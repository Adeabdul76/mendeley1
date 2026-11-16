"""X (Twitter) API v2 via tweepy. Recent search needs a paid API tier; skipped if no token."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

from ..config import Config

PLATFORM = "x"


def available(cfg: Config) -> bool:
    return bool(cfg.env("X_BEARER_TOKEN"))


def can_post(cfg: Config) -> bool:
    return all(cfg.env(k) for k in ("X_API_KEY", "X_API_SECRET", "X_ACCESS_TOKEN", "X_ACCESS_SECRET"))


def fetch(cfg: Config) -> list[dict]:
    import tweepy

    s = cfg["scout"]
    client = tweepy.Client(bearer_token=cfg.env("X_BEARER_TOKEN"), wait_on_rate_limit=True)
    start = datetime.now(timezone.utc) - timedelta(hours=min(s["lookback_hours"], 167))
    leads: list[dict] = []
    for q in s["x_queries"]:
        res = client.search_recent_tweets(
            query=q, max_results=max(10, min(100, s["max_leads_per_source"])), start_time=start,
            tweet_fields=["created_at", "author_id"], expansions=["author_id"], user_fields=["username"])
        users = {u.id: u.username for u in (res.includes or {}).get("users", [])}
        for t in res.data or []:
            username = users.get(t.author_id, "i")
            leads.append({
                "platform": PLATFORM, "source": "x:search", "external_id": str(t.id),
                "url": f"https://x.com/{username}/status/{t.id}", "author": username, "title": None,
                "text": t.text, "posted_at": t.created_at.isoformat() if t.created_at else None,
                "is_reply_to_us": 0, "is_own_channel": 0,
            })
    return leads


def post_reply(cfg: Config, target_external_id: str, body: str) -> tuple[str, str]:
    import tweepy

    client = tweepy.Client(consumer_key=cfg.env("X_API_KEY"), consumer_secret=cfg.env("X_API_SECRET"),
                           access_token=cfg.env("X_ACCESS_TOKEN"), access_token_secret=cfg.env("X_ACCESS_SECRET"))
    res = client.create_tweet(text=body, in_reply_to_tweet_id=target_external_id)
    tid = res.data["id"]
    return str(tid), f"https://x.com/i/status/{tid}"
