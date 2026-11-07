/**
 * NaikTaraf.AI — adds an "HR Dashboard" tab to the "NaikTaraf.AI – Responses"
 * Google Sheet, and keeps it up to date automatically.
 *
 * HOW TO USE (no coding needed):
 *   1. Click "Run" (▶) at the top of this page (the function is setupHrDashboard).
 *   2. Allow the permissions Google asks for (same steps as the Form builder).
 *   3. Open the "NaikTaraf.AI – Responses" Sheet: the new "HR Dashboard" tab is first.
 * After that it refreshes itself every time a worker submits answers (and
 * once an hour). You can also run refreshDashboard any time to update it.
 *
 * Privacy: only participant codes are shown. No names are collected.
 */

// ---------- Settings ----------
var SHEET_ID = '1nKSxm1l6D3EpvIURtb1Z4imceEa0K_5JRuEBN8Oe1a4';   // "NaikTaraf.AI – Responses"
var DASHBOARD_NAME = 'HR Dashboard';
var EXCLUDE_CODES = ['P99'];   // test codes to leave out, e.g. ['P99', 'P98']

// Correct answer for each question (the text before " / " is enough)
var CORRECT = {
  1: 'Robot yang direka untuk bekerja dengan selamat berdekatan manusia',
  2: 'Pastikan kawasan kerja kosong dan tetapan keselamatan dihidupkan',
  3: 'Tekan butang berhenti kecemasan dan laporkan kepada penyelia',
  4: 'Merah',
  5: 'Mencari kecacatan sebelum produk sampai kepada pelanggan',
  6: 'Calar atau retak pada produk',
  7: 'Asingkan dan ikut prosedur tolak/lapor',
  8: 'Pencahayaan yang baik dan bandingkan dengan sampel standard',
  9: 'Tempat kerja yang bersih, teratur dan selamat',
  10: 'Pemeriksaan dan penjagaan berkala supaya mesin tidak rosak',
};

var NAVY = '#1F3864', TEAL = '#2EC4B6', GOLD = '#FFB703', LIGHT = '#F4F7FB', GREY = '#B8C6D9';

// ---------- Run this once ----------
function setupHrDashboard() {
  refreshDashboard();
  var ss = SpreadsheetApp.openById(SHEET_ID);
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'refreshDashboard') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('refreshDashboard').forSpreadsheet(ss).onFormSubmit().create();
  ScriptApp.newTrigger('refreshDashboard').timeBased().everyHours(1).create();
  console.log('HR Dashboard ready: ' + ss.getUrl());
}

// ---------- Pure calculations (no Google services) ----------
function computeDashboard(values, excludeCodes) {
  var headers = values[0].map(function (h) { return String(h).trim(); });
  function col(name) { return headers.indexOf(name); }
  var c = {
    code: col('Kod peserta / Participant code'),
    stage: col('Peringkat / Stage'),
    job: col('Kerja sekarang / Current job'),
    role: col('Peranan dicadangkan / Recommended role'),
    lang: col('Bahasa chatbot / Chatbot language'),
  };
  if (c.code < 0 || c.stage < 0) throw new Error('Could not find the participant code / stage columns.');
  var qCols = [], qNames = [];
  for (var n = 1; n <= 10; n++) {
    var idx = -1;
    for (var h = 0; h < headers.length; h++) if (headers[h].indexOf(n + '. ') === 0) { idx = h; break; }
    qCols.push(idx);
    var title = idx >= 0 ? headers[idx] : 'Question ' + n;
    var en = title.indexOf(' / ') >= 0 ? title.split(' / ').slice(1).join(' / ') : title;
    qNames.push('Q' + n + ' ' + (en.length > 48 ? en.slice(0, 46) + '…' : en));
  }
  var skip = (excludeCodes || []).map(function (x) { return String(x).toUpperCase(); });

  var people = {};   // code -> { pre: record, post: record }
  for (var r = 1; r < values.length; r++) {
    var row = values[r];
    var code = String(row[c.code] || '').trim().toUpperCase();
    var stage = String(row[c.stage] || '').trim();
    if (!/^P\d\d$/.test(code) || skip.indexOf(code) >= 0 || (stage !== 'Pre' && stage !== 'Post')) continue;
    var correct = qCols.map(function (qc, i) {
      var ans = qc >= 0 ? String(row[qc] || '') : '';
      return ans.indexOf(CORRECT[i + 1]) === 0 ? 1 : 0;
    });
    var rec = {
      time: row[0], job: c.job >= 0 ? row[c.job] : '', role: c.role >= 0 ? row[c.role] : '',
      lang: c.lang >= 0 ? row[c.lang] : '', correct: correct,
      score: correct.reduce(function (a, b) { return a + b; }, 0),
    };
    people[code] = people[code] || {};
    people[code][stage === 'Pre' ? 'pre' : 'post'] = rec;   // rows are in time order: keep the latest
  }

  function avg(list) { return list.length ? list.reduce(function (a, b) { return a + b; }, 0) / list.length : null; }
  var codes = Object.keys(people).sort();
  var pres = [], posts = [], gains = [], roles = {}, participants = [];
  codes.forEach(function (code) {
    var p = people[code], latest = p.post || p.pre;
    if (p.pre) pres.push(p.pre.score);
    if (p.post) posts.push(p.post.score);
    if (p.pre && p.post) gains.push(p.post.score - p.pre.score);
    var role = latest.role || 'Unknown';
    roles[role] = roles[role] || { n: 0, pre: [], post: [] };
    roles[role].n += 1;
    if (p.pre) roles[role].pre.push(p.pre.score);
    if (p.post) roles[role].post.push(p.post.score);
    participants.push({
      code: code, job: latest.job, role: role, lang: latest.lang,
      pre: p.pre ? p.pre.score : null, post: p.post ? p.post.score : null,
      change: p.pre && p.post ? p.post.score - p.pre.score : null,
      status: p.post ? 'Badge earned' : 'In progress',
      done: p.post ? p.post.time : null,
    });
  });

  var started = codes.filter(function (k) { return people[k].pre; }).length;
  var completed = posts.length;
  var gapSource = codes.map(function (k) { return people[k].post; }).filter(Boolean);
  var gapStage = 'final';
  if (!gapSource.length) { gapSource = codes.map(function (k) { return people[k].pre; }).filter(Boolean); gapStage = 'pre'; }
  var gaps = qNames.map(function (name, i) {
    var right = gapSource.filter(function (r) { return r.correct[i]; }).length;
    return { name: name, pct: gapSource.length ? right / gapSource.length : null };
  }).sort(function (a, b) { return (a.pct === null ? 2 : a.pct) - (b.pct === null ? 2 : b.pct); });

  return {
    kpi: {
      started: started, completed: completed,
      completion: started ? completed / started : null,
      avgPre: avg(pres), avgPost: avg(posts), avgGain: avg(gains),
    },
    roles: Object.keys(roles).sort().map(function (k) {
      var a = avg(roles[k].pre), b = avg(roles[k].post);
      return { role: k, n: roles[k].n, pre: a, post: b, change: a !== null && b !== null ? b - a : null };
    }),
    gaps: gaps, gapStage: gapStage, participants: participants,
  };
}

