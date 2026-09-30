"use client";

import Link from "next/link";
import { useLanguage } from "@/contexts/LanguageContext";

type LegalKind = "terms" | "refund" | "privacy";

type LegalCopy = {
  eyebrow: string;
  title: string;
  intro: string;
  sections: Array<{ title: string; items: string[] }>;
  closing: string;
};

const ENGLISH: Record<LegalKind, LegalCopy> = {
  terms: {
    eyebrow: "Robocode School · Legal",
    title: "Terms & Conditions",
    intro: "These terms explain how our academy services, classes, and digital platforms are used.",
    sections: [
      { title: "Using our services", items: [
        "Enrollment in a course or group is subject to availability and placement in the appropriate level.",
        "Parents and students are responsible for providing correct and up-to-date registration information.",
        "Subscriptions, sessions, and payments are managed according to the student’s recorded contract or package.",
      ] },
      { title: "Attendance and schedule", items: [
        "A session is counted when it is delivered to the group, including when a student is absent, unless the academy confirms another arrangement.",
        "The academy may adjust a session time, instructor, or location when operationally necessary and will notify families whenever reasonably possible.",
      ] },
      { title: "Conduct and content", items: [
        "Students are expected to follow respectful, safe behavior in branches and on digital platforms.",
        "Learning materials, recordings, and platform content are for the student’s personal learning use and may not be shared or reused without written permission.",
        "Serious breaches of conduct or safety may result in suspension after communication with the parent or guardian.",
      ] },
    ],
    closing: "For questions about these terms, please contact the academy through our official communication channels.",
  },
  refund: {
    eyebrow: "Robocode School · Legal",
    title: "Refund Policy",
    intro: "We aim to make every enrollment clear and fair. Refund requests are reviewed against the student’s contract and the sessions already delivered.",
    sections: [
      { title: "How refunds are reviewed", items: [
        "A refund review may be requested before a program begins or during its early period, depending on the student’s contract and circumstances.",
        "Once a program has started, delivered sessions and sessions reserved for the student are deducted from the subscription value.",
        "Sessions that were delivered to the group are not refundable, including when the student was absent.",
      ] },
      { title: "Changes made by the academy", items: [
        "If the academy cancels a group and cannot offer a suitable alternative, the family may be offered a transfer, a student credit, or a refund for the unused portion, as appropriate.",
        "Promotions, discounts, and special offers may affect the final refundable amount.",
      ] },
      { title: "Submitting a request", items: [
        "Requests should be submitted through the academy administration or official communication channels.",
        "The academy reviews each request before confirming the outcome.",
        "A refund request does not affect the student’s ability to attend remaining sessions while their active contract remains valid.",
      ] },
    ],
    closing: "Please keep your payment reference and contract details available when submitting a request.",
  },
  privacy: {
    eyebrow: "Robocode School · Legal",
    title: "Privacy Policy",
    intro: "Robocode School respects the privacy of students, parents, and instructors. We use personal information only as needed to provide and improve our academy services.",
    sections: [
      { title: "Information we use", items: [
        "We may collect names, ages, contact details, parent details, branch and group information, attendance, and academic progress.",
        "This information helps us manage enrollment, communication, attendance, payments, and the learning experience.",
      ] },
      { title: "How information is protected", items: [
        "We do not sell personal information or share it for unrelated marketing purposes.",
        "Access is role-based: students see their own information, parents see their children’s information, and academy staff see what is necessary for their work.",
        "We use reasonable safeguards to protect information from unauthorized access or use.",
      ] },
      { title: "Student work and your choices", items: [
        "Student projects, photos, or videos may be shared in our gallery or promotional content only with the appropriate parent or guardian permission.",
        "You may ask the academy to update or correct your personal information through official communication channels.",
      ] },
    ],
    closing: "By using our services, you acknowledge this policy and the way we handle information to support the academy experience.",
  },
};

