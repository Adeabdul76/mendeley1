# Entrepreneurship Tutorial Hub

An all-in-one website for Dr Suleiman's diploma entrepreneurship tutorials.
It works on phones and laptops, and students do not need to log in.

| Tab | What students do |
|---|---|
| Home | Pick this week's tutorial, enter their name, matric number and class |
| Week 1 Idea Validation | Answer a 5-part checklist, get a validation score out of 10, download a PDF |
| Week 2 BMC | Fill in the 9-box Business Model Canvas (with Tealive examples), check it is complete, download a PDF |
| Week 3 Financials | Enter prices and costs in RM, see profit, break-even and a 6-month cashflow, download a PDF |
| Week 4 Marketing | Get TikTok ideas, Instagram captions, a poster headline and a pricing strategy, download a PDF |

Every tab has a **Submit to Lecturer** button. It creates a text summary that the student copies and sends to you on WhatsApp.
Students' work saves automatically in their own browser. Nothing is sent to a server.

## The files

| File | What it is | Do you edit it? |
|---|---|---|
| `content.js` | All examples, hints, TikTok ideas, captions, headlines, your name and WhatsApp number | **Yes, this is the one to edit** |
| `index.html` | The page layout | Rarely |
| `style.css` | Colours and fonts | Rarely |
| `app.js` | Calculations and buttons | No |

---

## 1. Run it on your own computer

**The easy way (nothing to install):**
1. On GitHub, click the green **Code** button, then **Download ZIP**.
2. Unzip the folder.
3. Double-click `index.html`. It opens in Chrome, Edge or Safari. That's it.

(You need internet the first time so the fonts and the PDF tool can load.)

**Optional, if you have Python installed:** open a terminal in the folder and run
`python3 -m http.server 8000`, then go to http://localhost:8000.

---

## 2. Put it online (free)

### Option A: Netlify Drop (about 2 minutes, no GitHub needed)
1. Go to https://app.netlify.com/drop and sign up free (you can use Google).
2. Drag the unzipped project folder onto the page.
3. Netlify gives you a link like `https://random-name-123.netlify.app`.
4. Optional: **Site configuration → Change site name** to something like `entrepreneurship-dr-suleiman`,
   so your link becomes `https://entrepreneurship-dr-suleiman.netlify.app`.

With Drop, you drag the folder again each time you change something.

### Option B: Vercel or Netlify connected to GitHub (updates by itself)
1. Go to https://vercel.com (or https://app.netlify.com) and **sign up with GitHub**.
2. Click **Add New → Project** (Netlify: **Add new site → Import an existing project**).
3. Choose the `mendeley1` repository.
4. Leave every setting as it is. There is no build command or framework to choose. Click **Deploy**.
5. You get a link like `https://mendeley1.vercel.app`.

From then on, every change you save on GitHub goes live automatically about a minute later.
(Choose the branch that has these files. If it is not merged yet, merge it into `main` first, or pick the branch in the project settings.)

---

## 3. Edit the examples without coding

Everything students see as examples is in **one file: `content.js`**.

1. Open the repository on GitHub and click **`content.js`**.
2. Click the **pencil icon** (Edit this file) at the top right.
3. Change only the words **inside the "double quotes"**. For example, to use ZUS Coffee instead of Tealive:
   ```
   bmcExampleBrand: "ZUS Coffee",
   customerSegments: "Office workers, university students, coffee lovers in cities",
   ```
4. Click **Commit changes…**, then **Commit changes** again.
5. If you used Option B above, the live site updates in about 1 minute. With Netlify Drop, download the ZIP again and drag it in again.

**What you can change in `content.js`:**
- `lecturerName`: your name on the home page and the PDFs
- `lecturerWhatsApp`: your number, e.g. `"60123456789"`. The "Open WhatsApp" button then goes straight to you.
- `ideaExamples`: grey hint text in Week 1
- `bmcExampleBrand` and `bmcExamples`: the brand and examples in the 9 BMC boxes
- `financialExample`: the numbers for the "Load example" button in Week 3
- `tiktokIdeas`, `instagramCaptions`, `posterHeadlines`: the Week 4 idea lists. Add as many as you want.
  `{product}` and `{customer}` are replaced with what the student typed.
- `valueBasedKeywords`: words that make the site suggest value-based pricing instead of cost-plus

**Rules so nothing breaks:**
- Keep the `"quotes"` at both ends, and the comma `,` at the end of each line.
- If you need a quote mark inside the text, type `\"` (see the TikTok examples).
- Made a mistake? Click **History** on GitHub and restore the previous version.

---

## Good to know
- Work is saved per browser. If a student changes phone or clears browser data, their work is lost, so they should download the PDF each week.
- Nothing is collected. You receive the student's work only when they send it to you on WhatsApp.
