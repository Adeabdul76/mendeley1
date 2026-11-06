/**
 * NaikTaraf.AI — builds the Pre/Post "Skills Check" Google Form automatically.
 *
 * HOW TO USE (no coding needed):
 *   1. Click "Run" (▶) at the top of this page.
 *   2. Google asks for permission. Click "Review permissions", choose your
 *      account, then "Advanced" → "Go to NaikTaraf Form Builder" → "Allow".
 *      (This lets the builder create a Form and a Sheet in YOUR Google Drive.)
 *   3. Wait about 20 seconds until "Execution completed" appears.
 *   4. In Google Drive, open the new Sheet "NaikTaraf.AI – Responses".
 *      On the "Setup" tab, copy the long link in cell A2 and send it to Claude.
 *
 * Run it only ONCE. Every run makes a brand-new Form.
 */

// ---------- The 10 questions (BM / English). The correct answer is marked with correct: N (counting from 0). ----------
var QUIZ = [
  // Lesson 1: Working Safely with Cobots
  { title: '1. Apakah itu cobot? / What is a cobot?',
    choices: ['Program komputer untuk kerja pejabat / A computer program for office work',
              'Robot yang direka untuk bekerja dengan selamat berdekatan manusia / A robot designed to work safely near people',
              'Robot yang mesti sentiasa dalam sangkar berkunci / A robot that must always stay in a locked cage',
              'Sejenis forklift / A type of forklift'],
    correct: 1 },
  { title: '2. Sebelum bekerja berdekatan cobot, apa yang perlu dibuat dahulu? / Before working near a cobot, what should you do first?',
    choices: ['Pastikan kawasan kerja kosong dan tetapan keselamatan dihidupkan / Check the work area is clear and safety settings are on',
              'Tanggalkan sensor keselamatan supaya ia lebih laju / Remove the safety sensors so it runs faster',
              'Hidupkan dahulu, periksa kemudian / Switch it on first, check later',
              'Minta kawan tolong tengokkan / Ask a friend to watch it for you'],
    correct: 0 },
  { title: '3. Jika cobot bergerak dengan cara yang tidak dijangka, apa yang perlu anda buat? / If a cobot moves in a way you did not expect, what should you do?',
    choices: ['Cuba pegang lengan robot supaya ia berhenti / Try to hold the robot arm still',
              'Abaikan jika produk nampak elok / Ignore it if the product looks fine',
              'Tekan butang berhenti kecemasan dan laporkan kepada penyelia / Press the emergency stop and report it to your supervisor',
              'Baiki sendiri / Fix it yourself'],
    correct: 2 },
  { title: '4. Biasanya, apakah warna butang berhenti kecemasan? / What colour is the emergency stop button usually?',
    choices: ['Hijau / Green', 'Biru / Blue', 'Putih / White', 'Merah / Red'],
    correct: 3 },

  // Lesson 2: Visual Quality Inspection Basics
  { title: '5. Apakah tujuan utama pemeriksaan kualiti visual? / What is the main purpose of visual quality inspection?',
    choices: ['Mencari kecacatan sebelum produk sampai kepada pelanggan / To find defects before the product reaches the customer',
              'Supaya barisan pengeluaran lebih laju / To make the production line faster',
              'Mengira bilangan pekerja / To count the workers',
              'Membersihkan mesin / To clean the machine'],
    correct: 0 },
  { title: '6. Yang manakah contoh kecacatan? / Which one is an example of a defect?',
    choices: ['Produk dalam kotak yang betul / Product in the correct box',
              'Calar atau retak pada produk / A scratch or crack on the product',
              'Label yang betul / The correct label',
              'Permukaan yang bersih / A clean surface'],
    correct: 1 },
  { title: '7. Anda jumpa produk yang cacat. Apa yang perlu anda buat? / You find a product with a defect. What should you do?',
    choices: ['Letak semula di barisan / Put it back on the line',
              'Buang tanpa memberitahu sesiapa / Throw it away without telling anyone',
              'Asingkan dan ikut prosedur tolak/lapor / Separate it and follow the reject/report procedure',
              'Sembunyikan / Hide it'],
    correct: 2 },
  { title: '8. Apa yang membantu anda memeriksa produk dengan betul? / What helps you inspect products correctly?',
    choices: ['Bekerja selaju mungkin / Working as fast as possible',
              'Meneka sahaja / Just guessing',
              'Periksa satu sisi sahaja / Checking only one side',
              'Pencahayaan yang baik dan bandingkan dengan sampel standard / Good lighting and comparing with the standard sample'],
    correct: 3 },

  // Lesson 3: 5S and Preventive Maintenance
  { title: '9. 5S membantu mewujudkan… / 5S helps to create…',
    choices: ['Tempat kerja yang bersih, teratur dan selamat / A clean, organised and safe workplace',
              'Lebih banyak kerja lebih masa / More overtime',
              'Kurang pekerja / Fewer workers',
              'Mesin yang lebih laju sahaja / Only faster machines'],
    correct: 0 },
  { title: '10. Apakah penyelenggaraan pencegahan? / What is preventive maintenance?',
    choices: ['Membaiki mesin hanya selepas ia rosak / Fixing a machine only after it breaks',
              'Pemeriksaan dan penjagaan berkala supaya mesin tidak rosak / Regular checks and care so machines do not break down',
              'Membeli mesin baharu / Buying new machines',
              'Mematikan mesin pada waktu malam / Switching machines off at night'],
    correct: 1 },
];

