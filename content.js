/* =====================================================================
   NaikTaraf.AI — ALL TEXT AND SETTINGS
   =====================================================================

   This is the only file you need to edit to change what the chatbot says.

   HOW TO EDIT SAFELY
   1. Only change the text INSIDE the quotes "like this".
   2. Keep every comma, bracket { } [ ] and quote mark exactly where it is.
   3. Keep the words in curly brackets, such as {role}, {skills}, {time},
      {n}, {title} and {button}. The app replaces them automatically.
   4. Text between ** and ** is shown in bold.
   5. Do NOT change the short codes on the left, such as  id: "robots"
      or  askCode:  — the app uses them to find the right text.
   6. Language codes:  ms = Bahasa Melayu,  en = English,
                       zh = 中文 (Mandarin),  ta = தமிழ் (Tamil).
      If a translation is missing, the app shows the English text instead.
   7. After editing, open the app and check that the page still loads.

   Lines marked  // TODO: check by fluent speaker  are draft translations.
   ===================================================================== */


/* ---------------------------------------------------------------------
   1. SETTINGS — links and Google Form details
   ------------------------------------------------------------------- */
const SETTINGS = {

  // --- Google Form (receives the pre-test and post-test answers) ---
  // Workers answer the 10 questions INSIDE the chat. The app then sends the
  // answers to this Form in the background, so they appear in your Google
  // Sheet. If the phone is offline, the app keeps the answers and sends them
  // later. To find entry numbers: Form ⋮ menu → "Get pre-filled link".

  // The Form link up to and including "viewform" (nothing after it).
  FORM_BASE_URL: "https://docs.google.com/forms/d/e/1FAIpQLSdUcixZspOLeg1kGju-RDoUT_Tg4ZX-njTXuRqGzWfx0rbWaQ/viewform",

  // Required fields
  CODE_ENTRY_ID:  "entry.1677419179",  // Form question "Participant code"
  STAGE_ENTRY_ID: "entry.942965475",   // Form question "Stage"

  // The option text in the Form's "Stage" question. It must match EXACTLY,
  // including capital letters.
  STAGE_PRE_TEXT:  "Pre",
  STAGE_POST_TEXT: "Post",

  // Extra fields: the check-in answers, sent in English so your data is
  // consistent whichever language the worker used. In the Form, make each
  // of these a "Short answer" question. To stop sending one, leave it as "".
  Q1_ENTRY_ID:       "entry.876157530",   // "Current job"
  Q2_ENTRY_ID:       "entry.1842294735",  // "Years in manufacturing"
  Q3_ENTRY_ID:       "entry.831979472",   // "Skills already confident in"
  Q4_ENTRY_ID:       "entry.1354644003",  // "Work interest"
  Q5_ENTRY_ID:       "entry.65465296",    // "Break time available"
  ROLE_ENTRY_ID:     "entry.1195738184",  // "Recommended role"
  LANGUAGE_ENTRY_ID: "entry.1046190184",  // "Chatbot language"

  // When true, a lesson's "Done" button stays locked until the worker has
  // watched the video almost to the end. The chat moves on by itself when
  // the video finishes.
  REQUIRE_FULL_VIDEO: true,
  // For lessons given as https:// links instead of MP4 files: keep "Done"
  // locked until the link has been opened.
  REQUIRE_OPEN_BEFORE_DONE: true,

  // true = the bot shows "typing…" dots before each message, like a real chat.
  TYPING_EFFECT: true,

  // --- Badge ---
  // Where the participant code and date are written on assets/badge.png.
  // Numbers are fractions of the image size: 0.5 = middle, 0.9 = near the bottom.
  BADGE_TEXT_COLOUR: "#1F3864",
  BADGE_TEXT_PANEL: false,  // true = draw a white label behind the code and date (not needed: the Canva badge has its own white box)
  BADGE_CODE_Y: 0.716,
  BADGE_DATE_Y: 0.78,
  BADGE_CODE_SIZE: 0.055,   // text height as a fraction of the badge width
  BADGE_DATE_SIZE: 0.04,
};


/* ---------------------------------------------------------------------
   2. LANGUAGES — the buttons on the first screen, in this order
   ------------------------------------------------------------------- */
const DEFAULT_LANGUAGE = "ms";

const LANGUAGES = [
  { id: "ms", name: "Bahasa Melayu", formValue: "Bahasa Melayu" },
  { id: "en", name: "English",       formValue: "English" },
  { id: "zh", name: "中文",           formValue: "Mandarin" },
  { id: "ta", name: "தமிழ்",          formValue: "Tamil" },
];


/* ---------------------------------------------------------------------
   3. LESSONS — titles and videos
   url can be an MP4 file in the assets/lessons/ folder (plays inside the
   chat), or a full https:// link (opens in a new tab).
   ------------------------------------------------------------------- */
const LESSONS = {
  L1: {
    url: "assets/lessons/lesson1.mp4?v=3", // made from the Canva lesson DAHaGkUPIEQ
    title: {
      ms: "Bekerja dengan Selamat bersama Cobot",
      en: "Working Safely with Cobots",
      zh: "与协作机器人安全工作",                     // TODO: check by fluent speaker
      ta: "Cobot-களுடன் பாதுகாப்பாக வேலை செய்தல்",     // TODO: check by fluent speaker
    },
  },
  L2: {
    url: "assets/lessons/lesson2.mp4?v=3", // made from the Canva lesson DAHaGsTS9RM
    title: {
      ms: "Asas Pemeriksaan Kualiti Visual",
      en: "Visual Quality Inspection Basics",
      zh: "目视质量检验基础",                         // TODO: check by fluent speaker
      ta: "காட்சித் தர ஆய்வின் அடிப்படைகள்",            // TODO: check by fluent speaker
    },
  },
  L3: {
    url: "assets/lessons/lesson3.mp4?v=3", // made from the Canva lesson DAHaGv-8L9I
    title: {
      ms: "5S dan Penyelenggaraan Pencegahan",
      en: "5S and Preventive Maintenance",
      zh: "5S 与预防性维护",                           // TODO: check by fluent speaker
      ta: "5S மற்றும் தடுப்புப் பராமரிப்பு",              // TODO: check by fluent speaker
    },
  },
};


/* ---------------------------------------------------------------------
   4. ROLES — role names stay in English in every language
   ------------------------------------------------------------------- */
const ROLES = {
  cobot:     "Cobot operator",
  aoi:       "AOI operator / quality technician",
  maint:     "Junior maintenance technician",
  warehouse: "Automated warehouse operator",
};


/* ---------------------------------------------------------------------
   5. RECOMMENDATION RULES
   The app checks Q4 (interest) first. If the answer is "Not sure yet"
   (not listed below), it uses Q1 (current job) instead.
   ------------------------------------------------------------------- */
