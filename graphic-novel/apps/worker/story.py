"""Stages [3] outline and [4] page script (CLAUDE.md §4)."""

from __future__ import annotations

import json
from pathlib import Path
from string import Template
from typing import Any, Callable

from apps.worker.llm import LLMClient
from apps.worker.validation import check_page_rules

ROOT = Path(__file__).resolve().parents[2]
PROMPTS = Path(__file__).resolve().parent / "prompts"
LAYOUTS: dict[str, int] = {
    k: v for k, v in json.loads((ROOT / "assets/style/layouts/index.json").read_text()).items() if not k.startswith("_")
}

# CLAUDE.md §3: Opus for outline (and later polish/QA), Sonnet for page drafting.
OUTLINE_MODEL = "claude-opus-5-5"
SCRIPT_MODEL = "claude-sonnet-5-5"

LANGUAGE_NAMES = {"en": "English", "ms": "Bahasa Melayu"}

SYSTEM = (
    "You write original, all-ages personalised comic books. "
    "Reply only with JSON that matches the requested schema."
)


def _prompt(name: str, **values: Any) -> str:
    return Template((PROMPTS / f"{name}.md").read_text(encoding="utf-8")).substitute(**values)


def _characters_text(brief: dict[str, Any]) -> str:
    lines = []
    for c in brief["characters"]:
        bits = [f"- id `{c['id']}`: {c['name']}, {c['role']} ({c['age_group']})"]
        if c.get("is_main"):
            bits.append("MAIN CHARACTER")
        if c.get("traits"):
            bits.append("traits: " + ", ".join(c["traits"]))
        if c.get("customer_description"):
            bits.append("looks: " + c["customer_description"])
        lines.append("; ".join(bits))
    return "\n".join(lines)


def _brief_text(brief: dict[str, Any]) -> str:
    b = brief["brief"]
    parts = [f"Summary: {b['summary']}"]
    for key, label in [("occasion", "Occasion"), ("setting", "Setting"), ("tone", "Tone")]:
        if b.get(key):
            parts.append(f"{label}: {b[key]}")
    if b.get("inside_jokes"):
        parts.append("Inside jokes: " + "; ".join(b["inside_jokes"]))
    if b.get("avoid"):
        parts.append("Avoid: " + "; ".join(b["avoid"]))
    return "\n".join(parts)


def story_pages(page_count: int) -> range:
    """Pages Claude scripts: 3 .. second-to-last (last is the back cover)."""
    return range(3, page_count)


# ---------- rules beyond the schema ----------

def check_outline_rules(outline: dict[str, Any], brief: dict[str, Any]) -> list[str]:
    problems: list[str] = []
    pages = list(story_pages(brief.get("page_count", 32)))
    covered: list[int] = []
    known = {c["id"] for c in brief["characters"]}
    for beat in outline["beats"]:
        a, b = beat["page_range"]
        if b < a:
            problems.append(f"beat {beat['page_range']} runs backwards")
            continue
        covered.extend(range(a, b + 1))
        for cid in beat.get("characters", []):
            if cid not in known:
                problems.append(f"beat {beat['page_range']} uses unknown character id '{cid}'")
    if covered != pages:
        problems.append(f"beats must cover pages {pages[0]}-{pages[-1]} exactly once, in order")
    for c in brief["characters"]:
        n = sum(1 for beat in outline["beats"] if c["id"] in beat.get("characters", []))
        if n < 3:
            problems.append(f"{c['name']} appears in only {n} beats (needs 3+)")
    return problems


def fix_outline(outline: Any) -> Any:
    """Accept a one-page beat written as [5] and store it as [5, 5]."""
    if isinstance(outline, dict):
        for beat in outline.get("beats", []):
            pr = beat.get("page_range") if isinstance(beat, dict) else None
            if isinstance(pr, list) and len(pr) == 1:
                beat["page_range"] = [pr[0], pr[0]]
    return outline


def beat_for_page(outline: dict[str, Any], page: int) -> dict[str, Any]:
    for beat in outline["beats"]:
        if beat["page_range"][0] <= page <= beat["page_range"][1]:
            return beat
    raise KeyError(page)


