/* =====================================================================
   NaikTaraf.AI — CHAT LOGIC
   You should not need to edit this file to change any text.
   All words, links and rules are in content.js.

   How it works, in short:
   - The conversation is a list of STEPS:
       lang → code → q1 … q5 → rec (→ later) → pre → lesson ×3 → post → badge
   - Everything the worker has seen is kept in `state.log`, and the whole
     `state` is saved in the browser after every tap. On refresh, the chat
     is redrawn from the log and continues at the saved step.
   - Answers are saved as short codes (e.g. "fixing"), never as button
     text, so the chat can be redrawn in any language.
   ===================================================================== */
(function () {
  "use strict";

  var STORAGE_KEY = "naiktaraf-progress-v1";
  var QUESTION_ORDER = ["q1", "q2", "q3", "q4", "q5"];
  var LESSON_COUNT = 3;

  var chatEl, inputBar, inputEl, sendBtn, startAgainBtn;
  var state;
  var busy = false;   // blocks a second tap while a first one is being handled

  /* ---------------------------------------------------------------
     Saving and loading progress (localStorage, safely wrapped)
     ------------------------------------------------------------- */
  function freshState() {
    return {
      lang: null,        // chosen language code
      code: null,        // participant code, e.g. "P07"
      answers: {},       // { q1: "machine", q3: ["operate"], ... }
      q3Draft: [],       // Q3 choices before "Done" is tapped
      step: "lang",
      lessonIndex: 0,    // 0, 1 or 2
      opened: false,     // has the worker opened the link for this step?
      badgeDate: null,   // "05/11/2026", fixed when the badge is earned
      log: [],           // everything shown in the chat so far
    };
  }

  function loadState() {
    try {
      var raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        var saved = JSON.parse(raw);
        if (saved && typeof saved.step === "string" && Array.isArray(saved.log)) {
          var s = freshState();
          for (var k in saved) { if (Object.prototype.hasOwnProperty.call(saved, k)) s[k] = saved[k]; }
          return s;
        }
      }
    } catch (e) { /* storage blocked or data damaged: start fresh */ }
    return freshState();
  }

  function saveState() {
    try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) { /* storage blocked */ }
  }

  function clearState() {
    try { window.localStorage.removeItem(STORAGE_KEY); } catch (e) { /* storage blocked */ }
  }

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
     Links
     ------------------------------------------------------------- */
  function isRealLink(url) { return /^https?:\/\//i.test(url || ""); }

  function formIsReady() {
    return isRealLink(SETTINGS.FORM_BASE_URL) && SETTINGS.FORM_BASE_URL.indexOf("FORM_ID") === -1;
  }

  // English text of an answer, so Form data is the same whatever language was used.
  function answerInEnglish(qid) {
    var q = findQuestion(qid);
    var value = state.answers[qid];
    if (Array.isArray(value)) {
      return value.map(function (id) { var o = findOption(q, id); return o ? pick(o.label, "en") : id; }).join("; ");
    }
    var opt = findOption(q, value);
    return opt ? pick(opt.label, "en") : "";
  }

  function buildFormUrl(stageText) {
    var lang = findLanguage(state.lang);
    var fields = [
      [SETTINGS.CODE_ENTRY_ID, state.code],
      [SETTINGS.STAGE_ENTRY_ID, stageText],
      [SETTINGS.Q1_ENTRY_ID, answerInEnglish("q1")],
      [SETTINGS.Q2_ENTRY_ID, answerInEnglish("q2")],
      [SETTINGS.Q3_ENTRY_ID, answerInEnglish("q3") || "None"],
      [SETTINGS.Q4_ENTRY_ID, answerInEnglish("q4")],
      [SETTINGS.Q5_ENTRY_ID, answerInEnglish("q5")],
      [SETTINGS.ROLE_ENTRY_ID, roleName()],
      [SETTINGS.LANGUAGE_ENTRY_ID, lang ? lang.formValue : ""],
    ];
    var parts = ["usp=pp_url"];
    fields.forEach(function (f) {
      if (f[0] && f[1]) parts.push(encodeURIComponent(f[0]) + "=" + encodeURIComponent(f[1]));
    });
    var base = SETTINGS.FORM_BASE_URL;
    return base + (base.indexOf("?") === -1 ? "?" : "&") + parts.join("&");
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

  // Turn one saved log entry into an element on screen.
  function renderEntry(entry, animate) {
    if (entry.type === "bot") {
      var vars = {};
      var text;
      if (entry.key === "question") {
        text = pick(findQuestion(entry.q).text);
      } else {
        if (entry.key === "recIntro") vars = { role: roleName(), skills: skillsText() };
        if (entry.key === "recPlan") vars = { time: timeText() };
        if (entry.key === "badge") vars = { role: roleName() };
        if (entry.key === "lesson") {
          var lesson = LESSONS[lessonIdAt(entry.i)];
          vars = { n: entry.i + 1, title: lesson ? pick(lesson.title) : "" };
        }
        text = msg(entry.key, vars, entry.lang);
      }
      return bubble("bot", richText(text), animate);
    }

    if (entry.type === "user") {
      var userText = "";
      if (entry.text !== undefined) {
        userText = entry.text;
      } else if (entry.btn) {
        userText = msg(entry.btn);
      } else if (entry.q) {
        var q = findQuestion(entry.q);
        if (Array.isArray(entry.a)) {
          userText = entry.a.length
            ? entry.a.map(function (id) { var o = findOption(q, id); return o ? pick(o.label) : ""; }).join(", ")
            : msg("noneSelected");
        } else {
          var o = findOption(q, entry.a);
          userText = o ? pick(o.label) : "";
        }
      }
      return bubble("user", escapeHtml(userText), animate);
    }

    if (entry.type === "badge") return renderBadge(animate);

    return document.createComment("unknown entry");
  }

  // Add a new entry: save it in the log and show it.
  function push(entry) {
    state.log.push(entry);
    removeControls();
    chatEl.appendChild(renderEntry(entry, true));
  }

  function bot(key, extra) {
    var entry = { type: "bot", key: key };
    if (extra) for (var k in extra) entry[k] = extra[k];
    push(entry);
  }

  function userBtn(key) { push({ type: "user", btn: key }); }

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
  function stepKey() { return state.step === "lesson" ? "lesson:" + state.lessonIndex : state.step; }

  function removeControls() {
    var old = document.getElementById("replies");
    if (old) old.parentNode.removeChild(old);
  }

  // Wrap a tap handler so it only runs once, and only for the step it was drawn for.
  function guarded(fn) {
    var drawnFor = stepKey();
    return function (ev) {
      if (busy || stepKey() !== drawnFor) return;
      busy = true;
      try { fn(ev); } finally {
        busy = false;
        saveState();
        renderControls();
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

  // A button that opens a link in a new tab, then unlocks the "next" button.
  function makeLinkButton(label, url, ready, nextBtn, hintEl) {
    var a = document.createElement("a");
    a.className = "reply link";
    a.textContent = label;
    a.href = ready ? url : "#";
    a.target = "_blank";
    a.rel = "noopener";
    var drawnFor = stepKey();
    a.addEventListener("click", function (ev) {
      if (stepKey() !== drawnFor) { ev.preventDefault(); return; }
      if (!ready) { ev.preventDefault(); window.alert(msg("linkNotReady")); }
      state.opened = true;
      saveState();
      nextBtn.disabled = false;
      if (hintEl) hintEl.hidden = true;
    });
    return a;
  }

  // Link button + "done" button pair, used for the checks and lessons.
  function linkStep(box, linkLabel, url, ready, doneLabel, onDone) {
    var doneBtn = makeButton(doneLabel, onDone, "primary");
    var hint = null;
    if (SETTINGS.REQUIRE_OPEN_BEFORE_DONE && !state.opened) {
      doneBtn.disabled = true;
      hint = document.createElement("p");
      hint.className = "hint";
      hint.textContent = msg("hintTapFirst", { button: linkLabel });
    }
    box.appendChild(makeLinkButton(linkLabel, url, ready, doneBtn, hint));
    box.appendChild(doneBtn);
    if (hint) box.appendChild(hint);
  }

  function renderControls() {
    removeControls();
    inputBar.hidden = state.step !== "code";

    var box = document.createElement("div");
    box.id = "replies";
    box.className = "replies";
    var step = state.step;

    if (step === "lang") {
      LANGUAGES.forEach(function (l) {
        box.appendChild(makeButton(l.name, function () { chooseLanguage(l.id); }));
      });

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
      var stageText = step === "pre" ? SETTINGS.STAGE_PRE_TEXT : SETTINGS.STAGE_POST_TEXT;
      linkStep(box, msg("btnOpenCheck"), buildFormUrl(stageText), formIsReady(),
        msg("btnFinishedCheck"), step === "pre" ? finishPreTest : finishPostTest);

    } else if (step === "lesson") {
      var lesson = LESSONS[lessonIdAt(state.lessonIndex)] || {};
      linkStep(box, msg("btnWatch", { n: state.lessonIndex + 1 }), lesson.url, isRealLink(lesson.url),
        msg("btnDone"), finishLesson);
    }

    if (box.childNodes.length) chatEl.appendChild(box);
    scrollToBottom();
  }

  /* ---------------------------------------------------------------
     Moving through the conversation
     ------------------------------------------------------------- */
  function goTo(step) {
    state.step = step;
    state.opened = false;

    if (step === "code") {
      bot("askCode");
    } else if (QUESTION_ORDER.indexOf(step) !== -1) {
      bot("question", { q: step });
    } else if (step === "rec") {
      bot("recIntro"); bot("recPlan"); bot("recNote");
    } else if (step === "pre") {
      bot("preTest");
    } else if (step === "lesson") {
      if (state.lessonIndex === 0) bot("safetyNote");
      bot("lesson", { i: state.lessonIndex });
    } else if (step === "post") {
      bot("postTest");
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
    goTo("code");
    focusCodeInputSoon();
  }

  function submitCode(ev) {
    ev.preventDefault();
    if (busy || state.step !== "code") return;
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
      renderControls();
      if (state.step === "code") focusCodeInputSoon();
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
    if (busy || state.step !== "q3") return;
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

  function startNow() { userBtn("btnStartNow"); goTo("pre"); }

  function remindLater() {
    userBtn("btnRemindLater");
    bot("remindLater");
    goTo("later");
  }

  function finishPreTest() {
    userBtn("btnFinishedCheck");
    state.lessonIndex = 0;
    goTo("lesson");
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

  function finishPostTest() { userBtn("btnFinishedCheck"); goTo("badge"); }

  function startAgain() {
    if (!window.confirm(msg("confirmStartAgain"))) return;
    clearState();
    begin();
    saveState();
    renderAll();
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
  }

  function scrollToBottom() { chatEl.scrollTop = chatEl.scrollHeight; }

  function focusCodeInputSoon() { setTimeout(function () { if (!inputBar.hidden) inputEl.focus(); }, 50); }

  function renderAll() {
    chatEl.innerHTML = "";
    state.log.forEach(function (entry) { chatEl.appendChild(renderEntry(entry, false)); });
    applyLanguageToPage();
    renderControls();
  }

  function init() {
    chatEl = document.getElementById("chat");
    inputBar = document.getElementById("input-bar");
    inputEl = document.getElementById("code-input");
    sendBtn = document.getElementById("send-btn");
    startAgainBtn = document.getElementById("start-again");

    inputBar.addEventListener("submit", submitCode);
    startAgainBtn.addEventListener("click", startAgain);

    state = loadState();
    if (state.log.length === 0) begin();

    try {
      renderAll();
    } catch (e) {
      // Saved progress could not be shown (e.g. content.js changed a lot): start fresh.
      clearState();
      begin();
      renderAll();
    }
    saveState();

    // Offline support: only works on https:// or localhost
    if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost")) {
      navigator.serviceWorker.register("sw.js").catch(function () { /* offline mode not available */ });
    }
  }

  document.addEventListener("DOMContentLoaded", init);
})();
