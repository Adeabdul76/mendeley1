# CLAUDE.md — Personalised AI Graphic-Novel Generator

This file tells Claude Code how to build and work on this project. Read it fully before writing code. When anything here conflicts with a user instruction in the session, ask before deviating.

---

## 1. What we are building

A web app that turns **a customer's photos + a short brief** into a **personalised, print-ready comic book / graphic novel** (default 32 pages), in the spirit of personalised gift comics such as Kindred Press: the customer and their family/friends become the heroes of a light-hearted illustrated story.

**User journey**
1. Customer chooses a book type (Adventure, Love Story, Family, Birthday, Graduation, Islamic values/children's moral tale, Custom).
2. Adds 1–6 characters: name, role, age group, personality traits, 2–5 reference photos each (or "describe only").
3. Writes a short brief (who, occasion, inside jokes, setting, tone, things to avoid).
4. App generates: story outline → page-by-page script → character sheets → panels → lettered pages → cover.
5. Customer previews every page, edits text freely, regenerates individual panels (limited by a credit budget), approves.
6. App exports a print-ready PDF (and a web flipbook) and sends it to the print/fulfilment step.

**Non-goals (v1):** animation, real-time collaboration, a public marketplace of user books.

---

## 2. Hard rules (never break these)

1. **Original house style only.** Do not copy, trace, or prompt for any real publisher's artwork, logos, trademarks, page templates or characters (including Kindred Press, Marvel, DC, Disney, manga IPs, etc.). Prompts must never contain an artist's or studio's name. Style is defined only by the descriptive style guide in §5.
2. **No copyrighted or trademarked characters, logos or brand names** in generated images or text, even if the customer asks. Offer an original look-alike-free alternative instead.
3. **Consent for real people's likeness.** The uploader must tick a box confirming they have permission to use every photo. Store that consent record with the order.
4. **Children's photos:** allowed only in family/children's book types; never in romance or mature themes. Content is always all-ages (G/PG): no sexual content, gore, hate, or mockery of protected traits.
5. **Photo privacy:** reference photos and derived embeddings are deleted 30 days after order completion (configurable), never used for model training, never shown to other users.
6. **Text is never baked into images.** The image model draws art only; all speech bubbles, captions, SFX and titles are rendered by our lettering engine (§7). This avoids garbled AI lettering and allows editing.
7. **Secrets** (API keys, storage credentials) come from environment variables only. Never commit `.env`.

---

## 3. Tech stack

| Layer | Choice | Notes |
|---|---|---|
| Frontend | Next.js 15 (App Router) + TypeScript + Tailwind | Book builder wizard, page editor, flipbook preview |
| API | Next.js route handlers (thin) → Python worker for heavy jobs | |
| Worker | Python 3.12, FastAPI, Celery/RQ + Redis | Generation pipeline, layout, PDF |
| Database | PostgreSQL + Prisma (TS side) / SQLAlchemy (Py side) | Single schema, migrations in `/db/migrations` |
| Storage | S3-compatible bucket | `uploads/`, `refs/`, `panels/`, `pages/`, `exports/` prefixes |
| Text LLM | Anthropic Claude API (`claude-sonnet-5-5` for drafting, `claude-opus-5-5` for outline/script polish and QA review) | Use structured JSON outputs |
| Vision QA | Claude (image input) | Checks panels against the script and character sheets |
| Image model | **Pluggable provider interface** (`ImageProvider`) | Must support reference images / identity conditioning and seeds. Do not hard-code a vendor. |
| Layout & lettering | Python: Pillow + Skia (or Cairo) | Panel grids, bubbles, tails, fonts |
| PDF | ReportLab or WeasyPrint | Print PDF with bleed and crop marks |
| Payments | Stripe | Credits for regenerations |
| Tests | Vitest + Playwright (web), pytest (worker) | |

Repository layout:

```
/apps/web            Next.js app (builder, editor, preview, checkout)
/apps/worker         Python pipeline (story, art, QA, layout, export)
/packages/schemas    Shared JSON Schemas (book, page, panel, character)
/assets/fonts        Licensed comic fonts (OFL or commercially licensed only)
/assets/style        House style guide, palette, bubble shapes, panel templates
/db                  Migrations and seed data
/docs                Architecture notes, prompt library, QA rubric
```

---

## 4. Generation pipeline

Each stage writes a versioned JSON artefact to the DB so any stage can be re-run on its own.

```
Brief + photos
  → [1] Intake & safety check
  → [2] Character sheets (identity + outfit + expression set)
  → [3] Story outline (beats, 32 pages)
  → [4] Page script (panels, shots, dialogue, captions)
  → [5] Panel art generation (with character references + seed)
  → [6] Vision QA (auto-retry failed panels)
  → [7] Lettering & page layout
  → [8] Cover + back cover + title page
  → [9] Customer review & edits → approve
  → [10] Print export (PDF/X) + web flipbook
```

### [1] Intake & safety
- Validate photos: face detectable, one main subject per photo, min 512 px, no explicit content.
- Run the brief through a moderation prompt; reject or ask to rephrase unsafe or IP-infringing requests.
- Normalise data into `BookBrief` (see `/packages/schemas/brief.json`).

### [2] Character sheets (the key to consistency)
Customer reviews say the most common failures are characters that don't look like the person, duplicates in one panel, wrong features (e.g. extra/missing eyes on pets, wheelchairs that weren't in the photo). So:
- For each character build a `CharacterSheet`: canonical text description (age, skin tone, hair, facial hair, glasses, hijab/headwear, build, signature outfit, accessories, pets' exact markings), plus 4 generated reference images (front, ¾, side, full body) in house style.
- Show the sheet to the customer for approval **before** any pages are drawn. Every later panel prompt is conditioned on the approved sheet images + text.
- Only describe what is visible in the photos. Never invent disabilities, medical devices, or body changes unless the customer states them.

### [3] Story outline
- Claude writes a 3-act outline: 32 pages = cover, title page, ~28 story pages, ending page, back cover.
- Every character appears at least 3 times; the main character is on at least 60% of pages.
- Use the customer's inside jokes and occasion; keep the tone warm and funny, never mean-spirited.
- Output JSON: `{title, logline, beats:[{page_range, summary, emotion}]}`.

### [4] Page script
For each page, JSON:
```json
{
  "page": 7,
  "layout": "3-tier-5",
  "panels": [
    {
      "id": "p7-1",
      "shot": "wide establishing",
      "setting": "night market in Penang, lanterns",
      "characters": [{"id": "aisha", "pose": "pointing", "expression": "excited"}],
      "action": "Aisha spots the giant durian stall",
      "dialogue": [{"speaker": "aisha", "text": "There it is!", "type": "speech"}],
      "caption": "Saturday, 8:47 pm.",
      "sfx": null
    }
  ]
}
```
Rules: 1–6 panels per page; ≤ 25 words per bubble; ≤ 2 bubbles per character per panel; every panel lists exactly which characters are present (this list drives the image prompt and the QA count check).

### [5] Panel art
- Build prompts from: house style block (§5) + shot + setting + action + each present character's sheet description and reference images + negative prompt (§5).
- Ask for **no text, no speech bubbles, no letters** in the image.
- Store `{provider, model, seed, prompt, refs, created_at}` per panel for reproducibility.
- Generate at 2× print size or upscale; panels must reach 300 DPI at final trim size.

### [6] Vision QA (automatic, before the customer sees anything)
Claude (vision) scores each panel against the script and the character sheets, returning JSON:
`{character_count_ok, identities_ok, duplicate_character, anatomy_ok, extra_text_found, matches_action, safe, notes}`.
- If any check fails, regenerate with a new seed (max 3 automatic retries), then flag the panel for human/customer review.
- Log failure reasons to improve prompts (`/docs/qa-log.md` summary weekly).

### [7] Lettering & layout
See §7.

### [8] Cover
Full-bleed hero image, title, "starring [names]", optional dedication on the inside cover. The back cover has a short blurb and our own (not anyone else's) logo.

### [9] Customer review
- The page editor allows: editing any text (re-flows bubbles live), swapping a panel for one of its alternate takes, regenerating a panel (costs 1 credit), reordering pages within an act.
- Every book includes 20 free regenerations. Show the remaining credits clearly. Never charge for regenerations caused by a failed QA check.
- "Pause production" toggle until the customer clicks Approve.

### [10] Export
- Trim size default 8.5" × 11" (also 6.625" × 10.25" US comic and A4). 0.125" bleed, 0.25" safe area, crop marks.
- PDF/X-1a or PDF/X-4, images 300 DPI, fonts embedded. Provide an RGB web flipbook as well.
- Page count must be a multiple of 4 for saddle-stitch; pad with an "Our Story Notes" or blank page if needed.

---

## 5. House style guide (original, descriptive)

Name: **"Warm Pop"** (our own style; extend in `/assets/style/style-guide.md`).

- **Line:** clean, confident ink outlines with medium weight and slightly thicker outer contours; minimal hatching.
- **Colour:** bright but warm palette, flat cel shading with one soft shadow tone and a subtle rim light; gentle gradients only on skies and backgrounds.
- **Characters:** friendly semi-realistic cartoon proportions (about 6 heads tall for adults, 4–5 for children), expressive eyes, recognisable likeness kept through hair, skin tone, glasses, facial hair, headwear and signature clothes.
- **Backgrounds:** simplified but specific locations, with soft depth of field on busy scenes.
- **Mood:** upbeat, humorous, family-friendly; big reaction faces for comedy beats.
- **Style block injected into every prompt** (keep in `prompts/style_block.txt`):
  "clean-line digital comic illustration, warm flat cel shading, soft rim light, expressive friendly cartoon characters, bright warm colour palette, simplified detailed background, no text, no lettering, no speech bubbles, no watermark"
- **Negative prompt** (`prompts/negative.txt`): "text, letters, captions, speech bubble, watermark, logo, signature, extra fingers, extra limbs, duplicate person, deformed face, extra eyes, blurry, photorealistic, gore".

Offer style presets later (e.g. "Storybook Watercolour", "Manga-inspired Clean Line", "Retro Newsprint"), each defined only by descriptive words and our own sample art, never by naming an artist or publisher.

---

## 6. Data model (core tables)

`users, orders, books, characters, character_refs (photos), character_sheets, outlines, pages, panels, panel_takes, qa_results, credits_ledger, consents, exports`

- `panels` belong to `pages`; `panel_takes` keeps every generation, with `is_selected`.
- Soft-delete only; a nightly job hard-deletes photos and refs after the retention period.

---

## 7. Lettering engine rules

- Fonts: a comic dialogue font (OFL-licensed, e.g. from Google Fonts) at 9–11 pt print size, all-caps optional per book; captions in a contrasting font in rectangular boxes.
- Bubbles: oval for speech, cloud for thoughts, jagged for shouts, dashed for whispers. The tail points to the speaker's mouth using the face bounding box from QA/vision.
- Reading order: left→right, top→bottom; earlier speakers higher and to the left. Never cover faces or key action (use the face and subject boxes as no-go zones).
- Auto-fit: shrink to the minimum size, then wrap, then flag "text too long" for editing; never let text overflow a bubble.
- Panel layouts come from a template library (`/assets/style/layouts/*.json`): gutters 0.125", consistent margins, splash pages allowed at act turns.
- Multilingual: support English and Malay first (UTF-8 throughout, including diacritics); Arabic phrases (e.g. greetings) need right-to-left shaping via HarfBuzz.

---

## 8. Prompts library

Keep all LLM and image prompts as versioned files in `/apps/worker/prompts/` (no prompt strings scattered through the code):

- `outline.md`, `script.md`, `character_sheet.md`, `panel_image.md`, `qa_vision.md`, `moderation.md`, `cover.md`
- Every prompt asks for **strict JSON** that matches a schema in `/packages/schemas`; validate the response and retry once with the validation error appended.
- Creativity/depth is set with `effort` (outline high, script medium, QA high). The current Claude API no longer accepts `temperature`, so do not send it.

---

## 9. Commands

```bash
# setup
pnpm install && pip install -r apps/worker/requirements.txt
cp .env.example .env            # fill ANTHROPIC_API_KEY, IMAGE_PROVIDER_*, S3_*, DATABASE_URL, STRIPE_*
pnpm db:migrate

# dev
pnpm dev                        # web on :3000
uvicorn apps.worker.main:app --reload --port 8000
celery -A apps.worker.tasks worker -l info

# quality
pnpm lint && pnpm typecheck && pnpm test
pytest apps/worker -q
pnpm e2e                        # Playwright: builder → preview → export

# generate a sample book from fixtures (no real faces)
python -m apps.worker.cli sample --fixture fixtures/family_adventure.json --out out/sample.pdf
```

---

## 10. Coding conventions

- TypeScript strict mode; Python type hints + `ruff` + `mypy`.
- Every pipeline stage is an idempotent task: `run_stage(book_id, stage, version)`.
- Long jobs report progress events (`stage`, `page`, `percent`) over SSE to the UI.
- Make image providers swappable: `ImageProvider.generate(prompt, refs, seed, size) -> ImageResult`.
- Unit-test schemas, layout maths, bubble fitting and PDF dimensions; use fixture characters (illustrated or synthetic), never real customer photos, in tests.
- Log costs per book (LLM tokens, image calls) to `cost_ledger`; fail the job if it goes over budget.

---

## 11. Definition of done for a book

- [ ] All 32 pages generated; every panel passed QA or was approved by the customer
- [ ] Character count and identity are correct in every panel; no duplicates
- [ ] No text inside artwork; all lettering is editable and within bubbles
- [ ] Spelling checked (English/Malay); names spelled exactly as entered
- [ ] Cover, title page, dedication and back cover present
- [ ] PDF passes the preflight script (`python -m apps.worker.preflight out.pdf`): trim, bleed, 300 DPI, fonts embedded, page count a multiple of 4
- [ ] Consent recorded; retention timer set

---

## 12. Build order (milestones)

1. Schemas + DB + storage + auth.
2. Text-only pipeline: brief → outline → script, shown as a "storyboard" in the UI.
3. Character sheet generation and approval screen.
4. Panel generation + vision QA + retry loop.
5. Lettering engine + layout templates + page preview.
6. Editor (text edits, regenerate, credits) + approval.
7. PDF export + preflight + web flipbook.
8. Payments, order tracking, retention jobs, admin dashboard.
9. Style presets and more book types.

When you start a session, check `/docs/STATUS.md` for the current milestone and update it when you finish a task.