const RULES_BY_INTEREST = {   // Q4 answer → role and lesson order
  robots: { role: "cobot", lessons: ["L1", "L3", "L2"] },
  quality: { role: "aoi",  lessons: ["L2", "L1", "L3"] },
  fixing: { role: "maint", lessons: ["L3", "L1", "L2"] },
};

const RULES_BY_JOB = {        // Q1 answer → role and lesson order
  production: { role: "cobot",     lessons: ["L1", "L3", "L2"] },
  qc:         { role: "aoi",       lessons: ["L2", "L1", "L3"] },
  machine:    { role: "maint",     lessons: ["L3", "L1", "L2"] },
  handler:    { role: "warehouse", lessons: ["L1", "L3", "L2"] },
  other:      { role: "cobot",     lessons: ["L1", "L3", "L2"] },
};


/* ---------------------------------------------------------------------
   6. CHECK-IN QUESTIONS (tap-to-answer)
   label  = the button text
   phrase = how the skill reads inside the sentence "You already have
            strengths in ..." (only for Q3; if missing, the label is used)
   time   = how the break time reads inside "...fits easily in your ... break"
   ------------------------------------------------------------------- */
const QUESTIONS = [
  {
    id: "q1",
    text: {
      ms: "Apakah kerja anda sekarang?",
      en: "What is your current job?",
      zh: "您目前的工作是什么？",                          // TODO: check by fluent speaker
      ta: "உங்கள் தற்போதைய வேலை என்ன?",                  // TODO: check by fluent speaker
    },
    options: [
      { id: "production", label: { ms: "Operator pengeluaran", en: "Production operator",
          zh: "生产操作员", ta: "உற்பத்தி இயக்குநர்" } },        // TODO: check by fluent speaker
      { id: "qc", label: { ms: "QC / pemeriksa visual", en: "QC / visual inspector",
          zh: "品检 / 目检员", ta: "QC / காட்சி ஆய்வாளர்" } },   // TODO: check by fluent speaker
      { id: "machine", label: { ms: "Operator mesin", en: "Machine operator",
          zh: "机器操作员", ta: "இயந்திர இயக்குநர்" } },          // TODO: check by fluent speaker
      { id: "handler", label: { ms: "Pengendali bahan / pembungkus", en: "Material handler / packer",
          zh: "物料搬运员 / 包装员", ta: "பொருள் கையாளுபவர் / பேக்கர்" } }, // TODO: check by fluent speaker
      { id: "other", label: { ms: "Lain-lain", en: "Other",
          zh: "其他", ta: "மற்றவை" } },                         // TODO: check by fluent speaker
    ],
  },
  {
    id: "q2",
    text: {
      ms: "Berapa lama anda sudah bekerja dalam bidang pembuatan?",
      en: "How long have you worked in manufacturing?",
      zh: "您在制造业工作多久了？",                                    // TODO: check by fluent speaker
      ta: "நீங்கள் உற்பத்தித் துறையில் எவ்வளவு காலம் வேலை செய்துள்ளீர்கள்?", // TODO: check by fluent speaker
    },
    options: [
      { id: "lt1", label: { ms: "Kurang 1 tahun", en: "Under 1 year",
          zh: "不到 1 年", ta: "1 ஆண்டுக்கும் குறைவு" } },        // TODO: check by fluent speaker
      { id: "1to3", label: { ms: "1–3 tahun", en: "1–3 years",
          zh: "1–3 年", ta: "1–3 ஆண்டுகள்" } },                 // TODO: check by fluent speaker
      { id: "4to10", label: { ms: "4–10 tahun", en: "4–10 years",
          zh: "4–10 年", ta: "4–10 ஆண்டுகள்" } },               // TODO: check by fluent speaker
      { id: "gt10", label: { ms: "Lebih 10 tahun", en: "Over 10 years",
          zh: "10 年以上", ta: "10 ஆண்டுகளுக்கு மேல்" } },        // TODO: check by fluent speaker
    ],
  },
  {
    id: "q3",
    multiSelect: true,
    text: {
      ms: "Antara berikut, kemahiran manakah yang sudah boleh anda lakukan dengan yakin? Anda boleh pilih lebih daripada satu, kemudian tekan 'Selesai'.",
      en: "Which of these can you already do confidently? You can choose more than one, then tap Done.",
      zh: "以下哪些是您已经能熟练做到的？可以选多项，然后点击“完成”。",       // TODO: check by fluent speaker
      ta: "இவற்றில் எவற்றை நீங்கள் ஏற்கனவே நம்பிக்கையுடன் செய்ய முடியும்? ஒன்றுக்கு மேற்பட்டவற்றைத் தேர்வு செய்யலாம், பிறகு “முடிந்தது” என்பதைத் தட்டவும்.", // TODO: check by fluent speaker
    },
    options: [
      { id: "operate",
        label:  { ms: "Mengendalikan mesin", en: "Operate machines",
                  zh: "操作机器", ta: "இயந்திரங்களை இயக்குதல்" },        // TODO: check by fluent speaker
        phrase: { ms: "mengendalikan mesin", en: "operating machines" } },
      { id: "quality",
        label:  { ms: "Memeriksa kualiti produk", en: "Check product quality",
                  zh: "检查产品质量", ta: "தயாரிப்புத் தரத்தைச் சரிபார்த்தல்" }, // TODO: check by fluent speaker
        phrase: { ms: "memeriksa kualiti produk", en: "checking product quality" } },
      { id: "care",
        label:  { ms: "Penjagaan asas mesin", en: "Basic machine care",
                  zh: "基本机器保养", ta: "அடிப்படை இயந்திரப் பராமரிப்பு" },   // TODO: check by fluent speaker
        phrase: { ms: "penjagaan asas mesin", en: "basic machine care" } },
      { id: "tablet",
        label:  { ms: "Menggunakan tablet atau komputer", en: "Use a tablet or computer",
                  zh: "使用平板或电脑", ta: "டேப்லெட் அல்லது கணினியைப் பயன்படுத்துதல்" }, // TODO: check by fluent speaker
        phrase: { ms: "menggunakan tablet atau komputer", en: "using a tablet or computer" } },
      { id: "english",
        label:  { ms: "Membaca arahan dalam Bahasa Inggeris", en: "Read English instructions",
                  zh: "阅读英文说明", ta: "ஆங்கில வழிமுறைகளைப் படித்தல்" },    // TODO: check by fluent speaker
        phrase: { ms: "membaca arahan dalam Bahasa Inggeris", en: "reading English instructions" } },
    ],
  },
  {
    id: "q4",
    text: {
      ms: "Jenis kerja apa yang paling menarik minat anda?",
      en: "Which kind of work interests you most?",
      zh: "您对哪种工作最感兴趣？",                          // TODO: check by fluent speaker
      ta: "எந்த வகையான வேலையில் உங்களுக்கு அதிக ஆர்வம்?",    // TODO: check by fluent speaker
    },
    options: [
      { id: "robots", label: { ms: "Bekerja dengan robot", en: "Working with robots",
          zh: "与机器人一起工作", ta: "ரோபோக்களுடன் வேலை செய்தல்" } },   // TODO: check by fluent speaker
      { id: "quality", label: { ms: "Kualiti dan pemeriksaan", en: "Quality and inspection",
          zh: "质量与检验", ta: "தரம் மற்றும் ஆய்வு" } },               // TODO: check by fluent speaker
      { id: "fixing", label: { ms: "Membaiki dan menyelenggara mesin", en: "Fixing and maintaining machines",
          zh: "维修和保养机器", ta: "இயந்திரங்களைப் பழுதுபார்த்துப் பராமரித்தல்" } }, // TODO: check by fluent speaker
      { id: "notsure", label: { ms: "Belum pasti", en: "Not sure yet",
          zh: "还不确定", ta: "இன்னும் உறுதியாகத் தெரியவில்லை" } },     // TODO: check by fluent speaker
    ],
  },
  {
    id: "q5",
    text: {
      ms: "Berapa lama masa yang anda boleh luangkan semasa waktu rehat?",
      en: "How much time can you spend during a break?",
      zh: "休息时您可以花多少时间？",                          // TODO: check by fluent speaker
      ta: "இடைவேளையின் போது எவ்வளவு நேரம் செலவிட முடியும்?",  // TODO: check by fluent speaker
    },
    options: [
      { id: "5",
        label: { ms: "5 minit", en: "5 minutes", zh: "5 分钟", ta: "5 நிமிடங்கள்" },  // TODO: check by fluent speaker
        time:  { ms: "5 minit", en: "5-minute", zh: "5 分钟", ta: "5 நிமிட" } },     // TODO: check by fluent speaker
      { id: "10",
        label: { ms: "10 minit", en: "10 minutes", zh: "10 分钟", ta: "10 நிமிடங்கள்" }, // TODO: check by fluent speaker
        time:  { ms: "10 minit", en: "10-minute", zh: "10 分钟", ta: "10 நிமிட" } },  // TODO: check by fluent speaker
      { id: "15",
        label: { ms: "15 minit atau lebih", en: "15 minutes or more",
                 zh: "15 分钟或以上", ta: "15 நிமிடங்கள் அல்லது அதற்கு மேல்" },     // TODO: check by fluent speaker
        time:  { ms: "15 minit", en: "15-minute", zh: "15 分钟", ta: "15 நிமிட" } },  // TODO: check by fluent speaker
    ],
  },
];


