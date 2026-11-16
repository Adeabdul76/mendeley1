"""Loads settings.yaml and the .env file."""
from __future__ import annotations

import os
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from zoneinfo import ZoneInfo

import yaml
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "data"
REPORTS_DIR = ROOT / "reports"
CONTENT_DIR = ROOT / "content"


@dataclass
class Config:
    raw: dict

    def __getitem__(self, key):
        return self.raw[key]

    @property
    def tz(self) -> ZoneInfo:
        return ZoneInfo(self.raw.get("timezone", "UTC"))

    @property
    def products(self) -> dict:
        return self.raw["store"]["products"]

    @staticmethod
    def env(name: str, default: str = "") -> str:
        return os.environ.get(name, default).strip()


@lru_cache(maxsize=1)
def get_config(path: str | None = None) -> Config:
    load_dotenv(ROOT / ".env")
    settings = Path(path or os.environ.get("GROWTH_AGENT_SETTINGS", ROOT / "config" / "settings.yaml"))
    with open(settings, encoding="utf-8") as f:
        return Config(yaml.safe_load(f))
