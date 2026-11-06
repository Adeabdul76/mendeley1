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

  // --- Google Form (the same Form is used for the pre-test and post-test) ---
  // In Google Forms: ⋮ menu → "Get pre-filled link". Fill in sample answers,
  // click "Get link", and copy it. The link contains parts like entry.123456=P01.
  // Copy each entry number into the matching place below.

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

  // When true, the "Done" / "I've finished the check" button stays locked
  // until the worker has tapped the link to open the lesson or the check.
  REQUIRE_OPEN_BEFORE_DONE: true,

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
    url: "assets/lessons/lesson1.mp4?v=2", // made from the Canva lesson DAHaGkUPIEQ
    title: {
      ms: "Bekerja dengan Selamat bersama Cobot",
      en: "Working Safely with Cobots",
      zh: "与协作机器人安全工作",                     // TODO: check by fluent speaker
      ta: "Cobot-களுடன் பாதுகாப்பாக வேலை செய்தல்",     // TODO: check by fluent speaker
    },
  },
  L2: {
    url: "assets/lessons/lesson2.mp4?v=2", // made from the Canva lesson DAHaGsTS9RM
    title: {
      ms: "Asas Pemeriksaan Kualiti Visual",
      en: "Visual Quality Inspection Basics",
      zh: "目视质量检验基础",                         // TODO: check by fluent speaker
      ta: "காட்சித் தர ஆய்வின் அடிப்படைகள்",            // TODO: check by fluent speaker
    },
  },
  L3: {
    url: "assets/lessons/lesson3.mp4?v=2", // made from the Canva lesson DAHaGv-8L9I
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
      ms: "Antara berikut, yang mana anda sudah boleh lakukan dengan yakin? Anda boleh pilih lebih daripada satu, kemudian tekan Selesai.",
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
    ms: "Hai! Saya NaikTaraf, jurulatih kerjaya anda. Dengan kira-kira 10 minit sehari, saya akan bantu anda belajar kemahiran untuk pekerjaan yang semakin berkembang di kilang anda. Bahasa apa yang anda pilih?",
    en: "Hi! I'm NaikTaraf, your career coach. In about 10 minutes a day, I'll help you learn skills for the jobs that are growing in your factory. Which language do you prefer?",
  },

  // ----- Stage 1b: participant code -----
  askCode: {
    ms: "Sila taip kod peserta yang diberi oleh pasukan kami (contohnya, P07).",
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
    ms: "Terima kasih! Mula-mula, 5 soalan ringkas tentang anda. Tekan sahaja jawapan anda.",
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
    ms: "Untuk bersedia, saya telah sediakan 3 pelajaran ringkas. Setiap pelajaran ialah video kira-kira 2 minit, jadi mudah dimuatkan dalam waktu rehat {time} anda. Sedia untuk mula?",
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
    ms: "Sebelum kita mula, sila jawab semakan ringkas 10 soalan supaya kita dapat lihat kemajuan anda.",
    en: "Before we start, please do a quick 10-question check so we can see your progress.",
    zh: "开始之前，请先做一个 10 道题的小测验，方便我们了解您的进步。",                          // TODO: check by fluent speaker
    ta: "தொடங்குவதற்கு முன், உங்கள் முன்னேற்றத்தைப் பார்க்க 10 கேள்விகள் கொண்ட சிறிய சோதனையைச் செய்யவும்.", // TODO: check by fluent speaker
  },
  btnOpenCheck: {
    ms: "Buka semakan", en: "Open the check",
    zh: "打开测验",           // TODO: check by fluent speaker
    ta: "சோதனையைத் திற",     // TODO: check by fluent speaker
  },
  btnFinishedCheck: {
    ms: "Saya sudah selesai semakan", en: "I've finished the check",
    zh: "我已完成测验",                  // TODO: check by fluent speaker
    ta: "சோதனையை முடித்துவிட்டேன்",      // TODO: check by fluent speaker
  },
  hintTapFirst: {     // small note under a locked button
    ms: "Tekan “{button}” dahulu.",
    en: "Tap “{button}” first.",
    zh: "请先点击“{button}”。",              // TODO: check by fluent speaker
    ta: "முதலில் “{button}” என்பதைத் தட்டவும்.", // TODO: check by fluent speaker
  },
  safetyNote: {
    ms: "Ingat: pelajaran ini hanya untuk kesedaran. Sentiasa ikut latihan dan peraturan keselamatan syarikat anda. Jika sesuatu nampak tidak selamat, berhenti dan laporkan kepada penyelia anda.",
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
    ms: "Syabas! Sila jawab semakan akhir supaya kita dapat ukur kemajuan anda.",
    en: "Well done! Please do the final check so we can measure your progress.",
    zh: "做得好！请完成最后的测验，方便我们衡量您的进步。",                     // TODO: check by fluent speaker
    ta: "நன்று! உங்கள் முன்னேற்றத்தை அளவிட இறுதிச் சோதனையைச் செய்யவும்.",     // TODO: check by fluent speaker
  },

  // ----- Stage 5: badge -----
  badge: {
    ms: "Tahniah! Anda telah menamatkan Laluan Permulaan **{role}** dan memperoleh lencana Tahap 1. Tunjukkan kepada penyelia atau HR anda. Seterusnya, tanya pasukan HR anda tentang latihan amali untuk peranan ini.",
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
