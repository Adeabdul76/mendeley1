# NaikTaraf.AI — career-coach chatbot prototype (IIMaCC 2026)

A mobile-first web chatbot that coaches factory production operators in Penang
whose jobs are changing because of automation. It runs in a phone browser from
one link: no app download and no login.

## Files

| File | What it is | Who edits it |
|---|---|---|
| `content.js` | **All text**, in 4 languages, plus questions, role rules, lesson links and Google Form settings | Your team |
| `app.js` | Chat logic | Developers only |
| `index.html` | Page structure | Rarely |
| `style.css` | Colours and layout | Rarely |
| `sw.js` | Lets the app open without internet after the first visit | Rarely |
| `assets/logo.png`, `assets/badge.png` | Images. These are placeholders, so replace them with your designer's versions (keep the same file names) | Designer |
| `CLAUDE.md` | The project brief | Team |
| `assets/lessons/lesson1.mp4` … `lesson3.mp4` | The 3 lesson videos (made from the Canva lessons). They play inside the chat. To replace one, upload a new MP4 with the same name | Team |
| `forms/create-google-form.gs` | One-click builder for the Pre/Post Skills Check Google Form (10 questions, BM/English, answers go to a Google Sheet) | Run once |

## How the chatbot works (for workers)

1. Choose a language, agree to the privacy note, and enter the participant code.
2. Answer 5 tap-to-answer check-in questions and get a recommended next role.
3. Answer a 10-question **pre-assessment inside the chat**.
4. Watch 3 short lesson videos inside the chat. The chat moves on by itself when a video ends.
5. Answer the same 10 questions as a **final assessment** and see the before and after scores.
6. Download the Level 1 badge.

A progress bar at the top shows which of the 5 stages the worker is in.

**Where the answers go:** both assessments are sent automatically, in the background, to the Google Form and then into the "NaikTaraf.AI – Responses" Google Sheet (one row for "Pre" and one for "Post"). Google marks each row out of 10. If a phone is offline, the answers are kept on the phone and sent the next time the chatbot is opened with internet.

## Before launch: things to replace in `content.js`

1. **Lesson videos:** replace `LESSON_1_URL`, `LESSON_2_URL` and `LESSON_3_URL` with full links starting with `https://`.
2. **Google Form:**
   - In the Form, create these questions:
     - *Participant code* (short answer)
     - *Stage* (multiple choice with the options `Pre` and `Post`)
     - Seven more short-answer questions: *Current job*, *Years in manufacturing*, *Skills already confident in*, *Work interest*, *Break time available*, *Recommended role*, *Chatbot language*.
   - Open the Form's ⋮ menu → **Get pre-filled link**, type a sample answer in every field, and click **Get link**.
   - The link contains parts like `entry.123456789=...`. Copy each `entry.` number into the matching `..._ENTRY_ID` line in `content.js`, and copy the start of the link (up to `viewform`) into `FORM_BASE_URL`.
3. **Mandarin and Tamil:** ask fluent speakers to check every line marked `// TODO: check by fluent speaker`.

Until real links are added, tapping a lesson or check button shows "this link is not ready yet". You can still tap through the whole flow for testing.

## Badge

The badge is `assets/badge.png` with the participant code and date (DD/MM/YYYY) written on top. If your designer's badge has the blank space in a different place, change `BADGE_CODE_Y` and `BADGE_DATE_Y` in `content.js`.

## Try it on your computer

Double-clicking `index.html` works for most things. For the full experience (offline mode and badge download), run a small local web server from this folder:

```bash
python3 -m http.server 8000
```

Then open http://localhost:8000 in your browser. In Chrome, press F12 and switch on the phone view to see it at phone size.

## Publish it (GitHub Pages, free)

On GitHub, go to **Settings → Pages**. Under "Build and deployment", choose **Deploy from a branch**, select the branch and the `/ (root)` folder, and click **Save**. After a minute or two, GitHub shows the link to share with workers.

## Privacy

The app only asks for a participant code (P01–P99). Progress is saved only in the worker's own phone browser. The check-in answers reach your team only through the pre-filled Google Form.
