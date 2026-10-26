import type { Locale } from "@/lib/i18n";

export type LocalizedText = Record<Locale, string>;
const text = (ar: string, en: string): LocalizedText => ({ ar, en });

// Owner-approved public offer. Not linked to LMS courses, contracts or payments.
export const ONLINE_STUDY = {
  classes: 12,
  months: 3,
  minutes: 90,
  semesters: 4,
  groupMin: 2,
  groupMax: 4,
  currency: "EGP",
} as const;

export const ONLINE_PLANS = [
  { id: "group", amount: 2800 },
  { id: "one-to-one", amount: 5200 },
] as const;

export interface OnlineProgram {
  id: string;
  ages: readonly [number, number];
  title: LocalizedText;
  description: LocalizedText;
  skills: LocalizedText[];
  tools: string[];
  semesters: { title: LocalizedText; description: LocalizedText }[];
}

export const ONLINE_PROGRAMS: OnlineProgram[] = [
  {
    id: "ages-6-8", ages: [6, 8],
    title: text("رحلتهم الأولى في عالم البرمجة", "First Steps into Coding"),
    description: text(
      "بداية ممتعة في التفكير المنطقي والبرمجة البصرية، من ترتيب الأوامر إلى تحريك الشخصيات وبناء القصص والألعاب والعوالم ثلاثية الأبعاد.",
      "A playful introduction to logical thinking and visual coding, from arranging instructions to animating characters and creating stories, games and 3D worlds.",
    ),
    skills: [text("التفكير المنطقي", "Logical thinking"), text("قصص تفاعلية", "Interactive stories"), text("تصميم الألعاب", "Game design")],
    tools: ["Code.org", "ScratchJr", "Scratch", "Kodu"],
    semesters: [
      { title: text("أساسيات البرمجة", "Coding Foundations"), description: text("ترتيب الأوامر والتفكير المنطقي باستخدام Code.org.", "Practise sequencing and logical thinking with Code.org.") },
      { title: text("قصص تفاعلية", "Interactive Stories"), description: text("تحريك الشخصيات وبناء المشاهد باستخدام ScratchJr.", "Animate characters and build scenes with ScratchJr.") },
      { title: text("تصميم الألعاب", "Game Design"), description: text("ألعاب بقواعد وحركة باستخدام ScratchJr أو Scratch حسب المستوى.", "Build games with movement and rules in ScratchJr or Scratch, depending on level.") },
      { title: text("تصميم وبرمجة ألعاب 3D", "3D Game Design and Coding"), description: text("إنشاء عوالم وألعاب ثلاثية الأبعاد باستخدام Kodu.", "Create 3D worlds and games with Kodu.") },
    ],
  },
  {
    id: "ages-9-11", ages: [9, 11],
    title: text("من أساسيات الكود إلى تصميم التطبيقات", "From Coding Foundations to App Design"),
    description: text(
      "يتعلّم طفلك أساسيات البرمجة ويصمّم ألعابًا ثنائية الأبعاد، ثم يتعرّف على Python ويطوّر تطبيقات موبايل تفاعلية.",
      "Your child builds coding foundations and designs 2D games, then explores Python and creates interactive mobile apps.",
    ),
    skills: [text("حل المشكلات", "Problem-solving"), text("ألعاب ثنائية الأبعاد", "2D games"), text("تطبيقات الموبايل", "Mobile apps")],
    tools: ["Code.org", "Scratch / mBlock", "PictoBlox", "MIT App Inventor"],
    semesters: [
      { title: text("أساسيات البرمجة", "Coding Foundations"), description: text("التسلسل والتكرار والشروط وحل التحديات باستخدام Code.org.", "Use sequences, loops and conditions to solve challenges with Code.org.") },
      { title: text("ألعاب ثنائية الأبعاد", "2D Game Creation"), description: text("تصميم ألعاب وإضافة النقاط والمراحل باستخدام Scratch أو mBlock.", "Create games with scoring and levels in Scratch or mBlock.") },
      { title: text("مدخل إلى Python", "Introduction to Python"), description: text("التعرّف على البرمجة النصية بمشروعات بسيطة باستخدام PictoBlox.", "Explore text-based coding through simple projects in PictoBlox.") },
      { title: text("تطبيقات الموبايل", "Mobile App Design"), description: text("تصميم واجهات وربطها بوظائف تفاعلية باستخدام MIT App Inventor.", "Create app interfaces and interactive functions with MIT App Inventor.") },
    ],
  },
  {
    id: "ages-12-14", ages: [12, 14],
    title: text("من البرمجة إلى الذكاء الاصطناعي", "From Python to Artificial Intelligence"),
    description: text(
      "من أساسيات Python إلى فهم البيانات وتدريب نماذج بسيطة، ثم تطبيق الذكاء الاصطناعي في مشروعات عملية لبورتفوليو الطالب.",
      "From Python foundations to understanding data and training simple models, students apply AI to practical projects for their digital portfolio.",
    ),
    skills: [text("البرمجة بـ Python", "Python coding"), text("تعلّم الآلة", "Machine learning"), text("مشروعات AI", "AI projects")],
    tools: ["Python", "AI", "Machine Learning"],
    semesters: [
      { title: text("أساسيات Python", "Python Foundations"), description: text("المتغيرات والشروط والتكرار والدوال.", "Work with variables, conditions, loops and functions.") },
      { title: text("الذكاء الاصطناعي وتعلّم الآلة", "AI and Machine Learning"), description: text("فهم البيانات وكيفية تدريب نماذج بسيطة.", "Understand data and how to train simple models.") },
      { title: text("تطبيقات AI باستخدام Python", "AI Applications with Python"), description: text("تطبيق نماذج ذكية على أفكار عملية.", "Apply intelligent models to practical ideas.") },
      { title: text("مشروعات AI متكاملة", "Integrated AI Projects"), description: text("تطوير المشروعات وعرضها ضمن بورتفوليو الطالب.", "Develop projects and present them in the student's portfolio.") },
    ],
  },
  {
    id: "ages-15-17", ages: [15, 17],
    title: text("البرمجة والذكاء الاصطناعي والمواقع والتطبيقات", "Coding and AI, Websites and Mobile Apps"),
    description: text(
      "يبدأ الطالب بـ Python والذكاء الاصطناعي، ثم يبني صفحات ويب تفاعلية، ويتعلّم أساسيات تطبيقات الموبايل باستخدام Flutter وDart.",
      "Students begin with Python and AI, build interactive web pages, then explore mobile app development with Flutter and Dart.",
    ),
    skills: [text("Python وAI", "Python and AI"), text("مواقع تفاعلية", "Interactive websites"), text("تطبيقات الموبايل", "Mobile apps")],
    tools: ["Python", "Google Colab", "HTML / CSS", "JavaScript", "Flutter / Dart"],
    semesters: [
      { title: text("أساسيات Python والذكاء الاصطناعي", "Python and AI Foundations"), description: text("أساسيات البرمجة وتجارب على البيانات ونماذج AI باستخدام Python وGoogle Colab.", "Explore coding, data and AI models with Python and Google Colab.") },
      { title: text("تصميم الويب 1", "Web Design 1"), description: text("بناء صفحات مناسبة للموبايل والكمبيوتر باستخدام HTML وCSS.", "Build mobile- and desktop-friendly pages with HTML and CSS.") },
      { title: text("تصميم الويب 2", "Web Design 2"), description: text("إضافة التفاعل وبناء مواقع وتطبيقات ويب بسيطة باستخدام JavaScript.", "Add interaction and build simple websites and web apps with JavaScript.") },
      { title: text("أساسيات تطبيقات الموبايل", "Mobile App Foundations"), description: text("تطبيقات متعددة الشاشات مع التنقل والتفاعل باستخدام Flutter وDart.", "Build multi-screen apps with navigation and interaction using Flutter and Dart.") },
    ],
  },
];

