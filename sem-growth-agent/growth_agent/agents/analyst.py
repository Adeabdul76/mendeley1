"""ANALYST: nightly report. Pulls Whop sales, clicks and content metrics, scores each topic
(utm_campaign), and tells the Creator what to repeat tomorrow and what to drop.

Data sources:
- Whop payments API: sales. Attributed to a topic through the single-use discount code
  given in a reply, or through utm_* metadata when Whop records it.
- data/clicks.csv (optional): date,utm_source,utm_campaign,clicks
  Whop's API does not expose link clicks, so export them from your link tool or
  Whop dashboard and save them here.
- data/content_metrics.csv (optional): date,platform,utm_campaign,views,saves,comments
  Numbers you copy from YouTube Studio / TikTok / X / LinkedIn analytics.
"""
from __future__ import annotations

import csv
import json
import logging
from collections import defaultdict
from datetime import datetime, timedelta, timezone

from .. import db, whop_client
from ..config import DATA_DIR, REPORTS_DIR, Config

log = logging.getLogger(__name__)
SOURCES = ("youtube", "tiktok", "reddit", "x", "linkedin")


def _read_csv(path, day: str) -> list[dict]:
    if not path.exists():
        return []
    with open(path, encoding="utf-8") as f:
        return [r for r in csv.DictReader(f) if r.get("date") == day]


def _num(v) -> float:
    try:
        return float(v or 0)
    except ValueError:
        return 0.0


def sync_sales(cfg: Config, conn, start: datetime, end: datetime) -> list[dict]:
    if not whop_client.available(cfg):
        return []
    payments = whop_client.list_paid_payments(cfg, start, end)
    promo = {r["whop_id"]: r for r in conn.execute("SELECT * FROM promo_codes").fetchall()}
    for p in payments:
        code = promo.get(p["promo_code_id"] or "")
        if code and not p["utm_campaign"]:
            p["utm_campaign"], p["utm_source"] = code["utm_campaign"], code["platform"]
        conn.execute(
            "INSERT OR REPLACE INTO sales (payment_id, created_at, product_id, product_key, amount_usd, "
            "promo_code_id, checkout_origin, utm_source, utm_campaign) VALUES (?,?,?,?,?,?,?,?,?)",
            (p["payment_id"], p["created_at"], p["product_id"], p["product_key"], p["amount_usd"],
             p["promo_code_id"], p["checkout_origin"], p["utm_source"], p["utm_campaign"]))
    conn.commit()
    return payments


