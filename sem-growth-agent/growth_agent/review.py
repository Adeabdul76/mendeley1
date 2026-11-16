"""The approval queue. Nothing goes live without your yes.

    python -m growth_agent review

For each draft you can: [a]pprove, [e]dit, [r]eject, [s]kip, [d]iscount code (people who
replied to you or commented on your own posts only), [q]uit.
Approved replies for Reddit/YouTube/X are posted by the publisher with rate limits.
Approved replies for other platforms are shown with the link so you can post them by hand.
"""
from __future__ import annotations

import os
import subprocess
import tempfile
import textwrap

from . import db, whop_client
from .agents.engager import strip_cta
from .config import Config
from .guardrails import check_text, count_links, link_allowed, too_similar
from .publisher import api_platforms, mark_posted

RULE = "-" * 72


def _edit(text: str, ask=input) -> str:
    editor = os.environ.get("EDITOR")
    if editor:
        with tempfile.NamedTemporaryFile("w+", suffix=".md", delete=False, encoding="utf-8") as f:
            f.write(text)
            path = f.name
        subprocess.call([editor, path])
        with open(path, encoding="utf-8") as f:
            new = f.read().strip()
        os.unlink(path)
        return new
    print("Type the new text. Finish with a line containing only a dot (.)")
    lines = []
    while (line := ask("")) != ".":
        lines.append(line)
    return "\n".join(lines).strip() or text


def validate_for_approval(cfg: Config, conn, draft: dict, lead: dict | None) -> tuple[str, list[str], list[str]]:
    """Re-apply the rules at approval time. Returns (body, problems, notices)."""
    body, notices = draft["body"], []
    if draft["kind"] == "reply":
        allowed = link_allowed(cfg, conn)
        if count_links(body) and not allowed:
            body = strip_cta(body)
            notices.append("Link removed: only 1 link per 3 replies, and a recent reply already had one.")
        problems = check_text(cfg, body, draft["platform"], allow_link=allowed,
                              must_disclose_ai=bool(lead and lead["asks_if_ai"]))
        if too_similar(conn, body, exclude_draft_id=draft["id"]):
            problems.append("too similar to an earlier reply: personalise it")
    else:
        problems = [p for p in (draft["guardrail_notes"] or "").splitlines() if "banned" in p]
        problems += [p for p in check_text(cfg, body, "longform") if "banned" in p]
    return body, problems, notices


def show(draft: dict, lead: dict | None) -> None:
    print(RULE)
    if draft["kind"] == "reply":
        print(f"REPLY #{draft['id']} on {draft['platform']} to {draft['author'] or 'unknown'}"
              f"   urgency {lead['urgency_score'] if lead else '?'}/10")
        print(f"Their post: {draft['target_url']}")
        if lead:
            original = f"{lead['title'] or ''}\n{lead['text']}".strip()
            print(textwrap.indent(textwrap.shorten(original, 600, placeholder=' ...'), "  > "))
            print(f"Problem: {lead['user_problem']}")
    else:
        print(f"CONTENT #{draft['id']}: {draft['platform']} {draft['format']} | pillar {draft['pillar']}")
    if draft["guardrail_notes"]:
        print("Rule checks:\n" + textwrap.indent(draft["guardrail_notes"], "  ! "))
    print(RULE)
    print(draft["body"])
    print(RULE)


