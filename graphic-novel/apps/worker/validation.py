"""Load the shared JSON Schemas and validate pipeline artefacts.

JSON Schema covers structure; `check_page_rules` covers the script rules
that a schema cannot express (CLAUDE.md §4 [4]).
"""

from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Any

from jsonschema import Draft202012Validator, FormatChecker
from referencing import Registry, Resource

SCHEMA_DIR = Path(__file__).resolve().parents[2] / "packages" / "schemas"

MAX_WORDS_PER_BUBBLE = 25
MAX_BUBBLES_PER_CHARACTER_PER_PANEL = 2


@lru_cache(maxsize=1)
def _registry() -> Registry:
    resources = []
    for path in SCHEMA_DIR.glob("*.json"):
        schema = json.loads(path.read_text(encoding="utf-8"))
        resources.append((schema["$id"], Resource.from_contents(schema)))
    return Registry().with_resources(resources)


def validator(name: str) -> Draft202012Validator:
    """Return a validator for e.g. ``"brief"`` or ``"page"``."""
    schema = _registry().contents(f"{name}.json")
    return Draft202012Validator(schema, registry=_registry(), format_checker=FormatChecker())


def schema_errors(name: str, data: Any) -> list[str]:
    """All schema errors as readable strings (empty list means valid).

    The string form is what gets appended to the LLM retry prompt (§8).
    """
    errors = sorted(validator(name).iter_errors(data), key=lambda e: list(e.absolute_path))
    return [f"{'/'.join(map(str, e.absolute_path)) or '<root>'}: {e.message}" for e in errors]


def check_page_rules(page: dict[str, Any]) -> list[str]:
    """Script rules beyond the schema: word limits, bubble limits, speakers present."""
    problems: list[str] = []
    for panel in page.get("panels", []):
        pid = panel.get("id", "?")
        present = {c["id"] for c in panel.get("characters", [])}
        bubbles: dict[str, int] = {}
        for line in panel.get("dialogue", []):
            speaker = line["speaker"]
            words = len(line["text"].split())
            if words > MAX_WORDS_PER_BUBBLE:
                problems.append(f"{pid}: bubble by {speaker} has {words} words (max {MAX_WORDS_PER_BUBBLE})")
            if speaker not in present:
                problems.append(f"{pid}: speaker {speaker} is not listed in the panel's characters")
            bubbles[speaker] = bubbles.get(speaker, 0) + 1
        for speaker, count in bubbles.items():
            if count > MAX_BUBBLES_PER_CHARACTER_PER_PANEL:
                problems.append(f"{pid}: {speaker} has {count} bubbles (max {MAX_BUBBLES_PER_CHARACTER_PER_PANEL})")
        ids = [c["id"] for c in panel.get("characters", [])]
        if len(ids) != len(set(ids)):
            problems.append(f"{pid}: a character is listed twice (would draw a duplicate)")
    return problems


def check_brief_rules(brief: dict[str, Any]) -> list[str]:
    """Brief rules beyond the schema (§2 rule 4, §3 outline rules)."""
    problems: list[str] = []
    chars = brief.get("characters", [])
    ids = [c["id"] for c in chars]
    if len(ids) != len(set(ids)):
        problems.append("character ids must be unique")
    if sum(1 for c in chars if c.get("is_main")) > 1:
        problems.append("only one character can be the main character")
    has_child = any(c.get("age_group") in {"baby", "child"} for c in chars)
    if has_child and brief.get("book_type") == "love_story":
        problems.append("children cannot appear in a love story book")
    return problems
