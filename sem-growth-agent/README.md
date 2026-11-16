# SEM Growth Agent

An ethical growth agent for two Whop products: **Mastering SEM with SmartPLS 4** and the
**VIVA Ready: Quantitative Thesis VIVA Kit**. It finds researchers who are publicly asking for
help with SmartPLS / PLS-SEM / their VIVA, drafts a genuinely helpful reply for each one, writes
3 pieces of content a day, and reports Whop sales every night.

**Nothing is posted without your approval.** The agent drafts; you approve, edit or reject in a
review screen. Approved replies on Reddit, YouTube and X are then posted slowly (a random 10-20
minutes apart, at most 20 a day per platform). For other sites you post the approved text yourself.

## The four agents

| Agent | What it does | Output |
|---|---|---|
| Scout | Searches Reddit, YouTube comments and X for the keywords in `config/settings.yaml`, then Claude Haiku scores each post 1-10 for urgency | `data/leads.json` |
| Engager | For leads scoring 7+, Claude Sonnet drafts a reply: acknowledge the problem, 2-3 free steps, one follow-up question, and a product mention only if it directly helps | review queue |
| Creator | 3 pieces a day (Shorts/TikTok scripts, X threads, Reddit value posts, LinkedIn posts) across your 4 content pillars, plus 1 long-form piece every Sunday | `content/YYYY-MM-DD/*.md` + review queue |
| Analyst | Every night at 9 PM: Whop sales, clicks per source, topic scores, top 3 topics to repeat and bottom 2 to drop | `reports/daily_YYYY-MM-DD.md` and `.json` |

## Rules the code enforces (not just "asks Claude nicely")

- Only posts scoring 7+ that are real help requests get a reply.
- Max 1 link in any 3 replies. If the last replies had a link, the link is removed automatically.
- Max 1 link per reply; no links in Reddit posts; X threads link only in the last tweet.
- Blocked phrases: "guaranteed", "you will pass", "sure pass", "100% pass", "write your thesis for you",
  "ghostwriting", "my students all passed", and others (edit the list in `settings.yaml`).
- If someone asks "are you a bot / AI?", the reply must say it is AI-assisted, or it cannot be approved.
- Near-copies of earlier replies are blocked (no copy-paste spam).
- Never the same person twice in 24 hours, unless they replied to you.
- 20 replies per platform per day, 10-20 minutes apart.
- No DMs at all.

## Setup (about 15 minutes)

You need Python 3.11 or newer.

```bash
cd sem-growth-agent
```

```bash
python3 -m venv .venv
```

```bash
source .venv/bin/activate
```

```bash
pip install -r requirements.txt
```

```bash
cp .env.example .env
```

Then:

1. Open `.env` and add your keys (see "Which keys do I need?" below). You can start with only
   `ANTHROPIC_API_KEY` and `WHOP_API_KEY`.
2. Open `config/settings.yaml` and change `base_url` to your Whop store link and each product's
   `slug` to the end of its Whop link.
3. Find your Whop product ids and paste them into `whop_product_id`:

```bash
python -m growth_agent whop-products
```

### Try it first with no keys (practice mode)

`--demo` uses 4 sample posts, a fake Claude and a separate practice database. It makes no API calls.

```bash
python -m growth_agent --demo run-daily
```

```bash
python -m growth_agent --demo review
```

```bash
python -m growth_agent --demo report
```

Delete `data/demo.db` to start practice mode again.

## Daily use

Run everything once (find leads, draft replies, create content):

```bash
python -m growth_agent run-daily
```

Review the drafts (about 10 minutes a day):

```bash
python -m growth_agent review
```

For each draft: `a` approve, `e` edit, `r` reject, `s` skip, `q` quit. For people who replied to you
or commented on your own videos, `d` creates a single-use 20% Whop discount code and adds it to the reply.

Or leave it running so it works on its own schedule (8 AM drafts, posting every 5 minutes within the
limits, 9 PM report):

```bash
python -m growth_agent schedule
```

Other commands: `scout`, `draft`, `create`, `publish`, `report`, `status`, and these two:

```bash
python -m growth_agent add-lead --platform quora --url "https://..." --text "How do I fix HTMT above 0.9?"
```

```bash
python -m growth_agent mark-posted 12 "https://link-to-what-you-posted"
```

## Which keys do I need?

| Key | Needed for | Where to get it |
|---|---|---|
| `ANTHROPIC_API_KEY` | Everything (Claude drafts and scores) | platform.claude.com |
| `WHOP_API_KEY` | Nightly sales report | Whop dashboard, Developer, API keys |
| `WHOP_COMPANY_ID` | Discount codes only | Your Whop business id (`biz_...`) |
| `REDDIT_*` | Finding and replying on Reddit | reddit.com/prefs/apps ("script" app). Reddit may ask you to request API access first |
| `YOUTUBE_API_KEY` | Finding YouTube comments | Google Cloud console, YouTube Data API v3 |
| `YOUTUBE_CLIENT_SECRETS_FILE` | Posting YouTube replies | Google Cloud OAuth client (Desktop app); then run `python -m growth_agent auth-youtube` once |
| `X_*` | X search and replies | developer.x.com. Search needs a paid API plan. Skip X if you don't want to pay |

## Where the brief couldn't be followed exactly, and why

- **TikTok, LinkedIn, Facebook groups, Quora, ResearchGate:** none of these offer a permitted API for
  searching other people's posts for marketing. TikTok's Research API is only for non-commercial
  academic research, and scraping breaks these sites' terms. So the agent does not monitor them. When
  you see a good question there, add it with `add-lead`; the agent drafts the reply and you post it.
- **Clicks per UTM:** Whop's API reports sales but not link clicks. Put daily clicks in `data/clicks.csv`
  (copy `data/clicks.example.csv`) from your Whop dashboard or link shortener. Views, saves and comments
  from YouTube Studio / TikTok / X / LinkedIn go in `data/content_metrics.csv`.
- **Sales attribution:** sales are tied to a topic through the single-use discount codes from replies,
  or through UTM data when Whop records it. Other sales still count in the totals.
- **Buffer:** not connected. Content is saved as files in `content/` for you to post or upload to your
  scheduler, so nothing goes out unreviewed.
- **Reddit:** many subreddits ban self-promotion. Check each subreddit's rules before approving a reply
  with a link, and remove subreddits from `settings.yaml` if they don't allow it.

## Files

```
sem-growth-agent/
  config/settings.yaml      keywords, subreddits, limits, CTAs, banned phrases
  .env                      your keys (never commit this)
  growth_agent/
    agents/                 scout.py, engager.py, creator.py, analyst.py
    sources/                reddit.py, youtube.py, x.py, manual.py
    llm.py                  Claude Haiku (triage) and Sonnet (drafting)
    guardrails.py           the hard rules above
    review.py               the approval screen
    publisher.py            rate-limited posting of approved replies
    whop_client.py          Whop products, sales, discount codes
    graph.py                LangGraph pipeline: Scout -> Engager -> Creator
    scheduler.py            APScheduler jobs
  data/                     growth.db, leads.json, engagement_log.csv, clicks.csv
  content/                  daily content drafts
  reports/                  nightly reports
  tests/                    run with: python -m pytest
```
