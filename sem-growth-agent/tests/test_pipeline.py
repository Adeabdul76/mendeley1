import csv
from datetime import datetime, timedelta, timezone

from growth_agent import db, publisher, review
from growth_agent.agents import analyst, creator, engager, scout
from growth_agent.guardrails import count_links
from growth_agent.graph import run_daily


def _seed(conn, leads):
    for lead in leads:
        db.insert_lead(conn, lead)


def _approve_all(cfg, conn, n):
    answers = iter(["a", ""] * n + ["q"])
    return review.run(cfg, conn, ask=lambda _="": next(answers))


def test_scout_scores_and_only_7plus_get_drafts(cfg, conn, llm, sample_leads, env):
    _seed(conn, sample_leads)
    scout.triage(cfg, conn, llm)
    assert (env / "leads.json").exists()
    out = engager.run(cfg, conn, llm)
    assert out["reply_drafts"] == 3                                      # the celebration post is skipped
    assert conn.execute("SELECT status FROM leads WHERE external_id = 'demo004'").fetchone()[0] == "skipped"


def test_link_ratio_one_in_three_at_approval(cfg, conn, llm, sample_leads):
    _seed(conn, sample_leads)
    scout.triage(cfg, conn, llm)
    engager.run(cfg, conn, llm)
    _approve_all(cfg, conn, 3)
    rows = conn.execute("SELECT body, has_link FROM drafts WHERE kind = 'reply' ORDER BY id").fetchall()
    assert [r["has_link"] for r in rows] == [1, 0, 0]
    assert all(count_links(r["body"]) == r["has_link"] for r in rows)
    disclosed = rows[2]["body"]                                        # lead 3 asked "are you a bot?"
    assert "AI-assisted" in disclosed and disclosed.count("AI") <= 2


def test_publisher_respects_gap_cap_and_same_user(cfg, conn, llm, sample_leads):
    _seed(conn, sample_leads)
    scout.triage(cfg, conn, llm)
    engager.run(cfg, conn, llm)
    for d in conn.execute("SELECT id FROM drafts WHERE kind = 'reply'"):
        conn.execute("UPDATE drafts SET status = 'approved', reviewed_at = ? WHERE id = ?", (db.now_iso(), d["id"]))
    conn.commit()
    fake = lambda c, d: (f"ext{d['id']}", f"{d['target_url']}#r")
    t0 = datetime.now(timezone.utc)
    first = publisher.tick(cfg, conn, now=t0, poster=fake)
    assert first and 10 <= first["next_in_minutes"] <= 20
    assert publisher.tick(cfg, conn, now=t0 + timedelta(minutes=5), poster=fake) is None   # inside the gap
    assert publisher.tick(cfg, conn, now=t0 + timedelta(minutes=21), poster=fake)
    log = list(csv.DictReader(open(db.os.environ["ENGAGEMENT_LOG"])))
    assert len(log) == 2 and log[0]["posted_by"] == "agent"

    # daily cap: pretend 20 replies already went out on reddit today
    for i in range(20):
        conn.execute("INSERT INTO drafts (kind, platform, body, status, posted_at, created_at, author) "
                     "VALUES ('reply', 'reddit', 'x', 'posted', ?, ?, ?)", (db.now_iso(), db.now_iso(), f"u{i}"))
    conn.commit()
    from growth_agent.guardrails import under_daily_cap, same_user_ok
    assert not under_daily_cap(cfg, conn, "reddit")
    assert not same_user_ok(cfg, conn, "reddit", "u3", False)
    assert same_user_ok(cfg, conn, "reddit", "u3", True)               # they replied back to us


def test_creator_formats(cfg, conn, llm):
    out = creator.run(cfg, conn, llm, today=datetime(2026, 11, 15, 8, tzinfo=cfg.tz))  # a Sunday
    assert out["content_drafts"] == 4                                  # 3 daily + weekly long-form
    rows = {r["format"]: r for r in conn.execute("SELECT * FROM drafts WHERE kind = 'content'")}
    assert "longform" in rows
    for r in rows.values():
        if r["format"] == "thread":
            tweets = r["body"].split("\n\n---\n\n")
            assert len(tweets) == 7 and count_links(tweets[-1]) == 1 and r["guardrail_notes"] is None
        if r["platform"] == "reddit":
            assert count_links(r["body"].split("<!--")[0]) == 0


def test_analyst_attributes_sales_via_promo_code(cfg, conn, env, monkeypatch):
    from growth_agent import whop_client
    conn.execute("INSERT INTO promo_codes (code, whop_id, platform, utm_campaign, created_at) "
                 "VALUES ('SEMABC', 'promo_1', 'reddit', 'htmt_fix', ?)", (db.now_iso(),))
    conn.commit()
    monkeypatch.setattr(whop_client, "available", lambda c: True)
    monkeypatch.setattr(whop_client, "list_paid_payments", lambda c, s, e: [
        {"payment_id": "pay_1", "created_at": db.now_iso(), "product_id": "prod_1", "product_key": "sem_guide",
         "amount_usd": 49.0, "promo_code_id": "promo_1", "checkout_origin": None, "utm_source": None, "utm_campaign": None}])
    day = datetime.now(cfg.tz).strftime("%Y-%m-%d")
    (env / "clicks.csv").write_text(f"date,utm_source,utm_campaign,clicks\n{day},reddit,htmt_fix,12\n{day},x,viva_mediation,3\n")
    out = analyst.run(cfg, conn)
    md = open(out["report"]).read()
    assert "Sales: **1**" in md and "htmt_fix" in md
    assert db.kv_get(conn, "repeat_topics")[0] == "htmt_fix"


def test_daily_graph_runs(cfg, conn, llm, sample_leads):
    _seed(conn, sample_leads)
    result = run_daily(cfg, conn, llm)
    assert set(result) == {"scout", "engager", "creator"}
    assert result["engager"]["reply_drafts"] == 3