// ---------- Fields filled in automatically by the chatbot (order matters: matches content.js) ----------
var AUTO_FIELDS = [
  ['JOB',      'Kerja sekarang / Current job'],
  ['YEARS',    'Tahun dalam pembuatan / Years in manufacturing'],
  ['SKILLS',   'Kemahiran yang sudah yakin / Skills already confident in'],
  ['INTEREST', 'Minat kerja / Work interest'],
  ['BREAK',    'Masa rehat / Break time available'],
  ['ROLE',     'Peranan dicadangkan / Recommended role'],
  ['LANGUAGE', 'Bahasa chatbot / Chatbot language'],
];

function createNaikTarafForm() {
  var form = FormApp.create('NaikTaraf.AI – Semakan Kemahiran / Skills Check');
  form.setDescription(
    'Semakan ringkas 10 soalan. Ini bukan peperiksaan — ia membantu kami melihat kemajuan anda. Jangan tulis nama anda.\n' +
    'A quick 10-question check. This is not an exam — it helps us see your progress. Please do not write your name.');
  form.setIsQuiz(true);
  form.setCollectEmail(false);
  form.setAllowResponseEdits(false);
  form.setProgressBar(true);
  form.setConfirmationMessage(
    'Terima kasih! Sila kembali ke NaikTaraf dan tekan "Saya sudah selesai semakan".\n' +
    'Thank you! Please go back to NaikTaraf and tap "I\'ve finished the check".');
  try { form.setRequireLogin(false); } catch (e) { /* only for university/company accounts */ }

  // Section 1: participant information (filled automatically)
  form.addSectionHeaderItem()
    .setTitle('Maklumat peserta / Participant information')
    .setHelpText('Diisi secara automatik oleh NaikTaraf. Sila jangan ubah. / Filled in automatically by NaikTaraf. Please do not change.');

  var codeItem = form.addTextItem()
    .setTitle('Kod peserta / Participant code')
    .setRequired(true)
    .setValidation(FormApp.createTextValidation()
      .requireTextMatchesPattern('^[Pp][0-9][0-9]$')
      .setHelpText('Contoh / Example: P07')
      .build());

  var stageItem = form.addMultipleChoiceItem()
    .setTitle('Peringkat / Stage')
    .setChoiceValues(['Pre', 'Post'])   // must match STAGE_PRE_TEXT / STAGE_POST_TEXT in content.js
    .setRequired(true);

  var autoItems = AUTO_FIELDS.map(function (f) { return form.addTextItem().setTitle(f[1]); });

  // Section 2: the 10 questions
  form.addPageBreakItem()
    .setTitle('10 soalan / 10 questions')
    .setHelpText('Pilih satu jawapan untuk setiap soalan. / Choose one answer for each question.');

  QUIZ.forEach(function (q) {
    var item = form.addMultipleChoiceItem();
    item.setTitle(q.title).setRequired(true).setPoints(1);
    item.setChoices(q.choices.map(function (c, i) { return item.createChoice(c, i === q.correct); }));
  });

  // Responses go into a Google Sheet
  var sheet = SpreadsheetApp.create('NaikTaraf.AI – Responses');
  form.setDestination(FormApp.DestinationType.SPREADSHEET, sheet.getId());

  // Make the pre-filled link that tells the chatbot where each field is
  var sample = form.createResponse()
    .withItemResponse(codeItem.createResponse('P01'))
    .withItemResponse(stageItem.createResponse('Pre'));
  autoItems.forEach(function (item, i) { sample.withItemResponse(item.createResponse(AUTO_FIELDS[i][0])); });
  var prefilled = sample.toPrefilledUrl();

  var setup = sheet.getSheets()[0].setName('Setup');
  setup.getRange('A1:A8').setValues([
    ['SEND THIS LINK TO CLAUDE:'],
    [prefilled],
    [''],
    ['Form link for workers (the chatbot adds this automatically):'],
    [form.getPublishedUrl()],
    [''],
    ['Edit the Form here:'],
    [form.getEditUrl()],
  ]);
  setup.getRange('A1').setFontWeight('bold');
  setup.setColumnWidth(1, 900);

  console.log('LINK FOR CLAUDE: ' + prefilled);
  console.log('Responses Sheet: ' + sheet.getUrl());
}