const ARABIC: Record<LegalKind, LegalCopy> = {
  terms: {
    eyebrow: "Robocode School · الشروط القانونية",
    title: "الشروط والأحكام",
    intro: "توضح هذه الشروط طريقة استخدام خدمات الأكاديمية والحصص والمنصات الرقمية الخاصة بـ Robocode School.",
    sections: [
      { title: "استخدام خدمات الأكاديمية", items: [
        "يعتمد التسجيل في البرامج والجروبات على توفر الأماكن وتحديد المستوى المناسب للطالب.",
        "يلتزم الطالب وولي الأمر بتقديم بيانات صحيحة ومحدّثة عند التسجيل.",
        "تُدار الاشتراكات والحصص والمدفوعات وفقًا للعقد أو الباقة المسجلة للطالب.",
      ] },
      { title: "الحضور والمواعيد", items: [
        "تُحتسب الحصة عند انعقادها للجروب، بما في ذلك غياب الطالب، إلا إذا أكدت الأكاديمية ترتيبًا مختلفًا.",
        "يجوز للأكاديمية تعديل موعد الحصة أو المدرب أو المكان عند الحاجة التشغيلية، مع إبلاغ الأسر كلما أمكن ذلك.",
      ] },
      { title: "السلوك والمحتوى", items: [
        "يلتزم الطلاب بالسلوك المحترم والآمن داخل الفروع وعلى المنصات الرقمية.",
        "مواد التعلم والتسجيلات ومحتوى المنصة مخصصة للاستخدام التعليمي الشخصي للطالب، ولا يجوز مشاركتها أو إعادة استخدامها دون إذن كتابي.",
        "قد يؤدي الإخلال الجسيم بالسلوك أو السلامة إلى إيقاف المشاركة بعد التواصل مع ولي الأمر.",
      ] },
    ],
    closing: "لأي استفسار بخصوص هذه الشروط، يُرجى التواصل مع الأكاديمية عبر قنواتها الرسمية.",
  },
  refund: {
    eyebrow: "Robocode School · الشروط القانونية",
    title: "سياسة الاسترداد",
    intro: "نسعى إلى أن يكون كل تسجيل واضحًا وعادلًا. تتم مراجعة طلبات الاسترداد وفقًا لعقد الطالب والحصص التي تم تنفيذها.",
    sections: [
      { title: "مراجعة طلبات الاسترداد", items: [
        "يمكن طلب مراجعة الاسترداد قبل بدء البرنامج أو خلال فترته الأولى، حسب العقد وحالة الطالب.",
        "بعد بدء البرنامج، تُخصم قيمة الحصص التي انعقدت أو تم حجزها للطالب من قيمة الاشتراك.",
        "لا تُسترد الحصص التي انعقدت للجروب، بما في ذلك الحصص التي تغيب عنها الطالب.",
      ] },
      { title: "التغييرات من جانب الأكاديمية", items: [
        "إذا ألغت الأكاديمية جروبًا ولم يتوفر بديل مناسب، قد يتم تقديم نقل إلى جروب آخر أو رصيد للطالب أو استرداد الجزء غير المستخدم بحسب الحالة.",
        "قد تؤثر الخصومات والعروض الخاصة على قيمة الاسترداد النهائية.",
      ] },
      { title: "تقديم الطلب", items: [
        "يُقدم الطلب عبر إدارة الأكاديمية أو قنوات التواصل الرسمية.",
        "تراجع الأكاديمية كل طلب قبل اعتماد القرار النهائي.",
        "لا يؤثر طلب الاسترداد على حق الطالب في حضور الحصص المتبقية ما دام عقده النشط ساريًا.",
      ] },
    ],
    closing: "يُفضّل الاحتفاظ بمرجع الدفع وتفاصيل العقد عند تقديم الطلب.",
  },
  privacy: {
    eyebrow: "Robocode School · الشروط القانونية",
    title: "سياسة الخصوصية",
    intro: "تحترم Robocode School خصوصية الطلاب وأولياء الأمور والمدربين، وتستخدم البيانات الشخصية فقط بما يلزم لتقديم وتحسين خدمات الأكاديمية.",
    sections: [
      { title: "البيانات التي نستخدمها", items: [
        "قد نجمع الاسم والعمر وبيانات التواصل وبيانات ولي الأمر والفرع والجروب والحضور والتقدم الأكاديمي.",
        "تساعدنا هذه البيانات في إدارة التسجيل والتواصل والحضور والمدفوعات وتجربة التعلم.",
      ] },
      { title: "حماية البيانات", items: [
        "لا نبيع البيانات الشخصية ولا نشاركها لأغراض تسويقية غير مرتبطة بخدمات الأكاديمية.",
        "يكون الوصول للبيانات حسب الصلاحيات: الطالب يرى بياناته، وولي الأمر يرى بيانات أبنائه، وفريق الأكاديمية يرى ما يلزم لعمله.",
        "نتخذ إجراءات مناسبة لحماية البيانات من الوصول أو الاستخدام غير المصرح به.",
      ] },
      { title: "أعمال الطالب وخياراتك", items: [
        "قد تُعرض مشاريع أو صور أو فيديوهات الطلاب في المعرض أو المحتوى التعريفي بعد الحصول على موافقة ولي الأمر المناسبة.",
        "يمكنك طلب تحديث أو تصحيح بياناتك عبر قنوات التواصل الرسمية للأكاديمية.",
      ] },
    ],
    closing: "باستخدامك لخدماتنا، فإنك تقر بهذه السياسة وطريقة تعاملنا مع المعلومات لدعم تجربة الأكاديمية.",
  },
};

