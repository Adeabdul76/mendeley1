"""Claude calls that must return JSON matching one of our schemas.

Two clients share one interface:
- ClaudeClient: real calls (needs ANTHROPIC_API_KEY in the environment).
- PracticeClient: no network, no cost; returns simple made-up JSON so the
  whole pipeline can be tried end to end (CLAUDE.md §10: fixtures, no real data).

Every call validates against the full schema plus our extra rules, and
retries once with the errors appended (CLAUDE.md §8).
"""

from __future__ import annotations

import copy
import json
import os
from dataclasses import dataclass, field
from typing import Any, Callable, Protocol

from apps.worker.validation import _registry, schema_errors

# Keywords the structured-output API does not accept. We strip them from the
# schema we send and enforce them ourselves after the reply arrives.
_UNSUPPORTED = {
    "minLength", "maxLength", "minimum", "maximum", "multipleOf", "minItems",
    "maxItems", "pattern", "if", "then", "else", "default", "$schema", "$id", "format",
}

FALLBACK_BETA = "server-side-fallback-2026-07-01"


class LLMError(RuntimeError):
    pass


@dataclass
class Usage:
    calls: int = 0
    input_tokens: int = 0
    output_tokens: int = 0
    by_model: dict[str, list[int]] = field(default_factory=dict)

    def add(self, model: str, inp: int, out: int) -> None:
        self.calls += 1
        self.input_tokens += inp
        self.output_tokens += out
        m = self.by_model.setdefault(model, [0, 0])
        m[0] += inp
        m[1] += out


def api_schema(name: str) -> dict[str, Any]:
    """Our schema as one self-contained, API-compatible JSON Schema."""
    reg = _registry()
    defs: dict[str, Any] = {}

    def walk(node: Any, base: str) -> Any:
        if isinstance(node, list):
            return [walk(n, base) for n in node]
        if not isinstance(node, dict):
            return node
        if "$ref" in node:
            ref = node["$ref"]
            file, _, frag = ref.partition("#")
            file = file or base
            key = (file.removesuffix(".json") + ("_" + frag.split("/")[-1] if frag else "")).replace("-", "_")
            if key not in defs:
                defs[key] = {}  # placeholder stops infinite loops
                target = reg.contents(file)
                for part in [p for p in frag.split("/") if p]:
                    target = target[part]
                defs[key] = walk(target, file)
            return {"$ref": f"#/$defs/{key}"}
        out: dict[str, Any] = {}
        for k, v in node.items():
            if k in _UNSUPPORTED or k == "$defs":
                continue
            if k == "type" and isinstance(v, list):  # ["string","null"] -> anyOf
                return {"anyOf": [{"type": t} for t in v], **{kk: walk(vv, base) for kk, vv in node.items() if kk not in _UNSUPPORTED and kk not in {"type", "$defs"}}}
            out[k] = walk(v, base)
        if out.get("type") == "object" or "properties" in out:
            out["additionalProperties"] = False
        return out

    root = walk(copy.deepcopy(reg.contents(f"{name}.json")), f"{name}.json")
    if defs:
        root["$defs"] = defs
    return root


Checker = Callable[[Any], list[str]]


class LLMClient(Protocol):
    usage: Usage

    def json_call(self, *, stage: str, model: str, system: str, prompt: str,
                  schema: str, effort: str, extra_check: Checker | None = None) -> Any: ...


class ClaudeClient:
    def __init__(self) -> None:
        import anthropic  # imported here so practice mode needs no SDK

        if not os.environ.get("ANTHROPIC_API_KEY"):
            raise LLMError("ANTHROPIC_API_KEY is not set. Use practice mode or add the key.")
        self._anthropic = anthropic
        self._client = anthropic.Anthropic()
        self.usage = Usage()

    def _once(self, model: str, system: str, messages: list[dict[str, Any]], schema: str, effort: str) -> Any:
        with self._client.beta.messages.stream(
            model=model,
            max_tokens=32000,
            system=system,
            messages=messages,
            output_config={"effort": effort, "format": {"type": "json_schema", "schema": api_schema(schema)}},
            betas=[FALLBACK_BETA],
            fallbacks="default",
        ) as stream:
            msg = stream.get_final_message()
        self.usage.add(msg.model, msg.usage.input_tokens, msg.usage.output_tokens)
        if msg.stop_reason == "refusal":
            raise LLMError("Claude declined this request. Please rephrase the brief.")
        if msg.stop_reason == "max_tokens":
            raise LLMError("Reply was cut off (too long).")
        text = "".join(b.text for b in msg.content if b.type == "text")
        return json.loads(text)

    def json_call(self, *, stage: str, model: str, system: str, prompt: str,
                  schema: str, effort: str, extra_check: Checker | None = None) -> Any:
        messages: list[dict[str, Any]] = [{"role": "user", "content": prompt}]
        for attempt in range(2):
            data = self._once(model, system, messages, schema, effort)
            problems = schema_errors(schema, data) + (extra_check(data) if extra_check else [])
            if not problems:
                return data
            if attempt == 0:
                messages = [
                    {"role": "user", "content": prompt},
                    {"role": "assistant", "content": json.dumps(data, ensure_ascii=False)},
                    {"role": "user", "content": "That JSON broke these rules. Return a corrected version:\n- " + "\n- ".join(problems)},
                ]
        raise LLMError(f"{stage}: still invalid after retry: {problems}")


class PracticeClient:
    """Offline stand-in. Produces valid but obviously placeholder content."""

    def __init__(self, responder: Callable[[str, str], Any]) -> None:
        self._respond = responder
        self.usage = Usage()

    def json_call(self, *, stage: str, model: str, system: str, prompt: str,
                  schema: str, effort: str, extra_check: Checker | None = None) -> Any:
        data = self._respond(stage, prompt)
        self.usage.add(f"practice:{model}", 0, 0)
        problems = schema_errors(schema, data) + (extra_check(data) if extra_check else [])
        if problems:
            raise LLMError(f"practice {stage} invalid: {problems}")
        return data