def run(cfg: Config, conn, ask=input) -> dict:
    stats = {"approved": 0, "rejected": 0, "skipped": 0}
    rows = conn.execute(
        "SELECT d.* FROM drafts d LEFT JOIN leads l ON l.id = d.lead_id WHERE d.status = 'pending' "
        "ORDER BY d.kind = 'content', COALESCE(l.is_reply_to_us, 0) DESC, COALESCE(l.urgency_score, 0) DESC, d.id"
    ).fetchall()
    if not rows:
        print("Nothing to review.")
    auto = set(api_platforms(cfg))
    for row in rows:
        draft = dict(row)
        lead = conn.execute("SELECT * FROM leads WHERE id = ?", (draft["lead_id"],)).fetchone() if draft["lead_id"] else None
        while True:
            show(draft, lead)
            engaged = bool(lead and (lead["is_reply_to_us"] or lead["is_own_channel"]))
            options = "[a]pprove [e]dit [r]eject [s]kip " + ("[d]iscount code " if engaged and draft["kind"] == "reply" else "") + "[q]uit"
            choice = ask(f"{options} > ").strip().lower()[:1]
            if choice == "q":
                return stats
            if choice == "s":
                stats["skipped"] += 1
                break
            if choice == "r":
                conn.execute("UPDATE drafts SET status = 'rejected', reviewed_at = ? WHERE id = ?", (db.now_iso(), draft["id"]))
                conn.commit()
                stats["rejected"] += 1
                break
            if choice == "e":
                draft["body"] = _edit(draft["body"], ask)
                draft["has_link"] = int(count_links(draft["body"]) > 0)
                _, problems, _ = validate_for_approval(cfg, conn, draft, lead)
                draft["guardrail_notes"] = "\n".join(problems) or None
                conn.execute("UPDATE drafts SET body = ?, has_link = ?, guardrail_notes = ? WHERE id = ?",
                             (draft["body"], draft["has_link"], draft["guardrail_notes"], draft["id"]))
                conn.commit()
                continue
            if choice == "d" and engaged:
                _add_discount(cfg, conn, draft, lead)
                continue
            if choice == "a":
                body, problems, notices = validate_for_approval(cfg, conn, draft, lead)
                for n in notices:
                    print(f"Note: {n}")
                if problems:
                    print("Cannot approve yet. Fix with [e]dit:\n" + "\n".join(f"  ! {p}" for p in problems))
                    draft["body"] = body
                    continue
                has_link = int(count_links(body) > 0)
                conn.execute("UPDATE drafts SET status = 'approved', body = ?, has_link = ?, reviewed_at = ?, "
                             "guardrail_notes = NULL WHERE id = ?", (body, has_link, db.now_iso(), draft["id"]))
                conn.commit()
                stats["approved"] += 1
                draft.update(body=body, has_link=has_link)
                if draft["kind"] == "reply" and draft["platform"] not in auto:
                    _manual_post(conn, draft, ask)
                elif draft["kind"] == "reply":
                    print("Queued. The publisher will post it within the rate limits.")
                else:
                    print("Approved. Post it from the content/ folder (or your scheduler), then run "
                          f"`python -m growth_agent mark-posted {draft['id']} <url>`.")
                break
    return stats


def _manual_post(conn, draft: dict, ask) -> None:
    print(f"\nPost this by hand here: {draft['target_url']}")
    url = ask("Paste the link to your posted reply (or press Enter to do it later) > ").strip()
    if url:
        mark_posted(conn, draft, url, posted_by="owner")
        print("Logged.")
    else:
        print(f"Later: python -m growth_agent mark-posted {draft['id']} <url>")


def _add_discount(cfg: Config, conn, draft: dict, lead) -> None:
    if not (whop_client.available(cfg) and cfg.env("WHOP_COMPANY_ID")):
        print("Set WHOP_API_KEY and WHOP_COMPANY_ID in .env to create discount codes.")
        return
    product = draft["product"] or lead["product_fit"]
    if product not in cfg.products:
        print("No product linked to this reply.")
        return
    try:
        code, whop_id = whop_client.create_single_use_code(cfg, product)
    except Exception as e:
        print(f"Whop refused the discount code: {e}")
        return
    conn.execute("INSERT INTO promo_codes (code, whop_id, draft_id, platform, author, utm_campaign, created_at) "
                 "VALUES (?, ?, ?, ?, ?, ?, ?)", (code, whop_id, draft["id"], draft["platform"], draft["author"],
                                                  draft["utm_campaign"], db.now_iso()))
    draft["body"] += f"\n\nSince you've been following along, here's a one-time 20% code for you: {code} (valid 14 days)."
    conn.execute("UPDATE drafts SET body = ?, promo_code = ? WHERE id = ?", (draft["body"], code, draft["id"]))
    conn.commit()
    print(f"Created single-use code {code}.")
