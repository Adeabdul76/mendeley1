"""Posts APPROVED replies, one at a time, within the rate limits:
- at most N replies per platform per day (default 20),
- a random 10-20 minute gap between any two replies,
- never the same person twice in 24h unless they replied to us.
Called every few minutes by the scheduler (or by hand: `python -m growth_agent publish`).
"""
from __future__ import annotations

import logging
import random
from datetime import datetime, timedelta, timezone

from . import db
from .config import Config
from .guardrails import same_user_ok, under_daily_cap
from .sources import reddit, x, youtube

log = logging.getLogger(__name__)
POSTERS = {"reddit": reddit, "youtube": youtube, "x": x}


def _post(cfg: Config, draft) -> tuple[str, str]:
    p = draft["platform"]
    if p == "youtube":
        return youtube.post_reply(cfg, draft["target_external_id"], draft["body"], draft["target_url"])
    return POSTERS[p].post_reply(cfg, draft["target_external_id"], draft["body"])


def api_platforms(cfg: Config) -> list[str]:
    return [p for p in cfg["engager"]["api_posting"] if p in POSTERS and POSTERS[p].can_post(cfg)]


def tick(cfg: Config, conn, now: datetime | None = None, poster=_post) -> dict | None:
    now = now or datetime.now(timezone.utc)
    next_at = db.kv_get(conn, "next_post_at")
    if next_at and now < datetime.fromisoformat(next_at):
        return None
    platforms = api_platforms(cfg) if poster is _post else list(cfg["engager"]["api_posting"])
    if not platforms:
        return None
    q = ",".join("?" * len(platforms))
    rows = conn.execute(
        f"SELECT d.*, COALESCE(l.is_reply_to_us, 0) AS is_reply_to_us FROM drafts d "
        f"LEFT JOIN leads l ON l.id = d.lead_id WHERE d.kind = 'reply' AND d.status = 'approved' "
        f"AND d.platform IN ({q}) ORDER BY d.reviewed_at, d.id", platforms).fetchall()
    for d in rows:
        if not under_daily_cap(cfg, conn, d["platform"]):
            continue
        if not same_user_ok(cfg, conn, d["platform"], d["author"], bool(d["is_reply_to_us"]), exclude_draft_id=d["id"]):
            continue
        try:
            ext_id, url = poster(cfg, d)
        except Exception as e:
            log.warning("publish failed for draft %s: %s", d["id"], e)
            conn.execute("UPDATE drafts SET status = 'failed', error = ? WHERE id = ?", (str(e)[:500], d["id"]))
            conn.commit()
            return {"draft_id": d["id"], "error": str(e)}
        mark_posted(conn, d, url, ext_id, posted_by="agent")
        gap = random.uniform(cfg["engager"]["min_gap_minutes"], cfg["engager"]["max_gap_minutes"])
        db.kv_set(conn, "next_post_at", (now + timedelta(minutes=gap)).isoformat())
        return {"draft_id": d["id"], "url": url, "next_in_minutes": round(gap, 1)}
    return None


def mark_posted(conn, draft, url: str, ext_id: str | None = None, posted_by: str = "owner") -> None:
    conn.execute("UPDATE drafts SET status = 'posted', posted_at = ?, posted_url = ?, posted_external_id = ?, "
                 "error = NULL WHERE id = ?", (db.now_iso(), url, ext_id, draft["id"]))
    conn.commit()
    db.log_engagement(draft, url, posted_by)
