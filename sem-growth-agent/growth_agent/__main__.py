"""Command line: python -m growth_agent <command>. Run with --help for the list."""
from __future__ import annotations

import argparse
import json
import logging
import os
import sys

from .config import DATA_DIR, get_config


def _llm(cfg, demo: bool):
    from .llm import LLM, FakeLLM

    return FakeLLM(cfg) if demo else LLM(cfg)


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(prog="growth_agent", description="SEM Growth Agent")
    ap.add_argument("--demo", action="store_true",
                    help="offline practice mode: sample leads, no API calls, separate data/demo.db")
    ap.add_argument("-v", "--verbose", action="store_true")
    sub = ap.add_subparsers(dest="cmd", required=True)
    sub.add_parser("run-daily", help="Scout -> Engager -> Creator (what the scheduler runs each morning)")
    sub.add_parser("scout", help="find and score new leads; writes data/leads.json")
    sub.add_parser("draft", help="draft replies for leads scoring 7+")
    sub.add_parser("create", help="create today's content drafts")
    sub.add_parser("review", help="approve / edit / reject drafts")
    sub.add_parser("publish", help="post the next approved reply if the rate limits allow")
    sub.add_parser("report", help="run the analyst now; writes reports/daily_YYYY-MM-DD.md")
    sub.add_parser("status", help="counts of leads and drafts")
    p = sub.add_parser("mark-posted", help="log a reply/content you posted by hand")
    p.add_argument("draft_id", type=int)
    p.add_argument("url")
    p = sub.add_parser("add-lead", help="add a question you saw on TikTok/LinkedIn/Facebook/Quora/ResearchGate")
    p.add_argument("--platform", required=True)
    p.add_argument("--url", required=True)
    p.add_argument("--text", required=True)
    p.add_argument("--author")
    sub.add_parser("whop-products", help="list your Whop products and their prod_ ids")
    sub.add_parser("auth-youtube", help="one-time sign-in so the agent can post approved YouTube replies")
    p = sub.add_parser("schedule", help="run forever: daily pipeline, publisher, nightly analyst")
    p.add_argument("--daily-at", default="08:00")
    args = ap.parse_args(argv)

    logging.basicConfig(level=logging.INFO if args.verbose or args.cmd == "schedule" else logging.WARNING,
                        format="%(asctime)s %(levelname)s %(message)s")
    if args.demo:
        os.environ["DATABASE_PATH"] = str(DATA_DIR / "demo.db")
    cfg = get_config()

    from . import db, publisher, review, whop_client
    from .agents import analyst, creator, engager, scout

    conn = db.connect()
    out: object = None
    if args.cmd == "run-daily":
        from .graph import run_daily

        llm = _llm(cfg, args.demo)
        if args.demo:
            _load_sample_leads(conn)
        out = run_daily(cfg, conn, llm)
    elif args.cmd == "scout":
        llm = _llm(cfg, args.demo)
        if args.demo:
            _load_sample_leads(conn)
            out = {"triaged": scout.triage(cfg, conn, llm)}
        else:
            out = scout.run(cfg, conn, llm)
    elif args.cmd == "draft":
        out = engager.run(cfg, conn, _llm(cfg, args.demo))
    elif args.cmd == "create":
        out = creator.run(cfg, conn, _llm(cfg, args.demo))
    elif args.cmd == "review":
        out = review.run(cfg, conn)
    elif args.cmd == "publish":
        if args.demo:
            out = publisher.tick(cfg, conn, poster=lambda c, d: ("demo", f"{d['target_url']}#demo-reply"))
        else:
            out = publisher.tick(cfg, conn) or "nothing to post right now (none approved, or waiting for the gap / daily cap)"
    elif args.cmd == "report":
        out = analyst.run(cfg, conn)
    elif args.cmd == "status":
        out = {
            "leads": {r["status"]: r["n"] for r in conn.execute("SELECT status, COUNT(*) n FROM leads GROUP BY status")},
            "drafts": {f"{r['kind']}:{r['status']}": r["n"] for r in
                       conn.execute("SELECT kind, status, COUNT(*) n FROM drafts GROUP BY kind, status")},
            "can_post_by_api": publisher.api_platforms(cfg),
        }
    elif args.cmd == "mark-posted":
        d = conn.execute("SELECT * FROM drafts WHERE id = ?", (args.draft_id,)).fetchone()
        if not d:
            print(f"No draft #{args.draft_id}")
            return 1
        if d["status"] not in ("approved", "failed"):
            print(f"Draft #{args.draft_id} is '{d['status']}'; approve it in `review` first.")
            return 1
        publisher.mark_posted(conn, d, args.url, posted_by="owner")
        out = "logged"
    elif args.cmd == "add-lead":
        from .sources.manual import make_lead

        lead_id = db.insert_lead(conn, make_lead(args.platform.lower(), args.url, args.text, args.author))
        out = f"added lead #{lead_id}; run `scout` then `draft` (or run-daily)" if lead_id else "already added"
    elif args.cmd == "whop-products":
        out = whop_client.list_products(cfg)
    elif args.cmd == "auth-youtube":
        from .sources import youtube

        youtube.authorize(cfg)
        out = "saved youtube_token.json"
    elif args.cmd == "schedule":
        from .scheduler import start

        start(cfg, _llm(cfg, args.demo), args.daily_at)

    if out is not None:
        print(out if isinstance(out, str) else json.dumps(out, indent=2, default=str))
    return 0


def _load_sample_leads(conn) -> None:
    from . import db

    with open(DATA_DIR / "sample_leads.json", encoding="utf-8") as f:
        for lead in json.load(f):
            db.insert_lead(conn, lead)


if __name__ == "__main__":
    sys.exit(main())