/* ---------------------------------------------------------------------
   7. MESSAGES — everything else the bot says, and the button labels
   ------------------------------------------------------------------- */
const MESSAGES = {

  // ----- Stage 1: welcome (shown in BM and English together) -----
  welcome: {
    ms: "Hai! Saya NaikTaraf, jurulatih kerjaya anda. Luangkan masa kira-kira 10 minit sehari, dan saya akan bantu anda mempelajari kemahiran baharu untuk kerjaya yang sedang berkembang di kilang anda. Apakah bahasa pilihan anda?",
    en: "Hi! I'm NaikTaraf, your career coach. In about 10 minutes a day, I'll help you learn skills for the jobs that are growing in your factory. Which language do you prefer?",
  },

  // ----- Stage 1b: participant code -----
  askCode: {
    ms: "Sila masukkan kod peserta yang diberikan oleh pasukan kami (contohnya: P07).",
    en: "Please type the participant code given by our team (for example, P07).",
    zh: "请输入我们团队给您的参与者编号（例如 P07）。",                                  // TODO: check by fluent speaker
    ta: "எங்கள் குழு வழங்கிய பங்கேற்பாளர் குறியீட்டைத் தட்டச்சு செய்யவும் (உதாரணமாக, P07).", // TODO: check by fluent speaker
  },
  codeInvalid: {
    ms: "Maaf, kod itu tidak betul. Kod ialah huruf P diikuti dua nombor, contohnya P07. Sila cuba lagi.",
    en: "Sorry, that code doesn't look right. It is the letter P followed by two numbers, for example P07. Please try again.",
    zh: "抱歉，这个编号不正确。编号是字母 P 加两个数字，例如 P07。请再试一次。",                 // TODO: check by fluent speaker
    ta: "மன்னிக்கவும், அந்தக் குறியீடு சரியாக இல்லை. அது P என்ற எழுத்தும் இரண்டு எண்களும் கொண்டது, உதாரணமாக P07. மீண்டும் முயற்சிக்கவும்.", // TODO: check by fluent speaker
  },
  codeOk: {
    ms: "Terima kasih! Sebelum kita bermula, sila jawab 5 soalan ringkas mengenai diri anda. Anda hanya perlu memilih jawapan yang disediakan.",
    en: "Thank you! First, 5 quick questions about you. Just tap your answer.",
    zh: "谢谢！首先，回答 5 个关于您的简单问题。只需点击您的答案。",                         // TODO: check by fluent speaker
    ta: "நன்றி! முதலில், உங்களைப் பற்றிய 5 எளிய கேள்விகள். உங்கள் பதிலைத் தட்டவும்.",       // TODO: check by fluent speaker
  },
  codePlaceholder: {
    ms: "cth. P07", en: "e.g. P07",
    zh: "例如 P07",   // TODO: check by fluent speaker
    ta: "எ.கா. P07",  // TODO: check by fluent speaker
  },
  btnSend: {
    ms: "Hantar", en: "Send",
    zh: "发送",       // TODO: check by fluent speaker
    ta: "அனுப்பு",    // TODO: check by fluent speaker
  },

  // ----- Stage 2: check-in -----
  btnDone: {
    ms: "Selesai", en: "Done",
    zh: "完成",       // TODO: check by fluent speaker
    ta: "முடிந்தது",  // TODO: check by fluent speaker
  },
  noneSelected: {     // shown as the worker's answer if they tap Done without choosing
    ms: "Belum ada lagi", en: "None of these yet",
    zh: "暂时都没有",                    // TODO: check by fluent speaker
    ta: "இவற்றில் எதுவும் இல்லை",        // TODO: check by fluent speaker
  },

  // ----- Stage 3: recommendation (split into short bubbles) -----
  recIntro: {
    ms: "Berita baik! Berdasarkan jawapan anda, langkah seterusnya yang sesuai untuk anda ialah **{role}**. Anda sudah ada kekuatan dalam {skills}.",
    en: "Great news! Based on your answers, a good next step for you is **{role}**. You already have strengths in {skills}.",
    zh: "好消息！根据您的回答，适合您的下一步是 **{role}**。您已经在{skills}方面有优势。",       // TODO: check by fluent speaker
    ta: "நல்ல செய்தி! உங்கள் பதில்களின் அடிப்படையில், உங்களுக்கு ஏற்ற அடுத்த படி **{role}**. நீங்கள் ஏற்கனவே இவற்றில் திறமை பெற்றுள்ளீர்கள்: {skills}.", // TODO: check by fluent speaker
  },
  recPlan: {
    ms: "Sebagai persediaan, saya telah sediakan 3 modul pembelajaran ringkas. Setiap modul mengambil masa kira-kira 2 minit, sesuai untuk ditonton semasa waktu rehat anda. Adakah anda bersedia untuk mula?",
    en: "To get ready, I've prepared 3 short lessons. Each lesson is about 2 minutes of video, which fits easily in your {time} break. Ready to start?",
    zh: "为了做好准备，我为您准备了 3 节简短课程。每节课大约是 2 分钟的视频，在您 {time}的休息时间里就能轻松看完。准备好开始了吗？", // TODO: check by fluent speaker
    ta: "தயாராவதற்கு, 3 சிறிய பாடங்களைத் தயார் செய்துள்ளேன். ஒவ்வொரு பாடமும் சுமார் 2 நிமிட வீடியோ, உங்கள் {time} இடைவேளையில் எளிதாகப் பார்க்கலாம். தொடங்கலாமா?", // TODO: check by fluent speaker
  },
  recNote: {
    ms: "Untuk makluman: ini hanya cadangan pembelajaran. Sebarang pertukaran kerja atau kenaikan pangkat ditentukan oleh syarikat anda.",
    en: "Please note: this is a learning suggestion only. Any job change or promotion is decided by your company.",
    zh: "请注意：这只是学习建议。任何调岗或升职都由您的公司决定。",                             // TODO: check by fluent speaker
    ta: "கவனிக்கவும்: இது ஒரு கற்றல் பரிந்துரை மட்டுமே. எந்த வேலை மாற்றமும் பதவி உயர்வும் உங்கள் நிறுவனத்தால் முடிவு செய்யப்படும்.", // TODO: check by fluent speaker
  },
  skillsNone: {       // used when the worker chose no skills in Q3
    ms: "mempelajari perkara baharu", en: "learning new things",
    zh: "学习新事物",                         // TODO: check by fluent speaker
    ta: "புதிய விஷயங்களைக் கற்றுக்கொள்வது",   // TODO: check by fluent speaker
  },
  listSeparator: { ms: ", ", en: ", ", zh: "、", ta: ", " },    // between skills in a list
  listAnd: {                                                     // before the last skill
    ms: " dan ", en: " and ",
    zh: "和",         // TODO: check by fluent speaker
    ta: " மற்றும் ",  // TODO: check by fluent speaker
  },
  btnStartNow: {
    ms: "Mula sekarang", en: "Start now",
    zh: "现在开始",          // TODO: check by fluent speaker
    ta: "இப்போது தொடங்கு",   // TODO: check by fluent speaker
  },
  btnRemindLater: {
    ms: "Ingatkan saya nanti", en: "Remind me later",
    zh: "稍后提醒我",          // TODO: check by fluent speaker
    ta: "பிறகு நினைவூட்டு",    // TODO: check by fluent speaker
  },
  remindLater: {
    ms: "Tiada masalah! Buka pautan yang sama ini bila-bila masa dan kita akan sambung dari sini.",
    en: "No problem! Open this same link any time and we'll continue from here.",
    zh: "没问题！随时打开这个链接，我们就从这里继续。",                                          // TODO: check by fluent speaker
    ta: "பரவாயில்லை! எப்போது வேண்டுமானாலும் இதே இணைப்பைத் திறக்கவும், இங்கிருந்தே தொடர்வோம்.", // TODO: check by fluent speaker
  },

  // ----- Stage 4: learning -----
  preTest: {
    ms: "Sebelum kita bermula, sila jawab penilaian ringkas 10 soalan ini supaya kami dapat memantau kemajuan anda.",
    en: "Before we start, please do a quick 10-question check so we can see your progress.",
    zh: "开始之前，请先做一个 10 道题的小测验，方便我们了解您的进步。",                          // TODO: check by fluent speaker
    ta: "தொடங்குவதற்கு முன், உங்கள் முன்னேற்றத்தைப் பார்க்க 10 கேள்விகள் கொண்ட சிறிய சோதனையைச் செய்யவும்.", // TODO: check by fluent speaker
  },
  hintTapFirst: {     // small note under a locked button
    ms: "Tekan “{button}” dahulu.",
    en: "Tap “{button}” first.",
    zh: "请先点击“{button}”。",              // TODO: check by fluent speaker
    ta: "முதலில் “{button}” என்பதைத் தட்டவும்.", // TODO: check by fluent speaker
  },
  safetyNote: {
    ms: "Ingat: modul ini adalah untuk tujuan rujukan dan kesedaran sahaja. Sentiasa patuhi latihan dan peraturan keselamatan syarikat anda. Jika mendapati sebarang keadaan yang tidak selamat, hentikan tugas serta-merta dan laporkan kepada penyelia anda.",
    en: "Remember: these lessons are for awareness only. Always follow your company's training and safety rules. If something seems unsafe, stop and report it to your supervisor.",
    zh: "请记住：这些课程仅供了解。请始终遵守公司的培训和安全规定。如果发现任何不安全的情况，请立即停止并向主管报告。", // TODO: check by fluent speaker
    ta: "நினைவில் கொள்ளுங்கள்: இந்தப் பாடங்கள் விழிப்புணர்வுக்காக மட்டுமே. எப்போதும் உங்கள் நிறுவனத்தின் பயிற்சி மற்றும் பாதுகாப்பு விதிகளைப் பின்பற்றவும். ஏதாவது பாதுகாப்பற்றதாகத் தோன்றினால், நிறுத்திவிட்டு உங்கள் மேற்பார்வையாளரிடம் தெரிவிக்கவும்.", // TODO: check by fluent speaker
  },
  lesson: {
    ms: "Pelajaran {n}: {title} (kira-kira 2 minit). Tonton sekarang, kemudian tekan Selesai.",
    en: "Lesson {n}: {title} (about 2 minutes). Watch it now, then tap Done.",
    zh: "第 {n} 课：{title}（约 2 分钟）。现在观看，然后点击“完成”。",                     // TODO: check by fluent speaker
    ta: "பாடம் {n}: {title} (சுமார் 2 நிமிடம்). இப்போது பார்த்துவிட்டு, “முடிந்தது” என்பதைத் தட்டவும்.", // TODO: check by fluent speaker
  },
  btnWatch: {
    ms: "Tonton pelajaran {n}", en: "Watch lesson {n}",
    zh: "观看第 {n} 课",        // TODO: check by fluent speaker
    ta: "பாடம் {n} பார்க்க",     // TODO: check by fluent speaker
  },
  postTest: {
    ms: "Syabas! Sila jawab penilaian akhir ini supaya kami dapat mengukur tahap kemajuan anda.",
    en: "Well done! Please do the final check so we can measure your progress.",
    zh: "做得好！请完成最后的测验，方便我们衡量您的进步。",                     // TODO: check by fluent speaker
    ta: "நன்று! உங்கள் முன்னேற்றத்தை அளவிட இறுதிச் சோதனையைச் செய்யவும்.",     // TODO: check by fluent speaker
  },

  // ----- Stage 5: badge -----
  badge: {
    ms: "Tahniah! Anda telah berjaya melengkapkan Laluan Permulaan untuk **{role}** serta memperolehi lencana Tahap 1. Sila tunjukkan pencapaian ini kepada penyelia atau pegawai HR anda. Seterusnya, anda boleh merujuk kepada pihak HR mengenai latihan amali untuk peranan ini.",
    en: "Congratulations! You've completed the **{role}** Starter Pathway and earned your Level 1 badge. Show it to your supervisor or HR. Next, ask your HR team about practical training for this role.",
    zh: "恭喜！您已完成 **{role}** 入门路径，获得了一级徽章。请把它给您的主管或人力资源部看。接下来，可以向人力资源部询问这个职位的实操培训。", // TODO: check by fluent speaker
    ta: "வாழ்த்துகள்! **{role}** தொடக்கப் பாதையை முடித்து, நிலை 1 பதக்கத்தைப் பெற்றுள்ளீர்கள். அதை உங்கள் மேற்பார்வையாளர் அல்லது HR-இடம் காட்டுங்கள். அடுத்து, இந்தப் பணிக்கான நடைமுறைப் பயிற்சி பற்றி உங்கள் HR குழுவிடம் கேளுங்கள்.", // TODO: check by fluent speaker
  },
  btnDownloadBadge: {
    ms: "Muat turun lencana", en: "Download badge",
    zh: "下载徽章",              // TODO: check by fluent speaker
    ta: "பதக்கத்தைப் பதிவிறக்கு", // TODO: check by fluent speaker
  },
  badgeError: {
    ms: "Maaf, lencana tidak dapat disimpan dalam telefon ini. Sila ambil tangkapan skrin.",
    en: "Sorry, the badge could not be saved on this phone. Please take a screenshot instead.",
    zh: "抱歉，这部手机无法保存徽章。请改用截图。",                          // TODO: check by fluent speaker
    ta: "மன்னிக்கவும், இந்தத் தொலைபேசியில் பதக்கத்தைச் சேமிக்க முடியவில்லை. அதற்குப் பதிலாக ஸ்கிரீன்ஷாட் எடுக்கவும்.", // TODO: check by fluent speaker
  },
  badgeAlt: {   // description of the badge image for screen readers
    ms: "Lencana NaikTaraf Tahap 1", en: "NaikTaraf Level 1 badge",
    zh: "NaikTaraf 一级徽章",           // TODO: check by fluent speaker
    ta: "NaikTaraf நிலை 1 பதக்கம்",     // TODO: check by fluent speaker
  },


  // ----- Privacy consent (shown after the language is chosen) -----
  consent: {
    ms: "Sebelum kita mula: jawapan anda hanya digunakan untuk kajian latihan ini. Kami tidak mengumpul nama, nombor IC atau nombor telefon anda. Anda boleh berhenti pada bila-bila masa. Adakah anda bersetuju untuk meneruskan?",
    en: "Before we start: your answers are used only for this training study. We never collect your name, IC number or phone number. You can stop at any time. Do you agree to continue?",
    zh: "开始之前：您的回答只用于本次培训研究。我们不会收集您的姓名、身份证号码或电话号码。您可以随时停止。您同意继续吗？", // TODO: check by fluent speaker
    ta: "தொடங்கும் முன்: உங்கள் பதில்கள் இந்தப் பயிற்சி ஆய்வுக்கு மட்டுமே பயன்படுத்தப்படும். உங்கள் பெயர், அடையாள அட்டை எண் அல்லது தொலைபேசி எண்ணை நாங்கள் சேகரிப்பதில்லை. நீங்கள் எப்போது வேண்டுமானாலும் நிறுத்தலாம். தொடர ஒப்புக்கொள்கிறீர்களா?", // TODO: check by fluent speaker
  },
  btnAgree: {
    ms: "Saya setuju", en: "I agree",
    zh: "我同意", // TODO: check by fluent speaker
    ta: "ஒப்புக்கொள்கிறேன்", // TODO: check by fluent speaker
  },
  btnNotNow: {
    ms: "Tidak sekarang", en: "Not now",
    zh: "暂时不要", // TODO: check by fluent speaker
    ta: "இப்போது வேண்டாம்", // TODO: check by fluent speaker
  },
  consentDeclined: {
    ms: "Tiada masalah. Jika anda berubah fikiran, tekan “{button}” pada bila-bila masa.",
    en: "No problem. If you change your mind, tap “{button}” any time.",
    zh: "没问题。如果您改变主意，随时点击“{button}”。", // TODO: check by fluent speaker
    ta: "பரவாயில்லை. மனம் மாறினால், எப்போது வேண்டுமானாலும் “{button}” என்பதைத் தட்டவும்.", // TODO: check by fluent speaker
  },

  // ----- Learning path overview (after "Start now") -----
  pathOverview: {
    ms: "Laluan pembelajaran anda:\n1. {l1}\n2. {l2}\n3. {l3}\nAnda akan menjawab penilaian ringkas sebelum dan selepas modul untuk melihat kemajuan anda.",
    en: "Your learning path:\n1. {l1}\n2. {l2}\n3. {l3}\nYou'll answer a short check before and after the lessons to see your progress.",
    zh: "您的学习路径：\n1. {l1}\n2. {l2}\n3. {l3}\n在课程前后，您会做一个简短的测验，看看自己的进步。", // TODO: check by fluent speaker
    ta: "உங்கள் கற்றல் பாதை:\n1. {l1}\n2. {l2}\n3. {l3}\nஉங்கள் முன்னேற்றத்தைக் காண பாடங்களுக்கு முன்னும் பின்னும் ஒரு சிறிய சோதனை இருக்கும்.", // TODO: check by fluent speaker
  },

  // ----- Pre-test and post-test (inside the chat) -----
  quizHeader: {
    ms: "Soalan {n} daripada {total}", en: "Question {n} of {total}",
    zh: "第 {n} 题（共 {total} 题）", // TODO: check by fluent speaker
    ta: "கேள்வி {n} / {total}", // TODO: check by fluent speaker
  },
  preScore: {
    ms: "Terima kasih! Anda menjawab {score} daripada {total} soalan dengan betul. Jangan risau, modul seterusnya akan membantu anda. Mari kita mulakan.",
    en: "Thank you! You got {score} out of {total} correct. Don't worry, the lessons will help you. Let's begin.",
    zh: "谢谢！您答对了 {total} 题中的 {score} 题。别担心，接下来的课程会帮助您。我们开始吧。", // TODO: check by fluent speaker
    ta: "நன்றி! {total} கேள்விகளில் {score} சரியாகப் பதிலளித்தீர்கள். கவலை வேண்டாம், பாடங்கள் உதவும். தொடங்குவோம்.", // TODO: check by fluent speaker
  },
  postScore: {
    ms: "Markah akhir anda: **{score}/{total}** (sebelum modul: {pre}/{total}).",
    en: "Your final score: **{score}/{total}** (before the lessons: {pre}/{total}).",
    zh: "您的最终得分：**{score}/{total}**（课程前：{pre}/{total}）。", // TODO: check by fluent speaker
    ta: "உங்கள் இறுதி மதிப்பெண்: **{score}/{total}** (பாடங்களுக்கு முன்: {pre}/{total}).", // TODO: check by fluent speaker
  },
  postImproved: {
    ms: "Anda telah meningkat sebanyak {diff} markah. Hebat!",
    en: "You improved by {diff} points. Great work!",
    zh: "您进步了 {diff} 分。做得好！", // TODO: check by fluent speaker
    ta: "நீங்கள் {diff} மதிப்பெண்கள் முன்னேறியுள்ளீர்கள். அருமை!", // TODO: check by fluent speaker
  },
  postKeepGoing: {
    ms: "Teruskan usaha! Setiap langkah kecil membawa kemajuan.",
    en: "Keep going! Every small step counts.",
    zh: "继续加油！每一小步都很重要。", // TODO: check by fluent speaker
    ta: "தொடர்ந்து முயலுங்கள்! ஒவ்வொரு சிறிய அடியும் முக்கியம்.", // TODO: check by fluent speaker
  },
  videoHint: {   // small note under "Done" until the video has been watched
    ms: "Tonton video hingga habis untuk meneruskan.",
    en: "Watch the video to the end to continue.",
    zh: "请看完视频再继续。", // TODO: check by fluent speaker
    ta: "தொடர வீடியோவை முழுமையாகப் பாருங்கள்.", // TODO: check by fluent speaker
  },

  // ----- Progress bar at the top -----
  progressLabel: {
    ms: "Langkah {n}/{total}: {label}", en: "Step {n}/{total}: {label}",
    zh: "第 {n}/{total} 步：{label}", // TODO: check by fluent speaker
    ta: "படி {n} / {total}: {label}", // TODO: check by fluent speaker
  },
  stage1: { ms: "Soalan ringkas", en: "Check-in", zh: "基本问题", ta: "அறிமுகக் கேள்விகள்" }, // TODO: check by fluent speaker
  stage2: { ms: "Penilaian awal", en: "Pre-assessment", zh: "课前测验", ta: "முன் மதிப்பீடு" }, // TODO: check by fluent speaker
  stage3: { ms: "Modul pembelajaran", en: "Lessons", zh: "学习课程", ta: "பாடங்கள்" }, // TODO: check by fluent speaker
  stage4: { ms: "Penilaian akhir", en: "Final assessment", zh: "课后测验", ta: "இறுதி மதிப்பீடு" }, // TODO: check by fluent speaker
  stage5: { ms: "Lencana", en: "Badge", zh: "徽章", ta: "பதக்கம்" }, // TODO: check by fluent speaker

  welcomeBack: {   // small note when a worker reopens the link
    ms: "Selamat kembali! Kita sambung dari tempat anda berhenti.",
    en: "Welcome back! Let's continue where you left off.",
    zh: "欢迎回来！我们从上次停下的地方继续。", // TODO: check by fluent speaker
    ta: "மீண்டும் வருக! நீங்கள் நிறுத்திய இடத்திலிருந்து தொடர்வோம்.", // TODO: check by fluent speaker
  },

  // ----- General -----
  linkNotReady: {
    ms: "Maaf, pautan ini belum sedia. Sila beritahu pasukan kami.",
    en: "Sorry, this link is not ready yet. Please tell our team.",
    zh: "抱歉，此链接尚未准备好。请告诉我们的团队。",                         // TODO: check by fluent speaker
    ta: "மன்னிக்கவும், இந்த இணைப்பு இன்னும் தயாராகவில்லை. எங்கள் குழுவிடம் தெரிவிக்கவும்.", // TODO: check by fluent speaker
  },
  startAgain: {
    ms: "Mula semula", en: "Start again",
    zh: "重新开始",            // TODO: check by fluent speaker
    ta: "மீண்டும் தொடங்கு",   // TODO: check by fluent speaker
  },
  confirmStartAgain: {
    ms: "Mula semula dari awal? Jawapan anda dalam telefon ini akan dipadam.",
    en: "Start again from the beginning? Your answers on this phone will be cleared.",
    zh: "要从头开始吗？这部手机上的答案将被清除。",                                   // TODO: check by fluent speaker
    ta: "தொடக்கத்திலிருந்து மீண்டும் தொடங்கவா? இந்தத் தொலைபேசியில் உள்ள உங்கள் பதில்கள் அழிக்கப்படும்.", // TODO: check by fluent speaker
  },
};


