/* Entrepreneurship Tutorial Hub — app logic.
   Words and examples live in content.js; this file should rarely need changes. */
(function () {
  "use strict";

  var C = window.HUB_CONTENT || {};
  var STORE_KEY = "entre-hub-v1";
  var TABS = ["home", "idea", "bmc", "finance", "marketing"];
  var BMC_FIELDS = [
    ["customerSegments", "Customer Segments"],
    ["valueProposition", "Value Proposition"],
    ["channels", "Channels"],
    ["customerRelationships", "Customer Relationships"],
    ["revenueStreams", "Revenue Streams"],
    ["keyResources", "Key Resources"],
    ["keyActivities", "Key Activities"],
    ["keyPartners", "Key Partners"],
    ["costStructure", "Cost Structure"]
  ];
  var IDEA_QS = [
    ["q1", "c1", "What problem does it solve?"],
    ["q2", "c2", "Who has this problem in Malaysia?"],
    ["q3", "c3", "How do they solve it now?"],
    ["q4", "c4", "Why is your solution better?"]
  ];
  var WEEK_NAMES = {
    idea: "Tutorial 1 - Idea Validation",
    bmc: "Tutorial 2 - Business Model Canvas",
    finance: "Tutorial 3 - Financial Planning",
    marketing: "Tutorial 4 - Marketing for New Venture"
  };

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  /* ---------------- Storage ---------------- */
  var state = { profile: {}, idea: {}, bmc: {}, fin: {}, mkt: {}, ui: {} };
  try {
    var saved = JSON.parse(localStorage.getItem(STORE_KEY) || "null");
    if (saved && typeof saved === "object") {
      Object.keys(state).forEach(function (k) { if (saved[k]) state[k] = saved[k]; });
    }
  } catch (e) { /* storage unavailable: app still works, just won't remember */ }

  var saveTimer;
  function save() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(function () {
      var el = $("#save-state");
      try {
        localStorage.setItem(STORE_KEY, JSON.stringify(state));
        el.textContent = "Saved in this browser at " + new Date().toLocaleTimeString("en-MY", { hour: "numeric", minute: "2-digit" }) + ".";
      } catch (e) {
        el.textContent = "This browser is not saving (private mode?). Download a PDF to keep your work.";
      }
    }, 250);
  }

  function getPath(path) {
    var p = path.split("."); return (state[p[0]] || {})[p[1]];
  }
  function setPath(path, val) {
    var p = path.split("."); state[p[0]] = state[p[0]] || {}; state[p[0]][p[1]] = val;
  }
  function txt(v) { return (v == null ? "" : String(v)).trim(); }
  function num(v) { var n = parseFloat(v); return isFinite(n) ? n : 0; }
  function fill(tpl, vars) {
    return String(tpl).replace(/\{(\w+)\}/g, function (m, k) { return vars[k] != null ? vars[k] : m; });
  }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; });
  }
  function rm(n, dp) {
    if (dp == null) dp = 2;
    var neg = n < 0;
    var s = Math.abs(n).toLocaleString("en-MY", { minimumFractionDigits: dp, maximumFractionDigits: dp });
    return (neg ? "-RM " : "RM ") + s;
  }

  /* ---------------- Toast ---------------- */
  var toastTimer;
  function toast(msg) {
    var t = $("#toast"); t.textContent = msg; t.hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { t.hidden = true; }, 2600);
  }

  /* ---------------- Tabs ---------------- */
  function showTab(name, focus) {
    if (TABS.indexOf(name) < 0) name = "home";
    TABS.forEach(function (t) {
      $("#panel-" + t).hidden = t !== name;
      var b = $("#tab-" + t); b.setAttribute("aria-selected", t === name ? "true" : "false");
      if (t === name && b.scrollIntoView) b.scrollIntoView({ block: "nearest", inline: "nearest" });
    });
    state.ui.tab = name; save();
    if (location.hash.slice(1) !== name) {
      try { history.replaceState(null, "", "#" + name); } catch (e) { /* ignore */ }
    }
    if (focus) window.scrollTo(0, 0);
    if (name === "home") updateHomeProgress();
  }
  $$(".tab").forEach(function (b) { b.addEventListener("click", function () { showTab(b.dataset.tab, true); }); });
  $$("[data-go]").forEach(function (b) { b.addEventListener("click", function () { showTab(b.dataset.go, true); }); });
  window.addEventListener("hashchange", function () { showTab(location.hash.slice(1), true); });

  /* ---------------- Content from content.js ---------------- */
  var lecturer = C.lecturerName || "Dr Suleiman";
  $("#home-title").textContent = "Entrepreneurship Tutorial Toolkit - " + lecturer;
  var ideaEx = C.ideaExamples || {};
  $$("[data-hint]").forEach(function (el) { el.placeholder = ideaEx[el.dataset.hint] || ""; });
  var bmcEx = C.bmcExamples || {};
  $$(".bmc-brand").forEach(function (el) { el.textContent = C.bmcExampleBrand || "Tealive"; });
  $$("[data-bmc]").forEach(function (el) {
    var ex = bmcEx[el.dataset.bmc];
    el.placeholder = ex ? "For " + (C.bmcExampleBrand || "Tealive") + ": " + ex : "";
  });
  if (C.financialExampleName) $("#fin-example-name").textContent = C.financialExampleName;

  /* ---------------- Bind inputs ---------------- */
  var onChange = { idea: updateIdea, bmc: updateBmc, fin: updateFinance, mkt: updateMarketingLive, profile: function () {} };
  $$("[data-bind]").forEach(function (el) {
    var path = el.dataset.bind, v = getPath(path);
    if (el.type === "checkbox") el.checked = !!v; else if (v != null) el.value = v;
    el.addEventListener(el.type === "checkbox" ? "change" : "input", function () {
      setPath(path, el.type === "checkbox" ? el.checked : el.value);
      save();
      var fn = onChange[path.split(".")[0]]; if (fn) fn();
    });
  });
  function setField(path, val) {
    setPath(path, val);
    var el = $('[data-bind="' + path + '"]');
    if (el) { if (el.type === "checkbox") el.checked = !!val; else el.value = val == null ? "" : val; }
  }

  /* ================= WEEK 1: IDEA VALIDATION ================= */
  function ideaScore() {
    var s = state.idea, pts = 0, tips = [];
    var idea = txt(s.idea);
    if (idea.length >= 15) pts += 1;
    else if (idea.length >= 5) { pts += 0.5; tips.push("Describe your business idea in more detail (what you sell and to whom)."); }
    else tips.push("Write your business idea in the first box.");
    IDEA_QS.forEach(function (q) {
      var a = txt(s[q[0]]);
      if (a.length >= 20) pts += 1;
      else if (a.length > 0) { pts += 0.5; tips.push("Give a fuller answer for: \"" + q[2] + "\""); }
      else tips.push("Answer: \"" + q[2] + "\"");
      if (s[q[1]]) pts += 0.5; else tips.push("Tick the box for \"" + q[2] + "\" when you are happy with your answer.");
    });
    var interviews = 0;
    ["i1", "i2", "i3"].forEach(function (k) { if (txt(s[k]).length >= 15) { pts += 1; interviews++; } });
    if (interviews < 3) tips.push("Interview " + (3 - interviews) + " more potential customer" + (interviews === 2 ? "" : "s") + " and write what they said.");
    pts = Math.round(pts * 2) / 2;
    var verdict = pts >= 8 ? "Strong idea validation. You're ready for the Business Model Canvas."
      : pts >= 5 ? "Getting there. Fill the gaps below to make your idea stronger."
      : "Needs more work. Talk to real customers before moving on.";
    return { score: pts, verdict: verdict, tips: tips };
  }
  function renderScore() {
    var r = ideaScore();
    $("#score-box").hidden = false;
    $("#score-num").textContent = r.score % 1 ? r.score.toFixed(1) : r.score;
    $(".score-dial").style.setProperty("--pct", r.score * 10);
    $("#score-verdict").textContent = r.verdict;
    $("#score-tips").innerHTML = r.tips.length
      ? r.tips.slice(0, 5).map(function (t) { return "<li>" + esc(t) + "</li>"; }).join("") + (r.tips.length > 5 ? "<li>...and " + (r.tips.length - 5) + " more.</li>" : "")
      : "<li>Everything is filled in. Well done!</li>";
  }
  $("#btn-score").addEventListener("click", function () {
    state.ui.scoreShown = true; save(); renderScore();
    $("#score-box").scrollIntoView({ behavior: "smooth", block: "nearest" });
  });
  function updateIdea() { if (state.ui.scoreShown) renderScore(); }

  /* ================= WEEK 2: BMC ================= */
  function bmcFilled() { return BMC_FIELDS.filter(function (f) { return txt(state.bmc[f[0]]).length >= 3; }); }
  function updateBmc() {
    var filled = bmcFilled().map(function (f) { return f[0]; });
    $$("[data-bmc]").forEach(function (el) {
      el.closest(".bmc-box").classList.toggle("filled", filled.indexOf(el.dataset.bmc) >= 0);
    });
    var n = filled.length;
    $("#bmc-status").innerHTML = '<span>' + n + ' of 9 boxes filled</span><span class="meter"><i style="width:' + (n / 9 * 100) + '%"></i></span>'
      + (n === 9 ? '<span style="color:var(--good)">Complete</span>' : "");
    if (!$("#bmc-check-box").hidden) renderBmcCheck();
  }
  function renderBmcCheck() {
    var filled = bmcFilled().map(function (f) { return f[0]; });
    var missing = BMC_FIELDS.filter(function (f) { return filled.indexOf(f[0]) < 0; });
    var box = $("#bmc-check-box"); box.hidden = false;
    box.innerHTML = missing.length === 0
      ? "<strong>Yes! Your BMC is complete.</strong> All 9 boxes are filled. Download the PDF or submit it to your lecturer."
      : "<strong>Not yet: " + missing.length + " box" + (missing.length > 1 ? "es" : "") + " still empty.</strong><ul class=\"missing-list\">"
        + missing.map(function (f) { return "<li>" + f[1] + "</li>"; }).join("") + "</ul>";
  }
  $("#btn-bmc-check").addEventListener("click", renderBmcCheck);
  $("#btn-bmc-save").addEventListener("click", function () {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); toast("BMC saved in this browser"); }
    catch (e) { toast("Could not save here. Download the PDF to keep your work."); }
  });

  /* ================= WEEK 3: FINANCIALS ================= */
  function finCalc() {
    var f = state.fin;
    var price = num(f.price), cost = num(f.cost), rent = num(f.rent), salary = num(f.salary), units = num(f.units), capital = num(f.capital);
    var ppu = price - cost, fixed = rent + salary;
    var monthly = ppu * units - fixed;
    var be = ppu > 0 ? Math.ceil(fixed / ppu) : null;
    var rows = [], bal = capital;
    for (var m = 1; m <= 6; m++) {
      var inflow = price * units, cogs = cost * units, net = inflow - cogs - rent - salary;
      bal += net;
      rows.push({ m: m, inflow: inflow, cogs: cogs, rent: rent, salary: salary, net: net, bal: bal });
    }
    var any = ["price", "cost", "rent", "salary", "units"].some(function (k) { return txt(f[k]) !== ""; });
    return { price: price, cost: cost, rent: rent, salary: salary, units: units, capital: capital, ppu: ppu, fixed: fixed, monthly: monthly, be: be, rows: rows, any: any };
  }
  function kpi(id, value, cls, note) {
    var v = $("#k-" + id), card = v.closest(".kpi");
    v.textContent = value; card.classList.remove("good", "bad"); if (cls) card.classList.add(cls);
    if (note != null) $("#k-" + id + "-n").textContent = note;
  }
  function updateFinance() {
    var r = finCalc();
    if (!r.any) {
      kpi("ppu", "-", "", "Price minus cost");
      kpi("month", "-", "", "After rent and salary");
      kpi("be", "-", "", "Units to sell per month to cover all costs");
      $("#fin-explain").textContent = "";
    } else {
      kpi("ppu", rm(r.ppu), r.ppu > 0 ? "good" : "bad", "RM " + r.price.toFixed(2) + " price - RM " + r.cost.toFixed(2) + " cost");
      kpi("month", rm(r.monthly), r.monthly >= 0 ? "good" : "bad", r.monthly >= 0 ? "Profit after rent and salary" : "Loss after rent and salary");
      if (r.be == null) kpi("be", "Not possible", "bad", "Your price must be higher than your cost");
      else kpi("be", r.be.toLocaleString("en-MY") + " units", r.units >= r.be ? "good" : "bad",
        "About " + Math.ceil(r.be / 26) + " a day (26 working days). Sales of " + rm(r.be * r.price, 0) + " a month.");
      var msg;
      if (r.ppu <= 0) msg = "You lose money on every unit you sell. Increase your price or find a cheaper supplier.";
      else if (r.units >= r.be) msg = "Good news: you plan to sell " + r.units.toLocaleString("en-MY") + " units, which is " + (r.units - r.be).toLocaleString("en-MY") + " more than your break-even of " + r.be.toLocaleString("en-MY") + ". In 6 months you could make " + rm(r.monthly * 6, 0) + " profit.";
      else msg = "Careful: you need to sell " + (r.be - r.units).toLocaleString("en-MY") + " more units a month to break even. Try a higher price, lower rent, or more sales.";
      $("#fin-explain").textContent = msg;
    }
    var tb = $("#cash-table tbody");
    tb.innerHTML = r.rows.map(function (x) {
      return "<tr><td>Month " + x.m + "</td><td>" + rm(x.inflow) + "</td><td>" + rm(-x.cogs) + "</td><td>" + rm(-x.rent) + "</td><td>" + rm(-x.salary)
        + '</td><td class="' + (x.net < 0 ? "neg" : "pos") + '">' + rm(x.net) + '</td><td class="' + (x.bal < 0 ? "neg" : "") + '">' + rm(x.bal) + "</td></tr>";
    }).join("");
  }
  $("#btn-fin-example").addEventListener("click", function () {
    var ex = C.financialExample || {};
    ["price", "cost", "rent", "salary", "units", "capital"].forEach(function (k) { if (ex[k] != null) setField("fin." + k, String(ex[k])); });
    save(); updateFinance(); toast("Example loaded. Change the numbers to your own.");
  });

  /* ================= WEEK 4: MARKETING ================= */
  function pick(list, seed, n) {
    list = list || []; var out = [];
    for (var i = 0; i < Math.min(n, list.length); i++) out.push(list[(seed * n + i) % list.length]);
    return out;
  }
  function mktPlan() {
    var m = state.mkt;
    var vars = { product: txt(m.product) || "your product", customer: txt(m.customer) || "your customers" };
    var seed = m.seed || 0;
    var lower = vars.product.toLowerCase();
    var valueBased = (C.valueBasedKeywords || []).some(function (k) { return lower.indexOf(String(k).toLowerCase()) >= 0; });
    var cost = num(state.fin.cost), calc = "";
    if (cost > 0) {
      calc = valueBased
        ? "Your cost per unit (from Tutorial 3) is " + rm(cost) + ". Ask 5 customers what they would pay, then price above " + rm(cost * 1.6) + " if they value it highly."
        : "Your cost per unit (from Tutorial 3) is " + rm(cost) + ". With a 30% to 60% markup, sell at " + rm(cost * 1.3) + " to " + rm(cost * 1.6) + ".";
    } else {
      calc = "Tip: fill in Tutorial 3 (Financials) and we will suggest a price in RM here.";
    }
    return {
      tiktok: pick(C.tiktokIdeas, seed, 3).map(function (t) { return fill(t, vars); }),
      ig: pick(C.instagramCaptions, seed, 3).map(function (t) { return fill(t, vars); }),
      poster: fill(pick(C.posterHeadlines, seed, 1)[0] || "{product}", vars),
      strategy: valueBased ? "Value-based pricing" : "Cost-plus pricing",
      why: valueBased ? C.valueBasedExplanation : C.costPlusExplanation,
      calc: calc
    };
  }
  function renderMarketing() {
    var p = mktPlan();
    $("#mkt-out").hidden = false; $("#btn-mkt-more").hidden = false;
    $("#mkt-tiktok").innerHTML = p.tiktok.map(function (t) { return "<li>" + esc(t) + "</li>"; }).join("");
    $("#mkt-ig").innerHTML = p.ig.map(function (t, i) {
      return '<div class="caption"><p>' + esc(t) + '</p><button class="btn" data-copy-cap="' + i + '">Copy</button></div>';
    }).join("");
    $$("[data-copy-cap]", $("#mkt-ig")).forEach(function (b) {
      b.addEventListener("click", function () { copyText(p.ig[+b.dataset.copyCap], null); });
    });
    $("#mkt-poster").textContent = p.poster;
    $("#mkt-price-pill").textContent = "Suggested: " + p.strategy;
    $("#mkt-price-why").textContent = p.why;
    $("#mkt-price-calc").textContent = p.calc;
  }
  $("#btn-mkt-gen").addEventListener("click", function () {
    if (!txt(state.mkt.product) || !txt(state.mkt.customer)) { toast("Fill in your product and target customer first."); return; }
    state.mkt.generated = true; save(); renderMarketing();
    $("#mkt-out").scrollIntoView({ behavior: "smooth", block: "start" });
  });
  $("#btn-mkt-more").addEventListener("click", function () {
    state.mkt.seed = (state.mkt.seed || 0) + 1; save(); renderMarketing(); toast("New ideas generated");
  });
  function updateMarketingLive() { if (state.mkt.generated) renderMarketing(); }

  /* ================= HOME PROGRESS ================= */
  function progress() {
    var i = state.idea, m = state.mkt;
    var ideaDone = [txt(i.idea), txt(i.q1), txt(i.q2), txt(i.q3), txt(i.q4), txt(i.i1), txt(i.i2), txt(i.i3)].filter(Boolean).length;
    var r = finCalc();
    return {
      idea: [ideaDone, 8],
      bmc: [bmcFilled().length, 9],
      finance: [["price", "cost", "rent", "salary", "units"].filter(function (k) { return txt(state.fin[k]) !== ""; }).length, 5],
      marketing: [(txt(m.product) ? 1 : 0) + (txt(m.customer) ? 1 : 0) + (m.generated ? 1 : 0) + (m.posted ? 1 : 0) + (m.first ? 1 : 0), 5],
      _r: r
    };
  }
  function updateHomeProgress() {
    var p = progress();
    ["idea", "bmc", "finance", "marketing"].forEach(function (k) {
      var el = $("#prog-" + k), d = p[k][0], t = p[k][1];
      el.textContent = d === 0 ? "Not started" : d >= t ? "Done" : d + " of " + t + " parts done";
      el.classList.toggle("done", d >= t);
    });
  }

  /* ================= SUMMARIES (WhatsApp + PDF) ================= */
  function header() {
    var p = state.profile;
    return [
      "Name: " + (txt(p.name) || "-"),
      "Matric no: " + (txt(p.matric) || "-"),
      "Class/Group: " + (txt(p.group) || "-"),
      "Date: " + new Date().toLocaleDateString("en-MY", { day: "numeric", month: "short", year: "numeric" })
    ];
  }
  // Each returns sections: [{h: heading, lines: [..]}] or {h, table:{head, rows}}
  function sections(which) {
    var S = [];
    if (which === "idea") {
      var i = state.idea, sc = ideaScore();
      S.push({ h: "Business idea", lines: [txt(i.idea) || "-"] });
      IDEA_QS.forEach(function (q) { S.push({ h: (i[q[1]] ? "[x] " : "[ ] ") + q[2], lines: [txt(i[q[0]]) || "-"] }); });
      S.push({ h: (i.c5 ? "[x] " : "[ ] ") + "Interviews with 3 potential customers", lines: [
        "1. " + (txt(i.i1) || "-"), "2. " + (txt(i.i2) || "-"), "3. " + (txt(i.i3) || "-")] });
      S.push({ h: "Validation score", lines: [sc.score + " / 10 - " + sc.verdict] });
    } else if (which === "bmc") {
      var n = bmcFilled().length;
      BMC_FIELDS.forEach(function (f) { S.push({ h: f[1], lines: [txt(state.bmc[f[0]]) || "-"] }); });
      S.push({ h: "Completeness", lines: [n + " of 9 boxes filled" + (n === 9 ? " (complete)" : "")] });
    } else if (which === "finance") {
      var r = finCalc();
      S.push({ h: "My numbers", lines: [
        "Product price: " + rm(r.price), "Cost per product: " + rm(r.cost), "Monthly rent: " + rm(r.rent),
        "Staff salary: " + rm(r.salary), "Expected units sold per month: " + r.units.toLocaleString("en-MY"),
        "Starting capital: " + rm(r.capital)] });
      S.push({ h: "Results", lines: [
        "Profit per unit: " + rm(r.ppu),
        "Monthly profit: " + rm(r.monthly),
        "Break-even units: " + (r.be == null ? "Not possible (price is not higher than cost)" : r.be.toLocaleString("en-MY") + " units per month")] });
      S.push({ h: "6-month cashflow", table: {
        head: ["Month", "Cash in", "Product cost", "Rent", "Salary", "Net", "Balance"],
        rows: r.rows.map(function (x) { return ["Month " + x.m, rm(x.inflow), rm(-x.cogs), rm(-x.rent), rm(-x.salary), rm(x.net), rm(x.bal)]; }) } });
    } else if (which === "marketing") {
      var m = state.mkt, p = mktPlan();
      S.push({ h: "Product and customer", lines: ["My product is: " + (txt(m.product) || "-"), "My target customer is: " + (txt(m.customer) || "-")] });
      if (m.generated) {
        S.push({ h: "TikTok content ideas", lines: p.tiktok.map(function (t, k) { return (k + 1) + ". " + t; }) });
        S.push({ h: "Instagram captions", lines: p.ig.map(function (t, k) { return (k + 1) + ". " + t; }) });
        S.push({ h: "Poster headline", lines: [p.poster] });
        S.push({ h: "Pricing strategy: " + p.strategy, lines: [p.why, p.calc] });
      } else {
        S.push({ h: "Marketing plan", lines: ["Not generated yet."] });
      }
      S.push({ h: "Action checklist", lines: [
        (m.posted ? "[x]" : "[ ]") + " Have you posted?",
        (m.first ? "[x]" : "[ ]") + " Have you got your first customer?",
        "Notes: " + (txt(m.notes) || "-")] });
    }
    return S;
  }
  function sectionsToText(S) {
    return S.map(function (s) {
      if (s.table) {
        return "*" + s.h + "*\n" + s.table.rows.map(function (r) { return r[0] + ": in " + r[1] + ", net " + r[5] + ", balance " + r[6]; }).join("\n");
      }
      return "*" + s.h + "*\n" + s.lines.join("\n");
    }).join("\n\n");
  }
  function summaryText(which) {
    var list = which === "all" ? ["idea", "bmc", "finance", "marketing"] : [which];
    var out = ["ENTREPRENEURSHIP TUTORIAL SUBMISSION", "To: " + lecturer].concat(header()).join("\n");
    list.forEach(function (w) {
      out += "\n\n==== " + WEEK_NAMES[w].toUpperCase() + " ====\n\n" + sectionsToText(sections(w));
    });
    return out;
  }

  /* ---------------- Submit sheet ---------------- */
  var lastFocus;
  function openSheet(which) {
    if (!txt(state.profile.name)) toast("Tip: add your name on the Home tab so your lecturer knows it's you.");
    var text = summaryText(which);
    $("#sheet-text").value = text;
    var n = String(C.lecturerWhatsApp || "").replace(/\D/g, "");
    $("#btn-wa").href = "https://wa.me/" + n + "?text=" + encodeURIComponent(text);
    lastFocus = document.activeElement;
    $("#sheet").hidden = false; $("#btn-copy").focus();
  }
  function closeSheet() { $("#sheet").hidden = true; if (lastFocus) lastFocus.focus(); }
  $("#btn-sheet-close").addEventListener("click", closeSheet);
  $("#sheet").addEventListener("click", function (e) { if (e.target.id === "sheet") closeSheet(); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && !$("#sheet").hidden) closeSheet(); });
  function copyText(text, fallbackEl) {
    function fallback() {
      if (fallbackEl) { fallbackEl.focus(); fallbackEl.select(); toast("Text selected. Press Copy on your keyboard or phone."); }
      else toast("Could not copy automatically. Please select and copy the text.");
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () { toast("Copied! Now paste it in WhatsApp."); }, fallback);
    } else fallback();
  }
  $("#btn-copy").addEventListener("click", function () { copyText($("#sheet-text").value, $("#sheet-text")); });

  /* ---------------- PDF ---------------- */
  function pdfSafe(s) {
    return String(s).replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[–—]/g, "-")
      .replace(/…/g, "...").replace(/[^\x09\x0A\x0D\x20-\x7E\xA0-\xFF]/g, "");
  }
  function makePdf(which) {
    if (!window.jspdf || !window.jspdf.jsPDF) { toast("PDF tool is still loading. Check your internet and try again."); return; }
    var doc = new window.jspdf.jsPDF({ unit: "mm", format: "a4" });
    var W = 210, M = 16, y = 18, maxW = W - M * 2;
    function need(h) { if (y + h > 282) { doc.addPage(); y = 18; } }
    doc.setFillColor(11, 122, 98); doc.rect(0, 0, W, 6, "F");
    doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.setTextColor(11, 122, 98);
    doc.text(pdfSafe("ENTREPRENEURSHIP TUTORIAL TOOLKIT - " + lecturer.toUpperCase()), M, y); y += 8;
    doc.setFontSize(18); doc.setTextColor(21, 48, 42); doc.text(pdfSafe(WEEK_NAMES[which]), M, y); y += 8;
    doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.setTextColor(88, 112, 106);
    doc.text(pdfSafe(header().join("   |   ")), M, y, { maxWidth: maxW }); y += 10;

    sections(which).forEach(function (s) {
      need(14);
      doc.setFont("helvetica", "bold"); doc.setFontSize(12); doc.setTextColor(21, 48, 42);
      doc.splitTextToSize(pdfSafe(s.h), maxW).forEach(function (l) { need(6); doc.text(l, M, y); y += 6; });
      if (s.table) {
        var cols = s.table.head.length, cw = maxW / cols;
        doc.setFontSize(8.5); doc.setFillColor(234, 240, 237); need(8); doc.rect(M, y - 4.5, maxW, 7, "F");
        s.table.head.forEach(function (h, k) { doc.text(pdfSafe(h), k === 0 ? M + 1 : M + cw * (k + 1) - 1, y, { align: k === 0 ? "left" : "right" }); });
        y += 7; doc.setFont("helvetica", "normal");
        s.table.rows.forEach(function (r) {
          need(6);
          r.forEach(function (c, k) { doc.text(pdfSafe(c), k === 0 ? M + 1 : M + cw * (k + 1) - 1, y, { align: k === 0 ? "left" : "right" }); });
          y += 6;
        });
        y += 4; return;
      }
      doc.setFont("helvetica", "normal"); doc.setFontSize(10.5); doc.setTextColor(40, 60, 55);
      s.lines.forEach(function (line) {
        doc.splitTextToSize(pdfSafe(line), maxW).forEach(function (l) { need(5.5); doc.text(l, M, y); y += 5.5; });
      });
      y += 4;
    });
    var pages = doc.getNumberOfPages();
    for (var pg = 1; pg <= pages; pg++) {
      doc.setPage(pg); doc.setFontSize(8); doc.setTextColor(140, 150, 146);
      doc.text("Page " + pg + " of " + pages, W - M, 290, { align: "right" });
    }
    var name = txt(state.profile.name).replace(/[^\w]+/g, "-").replace(/^-|-$/g, "") || "student";
    doc.save(which + "-" + name + ".pdf");
    toast("PDF downloaded");
  }

  /* ---------------- Clear a tab (two-tap confirm) ---------------- */
  var CLEAR_MAP = { idea: "idea", bmc: "bmc", finance: "fin", marketing: "mkt" };
  function clearTab(btn, which) {
    if (!btn.classList.contains("confirm")) {
      btn.classList.add("confirm"); btn.dataset.label = btn.textContent; btn.textContent = "Tap again to delete everything in this tutorial";
      setTimeout(function () { if (btn.classList.contains("confirm")) { btn.classList.remove("confirm"); btn.textContent = btn.dataset.label; } }, 4000);
      return;
    }
    btn.classList.remove("confirm"); btn.textContent = btn.dataset.label;
    var key = CLEAR_MAP[which];
    state[key] = {};
    if (which === "idea") { state.ui.scoreShown = false; $("#score-box").hidden = true; }
    if (which === "marketing") { $("#mkt-out").hidden = true; $("#btn-mkt-more").hidden = true; }
    if (which === "bmc") $("#bmc-check-box").hidden = true;
    $$('[data-bind^="' + key + '."]').forEach(function (el) { if (el.type === "checkbox") el.checked = false; else el.value = ""; });
    save(); updateAll(); toast("Tutorial cleared");
  }

  /* ---------------- Action buttons ---------------- */
  document.addEventListener("click", function (e) {
    var b = e.target.closest("[data-action]"); if (!b) return;
    var a = b.dataset.action, w = b.dataset.which;
    if (a === "submit") openSheet(w);
    else if (a === "pdf") makePdf(w);
    else if (a === "clear") clearTab(b, w);
  });

  /* ---------------- Start ---------------- */
  function updateAll() {
    updateIdea(); updateBmc(); updateFinance();
    if (state.mkt.generated) renderMarketing();
    updateHomeProgress();
  }
  updateAll();
  showTab(location.hash.slice(1) || state.ui.tab || "home", false);
})();
