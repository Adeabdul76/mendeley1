"""CREATOR: 3 pieces of content a day plus 1 long-form piece a week.

Pieces are saved to content/YYYY-MM-DD/ as Markdown and queued for review.
Video scripts and posts are published by the owner (or via a scheduler such as
Buffer); the agent never auto-posts content.
"""
from __future__ import annotations

import logging
from datetime import datetime

from .. import db
from ..config import CONTENT_DIR, Config
from ..guardrails import check_text
from ..llm import LLMRefusal
from ..utm import build_link, slugify

log = logging.getLogger(__name__)

SEED_TOPICS = [
    "HTMT above 0.90: what it means and how to fix it",
    "AVE below 0.50: which items to check first",
    "Composite reliability vs Cronbach's alpha vs rho_A",
    "Bootstrapping settings in SmartPLS 4 (subsamples, one- vs two-tailed)",
    "Reporting a mediation analysis in PLS-SEM (specific indirect effects)",
    "Moderation in SmartPLS 4: two-stage approach and simple slope plots",
    "Measurement model before structural model: the checking order",
    "R-squared, f-squared and Q-squared: what examiners ask",
    "Collinearity (VIF) in the structural model",
    "Why your supervisor says 'model fit' and what to answer in PLS-SEM",
    "Defending your sample size and sampling method in the VIVA",
    "Common method bias: how to test and how to defend it",
]
MEDIUM = {"shorts_script": "shorts", "tiktok_script": "video", "thread": "thread", "value_post": "post",
          "post": "post", "longform": "longform"}


def _topics_for_today(conn, n: int, day_index: int) -> list[str]:
    topics: list[str] = list(db.kv_get(conn, "repeat_topics", []))  # analyst's winners first
    recent = conn.execute(
        "SELECT user_problem FROM leads WHERE urgency_score >= 7 AND found_at >= datetime('now', '-2 days') "
        "ORDER BY urgency_score DESC LIMIT 5").fetchall()
    topics += [f"A question students asked this week: {r['user_problem']}" for r in recent if r["user_problem"]]
    dropped = set(db.kv_get(conn, "drop_topics", []))
    seeds = SEED_TOPICS[day_index % len(SEED_TOPICS):] + SEED_TOPICS[: day_index % len(SEED_TOPICS)]
    topics += seeds
    out = []
    for t in topics:
        if slugify(t) not in dropped and t not in out:
            out.append(t)
    return out[:n]


def assemble(cfg: Config, piece, platform: str, fmt: str) -> tuple[str, str, bool, list[str]]:
    """Join parts, add the soft CTA (and a tracked link where the format allows). Returns
    (text, campaign, has_link, guardrail problems)."""
    product = piece.product if piece.product in cfg.products else "sem_guide"
    campaign = slugify(piece.topic)
    link = build_link(cfg, product, platform, MEDIUM[fmt], campaign)
    cta = cfg.products[product]["cta"]
    problems: list[str] = []

    if fmt == "thread":
        tweets = [t.strip() for t in piece.parts if t.strip()][:7]
        tweets[-1] = f"{tweets[-1]}\n\nFull guide: {cfg.products[product]['name']} {link}"
        for i, t in enumerate(tweets, 1):
            problems += [f"tweet {i}: {p}" for p in check_text(cfg, t, "x")]
        text = "\n\n---\n\n".join(tweets)
        return text, campaign, True, problems

    body = "\n\n".join(p.strip() for p in piece.parts if p.strip())
    has_link = False
    if platform == "reddit":
        body += "\n\n" + cfg["creator"]["reddit_cta"]   # no link in Reddit posts; link only if asked
    elif platform == "linkedin":
        body += f"\n\n{cta.replace('Link in bio.', '').strip()} {link}"
        has_link = True
    else:
        body += "\n\n" + cta
    platform_key = platform if platform in ("reddit", "linkedin") else "other"
    if fmt in ("shorts_script", "tiktok_script", "longform"):
        platform_key = "longform"  # scripts are read aloud, not posted as text; no character cap
    problems += [p for p in check_text(cfg, body, platform_key) if "characters" not in p or platform_key != "longform"]
    if not has_link:
        body += f"\n\n<!-- Bio / description link for this piece: {link} -->"
    return body, campaign, has_link, problems


def run(cfg: Config, conn, llm, today: datetime | None = None) -> dict:
    today = today or datetime.now(cfg.tz)
    c = cfg["creator"]
    day_index = today.toordinal()
    formats = c["formats"]
    pillars = list(c["pillars"].items())
    plan = [(formats[(day_index + i) % len(formats)], pillars[(day_index + i) % len(pillars)])
            for i in range(int(c["pieces_per_day"]))]
    if today.strftime("%A").lower() == c["longform_weekday"].lower():
        plan.append((["youtube", "longform"], pillars[day_index % len(pillars)]))
    topics = _topics_for_today(conn, len(plan), day_index)

    out_dir = CONTENT_DIR / today.strftime("%Y-%m-%d")
    out_dir.mkdir(parents=True, exist_ok=True)
    made = 0
    for i, ((platform, fmt), (pillar_key, pillar_desc)) in enumerate(plan):
        topic = topics[i % len(topics)]
        try:
            piece = llm.create_content(platform=platform, fmt=fmt, pillar=pillar_desc, topic_hint=topic)
        except LLMRefusal:
            continue
        except Exception as e:
            log.warning("content generation failed (%s/%s): %s", platform, fmt, e)
            continue
        text, campaign, has_link, problems = assemble(cfg, piece, platform, fmt)
        cur = conn.execute(
            "INSERT INTO drafts (kind, platform, format, pillar, topic, body, has_link, product, utm_campaign, "
            "guardrail_notes, created_at) VALUES ('content', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (platform, fmt, pillar_key, piece.topic, f"# {piece.title}\n\n{text}", int(has_link),
             piece.product if piece.product != "none" else "sem_guide", campaign,
             "\n".join(problems) or None, db.now_iso()))
        path = out_dir / f"{i + 1:02d}_{platform}_{fmt}_{campaign}.md"
        path.write_text(
            f"<!-- draft #{cur.lastrowid} | pillar: {pillar_key} | status: needs review -->\n# {piece.title}\n\n{text}\n",
            encoding="utf-8")
        made += 1
    conn.commit()
    return {"content_drafts": made, "folder": str(out_dir)}
