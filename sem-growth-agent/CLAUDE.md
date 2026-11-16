# CLAUDE.md - SEM Growth Agent

This folder is a separate project from the NaikTaraf.AI chatbot at the repository root.
The brief below is the owner's specification (transcribed from their PDF). The section
"Implementation decisions" at the end records how it was built and where it differs.

## Project Overview
Build an autonomous, ethical growth agent that drives REAL engagement and sales to Whop products.
No fake likes, no fake comments, no bots, no spam, no scraping private data. Only value-first,
helpful engagement.

## Business
Owner: solo creator, researcher. Platform: Whop.
Products:
1. Mastering SEM with SmartPLS 4: a complete guide for researchers to run Structural Equation
   Modeling correctly in SmartPLS 4.
2. VIVA Ready: Quantitative Thesis VIVA Kit: a prep kit for quantitative thesis defense: likely
   questions, model defense, SmartPLS output interpretation, examiner traps, and confident answers.

Target buyer: early-stage researchers, Masters and PhD students doing quantitative research with
SEM, PLS-SEM, SmartPLS 4. Struggling with measurement model, structural model, HTMT, AVE, CR,
discriminant validity, bootstrapping, mediation, moderation, VIVA defense. Global, heavy in Malaysia,
Nigeria, Indonesia, Pakistan, India, UK, Australia. Pain: fear of failing VIVA, supervisor corrections,
confusing YouTube tutorials.

Goal: drive qualified traffic to Whop, build trust, convert to sales. North Star: Whop sales, not vanity likes.

## Core Principles - NEVER VIOLATE
1. REAL ENGAGEMENT ONLY: only reply where a user has publicly asked for help. Never post fake
   testimonials, fake comments, or fake DMs.
2. VALUE FIRST, LINK SECOND: give a real answer first. Only add a Whop link if it directly solves the
   problem. Max 1 link per 3 helpful replies.
3. NO SPAM: no mass DM, no mass commenting, no copy-paste spam. Personalize every reply.
4. COMPLY WITH TOS: respect rate limits for YouTube, TikTok, Reddit, X, LinkedIn, Facebook. Use official
   APIs where available.
5. NO MISLEADING CLAIMS: never promise "pass VIVA guaranteed" or "publish guaranteed". Use "prepare to
   defend confidently", "avoid common examiner traps".
6. ACADEMIC INTEGRITY: never offer to write a thesis for students. Products are learning guides and
   defense prep, not ghostwriting.
7. TRANSPARENCY: disclose it is AI-assisted if asked. Never pretend to be the owner in DMs.

## Tech Stack
Python 3.11+; LangGraph; Claude Sonnet for drafting, Claude Haiku for triage; APScheduler;
SQLite (MVP) then Postgres; Whop API for products, sales, discount codes; YouTube Data API, Reddit
API (PRAW), X API v2; UTM tracking on every link; daily JSON report.

## Agents
1. SCOUT: search daily for the keywords in config/settings.yaml on Reddit (r/PhD, r/GradSchool,
   r/statistics, r/research, r/AskAcademia, r/Thesis), YouTube comments on SmartPLS tutorials, X.
   Output `data/leads.json`: source, url, user_problem, urgency_score 1-10, suggested_answer_angle.
   Only score 7+ is engaged.
2. CREATOR: 3 pieces per day, 1 long-form per week. Pillars: Pain Killer, VIVA Prep, Proof/Process,
   Mistake. Formats: YouTube Shorts script (hook 0-3s, problem, 1 solution, CTA), TikTok (more casual),
   X thread (7 tweets, last links to Whop), Reddit value post (300-500 words, no link), LinkedIn
   (professional). Soft CTA at the end of every piece.
3. ENGAGER: reply to comments on the owner's posts and to Scout leads. Template: acknowledge the exact
   problem, 2-3 concrete free steps, a follow-up question, soft CTA only if relevant. Max 20 replies per
   day per platform, 10-20 minutes apart, never the same user twice in 24h unless they reply back. Log
   every reply in `data/engagement_log.csv`.
4. ANALYST: every night at 9 PM: Whop sales, clicks per UTM source, content scores (views, saves,
   comments, CTR, sales). Output `reports/daily_YYYY-MM-DD.md`. Recommend top 3 topics to repeat and
   bottom 2 to drop.

Never hardcode API keys; use `.env`.

## Implementation decisions (owner-approved)
- Human approval queue: every reply and content piece is reviewed in `python -m growth_agent review`
  before anything is posted. Approved Reddit/YouTube/X replies are posted by `publisher.py` within the
  rate limits; everything else is posted by the owner.
- The rules are enforced in code (`guardrails.py`), re-checked at approval and before posting.
- TikTok, LinkedIn, Facebook groups, Quora and ResearchGate have no permitted search API for this use,
  so leads from there are added by hand (`add-lead`); no scraping.
- Whop's API has no per-UTM click data: clicks come from `data/clicks.csv`. Sales are attributed through
  single-use discount codes created for engaged users only, or UTM metadata if Whop records it.
- Buffer is not integrated; content is written to `content/` for the owner to publish.
- Claude: `claude-haiku-5-5` triage (low effort), `claude-sonnet-5-5` drafting with server-side refusal
  fallback; structured outputs via pydantic models. `FakeLLM` powers `--demo` and the tests.
- Keep it simple for a non-developer owner: plain-language README, settings in YAML, tests in `tests/`.
