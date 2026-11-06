# Project brief: NaikTaraf.AI career-coach chatbot (IIMaCC 2026 prototype)

You are helping a team of business students (not professional developers) at UOW Malaysia KDU Penang build a working prototype for an innovation competition. Explain what you are doing in plain language, keep the code simple, and ask before adding any new library or service.

## What we are building

A mobile-first web chatbot that coaches factory production operators in Penang whose jobs are changing because of automation. It runs in a phone browser from a single link. No app download and no login.

The worker:
1. chooses a language,
2. enters a participant code,
3. answers five tap-to-answer check-in questions,
4. gets a recommended next role,
5. does a pre-test, watches three short lessons, does a post-test,
6. receives a Level 1 digital badge.

## Technical rules

- Plain HTML, CSS and JavaScript only. No frameworks, no build step, no npm packages for the core app.
- Files:
  - `index.html`: page structure
  - `style.css`: styling
  - `app.js`: chat logic
  - `content.js`: ALL text, translations, questions, role rules, lesson links and quiz links, so non-programmers can edit content without touching logic
  - `assets/`: logo.png and badge.png
- Looks like a messaging app: bot bubbles on the left, user bubbles on the right, tap buttons (quick replies) under the latest bot message. Large text (at least 16px), large buttons, works at 360px phone width.
- Save progress in the browser (localStorage), so a worker can close the page and continue later. Wrap localStorage in try/catch so the app still works if storage is blocked. Include a small "Start again" link.
- Never collect names, IC numbers, phone numbers, employee numbers or company names. The participant code (format P01–P99) is the only identifier.
- Brand colours: navy #1F3864, blue #2E75B6, teal #2EC4B6, accent gold #FFB703, light background #F4F7FB.
- Keep everything working offline after first load, except the lesson videos and Google Forms links.

## Languages

Bahasa Melayu (default), English, 中文 (Mandarin) and தமிழ் (Tamil). Every piece of text the worker sees must come from `content.js`, keyed by language. Draft BM and English. For Mandarin and Tamil, add draft translations clearly marked `// TODO: check by fluent speaker`.

## Conversation flow

### Stage 1: Welcome and language
- EN: "Hi! I'm NaikTaraf, your career coach. In about 10 minutes a day, I'll help you learn skills for the jobs that are growing in your factory. Which language do you prefer?"
- BM: "Hai! Saya NaikTaraf, jurulatih kerjaya anda. Dengan kira-kira 10 minit sehari, saya akan bantu anda belajar kemahiran untuk pekerjaan yang semakin berkembang di kilang anda. Bahasa apa yang anda pilih?"
- Buttons: Bahasa Melayu | English | 中文 | தமிழ்

### Stage 1b: Participant code
- Ask: "Please type the participant code given by our team (for example, P07)."
- Validate the format P followed by two digits, case-insensitive. Reject anything else politely.

### Stage 2: Skills check-in (buttons only)
- Q1. What is your current job?
  - Production operator | QC / visual inspector | Machine operator | Material handler / packer | Other
- Q2. How long have you worked in manufacturing?
  - Under 1 year | 1–3 years | 4–10 years | Over 10 years
- Q3. Which of these can you already do confidently? (multi-select, with a "Done" button)
  - Operate machines | Check product quality | Basic machine care | Use a tablet or computer | Read English instructions
- Q4. Which kind of work interests you most?
  - Working with robots | Quality and inspection | Fixing and maintaining machines | Not sure yet
- Q5. How much time can you spend during a break?
  - 5 minutes | 10 minutes | 15 minutes or more

### Stage 3: Recommendation rules
Use Q4 first:

| Q4 answer | Recommended role | Lesson order |
|---|---|---|
| Working with robots | Cobot operator | L1, L3, L2 |
| Quality and inspection | AOI operator / quality technician | L2, L1, L3 |
| Fixing and maintaining machines | Junior maintenance technician | L3, L1, L2 |

If Q4 = "Not sure yet", use Q1:

| Q1 answer | Recommended role | Lesson order |
|---|---|---|
| Production operator | Cobot operator | L1, L3, L2 |
| QC / visual inspector | AOI operator / quality technician | L2, L1, L3 |
| Machine operator | Junior maintenance technician | L3, L1, L2 |
| Material handler / packer | Automated warehouse operator | L1, L3, L2 |
| Other | Cobot operator | L1, L3, L2 |

Message (EN): "Great news! Based on your answers, a good next step for you is **[role]**. You already have strengths in [Q3 skills, or 'learning new things' if none]. To get ready, I've prepared 3 short lessons. Each one takes about [Q5 time]. Ready to start?"
- Buttons: Start now | Remind me later

### Stage 4: Learning
1. First, show the pre-test: "Before we start, please do a quick 10-question check so we can see your progress." Show a button that opens the pre-test Google Form in a new tab, with the participant code and Stage=Pre pre-filled (see "Google Forms links" below). Then show an "I've finished the check" button.
2. Then show the lessons one at a time, in the recommended order: "Lesson [n]: [title] (about 2 minutes). Watch it now, then tap Done." Show a button that opens the video link, then a "Done" button.
3. After the last lesson, show the post-test: "Well done! Please do the final check so we can measure your progress." Use the same Form link, pre-filled with Stage=Post.

### Stage 5: Badge
- "Congratulations! You've completed the [role] Starter Pathway and earned your Level 1 badge. Show it to your supervisor or HR. Next, ask your HR team about practical training for this role."
- Show `assets/badge.png` with the participant code and today's date overlaid, plus a "Download badge" button.

## Lessons (placeholders, to be replaced in content.js)
- L1 Working Safely with Cobots: LESSON_1_URL
- L2 Visual Quality Inspection Basics: LESSON_2_URL
- L3 5S and Preventive Maintenance: LESSON_3_URL

## Google Forms links
The pre-test and post-test are the same Google Form. Its pre-filled link looks like:

`https://docs.google.com/forms/d/e/FORM_ID/viewform?usp=pp_url&entry.111=P01&entry.222=Pre`

In `content.js`, store FORM_BASE_URL, CODE_ENTRY_ID and STAGE_ENTRY_ID as clearly labelled placeholders. Also store the exact option text used in the Form for Pre and Post. Build the link in `app.js`, URL-encoding the values.

## Safety and tone rules (apply to all bot text)
- Short messages (under 60 words), simple everyday words, warm and encouraging.
- Never promise a job, promotion, pay rise or salary. Promotion decisions belong to the company.
- Lessons are awareness only. Workers must follow their company's training and safety rules. If something seems unsafe, stop and report it to a supervisor.

## Optional later feature: "Ask the coach" (do NOT build unless asked)
A free-text question box answered by Claude through a serverless function. The API key must never appear in front-end code.

## Definition of done
- The full flow works end to end on a phone-sized screen in BM and English.
- Tapping the same button twice does not break the flow.
- Refreshing the page resumes where the worker left off.
- "Start again" fully resets the flow.
- The browser console shows no errors.
