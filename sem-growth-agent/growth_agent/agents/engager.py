"""ENGAGER: draft personal, value-first replies for high-intent leads.

Drafts go to the review queue. Nothing is posted until the owner approves it
(see review.py) and the publisher's rate limits allow it (see publisher.py).
"""
from __future__ import annotations

import logging

from .. import db
from ..config import Config
from ..guardrails import DISCLOSURE_RE, check_text, count_links, link_allowed, same_user_ok, too_similar
from ..llm import LLMRefusal
from ..utm import build_link, slugify

log = logging.getLogger(__name__)

# Platforms where a link in a comment cannot be clicked: point to the bio instead.
NO_CLICKABLE_LINKS = {"tiktok"}


def cta_line(cfg: Config, platform: str, product: str, campaign: str) -> str:
    p = cfg.products[product]
    if platform in NO_CLICKABLE_LINKS:
        return f"{p['reply_cta'].rstrip(':')} (link in my bio)."
    return f"{p['reply_cta']} {build_link(cfg, product, platform, 'reply', campaign)}"


def strip_cta(body: str) -> str:
    """Remove the trailing product paragraph (used when the link rule says 'no link this time')."""
    paras = body.rstrip().split("\n\n")
    kept = [p for p in paras if not (count_links(p) or "link in my bio" in p)]
    return "\n\n".join(kept or paras)


def ensure_disclosure(cfg: Config, body: str) -> str:
    return body if DISCLOSURE_RE.search(body) else f"{body}\n\n{cfg['engager']['ai_disclosure']}"


def compose(cfg: Config, conn, lead: dict, draft) -> tuple[str, bool, str]:
    """Return (body, has_link, campaign)."""
    campaign = slugify(lead.get("user_problem") or "reply", 30)
    body = draft.body.strip()
    has_link = False
    wants_cta = draft.product_would_directly_help and draft.product in cfg.products
    if wants_cta and link_allowed(cfg, conn):
        body = f"{body}\n\n{cta_line(cfg, lead['platform'], draft.product, campaign)}"
        has_link = lead["platform"] not in NO_CLICKABLE_LINKS
    if lead.get("asks_if_ai") or cfg["engager"]["always_disclose_ai"]:
        body = ensure_disclosure(cfg, body)
    return body, has_link, campaign


def run(cfg: Config, conn, llm, limit: int = 60) -> dict:
    min_score = int(cfg["scout"]["min_urgency"])
    rows = conn.execute(
        "SELECT * FROM leads WHERE status = 'triaged' AND is_help_request = 1 AND urgency_score >= ? "
        "ORDER BY is_reply_to_us DESC, urgency_score DESC, id LIMIT ?", (min_score, limit)).fetchall()
    drafted = skipped = 0
    for row in rows:
        lead = dict(row)
        if not same_user_ok(cfg, conn, lead["platform"], lead["author"], bool(lead["is_reply_to_us"])):
            continue  # try again tomorrow; stays 'triaged'
        try:
            d = llm.draft_reply(lead, must_disclose_ai=bool(lead["asks_if_ai"]))
        except LLMRefusal:
            conn.execute("UPDATE leads SET status = 'skipped' WHERE id = ?", (lead["id"],))
            skipped += 1
            continue
        except Exception as e:
            log.warning("draft failed for lead %s: %s", lead["id"], e)
            continue
        body, has_link, campaign = compose(cfg, conn, lead, d)
        notes = check_text(cfg, body, lead["platform"], must_disclose_ai=bool(lead["asks_if_ai"]),
                           allow_link=lead["platform"] not in NO_CLICKABLE_LINKS)
        if too_similar(conn, body):
            notes.append("too similar to an earlier reply: personalise it")
        conn.execute(
            "INSERT INTO drafts (kind, lead_id, platform, format, target_url, target_external_id, author, body, "
            "has_link, product, utm_campaign, guardrail_notes, created_at) "
            "VALUES ('reply', ?, ?, 'reply', ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (lead["id"], lead["platform"], lead["url"], lead["external_id"], lead["author"], body, int(has_link),
             d.product if d.product != "none" else None, campaign, "\n".join(notes) or None, db.now_iso()))
        conn.execute("UPDATE leads SET status = 'drafted' WHERE id = ?", (lead["id"],))
        conn.commit()
        drafted += 1
    # Leads below the bar are closed so they are not re-checked every day.
    conn.execute("UPDATE leads SET status = 'skipped' WHERE status = 'triaged' AND "
                 "(is_help_request = 0 OR urgency_score < ?)", (min_score,))
    conn.commit()
    db.export_leads_json(conn)
    return {"reply_drafts": drafted, "refused": skipped}
