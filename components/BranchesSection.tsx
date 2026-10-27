"use client";

import { useEffect, useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { ACADEMY_WHATSAPP_URL } from "@/lib/public-site/contact";
import PublicSectionTitle from "./public-site/PublicSectionTitle";
import styles from "./public-site/BranchesSection.module.css";

interface Branch {
  id: string;
  name: string;
  location: string | null;
  active: boolean;
  study_mode?: "online" | "offline" | "hybrid" | null;
}

// Public display names only; portal names and branch records stay unchanged.
const BRANCH_NAMES: Record<string, { ar: string; en: string; area: { ar: string; en: string } }> = {
  "madinty sports club": { ar: "نادي مدينتي الرياضي", en: "Madinaty Sports Club", area: { ar: "مدينتي", en: "Madinaty" } },
  "elshrouk city": { ar: "الشروق", en: "El Shorouk", area: { ar: "مدينة الشروق", en: "El Shorouk City" } },
  "badr city": { ar: "بدر", en: "Badr", area: { ar: "مدينة بدر", en: "Badr City" } },
  "5th setlement": { ar: "التجمع الخامس", en: "Fifth Settlement", area: { ar: "القاهرة الجديدة", en: "New Cairo" } },
};

function BranchIcon({ name }: { name: string }) {
  const key = name.trim().toLowerCase();
  const paths: Record<string, string> = {
    "madinty sports club": "M3 21h18M5 21V10h14v11M9 21v-5h6v5M8 10V6h8v4M12 6V2l5 1.5L12 5M8 13h1m6 0h1",
    "elshrouk city": "M3 17h18M5 21h14M7 17a5 5 0 0 1 10 0M12 3v3M4.2 7.2l2.1 2.1M19.8 7.2l-2.1 2.1M2 12h2m16 0h2",
    "5th setlement": "M2 21h20M4 21V11l4-4 4 4v10M12 21V6l4-3 4 3v15M7 21v-5h2v5M15 8h2m-2 4h2m-2 4h2",
  };
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={paths[key] ?? "M4 21V5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v16M2 21h20M9 21v-4h6v4M8 7h2m4 0h2M8 11h2m4 0h2"} />
    </svg>
  );
}

function ChatIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5 9 9 0 0 1-4-.9L3 21l1.9-5.5a9 9 0 0 1-.9-4 8.5 8.5 0 0 1 17 0Z" /><path d="M8 11h8M8 14h5" /></svg>;
}

function OnlineIcon() {
  return <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="13" rx="2" /><path d="M8 21h8M12 16v5M8 8l-2 2 2 2m8-4 2 2-2 2m-3-5-2 6" /></svg>;
}

export default function BranchesSection() {
  const { locale, dir } = useLanguage();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const ar = locale === "ar";

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/branches", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("Branches unavailable");
        const data = await response.json();
        if (!Array.isArray(data)) throw new Error("Invalid branches response");
        if (!controller.signal.aborted) setBranches(data.filter((branch: Branch) => branch.active !== false));
      })
      .catch(() => { if (!controller.signal.aborted) setFailed(true); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [attempt]);

  const isOnline = (branch: Branch) => branch.study_mode === "online" || (!branch.study_mode && /^(online|أونلاين)$/i.test(branch.name.trim()));
  const physicalBranches = branches.filter((branch) => !isOnline(branch));
  const hasOnline = branches.some(isOnline);

  return (
    <section id="branches" aria-labelledby="branches-heading" className={styles.section} dir={dir}>
      <div className={styles.header}><PublicSectionTitle section="branches" id="branches-heading" /></div>
      {loading ? (
        <p className={styles.status} role="status">{ar ? "جارٍ تحميل الفروع…" : "Loading branches…"}</p>
      ) : failed ? (
        <div className={styles.status} role="status">
          <p>{ar ? "تعذّر تحميل الفروع." : "Branches could not be loaded."}</p>
          <button className={styles.action} onClick={() => { setFailed(false); setLoading(true); setAttempt((value) => value + 1); }}>
            {ar ? "حاول مرة أخرى" : "Try again"}
          </button>
        </div>
      ) : (
        <>
          {physicalBranches.length > 0 ? (
            <div className={styles.grid}>
              {physicalBranches.map((branch) => {
                const display = BRANCH_NAMES[branch.name.trim().toLowerCase()];
                const name = display?.[locale] ?? branch.name;
                // Legacy location fields may contain map URLs rather than addresses.
                const address = branch.location?.trim();
                const readableAddress = address && !/(?:https?:\/\/|www\.|maps\.app|share\.google)/i.test(address) ? address : display?.area[locale];
                const message = ar ? `مرحبًا، أود الاستفسار عن الدراسة في فرع ${name}.` : `Hello, I'd like to enquire about classes at the ${name} branch.`;
                return (
                  <article key={branch.id} className={styles.card}>
                    <span className={styles.icon}><BranchIcon name={branch.name} /></span>
                    <div className={styles.details}>
                      <h3>{name}</h3>
                      {readableAddress && <p className={styles.address}>{readableAddress}</p>}
                    </div>
                    <a className={styles.action} href={`${ACADEMY_WHATSAPP_URL}?text=${encodeURIComponent(message)}`} target="_blank" rel="noopener noreferrer" aria-label={ar ? `استفسر عن فرع ${name} عبر واتساب` : `Enquire about ${name} on WhatsApp`}>
                      <ChatIcon /><span>{ar ? "استفسر عن الفرع" : "Enquire about branch"}</span>
                    </a>
                  </article>
                );
              })}
            </div>
          ) : !hasOnline && (
            <p className={styles.status}>{ar ? "تفاصيل الفروع ستتوفر قريبًا." : "Branch details will be available soon."}</p>
          )}
          {hasOnline && (
            <article className={styles.online}>
              <div className={styles.onlineIntro}>
                <span className={styles.onlineIcon}><OnlineIcon /></span>
                <div>
                  <h3>{ar ? "حصص أونلاين" : "Online Classes"}</h3>
                  <p>{ar ? "تعلّم البرمجة والذكاء الاصطناعي من بيتك." : "Learn coding and AI from home."}</p>
                </div>
              </div>
              <a className={styles.onlineLink} href={`${ACADEMY_WHATSAPP_URL}?text=${encodeURIComponent(ar ? "مرحبًا، أود الاستفسار عن حصص الأونلاين في Robocode School." : "Hello, I'd like to enquire about online classes at Robocode School.")}`} target="_blank" rel="noopener noreferrer" aria-label={ar ? "استفسر عن الأونلاين عبر واتساب" : "Enquire about online classes on WhatsApp"}>
                <ChatIcon /><span>{ar ? "استفسر عن الأونلاين" : "Enquire about online classes"}</span>
              </a>
            </article>
          )}
        </>
      )}
    </section>
  );
}
