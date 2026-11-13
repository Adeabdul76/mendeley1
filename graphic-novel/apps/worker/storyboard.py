"""Render outline + page scripts as a single readable HTML storyboard."""

from __future__ import annotations

from html import escape
from typing import Any

CSS = """
:root{--bg:#faf7f2;--card:#fff;--ink:#2b2622;--muted:#7a6f66;--accent:#d9622b;--line:#e8dfd5;--soft:#f3ece4}
@media (prefers-color-scheme:dark){:root{--bg:#1d1a17;--card:#27231f;--ink:#f1ebe4;--muted:#a99d92;--accent:#f08a52;--line:#3a342e;--soft:#302a25}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.5 system-ui,sans-serif}
main{max-width:900px;margin:0 auto;padding:24px 16px 64px}
h1{font-size:1.9rem;margin:0 0 4px}.logline{color:var(--muted);margin:0 0 20px}
.banner{background:var(--soft);border-left:4px solid var(--accent);padding:10px 14px;border-radius:6px;margin-bottom:20px}
.cast{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:24px}.chip{background:var(--card);border:1px solid var(--line);border-radius:99px;padding:4px 12px;font-size:.9rem}
.warn{color:#b3261e}
details{background:var(--card);border:1px solid var(--line);border-radius:10px;margin:0 0 12px}
summary{cursor:pointer;padding:12px 16px;font-weight:600;display:flex;gap:10px;align-items:baseline;flex-wrap:wrap}
summary .meta{font-weight:400;color:var(--muted);font-size:.9rem}
.panels{display:grid;gap:10px;padding:0 16px 16px}
.panel{border:1px solid var(--line);border-radius:8px;padding:10px 12px;background:var(--soft)}
.panel h4{margin:0 0 4px;font-size:.85rem;color:var(--accent);text-transform:uppercase;letter-spacing:.03em}
.panel p{margin:4px 0}.who{color:var(--muted);font-size:.9rem}
.line{margin:4px 0 4px 12px}.line b{font-variant:small-caps}
.cap{font-style:italic}.sfx{font-weight:800;letter-spacing:.05em}
.act{margin:28px 0 10px;font-size:1.1rem;color:var(--muted)}
"""


def render(brief: dict[str, Any], outline: dict[str, Any], pages: list[dict[str, Any]],
           warnings: list[str], practice: bool) -> str:
    names = {c["id"]: c["name"] for c in brief["characters"]}
    out = [f"<!doctype html><html lang='en'><head><meta charset='utf-8'><meta name='viewport' content='width=device-width,initial-scale=1'>"
           f"<title>{escape(outline['title'])} storyboard</title><style>{CSS}</style></head><body><main>"]
    out.append(f"<h1>{escape(outline['title'])}</h1><p class='logline'>{escape(outline['logline'])}</p>")
    if practice:
        out.append("<div class='banner'><b>Practice mode.</b> This uses placeholder text to test the layout and rules. No AI was called.</div>")
    out.append("<div class='cast'>" + "".join(
        f"<span class='chip'>{escape(c['name'])} · {escape(c['role'])}{' ★' if c.get('is_main') else ''}</span>"
        for c in brief["characters"]) + "</div>")
    if warnings:
        out.append("<div class='banner'><b>Checks to review:</b><ul>" + "".join(f"<li class='warn'>{escape(w)}</li>" for w in warnings) + "</ul></div>")
    beats = {}
    for beat in outline["beats"]:
        for n in range(beat["page_range"][0], beat["page_range"][1] + 1):
            beats[n] = beat
    current_act = None
    for p in pages:
        beat = beats.get(p["page"], {})
        if beat.get("act") != current_act:
            current_act = beat.get("act")
            out.append(f"<div class='act'>Act {current_act}</div>")
        out.append(f"<details{' open' if p is pages[0] else ''}><summary>Page {p['page']}"
                   f"<span class='meta'>{escape(p['layout'])} · {escape(beat.get('emotion', ''))} — {escape(beat.get('summary', ''))}</span></summary><div class='panels'>")
        for panel in p["panels"]:
            who = ", ".join(f"{escape(names.get(c['id'], c['id']))} ({escape(c.get('expression', ''))})" for c in panel["characters"]) or "no characters"
            out.append(f"<div class='panel'><h4>{escape(panel['id'])} · {escape(panel['shot'])}</h4>"
                       f"<p class='who'>{who}</p><p>{escape(panel['setting'])}. {escape(panel['action'])}</p>")
            if panel.get("caption"):
                out.append(f"<p class='cap'>Caption: {escape(panel['caption'])}</p>")
            for line in panel["dialogue"]:
                out.append(f"<p class='line'><b>{escape(names.get(line['speaker'], line['speaker']))}</b> ({escape(line['type'])}): {escape(line['text'])}</p>")
            if panel.get("sfx"):
                out.append(f"<p class='sfx'>SFX: {escape(panel['sfx'])}</p>")
            out.append("</div>")
        out.append("</div></details>")
    out.append("</main></body></html>")
    return "".join(out)
