"""Reddit via the official API (PRAW). Reads public posts; replies only after owner approval."""
from __future__ import annotations

import time
from datetime import datetime, timezone

from ..config import Config

PLATFORM = "reddit"


def available(cfg: Config) -> bool:
    return all(cfg.env(k) for k in ("REDDIT_CLIENT_ID", "REDDIT_CLIENT_SECRET", "REDDIT_USER_AGENT"))


def can_post(cfg: Config) -> bool:
    return available(cfg) and bool(cfg.env("REDDIT_USERNAME") and cfg.env("REDDIT_PASSWORD"))


def _client(cfg: Config):
    import praw  # imported lazily so the rest of the agent works without Reddit set up

    kwargs = dict(client_id=cfg.env("REDDIT_CLIENT_ID"), client_secret=cfg.env("REDDIT_CLIENT_SECRET"),
                  user_agent=cfg.env("REDDIT_USER_AGENT"), ratelimit_seconds=600)
    if cfg.env("REDDIT_USERNAME"):
        kwargs.update(username=cfg.env("REDDIT_USERNAME"), password=cfg.env("REDDIT_PASSWORD"))
    return praw.Reddit(**kwargs)


def _iso(ts: float) -> str:
    return datetime.fromtimestamp(ts, timezone.utc).isoformat(timespec="seconds")


def fetch(cfg: Config) -> list[dict]:
    s = cfg["scout"]
    reddit = _client(cfg)
    cutoff = time.time() - s["lookback_hours"] * 3600
    query = " OR ".join(f'"{k}"' for k in s["keywords"])
    leads: list[dict] = []
    for sub in s["reddit_subreddits"]:
        for post in reddit.subreddit(sub).search(query, sort="new", time_filter="week",
                                                  limit=s["max_leads_per_source"]):
            if post.created_utc < cutoff or post.locked or post.archived:
                continue
            leads.append({
                "platform": PLATFORM, "source": f"r/{sub}", "external_id": post.fullname,
                "url": f"https://www.reddit.com{post.permalink}",
                "author": str(post.author) if post.author else None,
                "title": post.title, "text": post.selftext or post.title,
                "posted_at": _iso(post.created_utc), "is_reply_to_us": 0, "is_own_channel": 0,
            })
    if reddit.read_only is False:
        # People who replied to one of our comments: always worth a (human-approved) answer.
        for c in reddit.inbox.comment_replies(limit=50):
            if c.created_utc < cutoff:
                continue
            leads.append({
                "platform": PLATFORM, "source": "reddit:inbox", "external_id": c.fullname,
                "url": f"https://www.reddit.com{c.permalink}", "author": str(c.author) if c.author else None,
                "title": None, "text": c.body, "posted_at": _iso(c.created_utc),
                "is_reply_to_us": 1, "is_own_channel": 0,
            })
    return leads


def post_reply(cfg: Config, target_external_id: str, body: str) -> tuple[str, str]:
    reddit = _client(cfg)
    kind, _, rid = target_external_id.partition("_")
    thing = reddit.submission(id=rid) if kind == "t3" else reddit.comment(id=rid)
    comment = thing.reply(body)
    return comment.fullname, f"https://www.reddit.com{comment.permalink}"
