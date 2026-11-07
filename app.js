/* =====================================================================
   NaikTaraf.AI — CHAT LOGIC
   You should not need to edit this file to change any text.
   All words, links, questions and rules are in content.js.

   How it works, in short:
   - The conversation is a list of STEPS:
       lang → consent → code → q1 … q5 → rec (→ later)
       → pre (10 questions) → lesson ×3 → post (10 questions) → badge
   - Everything the worker has seen is kept in `state.log`, and the whole
     `state` is saved in the browser after every tap. On refresh, the chat
     is redrawn from the log and continues at the saved step.
   - Answers are saved as short codes (e.g. "fixing"), never as button
     text, so the chat can be redrawn in any language.
   - Pre-test and post-test answers are sent to the Google Form in the
     background. If the phone is offline they wait in an "outbox" and are
     sent the next time the page is open with internet.
   ===================================================================== */
(function () {
  "use strict";

  var STORAGE_KEY = "naiktaraf-progress-v2";
  var OUTBOX_KEY = "naiktaraf-outbox-v1";
  var QUESTION_ORDER = ["q1", "q2", "q3", "q4", "q5"];
  var LESSON_COUNT = 3;
  var STAGE_COUNT = 5;

  var chatEl, inputBar, inputEl, sendBtn, startAgainBtn, progressSteps, progressLabel;
  var state;
  var busy = false;        // blocks a second tap while a first one is being handled
  var queue = [];          // new chat entries waiting to be shown (typing effect)
  var animating = false;   // true while the typing effect is showing messages
  var generation = 0;      // changes on "Start again" so old timers stop
  var outbox = [];         // Google Form submissions not sent yet
  var sending = false;

  /* ---------------------------------------------------------------
     Saving and loading progress (localStorage, safely wrapped)
     ------------------------------------------------------------- */
  function freshState() {
    return {
      lang: null,        // chosen language code
      code: null,        // participant code, e.g. "P07"
      answers: {},       // { q1: "machine", q3: ["operate"], ... }
      q3Draft: [],       // Q3 choices before "Done" is tapped
      quiz: { pre: [], post: [] },   // chosen answer number for each question
      scores: {},        // { pre: 4, post: 9 }
      qIndex: 0,         // current question in the pre-test / post-test
      step: "lang",
      lessonIndex: 0,    // 0, 1 or 2
      opened: false,     // lesson video watched (or link opened) for this step
      badgeDate: null,   // "05/11/2026", fixed when the badge is earned
      log: [],           // everything shown in the chat so far
    };
  }

  function storageGet(key) {
    try { return window.localStorage.getItem(key); } catch (e) { return null; }
  }
  function storageSet(key, value) {
    try { window.localStorage.setItem(key, value); } catch (e) { /* storage blocked */ }
  }
  function storageRemove(key) {
    try { window.localStorage.removeItem(key); } catch (e) { /* storage blocked */ }
  }

  function loadState() {
    try {
      var raw = storageGet(STORAGE_KEY);
      if (raw) {
        var saved = JSON.parse(raw);
        if (saved && typeof saved.step === "string" && Array.isArray(saved.log)) {
          var s = freshState();
          for (var k in saved) { if (Object.prototype.hasOwnProperty.call(saved, k)) s[k] = saved[k]; }
          return s;
        }
      }
    } catch (e) { /* damaged data: start fresh */ }
    return freshState();
  }

  function saveState() { storageSet(STORAGE_KEY, JSON.stringify(state)); }
  function clearState() { storageRemove(STORAGE_KEY); }

  /* ---------------------------------------------------------------
     Text helpers
     ------------------------------------------------------------- */
  function currentLang() { return state.lang || DEFAULT_LANGUAGE; }

  // Pick the right language from { ms: "...", en: "..." }, falling back to English.
  function pick(obj, lang) {
    if (!obj) return "";
    if (typeof obj === "string") return obj;
    lang = lang || currentLang();
    if (obj[lang] !== undefined && obj[lang] !== "") return obj[lang];
    return obj.en || "";
  }

  // Replace {placeholders} with values.
  function fill(text, vars) {
    return String(text).replace(/\{(\w+)\}/g, function (whole, name) {
      return vars && vars[name] !== undefined ? vars[name] : whole;
    });
  }

  function msg(key, vars, lang) { return fill(pick(MESSAGES[key], lang), vars); }

  function escapeHtml(text) {
    return String(text).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  // Safe HTML with **bold** support.
  function richText(text) {
    return escapeHtml(text).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  }

  function findQuestion(id) {
    for (var i = 0; i < QUESTIONS.length; i++) if (QUESTIONS[i].id === id) return QUESTIONS[i];
    return null;
  }

  function findOption(question, optionId) {
    if (!question) return null;
    for (var i = 0; i < question.options.length; i++) {
      if (question.options[i].id === optionId) return question.options[i];
    }
    return null;
  }

  function findLanguage(id) {
    for (var i = 0; i < LANGUAGES.length; i++) if (LANGUAGES[i].id === id) return LANGUAGES[i];
    return null;
  }

  /* ---------------------------------------------------------------
     Recommendation (rules live in content.js)
     ------------------------------------------------------------- */
  function getPlan() {
    var a = state.answers;
    return RULES_BY_INTEREST[a.q4] || RULES_BY_JOB[a.q1] || RULES_BY_JOB.other;
  }

  function roleName() { return ROLES[getPlan().role] || ""; }

  function lessonIdAt(index) { return getPlan().lessons[index]; }

  function lessonTitleAt(index) {
    var lesson = LESSONS[lessonIdAt(index)];
    return lesson ? pick(lesson.title) : "";
  }

  function skillsText() {
    var q = findQuestion("q3");
    var lang = currentLang();
    var phrases = (state.answers.q3 || []).map(function (id) {
      var opt = findOption(q, id);
      if (!opt) return "";
      return (opt.phrase && opt.phrase[lang]) ? opt.phrase[lang] : pick(opt.label);
    }).filter(Boolean);

    if (phrases.length === 0) return msg("skillsNone");
    if (phrases.length === 1) return phrases[0];
    return phrases.slice(0, -1).join(msg("listSeparator")) + msg("listAnd") + phrases[phrases.length - 1];
  }

  function timeText() {
    var opt = findOption(findQuestion("q5"), state.answers.q5);
    return opt ? pick(opt.time || opt.label) : "";
  }

  /* ---------------------------------------------------------------
     Sending pre-test / post-test answers to the Google Form
     ------------------------------------------------------------- */
  function isRealLink(url) { return /^https?:\/\//i.test(url || ""); }

  function formIsReady() {
    return isRealLink(SETTINGS.FORM_BASE_URL) && SETTINGS.FORM_BASE_URL.indexOf("FORM_ID") === -1;
  }

  // English text of a check-in answer, so data is the same whatever language was used.
  function answerInEnglish(qid) {
    var q = findQuestion(qid);
    var value = state.answers[qid];
    if (Array.isArray(value)) {
      return value.map(function (id) { var o = findOption(q, id); return o ? pick(o.label, "en") : id; }).join("; ");
    }
    var opt = findOption(q, value);
    return opt ? pick(opt.label, "en") : "";
  }

  function buildSubmission(stage) {
    var lang = findLanguage(state.lang);
    var fields = [
      [SETTINGS.CODE_ENTRY_ID, state.code],
      [SETTINGS.STAGE_ENTRY_ID, stage === "pre" ? SETTINGS.STAGE_PRE_TEXT : SETTINGS.STAGE_POST_TEXT],
      [SETTINGS.Q1_ENTRY_ID, answerInEnglish("q1")],
      [SETTINGS.Q2_ENTRY_ID, answerInEnglish("q2")],
      [SETTINGS.Q3_ENTRY_ID, answerInEnglish("q3") || "None"],
      [SETTINGS.Q4_ENTRY_ID, answerInEnglish("q4")],
      [SETTINGS.Q5_ENTRY_ID, answerInEnglish("q5")],
      [SETTINGS.ROLE_ENTRY_ID, roleName()],
      [SETTINGS.LANGUAGE_ENTRY_ID, lang ? lang.formValue : ""],
    ];
    QUIZ.forEach(function (q, i) {
      var chosen = state.quiz[stage][i];
      if (q.entry && q.choices[chosen]) fields.push([q.entry, q.choices[chosen].form]);
    });
    var parts = ["pageHistory=0%2C1"];   // the Form has two pages
    fields.forEach(function (f) {
      if (f[0] && f[1]) parts.push(encodeURIComponent(f[0]) + "=" + encodeURIComponent(f[1]));
    });
    return parts.join("&");
  }

  function loadOutbox() {
    try { outbox = JSON.parse(storageGet(OUTBOX_KEY) || "[]"); } catch (e) { outbox = []; }
    if (!Array.isArray(outbox)) outbox = [];
  }
  function saveOutbox() { storageSet(OUTBOX_KEY, JSON.stringify(outbox)); }

  function queueSubmission(stage) {
    outbox.push(buildSubmission(stage));
    saveOutbox();
    sendOutbox();
  }

  // Send waiting answers one at a time. Google does not let the page read its
  // reply, so a successful network request counts as "sent".
  function sendOutbox() {
    if (sending || !outbox.length || !formIsReady() || !window.fetch) return;
    sending = true;
    var url = SETTINGS.FORM_BASE_URL.replace(/\/viewform.*$/, "/formResponse");
    window.fetch(url, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: outbox[0],
    }).then(function () {
      outbox.shift();
      saveOutbox();
      sending = false;
      sendOutbox();
    }).catch(function () {
      sending = false;   // offline: try again later
    });
  }

  /* ---------------------------------------------------------------
     Drawing chat bubbles
     ------------------------------------------------------------- */
  function bubble(who, html, animate) {
    var el = document.createElement("div");
    el.className = "msg " + who + (animate ? "" : " no-anim");
    el.innerHTML = html;
    return el;
  }

  function botText(entry) {
    if (entry.key === "question") return pick(findQuestion(entry.q).text);
    if (entry.key === "quiz") {
      var q = QUIZ[entry.i];
      return "**" + msg("quizHeader", { n: entry.i + 1, total: QUIZ.length }) + "**\n" + (q ? pick(q.text) : "");
    }
    var vars = {};
    if (entry.key === "recIntro") vars = { role: roleName(), skills: skillsText() };
    if (entry.key === "recPlan") vars = { time: timeText() };
    if (entry.key === "badge") vars = { role: roleName() };
    if (entry.key === "pathOverview") vars = { l1: lessonTitleAt(0), l2: lessonTitleAt(1), l3: lessonTitleAt(2) };
    if (entry.key === "lesson") vars = { n: entry.i + 1, title: lessonTitleAt(entry.i) };
    if (entry.key === "consentDeclined") vars = { button: msg("btnAgree") };
    if (entry.vars) for (var k in entry.vars) vars[k] = entry.vars[k];
    return msg(entry.key, vars, entry.lang);
  }

  function userText(entry) {
    if (entry.text !== undefined) return entry.text;
    if (entry.btn) return msg(entry.btn);
    if (entry.q === "quiz") {
      var qz = QUIZ[entry.i];
      return qz && qz.choices[entry.a] ? pick(qz.choices[entry.a]) : "";
    }
    if (entry.q) {
      var q = findQuestion(entry.q);
      if (Array.isArray(entry.a)) {
        return entry.a.length
          ? entry.a.map(function (id) { var o = findOption(q, id); return o ? pick(o.label) : ""; }).join(", ")
          : msg("noneSelected");
      }
      var o = findOption(q, entry.a);
      return o ? pick(o.label) : "";
    }
    return "";
  }

  // Turn one saved log entry into an element on screen.
  function renderEntry(entry, animate) {
    if (entry.type === "bot") return bubble("bot", richText(botText(entry)), animate);
    if (entry.type === "user") return bubble("user", escapeHtml(userText(entry)), animate);
    if (entry.type === "badge") return renderBadge(animate);
    return document.createComment("unknown entry");
  }

  // Add a new entry: save it in the log and queue it for showing.
  function push(entry) {
    state.log.push(entry);
    queue.push(entry);
  }

  function bot(key, extra) {
    var entry = { type: "bot", key: key };
    if (extra) for (var k in extra) entry[k] = extra[k];
    push(entry);
  }

  function userBtn(key) { push({ type: "user", btn: key }); }

  function reducedMotion() {
    return window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  // How long the "typing…" dots show before a bot message appears.
  function typingDelay(entry) {
    if (!SETTINGS.TYPING_EFFECT || reducedMotion() || entry.type === "user") return 0;
    if (entry.type === "badge") return 400;
    return Math.min(1300, 450 + botText(entry).length * 6);
  }

  function typingBubble() {
    var el = document.createElement("div");
    el.className = "msg bot typing";
    el.setAttribute("aria-label", "…");
    el.innerHTML = "<span></span><span></span><span></span>";
    return el;
  }

  // Show queued entries one by one, then draw the buttons for the current step.
  function flush() {
    removeControls();
    updateProgress();
    if (animating) return;
    animating = true;
    var myGeneration = generation;
    (function next() {
      if (myGeneration !== generation) return;
      if (!queue.length) {
        animating = false;
        renderControls();
        return;
      }
      var entry = queue.shift();
      var delay = typingDelay(entry);
      if (!delay) {
        chatEl.appendChild(renderEntry(entry, true));
        scrollToBottom();
        next();
        return;
      }
      var dots = typingBubble();
      chatEl.appendChild(dots);
      scrollToBottom();
      setTimeout(function () {
        if (myGeneration !== generation) return;
        if (dots.parentNode) dots.parentNode.removeChild(dots);
        chatEl.appendChild(renderEntry(entry, true));
        scrollToBottom();
        next();
      }, delay);
    })();
  }

  /* ---------------------------------------------------------------
     Progress bar
     ------------------------------------------------------------- */
  function stageNumber() {
    switch (state.step) {
      case "pre": return 2;
      case "lesson": return 3;
      case "post": return 4;
      case "badge": return 5;
      default: return 1;
    }
  }

  function updateProgress() {
    var n = stageNumber();
    var bars = progressSteps.children;
    for (var i = 0; i < bars.length; i++) {
      bars[i].className = i + 1 < n ? "done" : (i + 1 === n ? (n === STAGE_COUNT ? "done" : "current") : "");
    }
    progressLabel.textContent = msg("progressLabel", { n: n, total: STAGE_COUNT, label: msg("stage" + n) });
  }

  /* ---------------------------------------------------------------
     Badge (drawn with the browser's built-in canvas)
     ------------------------------------------------------------- */
  function todayMalaysian() {
    var d = new Date();
    var dd = String(d.getDate()).padStart(2, "0");
    var mm = String(d.getMonth() + 1).padStart(2, "0");
    return dd + "/" + mm + "/" + d.getFullYear();
  }

  function renderBadge(animate) {
    var card = document.createElement("div");
    card.className = "badge-card" + (animate ? "" : " no-anim");

    var canvas = document.createElement("canvas");
    canvas.width = 800;
    canvas.height = 800;
    canvas.setAttribute("role", "img");
    canvas.setAttribute("aria-label", msg("badgeAlt") + " — " + state.code + " — " + state.badgeDate);
    card.appendChild(canvas);

    var img = new Image();
    img.onload = function () { drawBadge(canvas, img); };
    img.onerror = function () { drawBadge(canvas, null); };
    img.src = "assets/badge.png";

    var dl = document.createElement("button");
    dl.type = "button";
    dl.className = "reply gold";
    dl.textContent = msg("btnDownloadBadge");
    dl.addEventListener("click", function () { downloadBadge(canvas); });
    card.appendChild(dl);
    return card;
  }

  function drawBadge(canvas, img) {
    var ctx = canvas.getContext("2d");
    var w, h;
    if (img && img.naturalWidth) {
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      w = canvas.width; h = canvas.height;
      ctx.drawImage(img, 0, 0);
    } else {
      // Simple fallback if badge.png is missing
      w = canvas.width; h = canvas.height;
      ctx.fillStyle = "#FFB703";
      ctx.beginPath(); ctx.arc(w / 2, h / 2, w * 0.48, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#FFFFFF";
      ctx.beginPath(); ctx.arc(w / 2, h / 2, w * 0.42, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#1F3864";
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.font = "bold " + Math.round(w * 0.09) + "px sans-serif";
      ctx.fillText("LEVEL 1", w / 2, h * 0.45);
    }
    if (SETTINGS.BADGE_TEXT_PANEL) {
      // White rounded label behind the code and date, so they are always readable
      var top = h * (SETTINGS.BADGE_CODE_Y - SETTINGS.BADGE_CODE_SIZE * 0.95);
      var bottom = h * (SETTINGS.BADGE_DATE_Y + SETTINGS.BADGE_DATE_SIZE * 0.95);
      var pw = w * 0.46, px = (w - pw) / 2, ph = bottom - top, r = ph * 0.25;
      ctx.fillStyle = "#FFFFFF";
      ctx.beginPath();
      ctx.moveTo(px + r, top);
      ctx.arcTo(px + pw, top, px + pw, bottom, r);
      ctx.arcTo(px + pw, bottom, px, bottom, r);
      ctx.arcTo(px, bottom, px, top, r);
      ctx.arcTo(px, top, px + pw, top, r);
      ctx.closePath();
      ctx.fill();
    }
    ctx.fillStyle = SETTINGS.BADGE_TEXT_COLOUR;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "bold " + Math.round(w * SETTINGS.BADGE_CODE_SIZE) + "px sans-serif";
    ctx.fillText(state.code || "", w / 2, h * SETTINGS.BADGE_CODE_Y);
    ctx.font = Math.round(w * SETTINGS.BADGE_DATE_SIZE) + "px sans-serif";
    ctx.fillText(state.badgeDate || "", w / 2, h * SETTINGS.BADGE_DATE_Y);
  }

  function downloadBadge(canvas) {
    var fileName = "NaikTaraf-Level1-" + (state.code || "badge") + ".png";
    try {
      canvas.toBlob(function (blob) {
        if (!blob) { window.alert(msg("badgeError")); return; }
        var url = URL.createObjectURL(blob);
        var a = document.createElement("a");
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
      }, "image/png");
    } catch (e) {
      window.alert(msg("badgeError"));
    }
  }

  /* ---------------------------------------------------------------
     Buttons under the latest bot message
     ------------------------------------------------------------- */
  function stepKey() {
    if (state.step === "lesson") return "lesson:" + state.lessonIndex;
    if (state.step === "pre" || state.step === "post") return state.step + ":" + state.qIndex;
    return state.step;
  }

  function removeControls() {
    var old = document.getElementById("replies");
    if (old) old.parentNode.removeChild(old);
  }

  // Wrap a tap handler so it only runs once, and only for the step it was drawn for.
  function guarded(fn) {
    var drawnFor = stepKey();
    return function (ev) {
      if (busy || animating || stepKey() !== drawnFor) return;
      busy = true;
      try { fn(ev); } finally {
        busy = false;
        saveState();
        flush();
      }
    };
  }

  function makeButton(label, onTap, extraClass) {
    var b = document.createElement("button");
    b.type = "button";
    b.className = "reply" + (extraClass ? " " + extraClass : "");
    b.textContent = label;
    b.addEventListener("click", guarded(onTap));
    return b;
  }

  function makeHint(text) {
    var hint = document.createElement("p");
    hint.className = "hint";
    hint.textContent = text;
    return hint;
  }

  // For lessons given as https:// links: opens the link in a new tab,
  // then unlocks the "Done" button.
  function linkStep(box, linkLabel, url, ready, doneLabel, onDone) {
    var doneBtn = makeButton(doneLabel, onDone, "primary");
    var hint = null;
    if (SETTINGS.REQUIRE_OPEN_BEFORE_DONE && !state.opened) {
      doneBtn.disabled = true;
      hint = makeHint(msg("hintTapFirst", { button: linkLabel }));
    }
    var a = document.createElement("a");
    a.className = "reply link";
    a.textContent = linkLabel;
    a.href = ready ? url : "#";
    a.target = "_blank";
    a.rel = "noopener";
    var drawnFor = stepKey();
    a.addEventListener("click", function (ev) {
      if (stepKey() !== drawnFor) { ev.preventDefault(); return; }
      if (!ready) { ev.preventDefault(); window.alert(msg("linkNotReady")); }
      state.opened = true;
      saveState();
      doneBtn.disabled = false;
      if (hint) hint.hidden = true;
    });
    box.appendChild(a);
    box.appendChild(doneBtn);
    if (hint) box.appendChild(hint);
  }

  function isVideoFile(url) { return /\.mp4(\?.*)?$/i.test(url || ""); }

  // "Watch" button that shows and plays the lesson video inside the chat.
  // "Done" unlocks once the video is nearly finished, and the chat moves on
  // by itself when the video ends.
  function videoStep(box, watchLabel, url, doneLabel, onDone) {
    var doneBtn = makeButton(doneLabel, onDone, "primary");
    var hint = null;
    if (SETTINGS.REQUIRE_FULL_VIDEO && !state.opened) {
      doneBtn.disabled = true;
      hint = makeHint(msg("videoHint"));
    }

    var player = document.createElement("video");
    player.className = "lesson-video";
    player.src = url;
    player.controls = true;
    player.preload = "metadata";
    player.setAttribute("playsinline", "");
    player.hidden = true;

    var watchBtn = document.createElement("button");
    watchBtn.type = "button";
    watchBtn.className = "reply link play";
    watchBtn.textContent = watchLabel;
    var drawnFor = stepKey();

    function unlock() {
      if (stepKey() !== drawnFor) return;
      if (!state.opened) { state.opened = true; saveState(); }
      doneBtn.disabled = false;
      if (hint) hint.hidden = true;
    }

    watchBtn.addEventListener("click", function () {
      if (stepKey() !== drawnFor) return;
      watchBtn.hidden = true;
      player.hidden = false;
      var playing = player.play();
      if (playing && playing.catch) playing.catch(function () { /* worker can press play */ });
      player.scrollIntoView({ block: "center", behavior: "smooth" });
    });
    player.addEventListener("timeupdate", function () {
      if (player.duration && player.currentTime / player.duration >= 0.9) unlock();
    });
    player.addEventListener("ended", function () {
      unlock();
      if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(function () {});
      setTimeout(function () { if (stepKey() === drawnFor) doneBtn.click(); }, 600);
    });
    player.addEventListener("error", unlock);   // never leave a worker stuck

    box.appendChild(watchBtn);
    box.appendChild(player);
    box.appendChild(doneBtn);
    if (hint) box.appendChild(hint);
  }

  function renderControls() {
    removeControls();
    updateProgress();
    inputBar.hidden = state.step !== "code";

    var box = document.createElement("div");
    box.id = "replies";
    box.className = "replies";
    var step = state.step;

    if (step === "lang") {
      LANGUAGES.forEach(function (l) {
        box.appendChild(makeButton(l.name, function () { chooseLanguage(l.id); }));
      });

    } else if (step === "consent") {
      box.appendChild(makeButton(msg("btnAgree"), agree, "primary"));
      box.appendChild(makeButton(msg("btnNotNow"), notNow));

    } else if (step === "consentLater") {
      box.appendChild(makeButton(msg("btnAgree"), agree, "primary"));

    } else if (QUESTION_ORDER.indexOf(step) !== -1) {
      var q = findQuestion(step);
      if (q.multiSelect) {
        q.options.forEach(function (opt) {
          var t = document.createElement("button");
          t.type = "button";
          t.className = "reply toggle";
          t.textContent = pick(opt.label);
          t.setAttribute("aria-pressed", state.q3Draft.indexOf(opt.id) !== -1 ? "true" : "false");
          t.addEventListener("click", function () { toggleSkill(opt.id, t); });
          box.appendChild(t);
        });
        box.appendChild(makeButton(msg("btnDone"), finishMultiSelect, "primary"));
      } else {
        q.options.forEach(function (opt) {
          box.appendChild(makeButton(pick(opt.label), function () { answer(q.id, opt.id); }));
        });
      }

    } else if (step === "rec") {
      box.appendChild(makeButton(msg("btnStartNow"), startNow, "primary"));
      box.appendChild(makeButton(msg("btnRemindLater"), remindLater));

    } else if (step === "later") {
      box.appendChild(makeButton(msg("btnStartNow"), startNow, "primary"));

    } else if (step === "pre" || step === "post") {
      var quizItem = QUIZ[state.qIndex];
      if (quizItem) {
        quizItem.choices.forEach(function (choice, index) {
          box.appendChild(makeButton(pick(choice), function () { answerQuiz(step, index); }, "choice"));
        });
      }

    } else if (step === "lesson") {
      var lesson = LESSONS[lessonIdAt(state.lessonIndex)] || {};
      var watchLabel = msg("btnWatch", { n: state.lessonIndex + 1 });
      if (isVideoFile(lesson.url)) {
        videoStep(box, watchLabel, lesson.url, msg("btnDone"), finishLesson);
      } else {
        linkStep(box, watchLabel, lesson.url, isRealLink(lesson.url), msg("btnDone"), finishLesson);
      }
    }

    if (box.childNodes.length) chatEl.appendChild(box);
    scrollToBottom();
    if (step === "code") focusCodeInputSoon();
  }

  /* ---------------------------------------------------------------
     Moving through the conversation
     ------------------------------------------------------------- */
  function goTo(step) {
    state.step = step;
    state.opened = false;

    if (step === "consent") {
      bot("consent");
    } else if (step === "code") {
      bot("askCode");
    } else if (QUESTION_ORDER.indexOf(step) !== -1) {
      bot("question", { q: step });
    } else if (step === "rec") {
      bot("recIntro"); bot("recPlan"); bot("recNote");
    } else if (step === "pre") {
      state.qIndex = 0;
      state.quiz.pre = [];
      bot("preTest");
      bot("quiz", { stage: "pre", i: 0 });
    } else if (step === "lesson") {
      if (state.lessonIndex === 0) bot("safetyNote");
      bot("lesson", { i: state.lessonIndex });
    } else if (step === "post") {
      state.qIndex = 0;
      state.quiz.post = [];
      bot("postTest");
      bot("quiz", { stage: "post", i: 0 });
    } else if (step === "badge") {
      state.badgeDate = todayMalaysian();
      bot("badge");
      push({ type: "badge" });
    }
  }

  function begin() {
    state = freshState();
    bot("welcome", { lang: "ms" });
    bot("welcome", { lang: "en" });
  }

  function chooseLanguage(id) {
    var l = findLanguage(id);
    push({ type: "user", text: l ? l.name : id });
    state.lang = id;
    applyLanguageToPage();
    goTo("consent");
  }

  function agree() {
    userBtn("btnAgree");
    goTo("code");
  }

  function notNow() {
    userBtn("btnNotNow");
    bot("consentDeclined");
    state.step = "consentLater";
  }

  function submitCode(ev) {
    ev.preventDefault();
    if (busy || animating || state.step !== "code") return;
    var typed = inputEl.value.replace(/\s+/g, "").toUpperCase();
    if (!typed) return;
    busy = true;
    try {
      inputEl.value = "";
      push({ type: "user", text: typed });
      var match = /^P(\d\d)$/.exec(typed);
      if (match && match[1] !== "00") {
        state.code = typed;
        bot("codeOk");
        goTo("q1");
      } else {
        bot("codeInvalid");
      }
    } finally {
      busy = false;
      saveState();
      flush();
    }
  }

  function nextQuestion(qid) {
    var i = QUESTION_ORDER.indexOf(qid);
    goTo(i < QUESTION_ORDER.length - 1 ? QUESTION_ORDER[i + 1] : "rec");
  }

  function answer(qid, optionId) {
    state.answers[qid] = optionId;
    push({ type: "user", q: qid, a: optionId });
    nextQuestion(qid);
  }

  function toggleSkill(optionId, buttonEl) {
    if (busy || animating || state.step !== "q3") return;
    var i = state.q3Draft.indexOf(optionId);
    if (i === -1) state.q3Draft.push(optionId); else state.q3Draft.splice(i, 1);
    buttonEl.setAttribute("aria-pressed", i === -1 ? "true" : "false");
    saveState();
  }

  function finishMultiSelect() {
    var q = findQuestion("q3");
    // keep the same order as the buttons
    var chosen = q.options.map(function (o) { return o.id; })
      .filter(function (id) { return state.q3Draft.indexOf(id) !== -1; });
    state.answers.q3 = chosen;
    state.q3Draft = [];
    push({ type: "user", q: "q3", a: chosen });
    nextQuestion("q3");
  }

  function startNow() {
    userBtn("btnStartNow");
    bot("pathOverview");
    goTo("pre");
  }

  function remindLater() {
    userBtn("btnRemindLater");
    bot("remindLater");
    goTo("later");
  }

  function scoreOf(stage) {
    var score = 0;
    QUIZ.forEach(function (q, i) { if (state.quiz[stage][i] === q.correct) score += 1; });
    return score;
  }

  function answerQuiz(stage, choiceIndex) {
    state.quiz[stage][state.qIndex] = choiceIndex;
    push({ type: "user", q: "quiz", i: state.qIndex, a: choiceIndex });
    state.qIndex += 1;
    if (state.qIndex < QUIZ.length) {
      bot("quiz", { stage: stage, i: state.qIndex });
      return;
    }
    var score = scoreOf(stage);
    state.scores[stage] = score;
    queueSubmission(stage);
    if (stage === "pre") {
      bot("preScore", { vars: { score: score, total: QUIZ.length } });
      state.lessonIndex = 0;
      goTo("lesson");
    } else {
      var pre = state.scores.pre || 0;
      bot("postScore", { vars: { score: score, total: QUIZ.length, pre: pre } });
      if (score > pre) bot("postImproved", { vars: { diff: score - pre } });
      else bot("postKeepGoing");
      goTo("badge");
    }
  }

  function finishLesson() {
    userBtn("btnDone");
    if (state.lessonIndex < LESSON_COUNT - 1) {
      state.lessonIndex += 1;
      goTo("lesson");
    } else {
      goTo("post");
    }
  }

  function startAgain() {
    if (!window.confirm(msg("confirmStartAgain"))) return;
    generation += 1;
    queue = [];
    animating = false;
    busy = false;
    clearState();
    chatEl.innerHTML = "";
    begin();
    saveState();
    applyLanguageToPage();
    flush();
  }

  /* ---------------------------------------------------------------
     Page setup
     ------------------------------------------------------------- */
  function applyLanguageToPage() {
    var htmlLang = { ms: "ms", en: "en", zh: "zh-Hans", ta: "ta" }[currentLang()] || "ms";
    document.documentElement.lang = htmlLang;
    startAgainBtn.textContent = msg("startAgain");
    inputEl.placeholder = msg("codePlaceholder");
    inputEl.setAttribute("aria-label", msg("askCode"));
    sendBtn.textContent = msg("btnSend");
    updateProgress();
  }

  function scrollToBottom() { chatEl.scrollTop = chatEl.scrollHeight; }

  function focusCodeInputSoon() { setTimeout(function () { if (!inputBar.hidden) inputEl.focus(); }, 50); }

  // Redraw the whole chat at once (used when the page is opened again).
  function renderAll() {
    chatEl.innerHTML = "";
    state.log.forEach(function (entry) { chatEl.appendChild(renderEntry(entry, false)); });
    applyLanguageToPage();
    renderControls();
  }

  function showWelcomeBack() {
    var note = document.createElement("p");
    note.className = "note";
    note.textContent = msg("welcomeBack");
    var replies = document.getElementById("replies");
    chatEl.insertBefore(note, replies || null);
    scrollToBottom();
  }

  function init() {
    chatEl = document.getElementById("chat");
    inputBar = document.getElementById("input-bar");
    inputEl = document.getElementById("code-input");
    sendBtn = document.getElementById("send-btn");
    startAgainBtn = document.getElementById("start-again");
    progressSteps = document.getElementById("progress-steps");
    progressLabel = document.getElementById("progress-label");

    inputBar.addEventListener("submit", submitCode);
    startAgainBtn.addEventListener("click", startAgain);

    loadOutbox();
    state = loadState();

    if (state.log.length === 0) {
      begin();
      saveState();
      applyLanguageToPage();
      flush();
    } else {
      try {
        renderAll();
        if (state.step !== "lang" && state.step !== "badge") showWelcomeBack();
      } catch (e) {
        // Saved progress could not be shown (e.g. content.js changed a lot): start fresh.
        clearState();
        begin();
        saveState();
        chatEl.innerHTML = "";
        applyLanguageToPage();
        flush();
      }
    }

    // Send any answers that were saved while the phone was offline
    sendOutbox();
    window.addEventListener("online", sendOutbox);

    // Offline support: only works on https:// or localhost
    if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost")) {
      navigator.serviceWorker.register("sw.js").catch(function () { /* offline mode not available */ });
    }
  }

  document.addEventListener("DOMContentLoaded", init);
})();
