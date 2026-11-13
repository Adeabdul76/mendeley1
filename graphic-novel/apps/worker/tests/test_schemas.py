import copy
import json
from pathlib import Path

import pytest

from apps.worker.validation import SCHEMA_DIR, check_brief_rules, check_page_rules, schema_errors, validator

FIXTURES = Path(__file__).resolve().parents[3] / "fixtures"


def load(name: str) -> dict:
    return json.loads((FIXTURES / name).read_text(encoding="utf-8"))


@pytest.mark.parametrize("path", sorted(SCHEMA_DIR.glob("*.json")), ids=lambda p: p.name)
def test_every_schema_is_itself_valid(path: Path) -> None:
    validator(path.stem).check_schema(json.loads(path.read_text()))


def test_fixture_brief_is_valid() -> None:
    brief = load("family_adventure.json")
    assert schema_errors("brief", brief) == []
    assert check_brief_rules(brief) == []


def test_fixture_page_is_valid() -> None:
    page = load("page_sample.json")
    assert schema_errors("page", page) == []
    assert check_page_rules(page) == []


def test_brief_requires_consent() -> None:
    brief = load("family_adventure.json")
    brief["consent"]["photos_permission_confirmed"] = False
    assert any("consent" in e for e in schema_errors("brief", brief))


def test_page_count_must_be_multiple_of_4() -> None:
    brief = load("family_adventure.json")
    brief["page_count"] = 30
    assert schema_errors("brief", brief)


def test_photo_character_needs_at_least_two_photos() -> None:
    brief = load("family_adventure.json")
    c = brief["characters"][0]
    c["describe_only"] = False
    c["photo_ids"] = ["3f2b6c1e-0000-4000-8000-000000000001"]
    assert schema_errors("brief", brief)


def test_no_children_in_love_story() -> None:
    brief = load("family_adventure.json")
    brief["book_type"] = "love_story"
    assert "children cannot appear in a love story book" in check_brief_rules(brief)


def test_too_many_panels_rejected() -> None:
    page = load("page_sample.json")
    page["panels"] = [copy.deepcopy(page["panels"][0]) for _ in range(7)]
    assert schema_errors("page", page)


def test_long_bubble_flagged() -> None:
    page = load("page_sample.json")
    page["panels"][0]["dialogue"][0]["text"] = " ".join(["word"] * 26)
    assert any("26 words" in p for p in check_page_rules(page))


def test_speaker_must_be_present() -> None:
    page = load("page_sample.json")
    page["panels"][0]["dialogue"][0]["speaker"] = "biscuit"
    assert any("not listed" in p for p in check_page_rules(page))


def test_three_bubbles_for_one_character_flagged() -> None:
    page = load("page_sample.json")
    line = page["panels"][0]["dialogue"][0]
    page["panels"][0]["dialogue"] = [line, line, line]
    assert any("3 bubbles" in p for p in check_page_rules(page))


def test_duplicate_character_flagged() -> None:
    page = load("page_sample.json")
    chars = page["panels"][0]["characters"]
    chars.append(dict(chars[0]))
    assert any("listed twice" in p for p in check_page_rules(page))


def test_qa_result_shape() -> None:
    ok = {
        "character_count_ok": True, "identities_ok": True, "duplicate_character": False,
        "anatomy_ok": True, "extra_text_found": False, "matches_action": True, "safe": True,
        "notes": "", "face_boxes": [{"character_id": "nora", "box": [0.1, 0.1, 0.2, 0.2]}],
    }
    assert schema_errors("qa_result", ok) == []
    del ok["safe"]
    assert schema_errors("qa_result", ok)