export function formatOnlinePrice(amount: number, locale: Locale): string {
  return new Intl.NumberFormat(locale === "ar" ? "ar-EG" : "en-EG", { numberingSystem: "latn" }).format(amount);
}

// These two newly approved homepage sections supersede the old catalog. Keep
// every unrelated CMS visibility decision, without mutating production settings.
export function resolveOnlineHomepageSections(sections: readonly string[]): string[] {
  const legacyKeys = new Set(["programs", "learning_journey", "online_pricing"]);
  const moveAccreditations = sections.includes("why") && sections.includes("accreditations");
  if (moveAccreditations) legacyKeys.add("accreditations");
  const remaining = [...new Set(sections)].filter((key) => !legacyKeys.has(key));
  const anchorKey = ["why", "trust", "hero"].find((key) => remaining.includes(key));
  const anchor = anchorKey ? remaining.indexOf(anchorKey) : -1;
  remaining.splice(anchor + 1, 0, ...(moveAccreditations ? ["accreditations"] : []), "programs", "online_pricing");
  return remaining;
}

export const ONLINE_COPY = {
  ar: {
    eyebrow: "مسارات Robocode School", heading: "مسار يناسب سن طفلك، ومهارات تتطور مع كل سيمستر.",
    intro: "اكتشف المراحل التعليمية الأربع للأعمار من 6 إلى 17 سنة، من أول أوامر البرمجة إلى تطبيقات الذكاء الاصطناعي والمواقع والموبايل. اطّلع على تفاصيل كل مرحلة ورحلة التعلّم داخلها.",
    ages: "الفئة العمرية", years: "سنة", live: "أونلاين مباشر", details: "تفاصيل المرحلة", tools: "أدوات المسار", skills: "المهارات", close: "إغلاق التفاصيل",
    preview: "نظرة على المسار", semester: "السيمستر", roadmapNote: "توضح الرودماب تسلسل التعلّم. قد تختلف وتيرة التقدّم حسب مستوى الطالب وتطوّره.",
    format: `${ONLINE_STUDY.classes} حصة لكل سيمستر · ${ONLINE_STUDY.minutes} دقيقة للحصة`,
    seePrices: "استعرض باقات الأونلاين", trial: "احجز تجربة أونلاين", pricingEyebrow: "نظام الدراسة والأسعار",
    pricingHeading: "باقات الأونلاين",
    pricingIntro: "نفس المسار التعليمي، بطريقتين للدراسة. اختر مجموعة صغيرة أو حصصًا فردية مع المدرب.",
    groupTitle: "حصص جماعية", individualTitle: "حصص فردية", groupDescription: "يتعلّم طفلك ويطبّق مع زملائه ضمن مجموعة صغيرة.",
    individualDescription: "حصص فردية لطالب واحد مع المدرب.", groupSize: `من ${ONLINE_STUDY.groupMin} إلى ${ONLINE_STUDY.groupMax} طلاب`, individualSize: "طالب واحد مع المدرب",
    currency: "جنيه مصري", perStudent: "للطالب / للسيمستر",
    schedule: `${ONLINE_STUDY.classes} حصة خلال ${ONLINE_STUDY.months} شهور`, weekly: "حصة واحدة كل أسبوع", duration: "ساعة ونصف للحصة",
    certificate: "شهادة معتمدة من STEM بعد كل سيمستر", progress: "متابعة التقدّم عبر منصة LMS", portfolio: "بورتفوليو رقمي لمشروعات الطالب",
    groupEnquiry: "استفسر عن الباقة الجماعية", individualEnquiry: "استفسر عن الباقة الفردية", enquiryHint: "تواصل مع الأكاديمية لمعرفة المجموعة والمواعيد المناسبة.",
    priceNote: `الأسعار بالجنيه المصري وتخص الدراسة الأونلاين فقط. السعر المعروض لسيمستر واحد من ${ONLINE_STUDY.classes} حصة، وليس للمسار الكامل المكوّن من أربعة سيمسترات.`,
    inPerson: "لمعرفة تفاصيل الدراسة الحضورية، تواصل مع الأكاديمية.", noPayment: "للاستفسار والحجز فقط؛ لا يتم تحصيل مدفوعات من خلال الموقع حاليًا.",
    progressTitle: "تعلّم، طبّق، وتابع تقدّمك",
  },
  en: {
    eyebrow: "Robocode School pathways", heading: "A pathway for your child's age. Skills that grow each semester.",
    intro: "Four learning pathways for ages 6–17, from first coding steps to AI, websites and apps. Discover the right pathway for your child.",
    ages: "Age group", years: "years", live: "Live online", details: "View pathway details", tools: "Pathway tools", skills: "Skills", close: "Close details",
    preview: "Pathway preview", semester: "Semester", roadmapNote: "The roadmap shows the learning sequence. Progress may vary with the student's level and development.",
    format: `${ONLINE_STUDY.classes} classes per semester · ${ONLINE_STUDY.minutes} minutes per class`,
    seePrices: "Explore Online Packages", trial: "Book an Online Trial", pricingEyebrow: "Study format & prices",
    pricingHeading: "Online Packages",
    pricingIntro: "The same learning pathway, with two ways to study. Choose a small group or one-to-one classes with the instructor.",
    groupTitle: "Group Classes", individualTitle: "One-to-One Classes", groupDescription: "Your child learns and builds alongside others in a small group.",
    individualDescription: "Individual classes for one student with the instructor.", groupSize: `${ONLINE_STUDY.groupMin}–${ONLINE_STUDY.groupMax} students`, individualSize: "One student with the instructor",
    currency: "EGP", perStudent: "per student / per semester",
    schedule: `${ONLINE_STUDY.classes} classes over ${ONLINE_STUDY.months} months`, weekly: "One class every week", duration: "90 minutes per class",
    certificate: "A STEM-accredited certificate after each semester", progress: "Learning progress through the LMS", portfolio: "A digital portfolio of student projects",
    groupEnquiry: "Enquire About Group Classes", individualEnquiry: "Enquire About One-to-One Classes", enquiryHint: "Contact the academy to discuss suitable groups and schedules.",
    priceNote: `Prices are in Egyptian pounds and apply to online classes only. Each price covers one ${ONLINE_STUDY.classes}-class semester, not the complete four-semester pathway.`,
    inPerson: "Contact the academy for in-person study details.", noPayment: "Enquiries and booking only; payments are not collected through the website at this time.",
    progressTitle: "Learn, build, and see your progress",
  },
} satisfies Record<Locale, Record<string, string>>;
