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
| `forms/create-google-form.gs` | One-click builder for the Pre/Post Skills Check Google Form (10 questions, BM/English, answers go to a Google Sheet) | Run once |

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
