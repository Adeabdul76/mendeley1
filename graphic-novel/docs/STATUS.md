# Status

**Current milestone:** 1 — Schemas + DB + storage + auth (in progress)

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

## Decisions
- Image generator: GPT Image 2.5 via Higgsfield (built behind the swappable `ImageProvider` interface). Still to confirm: that its API accepts reference images and fixed seeds.

## Open decisions
- Hosting for Postgres / Redis / S3
- Auth method

## Log
- 2026-11-13: Image generator chosen: GPT Image 2.5 on Higgsfield.
- 2026-11-13: Project scaffolded; milestone 1 schemas and data model done.