// ---------- Drawing the dashboard tab ----------
function findResponsesSheet(ss) {
  var sheets = ss.getSheets();
  for (var i = 0; i < sheets.length; i++) if (sheets[i].getFormUrl()) return sheets[i];
  for (var j = 0; j < sheets.length; j++) {
    var first = sheets[j].getRange(1, 1, 1, Math.max(1, sheets[j].getLastColumn())).getValues()[0];
    if (first.indexOf('Kod peserta / Participant code') >= 0) return sheets[j];
  }
  throw new Error('Could not find the responses tab.');
}

function blank(v, digits) { return v === null || v === undefined ? '–' : (digits === undefined ? v : Number(v.toFixed(digits))); }

function refreshDashboard() {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var data = computeDashboard(findResponsesSheet(ss).getDataRange().getValues(), EXCLUDE_CODES);
  var tz = Session.getScriptTimeZone();

  var sh = ss.getSheetByName(DASHBOARD_NAME) || ss.insertSheet(DASHBOARD_NAME, 0);
  sh.getCharts().forEach(function (ch) { sh.removeChart(ch); });
  sh.clear();
  sh.setHiddenGridlines(true);
  ss.setActiveSheet(sh);
  ss.moveActiveSheet(1);

  // Title
  sh.getRange('A1:I1').merge().setValue('NaikTaraf.AI · HR Dashboard')
    .setFontSize(20).setFontWeight('bold').setFontColor('#FFFFFF').setBackground(NAVY);
  sh.getRange('A2:I2').merge()
    .setValue('Updated ' + Utilities.formatDate(new Date(), tz, 'dd/MM/yyyy HH:mm') +
      ' · refreshes automatically · participant codes only, no names')
    .setFontColor('#5B6678').setFontSize(10);
  sh.setRowHeight(1, 44);

  // Headline numbers
  var k = data.kpi;
  var kpiLabels = ['Workers started', 'Completed (badge earned)', 'Avg. pre-assessment /10', 'Avg. final assessment /10', 'Avg. improvement'];
  var kpiValues = [k.started, k.completed, blank(k.avgPre, 1), blank(k.avgPost, 1),
    k.avgGain === null ? '–' : (k.avgGain >= 0 ? '+' : '') + k.avgGain.toFixed(1)];
  sh.getRange(4, 1, 1, 5).setValues([kpiValues]).setFontSize(26).setFontWeight('bold').setFontColor(NAVY)
    .setHorizontalAlignment('left').setBackground('#FFFFFF');
  sh.getRange(5, 1, 1, 5).setValues([kpiLabels]).setFontColor('#5B6678').setFontSize(10).setBackground('#FFFFFF');
  sh.getRange(6, 2).setValue(k.completion === null ? '' : Math.round(k.completion * 100) + '% completion')
    .setFontColor('#178A7F').setFontWeight('bold');
  sh.getRange(4, 1, 3, 5).setBorder(true, true, true, true, true, false, '#DCE4EE', SpreadsheetApp.BorderStyle.SOLID);

  // Section 1: by role
  var r = 8;
  section(sh, r, 'Score before and after, by recommended role (average out of 10)');
  var roleRows = [['Recommended role', 'Workers', 'Before', 'After', 'Change']].concat(
    data.roles.length ? data.roles.map(function (x) {
      return [x.role, x.n, blank(x.pre, 1), blank(x.post, 1), x.change === null ? '–' : x.change.toFixed(1)];
    }) : [['No responses yet', '', '', '', '']]);
  table(sh, r + 1, roleRows);
  if (data.roles.length) {
    sh.insertChart(sh.newChart().setChartType(Charts.ChartType.COLUMN)
      .addRange(sh.getRange(r + 1, 1, roleRows.length, 1))
      .addRange(sh.getRange(r + 1, 3, roleRows.length, 2))
      .setNumHeaders(1).setPosition(r, 7, 10, 0)
      .setOption('title', 'Before vs after, by role').setOption('colors', [GREY, TEAL])
      .setOption('vAxis', { minValue: 0, maxValue: 10 }).setOption('legend', { position: 'top' })
      .setOption('width', 520).setOption('height', 280).build());
  }

  // Section 2: knowledge gaps
  r = Math.max(r + roleRows.length + 3, r + 16);
  section(sh, r, 'Knowledge gaps: % answering correctly in the ' + (data.gapStage === 'final' ? 'final' : 'pre-') + ' assessment (lowest first)');
  var gapRows = [['Question', '% correct']].concat(data.gaps.map(function (g) { return [g.name, g.pct === null ? '–' : g.pct]; }));
  table(sh, r + 1, gapRows);
  sh.getRange(r + 2, 2, gapRows.length - 1, 1).setNumberFormat('0%');
  if (data.participants.length) {
    sh.insertChart(sh.newChart().setChartType(Charts.ChartType.BAR)
      .addRange(sh.getRange(r + 1, 1, gapRows.length, 2))
      .setNumHeaders(1).setPosition(r, 7, 10, 0)
      .setOption('title', 'Questions answered correctly').setOption('colors', [GOLD])
      .setOption('hAxis', { minValue: 0, maxValue: 1, format: '0%' }).setOption('legend', { position: 'none' })
      .setOption('width', 520).setOption('height', 300).build());
  }

  // Section 3: participants
  r = r + Math.max(gapRows.length + 3, 17);
  section(sh, r, 'Participants: verify badges and plan practical training');
  var pRows = [['Code', 'Current job', 'Recommended role', 'Language', 'Before', 'After', 'Change', 'Status', 'Completed']].concat(
    data.participants.length ? data.participants.map(function (p) {
      return [p.code, p.job, p.role, p.lang, blank(p.pre), blank(p.post),
        p.change === null ? '–' : (p.change > 0 ? '+' : '') + p.change, p.status,
        p.done instanceof Date ? Utilities.formatDate(p.done, tz, 'dd/MM/yyyy') : '–'];
    }) : [['No responses yet', '', '', '', '', '', '', '', '']]);
  table(sh, r + 1, pRows);
  pRows.slice(1).forEach(function (p, i) {
    if (p[7] === 'Badge earned') sh.getRange(r + 2 + i, 8).setFontColor('#178A7F').setFontWeight('bold');
    else if (p[7] === 'In progress') sh.getRange(r + 2 + i, 8).setFontColor('#8A5A00').setFontWeight('bold');
  });

  // Column widths
  [230, 170, 230, 120, 110, 80, 80, 120, 110].forEach(function (w, i) { sh.setColumnWidth(i + 1, w); });
  sh.setFrozenRows(2);
}

function section(sh, row, title) {
  sh.getRange(row, 1, 1, 5).merge().setValue(title).setFontSize(13).setFontWeight('bold').setFontColor(NAVY);
}

function table(sh, row, rows) {
  var range = sh.getRange(row, 1, rows.length, rows[0].length);
  range.setValues(rows).setFontSize(10).setVerticalAlignment('middle');
  sh.getRange(row, 1, 1, rows[0].length).setBackground(NAVY).setFontColor('#FFFFFF').setFontWeight('bold');
  if (rows.length > 1) sh.getRange(row + 1, 1, rows.length - 1, rows[0].length).setBackground('#FFFFFF');
  range.setBorder(true, true, true, true, false, true, '#DCE4EE', SpreadsheetApp.BorderStyle.SOLID);
  for (var i = 2; i < rows.length; i += 2) sh.getRange(row + i, 1, 1, rows[0].length).setBackground(LIGHT);
}
