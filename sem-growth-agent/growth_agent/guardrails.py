"""Hard rules from CLAUDE.md, enforced in code (not just in prompts).

Every draft passes through check_text() before it reaches the review queue, and
again after the owner edits it. Posting re-checks the rate and link rules.
"""
from __future__ import annotations

import difflib
import re
from datetime import datetime, timedelta, timezone

from .config import Config

LINK_RE = re.compile(r"https?://\S+", re.I)
ASKS_IF_AI_RE = re.compile(
    r"\b(are|r) (you|u) (a |an )?(bot|ai|real|human|chatgpt|gpt)\b|\bis this (a )?(bot|ai)\b", re.I)
DISCLOSURE_RE = re.compile(r"\bAI\b|\bAI-assisted\b|artificial intelligence", re.I)


def count_links(text: str) -> int:
    return len(LINK_RE.findall(text or ""))


def asks_if_ai(text: str) -> bool:
    return bool(ASKS_IF_AI_RE.search(text or ""))


def check_text(cfg: Config, body: str, platform: str, *, allow_link: bool = True,
               must_disclose_ai: bool = False) -> list[str]:
    """Return a list of rule violations. Empty list = OK."""
    problems: list[str] = []
    g = cfg["guardrails"]
    for pattern in g["banned_patterns"]:
        if re.search(pattern, body or "", re.I):
            problems.append(f"banned phrase matched /{pattern}/ (no guarantees, no ghostwriting, no fake proof)")
    links = count_links(body)
    if links > 1:
        problems.append(f"{links} links; maximum is 1")
    if links and not allow_link:
        problems.append("link not allowed here (link ratio rule or platform rule)")
    limit = g["max_chars"].get(platform, g["max_chars"]["other"])
    length = len(LINK_RE.sub("x" * 23, body or "")) if platform == "x" else len(body or "")  # X counts links as 23
    if length > limit:
        problems.append(f"{length} characters; {platform} limit is {limit}")
    if must_disclose_ai and not DISCLOSURE_RE.search(body or ""):
        problems.append("they asked if this is a bot/AI: the reply must say it is AI-assisted")
    if not (body or "").strip():
        problems.append("empty text")
    return problems


def _recent_replies(conn, statuses=("approved", "posted")):
    q = ",".join("?" * len(statuses))
    return conn.execute(
        f"SELECT * FROM drafts WHERE kind = 'reply' AND status IN ({q}) "
        "ORDER BY COALESCE(posted_at, reviewed_at, created_at) DESC", statuses)


def link_allowed(cfg: Config, conn) -> bool:
    """At most 1 link in any `link_window` consecutive replies (default: 1 per 3)."""
    window = int(cfg["engager"]["link_window"])
    recent = _recent_replies(conn).fetchmany(window - 1)
    return not any(r["has_link"] for r in recent)


def same_user_ok(cfg: Config, conn, platform: str, author: str | None, is_reply_to_us: bool,
                 exclude_draft_id: int | None = None) -> bool:
    """Never reply to the same person twice in 24h, unless they replied to us."""
    if not author or is_reply_to_us:
        return True
    hours = int(cfg["engager"]["same_user_cooldown_hours"])
    since = (datetime.now(timezone.utc) - timedelta(hours=hours)).isoformat(timespec="seconds")
    row = conn.execute(
        "SELECT COUNT(*) AS n FROM drafts WHERE kind = 'reply' AND platform = ? AND lower(author) = lower(?) "
        "AND id != ? AND (status = 'posted' AND posted_at >= ? OR status IN ('approved', 'pending'))",
        (platform, author, exclude_draft_id or -1, since)).fetchone()
    return row["n"] == 0


def daily_count(conn, platform: str, tz) -> int:
    start_local = datetime.now(tz).replace(hour=0, minute=0, second=0, microsecond=0)
    start = start_local.astimezone(timezone.utc).isoformat(timespec="seconds")
    row = conn.execute(
        "SELECT COUNT(*) AS n FROM drafts WHERE kind = 'reply' AND platform = ? AND status = 'posted' "
        "AND posted_at >= ?", (platform, start)).fetchone()
    return row["n"]


def under_daily_cap(cfg: Config, conn, platform: str) -> bool:
    return daily_count(conn, platform, cfg.tz) < int(cfg["engager"]["max_replies_per_day_per_platform"])


def too_similar(conn, body: str, threshold: float = 0.8, exclude_draft_id: int | None = None) -> bool:
    """Blocks copy-paste replies: compare with the last 50 reply drafts."""
    rows = conn.execute(
        "SELECT body FROM drafts WHERE kind = 'reply' AND id != ? ORDER BY id DESC LIMIT 50",
        (exclude_draft_id or -1,)).fetchall()
    strip = lambda t: LINK_RE.sub("", t or "").lower()
    target = strip(body)
    return any(difflib.SequenceMatcher(None, target, strip(r["body"])).ratio() > threshold for r in rows)