def page_checker(page: int, known: set[str]) -> Callable[[dict[str, Any]], list[str]]:
    def check(data: dict[str, Any]) -> list[str]:
        problems = check_page_rules(data)
        if data.get("page") != page:
            problems.append(f"page must be {page}")
        layout = data.get("layout")
        if layout not in LAYOUTS:
            problems.append(f"layout '{layout}' is not one of {sorted(LAYOUTS)}")
        elif LAYOUTS[layout] != len(data.get("panels", [])):
            problems.append(f"layout {layout} needs exactly {LAYOUTS[layout]} panels")
        for i, panel in enumerate(data.get("panels", []), start=1):
            if panel.get("id") != f"p{page}-{i}":
                problems.append(f"panel {i} id must be p{page}-{i}")
            for ch in panel.get("characters", []):
                if ch["id"] not in known:
                    problems.append(f"{panel.get('id')}: unknown character '{ch['id']}'")
        return problems
    return check


def check_book_rules(pages: list[dict[str, Any]], brief: dict[str, Any]) -> list[str]:
    """Whole-book checks (§4 [3]): warnings shown to the team, not auto-fixed."""
    warnings: list[str] = []
    on_page: dict[str, int] = {c["id"]: 0 for c in brief["characters"]}
    for p in pages:
        present = {ch["id"] for panel in p["panels"] for ch in panel["characters"]}
        for cid in present & on_page.keys():
            on_page[cid] += 1
    for c in brief["characters"]:
        if on_page[c["id"]] < 3:
            warnings.append(f"{c['name']} is on only {on_page[c['id']]} pages (needs 3+)")
        if c.get("is_main") and pages and on_page[c["id"]] / len(pages) < 0.6:
            warnings.append(f"{c['name']} (main) is on {on_page[c['id']]}/{len(pages)} pages (needs 60%+)")
    return warnings


# ---------- stages ----------

def run_outline(brief: dict[str, Any], llm: LLMClient) -> dict[str, Any]:
    n = brief.get("page_count", 32)
    prompt = _prompt(
        "outline",
        book_type=brief["book_type"].replace("_", " "),
        language=LANGUAGE_NAMES[brief["language"]],
        page_count=n, last_page=n, ending_page=n - 1,
        characters=_characters_text(brief),
        brief=_brief_text(brief),
    )
    return llm.json_call(
        stage="outline", model=OUTLINE_MODEL, system=SYSTEM, prompt=prompt,
        schema="outline", effort="high", extra_check=lambda o: check_outline_rules(o, brief),
        fix=fix_outline,
    )


def run_script(brief: dict[str, Any], outline: dict[str, Any], llm: LLMClient,
               on_page: Callable[[int, int], None] | None = None,
               done: dict[int, dict[str, Any]] | None = None,
               save: Callable[[dict[str, Any]], None] | None = None) -> list[dict[str, Any]]:
    """Script every story page. Pages already in `done` are reused (no AI call);
    each new page is passed to `save` as soon as it is written."""
    known = {c["id"] for c in brief["characters"]}
    done = done or {}
    pages: list[dict[str, Any]] = []
    todo = list(story_pages(brief.get("page_count", 32)))
    outline_text = json.dumps(outline["beats"], ensure_ascii=False, indent=1)
    layouts_text = "\n".join(f"- {k}: {v}" for k, v in LAYOUTS.items())
    for i, page in enumerate(todo, start=1):
        if page in done:
            pages.append(done[page])
            if on_page:
                on_page(i, len(todo))
            continue
        prompt = _prompt(
            "script",
            language=LANGUAGE_NAMES[brief["language"]],
            layouts=layouts_text,
            title=outline["title"], logline=outline["logline"],
            characters=_characters_text(brief),
            outline=outline_text,
            previous=json.dumps(pages[-1], ensure_ascii=False) if pages else "(this is the first story page)",
            page=page,
            beat=json.dumps(beat_for_page(outline, page), ensure_ascii=False),
        )
        data = llm.json_call(
            stage=f"script p{page}", model=SCRIPT_MODEL, system=SYSTEM, prompt=prompt,
            schema="page", effort="medium", extra_check=page_checker(page, known),
        )
        pages.append(data)
        if save:
            save(data)
        if on_page:
            on_page(i, len(todo))
    return pages
