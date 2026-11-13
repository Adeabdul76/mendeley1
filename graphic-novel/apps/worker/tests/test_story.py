import json
from pathlib import Path
from types import SimpleNamespace

import pytest

from apps.worker import llm as llm_mod
from apps.worker.cli import main
from apps.worker.llm import ClaudeClient, LLMError, PracticeClient, Usage, api_schema
from apps.worker.practice import make_responder
from apps.worker.story import check_book_rules, check_outline_rules, run_outline, run_script

FIXTURES = Path(__file__).resolve().parents[3] / "fixtures"


def brief() -> dict:
    return json.loads((FIXTURES / "family_adventure.json").read_text())


def test_api_schema_is_self_contained_and_stripped() -> None:
    for name in ("outline", "page"):
        text = json.dumps(api_schema(name))
        assert ".json" not in text  # no cross-file refs left
        for kw in ("minLength", "maxLength", "minItems", "maxItems", "pattern", "minimum"):
            assert f'"{kw}"' not in text


def test_practice_pipeline_end_to_end() -> None:
    b = brief()
    client = PracticeClient(make_responder(b))
    outline = run_outline(b, client)
    pages = run_script(b, outline, client)
    assert [p["page"] for p in pages] == list(range(3, 32))
    assert check_book_rules(pages, b) == []


def test_outline_gap_is_caught() -> None:
    b = brief()
    outline = make_responder(b)("outline", "")
    outline["beats"].pop(3)
    assert any("exactly once" in p for p in check_outline_rules(outline, b))


def test_outline_unknown_character_is_caught() -> None:
    b = brief()
    outline = make_responder(b)("outline", "")
    outline["beats"][0]["characters"].append("batman")
    assert any("unknown character" in p for p in check_outline_rules(outline, b))


def test_cli_practice_writes_files(tmp_path: Path) -> None:
    assert main(["storyboard", "--fixture", str(FIXTURES / "family_adventure.json"), "--out", str(tmp_path), "--practice"]) == 0
    html = (tmp_path / "storyboard.html").read_text()
    assert "Practice mode" in html and "Nora" in html
    assert len(json.loads((tmp_path / "pages.json").read_text())) == 29


# ---- ClaudeClient with a fake SDK (no network) ----

class FakeStream:
    def __init__(self, text: str, stop: str = "end_turn") -> None:
        self.msg = SimpleNamespace(
            model="claude-opus-5-5", stop_reason=stop,
            usage=SimpleNamespace(input_tokens=100, output_tokens=50),
            content=[SimpleNamespace(type="text", text=text)],
        )

    def __enter__(self): return self
    def __exit__(self, *a): return False
    def get_final_message(self): return self.msg


def fake_client(replies: list[FakeStream]) -> tuple[ClaudeClient, list[dict]]:
    calls: list[dict] = []

    def stream(**kwargs):
        calls.append(kwargs)
        return replies.pop(0)

    c = ClaudeClient.__new__(ClaudeClient)
    c._client = SimpleNamespace(beta=SimpleNamespace(messages=SimpleNamespace(stream=stream)))
    c.usage = Usage()
    return c, calls


def test_claude_client_retries_once_with_errors() -> None:
    b = brief()
    good = make_responder(b)("outline", "")
    bad = dict(good, beats=good["beats"][:-1])  # misses the last pages
    client, calls = fake_client([FakeStream(json.dumps(bad)), FakeStream(json.dumps(good))])
    assert run_outline(b, client) == good
    assert len(calls) == 2
    assert "broke these rules" in calls[1]["messages"][-1]["content"]
    assert calls[0]["model"] == "claude-opus-5-5"
    assert calls[0]["fallbacks"] == "default"
    assert "temperature" not in calls[0]
    assert client.usage.calls == 2


def test_claude_client_reports_refusal() -> None:
    client, _ = fake_client([FakeStream("", stop="refusal")])
    with pytest.raises(LLMError, match="declined"):
        run_outline(brief(), client)


def test_claude_client_needs_key(monkeypatch) -> None:
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    with pytest.raises(LLMError, match="ANTHROPIC_API_KEY"):
        ClaudeClient()
