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


def test_rerun_reuses_saved_work(tmp_path: Path) -> None:
    fixture = str(FIXTURES / "family_adventure.json")
    assert main(["storyboard", "--fixture", fixture, "--out", str(tmp_path), "--practice"]) == 0
    # Drop five pages, as if the first run had stopped part-way.
    for n in range(27, 32):
        (tmp_path / "pages" / f"p{n:02d}.json").unlink()
    b = json.loads(Path(fixture).read_text())
    calls: list[str] = []
    responder = make_responder(b)
    client = PracticeClient(lambda stage, prompt: (calls.append(stage), responder(stage, prompt))[1])
    outline = json.loads((tmp_path / "outline.json").read_text())
    saved = {json.loads(f.read_text())["page"]: json.loads(f.read_text()) for f in (tmp_path / "pages").glob("p*.json")}
    pages = run_script(b, outline, client, done=saved)
    assert len(pages) == 29
    assert calls == [f"script p{n}" for n in range(27, 32)]


def test_long_pose_now_allowed() -> None:
    from apps.worker.validation import schema_errors
    page = json.loads((FIXTURES / "page_sample.json").read_text())
    page["panels"][0]["characters"][0]["pose"] = "holding the upside-down map close, tilting her head, glasses slightly low on her nose"
    assert schema_errors("page", page) == []


def test_one_number_page_range_is_accepted() -> None:
    b = brief()
    outline = make_responder(b)("outline", "")
    # Make beat 0 a single page written as [3], shifting the next beat to start at 4.
    outline["beats"][0]["page_range"] = [3]
    outline["beats"].insert(1, dict(outline["beats"][0], page_range=[4]))
    client, _ = fake_client([FakeStream(json.dumps(outline))])
    result = run_outline(b, client)
    assert result["beats"][0]["page_range"] == [3, 3]


def test_bad_shape_gets_retry_not_crash() -> None:
    b = brief()
    good = make_responder(b)("outline", "")
    bad = json.loads(json.dumps(good))
    bad["beats"][0]["page_range"] = [3, 4, 5]  # wrong shape: must not crash our own checks
    client, calls = fake_client([FakeStream(json.dumps(bad)), FakeStream(json.dumps(good))])
    assert run_outline(b, client) == good
    assert len(calls) == 2


def test_new_brief_does_not_reuse_old_outline(tmp_path: Path, capsys) -> None:
    fixture = FIXTURES / "family_adventure.json"
    assert main(["storyboard", "--fixture", str(fixture), "--out", str(tmp_path), "--practice"]) == 0
    other = json.loads(fixture.read_text())
    other["brief"]["summary"] = "A completely different story about a picnic in the park."
    other_file = tmp_path / "other.json"
    other_file.write_text(json.dumps(other))
    capsys.readouterr()
    assert main(["storyboard", "--fixture", str(other_file), "--out", str(tmp_path), "--practice"]) == 0
    printed = capsys.readouterr().out
    assert "starting fresh" in printed
    assert "Reusing" not in printed