/* ---------------------------------------------------------------------
   8. PRE-TEST AND POST-TEST — the same 10 questions, asked inside the chat
   entry   = the Google Form question that receives the answer
   correct = the right answer, counting from 0 (0 = first choice)
   form    = the choice text EXACTLY as written in the Google Form
             (do not change it unless you also change the Form)
   ------------------------------------------------------------------- */
const QUIZ = [
  {
    entry: "entry.912973161", correct: 1,
    text: { ms: "Apakah itu cobot?", en: "What is a cobot?",
            zh: "什么是协作机器人（cobot）？", ta: "Cobot என்றால் என்ன?" }, // TODO: check by fluent speaker
    choices: [
      { form: "Program komputer untuk kerja pejabat / A computer program for office work",
        ms: "Program komputer untuk kerja pejabat", en: "A computer program for office work", zh: "用于办公室工作的电脑程序", ta: "அலுவலக வேலைக்கான கணினி நிரல்" },
      { form: "Robot yang direka untuk bekerja dengan selamat berdekatan manusia / A robot designed to work safely near people",
        ms: "Robot yang direka untuk bekerja dengan selamat berdekatan manusia", en: "A robot designed to work safely near people", zh: "设计用于在人身边安全工作的机器人", ta: "மனிதர்களுக்கு அருகில் பாதுகாப்பாக வேலை செய்ய வடிவமைக்கப்பட்ட ரோபோ" },
      { form: "Robot yang mesti sentiasa dalam sangkar berkunci / A robot that must always stay in a locked cage",
        ms: "Robot yang mesti sentiasa dalam sangkar berkunci", en: "A robot that must always stay in a locked cage", zh: "必须一直放在上锁笼子里的机器人", ta: "எப்போதும் பூட்டிய கூண்டில் இருக்க வேண்டிய ரோபோ" },
      { form: "Sejenis forklift / A type of forklift",
        ms: "Sejenis forklift", en: "A type of forklift", zh: "一种叉车", ta: "ஒரு வகை ஃபோர்க்லிஃப்ட்" },
    ],
  },
  {
    entry: "entry.1200494507", correct: 0,
    text: { ms: "Sebelum bekerja berdekatan cobot, apa yang perlu dibuat dahulu?", en: "Before working near a cobot, what should you do first?",
            zh: "在协作机器人附近工作之前，应该先做什么？", ta: "Cobot அருகில் வேலை செய்வதற்கு முன் முதலில் என்ன செய்ய வேண்டும்?" }, // TODO: check by fluent speaker
    choices: [
      { form: "Pastikan kawasan kerja kosong dan tetapan keselamatan dihidupkan / Check the work area is clear and safety settings are on",
        ms: "Pastikan kawasan kerja kosong dan tetapan keselamatan dihidupkan", en: "Check the work area is clear and safety settings are on", zh: "检查工作区域是否清空，并确认安全设置已开启", ta: "வேலைப் பகுதி காலியாக உள்ளதா, பாதுகாப்பு அமைப்புகள் இயக்கத்தில் உள்ளதா எனச் சரிபார்க்கவும்" },
      { form: "Tanggalkan sensor keselamatan supaya ia lebih laju / Remove the safety sensors so it runs faster",
        ms: "Tanggalkan sensor keselamatan supaya ia lebih laju", en: "Remove the safety sensors so it runs faster", zh: "拆掉安全传感器让它运行更快", ta: "வேகமாக இயங்க பாதுகாப்பு சென்சார்களை அகற்றவும்" },
      { form: "Hidupkan dahulu, periksa kemudian / Switch it on first, check later",
        ms: "Hidupkan dahulu, periksa kemudian", en: "Switch it on first, check later", zh: "先开机，之后再检查", ta: "முதலில் இயக்கி, பிறகு சரிபார்க்கவும்" },
      { form: "Minta kawan tolong tengokkan / Ask a friend to watch it for you",
        ms: "Minta kawan tolong tengokkan", en: "Ask a friend to watch it for you", zh: "请朋友帮你看着", ta: "உங்களுக்காகப் பார்த்துக்கொள்ள நண்பரிடம் கேட்கவும்" },
    ],
  },
  {
    entry: "entry.1433619675", correct: 2,
    text: { ms: "Jika cobot bergerak dengan cara yang tidak dijangka, apa yang perlu anda buat?", en: "If a cobot moves in a way you did not expect, what should you do?",
            zh: "如果协作机器人出现意外动作，您应该怎么做？", ta: "Cobot எதிர்பாராத விதமாக நகர்ந்தால் என்ன செய்ய வேண்டும்?" }, // TODO: check by fluent speaker
    choices: [
      { form: "Cuba pegang lengan robot supaya ia berhenti / Try to hold the robot arm still",
        ms: "Cuba pegang lengan robot supaya ia berhenti", en: "Try to hold the robot arm still", zh: "试着抓住机械臂让它停下", ta: "ரோபோ கையைப் பிடித்து நிறுத்த முயலவும்" },
      { form: "Abaikan jika produk nampak elok / Ignore it if the product looks fine",
        ms: "Abaikan jika produk nampak elok", en: "Ignore it if the product looks fine", zh: "如果产品看起来没问题就不用理会", ta: "தயாரிப்பு சரியாகத் தெரிந்தால் புறக்கணிக்கவும்" },
      { form: "Tekan butang berhenti kecemasan dan laporkan kepada penyelia / Press the emergency stop and report it to your supervisor",
        ms: "Tekan butang berhenti kecemasan dan laporkan kepada penyelia", en: "Press the emergency stop and report it to your supervisor", zh: "按下紧急停止按钮并报告主管", ta: "அவசர நிறுத்த பொத்தானை அழுத்தி மேற்பார்வையாளரிடம் தெரிவிக்கவும்" },
      { form: "Baiki sendiri / Fix it yourself",
        ms: "Baiki sendiri", en: "Fix it yourself", zh: "自己修理", ta: "நீங்களே சரிசெய்யவும்" },
    ],
  },
  {
    entry: "entry.1838987795", correct: 3,
    text: { ms: "Biasanya, apakah warna butang berhenti kecemasan?", en: "What colour is the emergency stop button usually?",
            zh: "紧急停止按钮通常是什么颜色？", ta: "அவசர நிறுத்த பொத்தான் பொதுவாக என்ன நிறம்?" }, // TODO: check by fluent speaker
    choices: [
      { form: "Hijau / Green",
        ms: "Hijau", en: "Green", zh: "绿色", ta: "பச்சை" },
      { form: "Biru / Blue",
        ms: "Biru", en: "Blue", zh: "蓝色", ta: "நீலம்" },
      { form: "Putih / White",
        ms: "Putih", en: "White", zh: "白色", ta: "வெள்ளை" },
      { form: "Merah / Red",
        ms: "Merah", en: "Red", zh: "红色", ta: "சிவப்பு" },
    ],
  },
  {
    entry: "entry.1159921880", correct: 0,
    text: { ms: "Apakah tujuan utama pemeriksaan kualiti visual?", en: "What is the main purpose of visual quality inspection?",
            zh: "目视质量检验的主要目的是什么？", ta: "காட்சித் தர ஆய்வின் முக்கிய நோக்கம் என்ன?" }, // TODO: check by fluent speaker
    choices: [
      { form: "Mencari kecacatan sebelum produk sampai kepada pelanggan / To find defects before the product reaches the customer",
        ms: "Mencari kecacatan sebelum produk sampai kepada pelanggan", en: "To find defects before the product reaches the customer", zh: "在产品送到客户之前发现缺陷", ta: "தயாரிப்பு வாடிக்கையாளரை அடையும் முன் குறைபாடுகளைக் கண்டறிதல்" },
      { form: "Supaya barisan pengeluaran lebih laju / To make the production line faster",
        ms: "Supaya barisan pengeluaran lebih laju", en: "To make the production line faster", zh: "让生产线跑得更快", ta: "உற்பத்தி வரிசையை வேகமாக்குதல்" },
      { form: "Mengira bilangan pekerja / To count the workers",
        ms: "Mengira bilangan pekerja", en: "To count the workers", zh: "清点工人人数", ta: "தொழிலாளர்களை எண்ணுதல்" },
      { form: "Membersihkan mesin / To clean the machine",
        ms: "Membersihkan mesin", en: "To clean the machine", zh: "清洁机器", ta: "இயந்திரத்தைச் சுத்தம் செய்தல்" },
    ],
  },
  {
    entry: "entry.1420473445", correct: 1,
    text: { ms: "Yang manakah contoh kecacatan?", en: "Which one is an example of a defect?",
            zh: "以下哪一项是缺陷的例子？", ta: "இவற்றில் எது குறைபாட்டின் உதாரணம்?" }, // TODO: check by fluent speaker
    choices: [
      { form: "Produk dalam kotak yang betul / Product in the correct box",
        ms: "Produk dalam kotak yang betul", en: "Product in the correct box", zh: "产品放在正确的箱子里", ta: "சரியான பெட்டியில் உள்ள தயாரிப்பு" },
      { form: "Calar atau retak pada produk / A scratch or crack on the product",
        ms: "Calar atau retak pada produk", en: "A scratch or crack on the product", zh: "产品上有刮痕或裂纹", ta: "தயாரிப்பில் கீறல் அல்லது விரிசல்" },
      { form: "Label yang betul / The correct label",
        ms: "Label yang betul", en: "The correct label", zh: "正确的标签", ta: "சரியான லேபிள்" },
      { form: "Permukaan yang bersih / A clean surface",
        ms: "Permukaan yang bersih", en: "A clean surface", zh: "干净的表面", ta: "சுத்தமான மேற்பரப்பு" },
    ],
  },
  {
    entry: "entry.552504519", correct: 2,
    text: { ms: "Anda jumpa produk yang cacat. Apa yang perlu anda buat?", en: "You find a product with a defect. What should you do?",
            zh: "您发现一个有缺陷的产品，应该怎么做？", ta: "குறைபாடுள்ள தயாரிப்பைக் கண்டால் என்ன செய்ய வேண்டும்?" }, // TODO: check by fluent speaker
    choices: [
      { form: "Letak semula di barisan / Put it back on the line",
        ms: "Letak semula di barisan", en: "Put it back on the line", zh: "放回生产线", ta: "மீண்டும் வரிசையில் வைக்கவும்" },
      { form: "Buang tanpa memberitahu sesiapa / Throw it away without telling anyone",
        ms: "Buang tanpa memberitahu sesiapa", en: "Throw it away without telling anyone", zh: "不告诉任何人就扔掉", ta: "யாரிடமும் சொல்லாமல் தூக்கி எறியவும்" },
      { form: "Asingkan dan ikut prosedur tolak/lapor / Separate it and follow the reject/report procedure",
        ms: "Asingkan dan ikut prosedur tolak/lapor", en: "Separate it and follow the reject/report procedure", zh: "将其隔离并按照拒收/报告程序处理", ta: "அதைத் தனியாக வைத்து நிராகரிப்பு/புகார் நடைமுறையைப் பின்பற்றவும்" },
      { form: "Sembunyikan / Hide it",
        ms: "Sembunyikan", en: "Hide it", zh: "藏起来", ta: "மறைத்து வைக்கவும்" },
    ],
  },
  {
    entry: "entry.1852523662", correct: 3,
    text: { ms: "Apa yang membantu anda memeriksa produk dengan betul?", en: "What helps you inspect products correctly?",
            zh: "什么能帮助您正确检查产品？", ta: "தயாரிப்புகளைச் சரியாக ஆய்வு செய்ய எது உதவும்?" }, // TODO: check by fluent speaker
    choices: [
      { form: "Bekerja selaju mungkin / Working as fast as possible",
        ms: "Bekerja selaju mungkin", en: "Working as fast as possible", zh: "尽可能快地工作", ta: "முடிந்தவரை வேகமாக வேலை செய்தல்" },
      { form: "Meneka sahaja / Just guessing",
        ms: "Meneka sahaja", en: "Just guessing", zh: "只靠猜", ta: "ஊகித்தல் மட்டும்" },
      { form: "Periksa satu sisi sahaja / Checking only one side",
        ms: "Periksa satu sisi sahaja", en: "Checking only one side", zh: "只检查一面", ta: "ஒரு பக்கத்தை மட்டும் சரிபார்த்தல்" },
      { form: "Pencahayaan yang baik dan bandingkan dengan sampel standard / Good lighting and comparing with the standard sample",
        ms: "Pencahayaan yang baik dan bandingkan dengan sampel standard", en: "Good lighting and comparing with the standard sample", zh: "良好的照明，并与标准样品比较", ta: "நல்ல வெளிச்சம் மற்றும் நிலையான மாதிரியுடன் ஒப்பிடுதல்" },
    ],
  },
  {
    entry: "entry.554301451", correct: 0,
    text: { ms: "5S membantu mewujudkan…", en: "5S helps to create…",
            zh: "5S 有助于创造……", ta: "5S எதை உருவாக்க உதவுகிறது?" }, // TODO: check by fluent speaker
    choices: [
      { form: "Tempat kerja yang bersih, teratur dan selamat / A clean, organised and safe workplace",
        ms: "Tempat kerja yang bersih, teratur dan selamat", en: "A clean, organised and safe workplace", zh: "干净、整齐、安全的工作场所", ta: "சுத்தமான, ஒழுங்கான, பாதுகாப்பான பணியிடம்" },
      { form: "Lebih banyak kerja lebih masa / More overtime",
        ms: "Lebih banyak kerja lebih masa", en: "More overtime", zh: "更多加班", ta: "அதிக கூடுதல் நேர வேலை" },
      { form: "Kurang pekerja / Fewer workers",
        ms: "Kurang pekerja", en: "Fewer workers", zh: "更少工人", ta: "குறைவான தொழிலாளர்கள்" },
      { form: "Mesin yang lebih laju sahaja / Only faster machines",
        ms: "Mesin yang lebih laju sahaja", en: "Only faster machines", zh: "只是更快的机器", ta: "வேகமான இயந்திரங்கள் மட்டும்" },
    ],
  },
  {
    entry: "entry.1219445179", correct: 1,
    text: { ms: "Apakah penyelenggaraan pencegahan?", en: "What is preventive maintenance?",
            zh: "什么是预防性维护？", ta: "தடுப்புப் பராமரிப்பு என்றால் என்ன?" }, // TODO: check by fluent speaker
    choices: [
      { form: "Membaiki mesin hanya selepas ia rosak / Fixing a machine only after it breaks",
        ms: "Membaiki mesin hanya selepas ia rosak", en: "Fixing a machine only after it breaks", zh: "机器坏了才修理", ta: "இயந்திரம் பழுதான பிறகே சரிசெய்தல்" },
      { form: "Pemeriksaan dan penjagaan berkala supaya mesin tidak rosak / Regular checks and care so machines do not break down",
        ms: "Pemeriksaan dan penjagaan berkala supaya mesin tidak rosak", en: "Regular checks and care so machines do not break down", zh: "定期检查和保养，让机器不坏", ta: "இயந்திரங்கள் பழுதாகாமல் இருக்க வழக்கமான சோதனையும் பராமரிப்பும்" },
      { form: "Membeli mesin baharu / Buying new machines",
        ms: "Membeli mesin baharu", en: "Buying new machines", zh: "购买新机器", ta: "புதிய இயந்திரங்களை வாங்குதல்" },
      { form: "Mematikan mesin pada waktu malam / Switching machines off at night",
        ms: "Mematikan mesin pada waktu malam", en: "Switching machines off at night", zh: "晚上关掉机器", ta: "இரவில் இயந்திரங்களை அணைத்தல்" },
    ],
  },
];
