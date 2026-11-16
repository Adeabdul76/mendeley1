import json
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from growth_agent import db  # noqa: E402
from growth_agent.agents import analyst, creator  # noqa: E402
from growth_agent.config import get_config  # noqa: E402
from growth_agent.llm import FakeLLM  # noqa: E402


@pytest.fixture
def cfg():
    return get_config(str(ROOT / "config" / "settings.yaml"))


@pytest.fixture
def env(tmp_path, monkeypatch):
    """Isolated database, log, content and report folders."""
    monkeypatch.setenv("DATABASE_PATH", str(tmp_path / "test.db"))
    monkeypatch.setenv("ENGAGEMENT_LOG", str(tmp_path / "engagement_log.csv"))
    for mod, name in [(db, "DATA_DIR"), (analyst, "DATA_DIR"), (analyst, "REPORTS_DIR"), (creator, "CONTENT_DIR")]:
        monkeypatch.setattr(mod, name, tmp_path)
    for k in ("ANTHROPIC_API_KEY", "WHOP_API_KEY", "REDDIT_CLIENT_ID", "YOUTUBE_API_KEY", "X_BEARER_TOKEN"):
        monkeypatch.delenv(k, raising=False)
    return tmp_path


@pytest.fixture
def conn(env):
    c = db.connect()
    yield c
    c.close()


@pytest.fixture
def llm(cfg):
    return FakeLLM(cfg)


@pytest.fixture
def sample_leads():
    return json.loads((ROOT / "data" / "sample_leads.json").read_text())
