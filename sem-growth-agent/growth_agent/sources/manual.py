"""Leads you add by hand, for places with no permitted API for searching:
TikTok comments, LinkedIn, Facebook groups, Quora, ResearchGate.

The agent never scrapes these sites. When you see a question there, run e.g.
  python -m growth_agent add-lead --platform quora --url https://... --text "How do I fix HTMT > 0.9?"
and it is triaged and drafted like any other lead. You post the approved reply yourself.
"""
from __future__ import annotations

import hashlib

MANUAL_PLATFORMS = ("tiktok", "linkedin", "facebook", "quora", "researchgate", "other")


def make_lead(platform: str, url: str, text: str, author: str | None = None, title: str | None = None) -> dict:
    return {
        "platform": platform, "source": f"{platform}:manual",
        "external_id": hashlib.sha1(url.encode()).hexdigest()[:16], "url": url, "author": author,
        "title": title, "text": text, "posted_at": None, "is_reply_to_us": 0, "is_own_channel": 0,
    }
