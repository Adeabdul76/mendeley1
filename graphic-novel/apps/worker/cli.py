"""Command line entry point.

    python -m apps.worker.cli storyboard --fixture fixtures/family_adventure.json --out out/ [--practice]
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path

from apps.worker.llm import ClaudeClient, LLMError, PracticeClient
from apps.worker.practice import make_responder
from apps.worker.storyboard import render
from apps.worker.story import check_book_rules, run_outline, run_script
from apps.worker.validation import check_brief_rules, schema_errors

# USD per million tokens (input, output). Used only for the cost line printed at the end.
PRICES = {"claude-opus-5-5": (4.0, 20.0), "claude-sonnet-5-5": (2.0, 10.0)}


def storyboard(args: argparse.Namespace) -> int:
    brief = json.loads(Path(args.fixture).read_text(encoding="utf-8"))
    problems = schema_errors("brief", brief) + check_brief_rules(brief)
    if problems:
        print("The brief has problems:\n- " + "\n- ".join(problems))
        return 1
    practice = args.practice or not os.environ.get("ANTHROPIC_API_KEY")
    if practice and not args.practice:
        print("No ANTHROPIC_API_KEY found, so running in practice mode (no AI, no cost).")
    llm = PracticeClient(make_responder(brief)) if practice else ClaudeClient()

    out = Path(args.out)
    page_dir = out / "pages"
    brief_file = out / "brief.json"
    brief_changed = brief_file.exists() and json.loads(brief_file.read_text(encoding="utf-8")) != brief
    if brief_changed:
        print("This is a different brief from the last run in this folder, so starting fresh.")
    if args.fresh or brief_changed:
        for f in [out / "outline.json", *page_dir.glob("p*.json")]:
            f.unlink(missing_ok=True)
    page_dir.mkdir(parents=True, exist_ok=True)
    brief_file.write_text(json.dumps(brief, ensure_ascii=False, indent=2), encoding="utf-8")

    def save_page(page: dict) -> None:
        (page_dir / f"p{page['page']:02d}.json").write_text(json.dumps(page, ensure_ascii=False, indent=2), encoding="utf-8")

    def load_saved() -> dict[int, dict]:
        saved = {}
        for f in page_dir.glob("p*.json"):
            data = json.loads(f.read_text(encoding="utf-8"))
            if not schema_errors("page", data):
                saved[data["page"]] = data
        return saved

    try:
        outline_file = out / "outline.json"
        if outline_file.exists() and not schema_errors("outline", json.loads(outline_file.read_text(encoding="utf-8"))):
            outline = json.loads(outline_file.read_text(encoding="utf-8"))
            print(f"Reusing saved outline: “{outline['title']}” (use --fresh to start over)")
        else:
            print("Writing the outline… (this can take 1–3 minutes)")
            outline = run_outline(brief, llm)
            outline_file.write_text(json.dumps(outline, ensure_ascii=False, indent=2), encoding="utf-8")
            print(f"  “{outline['title']}”, {len(outline['beats'])} beats")
        saved = load_saved()
        if saved:
            print(f"Reusing {len(saved)} saved pages.")
        print("Writing page scripts…")
        pages = run_script(brief, outline, llm, done=saved, save=save_page,
                           on_page=lambda i, n: print(f"  page {i}/{n}", flush=True))
    except LLMError as e:
        print(f"\nStopped: {e}")
        print("Finished work is saved. Run the same command again to continue from here.")
        return 1

    warnings = check_book_rules(pages, brief)
    (out / "pages.json").write_text(json.dumps(pages, ensure_ascii=False, indent=2), encoding="utf-8")
    (out / "storyboard.html").write_text(render(brief, outline, pages, warnings, practice), encoding="utf-8")

    cost = sum(i / 1e6 * PRICES.get(m, (0, 0))[0] + o / 1e6 * PRICES.get(m, (0, 0))[1] for m, (i, o) in llm.usage.by_model.items())
    print(f"Done: {len(pages)} pages, {llm.usage.calls} AI calls, about ${cost:.2f}.")
    for w in warnings:
        print(f"  check: {w}")
    print(f"Open {out / 'storyboard.html'}")
    return 0


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="apps.worker.cli")
    sub = parser.add_subparsers(dest="cmd", required=True)
    sb = sub.add_parser("storyboard", help="brief -> outline -> page scripts -> HTML storyboard")
    sb.add_argument("--fixture", required=True)
    sb.add_argument("--out", default="out")
    sb.add_argument("--practice", action="store_true", help="no AI calls; placeholder text")
    sb.add_argument("--fresh", action="store_true", help="ignore saved outline/pages and start over")
    args = parser.parse_args(argv)
    return storyboard(args)


if __name__ == "__main__":
    sys.exit(main())