export default function LegalPageContent({ kind }: { kind: LegalKind }) {
  const { locale } = useLanguage();
  const copy = (locale === "ar" ? ARABIC : ENGLISH)[kind];
  const isArabic = locale === "ar";

  return (
    <main dir={isArabic ? "rtl" : "ltr"} className="min-h-screen bg-[#F8FAFC] px-5 pb-16 pt-32 text-[#0B2341] md:px-8 md:pt-40">
      <div className="mx-auto max-w-4xl">
        <Link href="/" className="inline-flex items-center gap-2 text-sm font-semibold text-[#0E7490] transition hover:text-[#C2410C]">
          <span aria-hidden>{isArabic ? "←" : "←"}</span>
          {isArabic ? "العودة إلى الرئيسية" : "Back to home"}
        </Link>
        <header className="mt-8 rounded-3xl border border-[#D7E0EA] bg-white px-6 py-9 shadow-[0_12px_32px_rgba(11,31,58,0.06)] md:px-10 md:py-12">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#C2410C]">{copy.eyebrow}</p>
          <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-[#0B2341] md:text-5xl">{copy.title}</h1>
          <p className="mt-5 max-w-2xl text-base leading-8 text-[#475569] md:text-lg">{copy.intro}</p>
          <p className="mt-6 text-sm font-medium text-[#64748B]">{isArabic ? "آخر تحديث: سبتمبر 2026" : "Last updated: September 2026"}</p>
        </header>

        <div className="mt-6 space-y-5">
          {copy.sections.map((section, index) => (
            <section key={section.title} className="rounded-2xl border border-[#D7E0EA] bg-white px-6 py-6 shadow-[0_4px_16px_rgba(11,31,58,0.035)] md:px-8">
              <div className="flex items-center gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#FFF1E5] text-xs font-extrabold text-[#C2410C]">{index + 1}</span>
                <h2 className="text-lg font-bold text-[#0B2341] md:text-xl">{section.title}</h2>
              </div>
              <ul className="mt-4 space-y-3">
                {section.items.map((item) => (
                  <li key={item} className="flex gap-3 text-sm leading-7 text-[#475569] md:text-base">
                    <span className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#10B6D3]" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>

        <p className="mt-7 rounded-2xl border-s-4 border-[#FF8A1F] bg-[#FFF7ED] px-5 py-4 text-sm leading-7 text-[#7C2D12] md:text-base">{copy.closing}</p>
      </div>
    </main>
  );
}
