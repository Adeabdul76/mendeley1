"""SCOUT: find people publicly asking for help, score them, write data/leads.json."""
from __future__ import annotations

import logging

from .. import db
from ..config import Config
from ..guardrails import asks_if_ai
from ..llm import LLMRefusal
from ..sources import reddit, x, youtube

log = logging.getLogger(__name__)
SOURCES = {"reddit": reddit, "youtube": youtube, "x": x}


def collect(cfg: Config, conn) -> int:
    """Pull new public posts from every configured source. Returns how many were new."""
    new = 0
    for name, src in SOURCES.items():
        if not src.available(cfg):
            log.info("scout: %s not configured, skipping", name)
            continue
        try:
            leads = src.fetch(cfg)
        except Exception as e:  # one broken source must not stop the others
            log.warning("scout: %s failed: %s", name, e)
            continue
        added = sum(1 for lead in leads if db.insert_lead(conn, lead))
        log.info("scout: %s returned %d posts, %d new", name, len(leads), added)
        new += added
    return new


def triage(cfg: Config, conn, llm, limit: int = 200) -> int:
    rows = conn.execute("SELECT * FROM leads WHERE status = 'new' ORDER BY id LIMIT ?", (limit,)).fetchall()
    for row in rows:
        lead = dict(row)
        try:
            t = llm.triage(lead)
        except LLMRefusal:
            conn.execute("UPDATE leads SET status = 'skipped' WHERE id = ?", (lead["id"],))
            continue
        except Exception as e:
            log.warning("triage failed for lead %s: %s", lead["id"], e)
            continue
        score = max(1, min(10, int(t.urgency_score)))
        # A reply to us, or a question on the owner's own post, is always worth answering.
        if lead["is_reply_to_us"] or lead["is_own_channel"]:
            score = max(score, int(cfg["scout"]["min_urgency"])) if t.is_help_request else score
        conn.execute(
            "UPDATE leads SET is_help_request = ?, user_problem = ?, urgency_score = ?, suggested_answer_angle = ?, "
            "product_fit = ?, asks_if_ai = ?, status = 'triaged' WHERE id = ?",
            (int(t.is_help_request), t.user_problem, score, t.suggested_answer_angle, t.product_fit,
             int(asks_if_ai(lead["text"])), lead["id"]))
    conn.commit()
    db.export_leads_json(conn)
    return len(rows)


def run(cfg: Config, conn, llm) -> dict:
    new = collect(cfg, conn)
    triaged = triage(cfg, conn, llm)
    return {"new_leads": new, "triaged": triaged}
