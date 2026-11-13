"""Made-up responses for practice mode. Clearly placeholder text, valid structure."""

from __future__ import annotations

import re
from typing import Any

from apps.worker.story import story_pages

_LAYOUT_CYCLE = ["3-tier-5", "2-tier-3", "3-tier-4", "3-tier-6", "2-tier-2"]
_SHOTS = ["wide establishing", "medium", "close-up", "over-the-shoulder", "medium two-shot", "low angle"]


def make_responder(brief: dict[str, Any]):
    chars = brief["characters"]
    ids = [c["id"] for c in chars]
    main = next((c["id"] for c in chars if c.get("is_main")), ids[0])
    names = {c["id"]: c["name"] for c in chars}
    pages = list(story_pages(brief.get("page_count", 32)))
    setting = brief["brief"].get("setting") or "a sunny town"

    def outline() -> dict[str, Any]:
        beats = []
        third = len(pages) // 4
        for i in range(0, len(pages), 2):
            first, last = pages[i], pages[min(i + 1, len(pages) - 1)]
            act = 1 if i < third else (3 if i >= len(pages) - third else 2)
            others = [ids[(i // 2 + k) % len(ids)] for k in range(min(2, len(ids)))]
            who = list(dict.fromkeys([main, *others]))
            beats.append({
                "act": act,
                "page_range": [first, last],
                "summary": f"[Practice text] Act {act}: {', '.join(names[w] for w in who)} keep going in {setting}.",
                "emotion": ["curious", "excited", "worried", "triumphant", "warm"][i // 2 % 5],
                "characters": who,
            })
        return {"title": "[Practice] The Big Day Out", "logline": "[Practice text] A placeholder story to test the pipeline.", "beats": beats}

    def page(n: int) -> dict[str, Any]:
        layout = "splash-1" if n in (pages[len(pages) // 4], pages[-3]) else _LAYOUT_CYCLE[n % len(_LAYOUT_CYCLE)]
        count = {"splash-1": 1, "2-tier-2": 2, "2-tier-3": 3, "3-tier-4": 4, "3-tier-5": 5, "3-tier-6": 6}[layout]
        panels = []
        for k in range(1, count + 1):
            friend = ids[(n + k) % len(ids)]
            present = list(dict.fromkeys([main, friend]))
            panels.append({
                "id": f"p{n}-{k}",
                "shot": _SHOTS[(n + k) % len(_SHOTS)],
                "setting": f"{setting}, page {n}",
                "characters": [{"id": c, "pose": "standing", "expression": "smiling"} for c in present],
                "action": f"[Practice] {' and '.join(names[c] for c in present)} do something fun.",
                "dialogue": [{"speaker": main, "text": f"Practice line on page {n}, panel {k}.", "type": "speech"}],
                "caption": "Meanwhile..." if k == 1 else None,
                "sfx": "WHOOSH!" if k == count and n % 3 == 0 else None,
            })
        return {"page": n, "layout": layout, "panels": panels}

    def respond(stage: str, prompt: str) -> Any:
        if stage == "outline":
            return outline()
        m = re.match(r"script p(\d+)", stage)
        if m:
            return page(int(m.group(1)))
        raise ValueError(stage)

    return respond
