from growth_agent.guardrails import asks_if_ai, check_text
from growth_agent.utm import build_link


def test_banned_promises_and_ghostwriting(cfg):
    for bad in ["This kit guarantees you pass", "You will pass your VIVA", "I can write your thesis for you",
                "100% pass rate", "My students all passed"]:
        assert check_text(cfg, bad, "reddit"), bad
    assert check_text(cfg, "Prepare to defend confidently and avoid common examiner traps.", "reddit") == []


def test_one_link_max_and_link_permission(cfg):
    two = "see https://a.example and https://b.example"
    assert any("2 links" in p for p in check_text(cfg, two, "reddit"))
    assert check_text(cfg, "see https://a.example", "reddit", allow_link=False)


def test_x_counts_links_as_23_chars(cfg):
    text = "a" * 250 + " https://whop.com/" + "x" * 80
    assert check_text(cfg, text, "x") == []        # 250 + 1 + 23 = 274
    assert check_text(cfg, "a" * 281, "x")


def test_ai_disclosure_required_when_asked(cfg):
    assert asks_if_ai("Are you a bot?") and asks_if_ai("is this AI") and not asks_if_ai("I use AI tools")
    assert check_text(cfg, "Here is how to fix it.", "reddit", must_disclose_ai=True)
    assert check_text(cfg, "Here is how. (AI-assisted, reviewed by me.)", "reddit", must_disclose_ai=True) == []


def test_utm_link_matches_brief_format(cfg):
    assert build_link(cfg, "sem_guide", "tiktok", "shorts", "HTMT fix") == \
        "https://whop.com/your-store/sem-guide/?utm_source=tiktok&utm_medium=shorts&utm_campaign=htmt_fix"
