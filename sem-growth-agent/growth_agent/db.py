"""SQLite storage. One file: data/growth.db (swap for Postgres later via DATABASE_PATH)."""
from __future__ import annotations

import csv
import json
import os
import sqlite3
from datetime import datetime, timezone
from pathlib import Path

from .config import DATA_DIR

SCHEMA = """
CREATE TABLE IF NOT EXISTS leads (
    id INTEGER PRIMARY KEY,
    platform TEXT NOT NULL,
    source TEXT NOT NULL,              -- e.g. r/PhD, youtube:<video id>, x:search
    external_id TEXT NOT NULL,         -- id of the post/comment we would reply to
    url TEXT NOT NULL,
    author TEXT,
    title TEXT,
    text TEXT NOT NULL,
    posted_at TEXT,
    is_reply_to_us INTEGER DEFAULT 0,  -- they replied to one of our replies
    is_own_channel INTEGER DEFAULT 0,  -- comment on the owner's own post
    is_help_request INTEGER,
    user_problem TEXT,
    urgency_score INTEGER,
    suggested_answer_angle TEXT,
    product_fit TEXT,
    asks_if_ai INTEGER DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'new', -- new | triaged | drafted | skipped
    found_at TEXT NOT NULL,
    UNIQUE (platform, external_id)
);
CREATE TABLE IF NOT EXISTS drafts (
    id INTEGER PRIMARY KEY,
    kind TEXT NOT NULL,                -- reply | content
    lead_id INTEGER REFERENCES leads(id),
    platform TEXT NOT NULL,
    format TEXT,                       -- reply | shorts_script | thread | value_post ...
    pillar TEXT,
    topic TEXT,
    target_url TEXT,
    target_external_id TEXT,
    author TEXT,
    body TEXT NOT NULL,
    has_link INTEGER DEFAULT 0,
    product TEXT,
    utm_campaign TEXT,
    guardrail_notes TEXT,
    status TEXT NOT NULL DEFAULT 'pending', -- pending | approved | rejected | posted | failed | exported
    promo_code TEXT,
    created_at TEXT NOT NULL,
    reviewed_at TEXT,
    posted_at TEXT,
    posted_external_id TEXT,
    posted_url TEXT,
    error TEXT
);
CREATE TABLE IF NOT EXISTS promo_codes (
    code TEXT PRIMARY KEY,
    whop_id TEXT,
    draft_id INTEGER REFERENCES drafts(id),
    platform TEXT,
    author TEXT,
    utm_campaign TEXT,
    created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS sales (
    payment_id TEXT PRIMARY KEY,
    created_at TEXT NOT NULL,
    product_id TEXT,
    product_key TEXT,
    amount_usd REAL,
    promo_code_id TEXT,
    checkout_origin TEXT,
    utm_source TEXT,
    utm_campaign TEXT
);
CREATE TABLE IF NOT EXISTS kv (
    key TEXT PRIMARY KEY,
    value TEXT
);
"""

ENGAGEMENT_LOG_FIELDS = ["logged_at", "platform", "author", "target_url", "posted_url",
                         "draft_id", "has_link", "product", "utm_campaign", "posted_by"]


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def db_path() -> Path:
    return Path(os.environ.get("DATABASE_PATH", DATA_DIR / "growth.db"))


def connect(path: Path | None = None) -> sqlite3.Connection:
    p = Path(path or db_path())
    p.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(p)
    conn.row_factory = sqlite3.Row
    conn.executescript(SCHEMA)
    return conn


def kv_get(conn, key: str, default=None):
    row = conn.execute("SELECT value FROM kv WHERE key = ?", (key,)).fetchone()
    return json.loads(row["value"]) if row else default


def kv_set(conn, key: str, value) -> None:
    conn.execute("INSERT INTO kv(key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
                 (key, json.dumps(value)))
    conn.commit()


def insert_lead(conn, lead: dict) -> int | None:
    """Insert a new lead; returns its id, or None if we have seen it before."""
    cols = ["platform", "source", "external_id", "url", "author", "title", "text", "posted_at",
            "is_reply_to_us", "is_own_channel"]
    values = [lead.get(c) for c in cols]
    cur = conn.execute(
        f"INSERT OR IGNORE INTO leads ({', '.join(cols)}, found_at) VALUES ({', '.join('?' * len(cols))}, ?)",
        values + [now_iso()],
    )
    conn.commit()
    return cur.lastrowid if cur.rowcount else None


def log_engagement(draft: sqlite3.Row | dict, posted_url: str, posted_by: str,
                   path: Path | None = None) -> None:
    path = Path(path or os.environ.get("ENGAGEMENT_LOG", DATA_DIR / "engagement_log.csv"))
    new_file = not path.exists()
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "a", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=ENGAGEMENT_LOG_FIELDS)
        if new_file:
            w.writeheader()
        w.writerow({
            "logged_at": now_iso(), "platform": draft["platform"], "author": draft["author"],
            "target_url": draft["target_url"], "posted_url": posted_url, "draft_id": draft["id"],
            "has_link": draft["has_link"], "product": draft["product"],
            "utm_campaign": draft["utm_campaign"], "posted_by": posted_by,
        })


def export_leads_json(conn, path: Path | None = None) -> Path:
    """Write the ranked lead list to data/leads.json (fields from the brief, plus a few extras)."""
    path = Path(path or DATA_DIR / "leads.json")
    rows = conn.execute(
        "SELECT * FROM leads WHERE urgency_score IS NOT NULL ORDER BY urgency_score DESC, found_at DESC LIMIT 500"
    ).fetchall()
    out = [{
        "source": r["source"], "url": r["url"], "user_problem": r["user_problem"],
        "urgency_score": r["urgency_score"], "suggested_answer_angle": r["suggested_answer_angle"],
        "platform": r["platform"], "product_fit": r["product_fit"], "status": r["status"],
        "found_at": r["found_at"],
    } for r in rows]
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(out, indent=2, ensure_ascii=False), encoding="utf-8")
    return path