def run(cfg: Config, conn, day: datetime | None = None) -> dict:
    day = day or datetime.now(cfg.tz)
    start = day.replace(hour=0, minute=0, second=0, microsecond=0)
    end = start + timedelta(days=1)
    dstr = start.strftime("%Y-%m-%d")
    w = cfg["analyst"]

    errors = []
    try:
        sales = sync_sales(cfg, conn, start, end)
    except Exception as e:
        log.warning("analyst: Whop sales failed: %s", e)
        errors.append(f"Whop sales could not be loaded: {e}")
        sales = []

    clicks = _read_csv(DATA_DIR / "clicks.csv", dstr)
    metrics = _read_csv(DATA_DIR / "content_metrics.csv", dstr)

    topics: dict[str, dict] = defaultdict(lambda: defaultdict(float))
    clicks_by_source: dict[str, float] = defaultdict(float)
    for r in clicks:
        topics[r["utm_campaign"]]["clicks"] += _num(r["clicks"])
        clicks_by_source[r["utm_source"]] += _num(r["clicks"])
    for r in metrics:
        t = topics[r["utm_campaign"]]
        for k in ("views", "saves", "comments"):
            t[k] += _num(r.get(k))
    for s in sales:
        if s["utm_campaign"]:
            topics[s["utm_campaign"]]["sales"] += 1
            topics[s["utm_campaign"]]["revenue"] += s["amount_usd"]

    scored = []
    for name, t in topics.items():
        ctr = t["clicks"] / t["views"] if t["views"] else 0.0
        score = (w["sale_weight"] * t["sales"] + w["click_weight"] * t["clicks"] + w["comment_weight"] * t["comments"]
                 + w["save_weight"] * t["saves"] + w["view_weight"] * t["views"])
        scored.append({"topic": name, "score": round(score, 2), "ctr": round(ctr, 4), **{k: t[k] for k in
                       ("sales", "revenue", "clicks", "views", "saves", "comments")}})
    scored.sort(key=lambda r: r["score"], reverse=True)
    repeat = [r["topic"] for r in scored[:3]]
    drop = [r["topic"] for r in scored[3:][-2:]] if len(scored) >= 5 else []
    db.kv_set(conn, "repeat_topics", repeat)
    db.kv_set(conn, "drop_topics", drop)

    s_iso, e_iso = (d.astimezone(timezone.utc).isoformat(timespec="seconds") for d in (start, end))
    posted = conn.execute(
        "SELECT platform, COUNT(*) n, SUM(has_link) links FROM drafts WHERE kind = 'reply' AND status = 'posted' "
        "AND posted_at >= ? AND posted_at < ? GROUP BY platform", (s_iso, e_iso)).fetchall()
    leads = conn.execute("SELECT COUNT(*) n, SUM(urgency_score >= ?) hot FROM leads WHERE found_at >= ? AND found_at < ?",
                         (cfg["scout"]["min_urgency"], s_iso, e_iso)).fetchone()
    pending = conn.execute("SELECT COUNT(*) n FROM drafts WHERE status = 'pending'").fetchone()["n"]

    report = {
        "date": dstr,
        "sales": {"count": len(sales), "revenue_usd": round(sum(s["amount_usd"] for s in sales), 2),
                  "by_product": _count_by(sales, "product_key"), "attributed": sum(1 for s in sales if s["utm_campaign"])},
        "clicks_by_source": {s: clicks_by_source.get(s, 0) for s in SOURCES},
        "replies_posted": {r["platform"]: {"replies": r["n"], "with_link": r["links"] or 0} for r in posted},
        "leads": {"found": leads["n"] or 0, "score_7_plus": leads["hot"] or 0},
        "drafts_waiting_for_review": pending,
        "topics": scored,
        "repeat_tomorrow": repeat,
        "drop": drop,
        "errors": errors,
    }
    REPORTS_DIR.mkdir(parents=True, exist_ok=True)
    (REPORTS_DIR / f"daily_{dstr}.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
    md_path = REPORTS_DIR / f"daily_{dstr}.md"
    md_path.write_text(to_markdown(report), encoding="utf-8")
    return {"report": str(md_path), "sales": report["sales"]["count"]}


def _count_by(rows, key) -> dict:
    out: dict = defaultdict(int)
    for r in rows:
        out[r[key] or "unknown"] += 1
    return dict(out)


def to_markdown(r: dict) -> str:
    lines = [f"# Daily report: {r['date']}", "",
             "North Star: Whop sales.", "",
             "## Sales",
             f"- Sales: **{r['sales']['count']}** (USD {r['sales']['revenue_usd']:.2f})",
             f"- By product: {r['sales']['by_product'] or 'none'}",
             f"- Linked to a topic: {r['sales']['attributed']} of {r['sales']['count']}", "",
             "## Clicks by source",
             *[f"- {s}: {int(n)}" for s, n in r["clicks_by_source"].items()], "",
             "## Engagement",
             f"- Leads found: {r['leads']['found']} ({r['leads']['score_7_plus']} scored 7+)",
             *[f"- {p}: {v['replies']} replies ({v['with_link']} with a link)" for p, v in r["replies_posted"].items()],
             f"- Drafts waiting for your review: {r['drafts_waiting_for_review']}", "",
             "## Topics", ""]
    if r["topics"]:
        lines += ["| Topic | Score | Sales | Clicks | Views | Saves | Comments | CTR |",
                  "|---|---|---|---|---|---|---|---|"]
        lines += [f"| {t['topic']} | {t['score']} | {int(t['sales'])} | {int(t['clicks'])} | {int(t['views'])} | "
                  f"{int(t['saves'])} | {int(t['comments'])} | {t['ctr']:.1%} |" for t in r["topics"]]
    else:
        lines.append("No topic data yet. Add data/clicks.csv or data/content_metrics.csv to score topics.")
    lines += ["", "## Recommendation",
              f"- Repeat tomorrow: {', '.join(r['repeat_tomorrow']) or 'not enough data yet'}",
              f"- Drop: {', '.join(r['drop']) or 'not enough data yet'}"]
    if r["errors"]:
        lines += ["", "## Problems", *[f"- {e}" for e in r["errors"]]]
    return "\n".join(lines) + "\n"
