# Status

**Current milestone:** 2 — Text-only pipeline (brief → outline → script → storyboard), code done; waiting on a first real run. Milestone 1 infrastructure items still open below.

## Milestone 1
- [x] Repository layout (§3)
- [x] Shared JSON Schemas: brief, character, character_sheet, outline, page, panel, qa_result (`packages/schemas`)
- [x] Python validator + extra script rules (word/bubble limits, speakers present, no duplicates, no children in love stories) — `apps/worker/validation.py`
- [x] Tests: `pytest apps/worker -q` (20 passing)
- [x] Prisma data model for all core tables (§6) — `db/schema.prisma` (not yet migrated)
- [x] Prompt files: style block + negative prompt; other prompts stubbed
- [x] Synthetic fixtures (no real faces)
- [ ] Next.js app skeleton (`apps/web`) + TypeScript types generated from schemas
- [ ] First migration against a real Postgres
- [ ] S3 storage client with `uploads/ refs/ panels/ pages/ exports/` prefixes
- [ ] Auth (decision needed: email magic link vs. provider)
- [ ] FastAPI worker skeleton + `run_stage(book_id, stage, version)`

## Milestone 2
- [x] Outline prompt + stage (`claude-opus-5-5`, effort high) with page-coverage and character-appearance checks
- [x] Page script prompt + stage (`claude-sonnet-5-5`, effort medium), one call per story page (pages 3–31), layout/panel-id/speaker checks
- [x] Structured JSON output, full validation, one retry with errors appended; server-side refusal fallback on
- [x] Practice mode (no AI, no cost) for testing
- [x] HTML storyboard: `python -m apps.worker.cli storyboard --fixture fixtures/family_adventure.json --out out`
- [x] Tests (32 passing), including a fake-Claude retry test
- [ ] First real run with an Anthropic API key (needs a place where the key can be set — see below)
- [ ] Storyboard screen in the web app

## Decisions
- Image generator: GPT Image 2.5 via Higgsfield (built behind the swappable `ImageProvider` interface). Still to confirm: that its API accepts reference images and fixed seeds.

## Open decisions
- Hosting for Postgres / Redis / S3
- Auth method

## Log
- 2026-11-14: Second real run crashed in our own outline checks when Claude wrote a one-page beat as [5]. Now normalised to [5, 5]; our rule checks run only after the schema passes, so a wrong shape triggers the retry instead of a crash.
- 2026-11-14: First real run stopped on page scripts: a character pose was longer than the 60-character limit. Loosened art-direction length limits; finished outline/pages are now saved and reused on rerun (`--fresh` to start over).
- 2026-11-13: Milestone 2 code done; tested in practice mode only. Real run pending: this cloud session can't hold an Anthropic key.
- 2026-11-13: Image generator chosen: GPT Image 2.5 on Higgsfield.
- 2026-11-13: Project scaffolded; milestone 1 schemas and data model done.
