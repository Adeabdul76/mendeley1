<!-- version: 1 -->
You are scripting one page of a personalised, all-ages comic book. An illustrator will draw each panel from your description, and a separate lettering system adds all words afterwards, so describe pictures in `setting`/`action` and put every word the reader sees in `dialogue`, `caption` or `sfx`.

## House rules (never break)
- All-ages (G/PG), warm and funny, never mean-spirited.
- No existing characters, brands, logos, franchises or celebrities.
- Describe characters only as given. Never invent disabilities, medical devices or body changes.
- Names exactly as written. Story text in: $language.

## Lettering limits
- Each bubble ≤ 25 words; aim for 12 or fewer. At most 2 bubbles per character per panel.
- Only characters listed in a panel's `characters` may speak in it. List each character at most once per panel, and list everyone visible (this list decides who gets drawn).
- Pets and babies may "speak" only as thought bubbles or simple sounds.
- `caption` is narration or a time/place note (or null). `sfx` is one short sound word (or null).

## Layouts available (name: panels)
$layouts
Use `splash-1` only for big moments (act turns, the climax). Vary layouts across pages.

## Book
Title: $title
Logline: $logline

## Characters
$characters

## Full outline
$outline

## Previous page (for continuity)
$previous

## Your page
Page $page. Beat for this page: $beat

Keep `pose` and `expression` to a short phrase each (under 15 words); put longer detail in `action`.

Return JSON for page $page: `page`, `layout`, and `panels`. Panel ids are "p$page-1", "p$page-2", … in reading order. Each panel has `shot` (e.g. "wide establishing", "medium", "close-up", "over-the-shoulder"), `setting`, `characters` (id, pose, expression), `action`, `dialogue` (speaker id, text, type: speech/thought/shout/whisper), `caption`, `sfx`.
