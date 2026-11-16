"""Builds tracked Whop links, e.g.
https://whop.com/your-store/sem-guide/?utm_source=tiktok&utm_medium=shorts&utm_campaign=htmt_fix
"""
from __future__ import annotations

import re
from urllib.parse import urlencode

from .config import Config


def slugify(text: str, max_len: int = 40) -> str:
    s = re.sub(r"[^a-z0-9]+", "_", (text or "").lower()).strip("_")
    return s[:max_len].rstrip("_") or "general"


def build_link(cfg: Config, product_key: str, source: str, medium: str, campaign: str) -> str:
    product = cfg.products[product_key]
    base = cfg["store"]["base_url"].rstrip("/")
    query = urlencode({"utm_source": source, "utm_medium": medium, "utm_campaign": slugify(campaign)})
    return f"{base}/{product['slug']}/?{query}"
