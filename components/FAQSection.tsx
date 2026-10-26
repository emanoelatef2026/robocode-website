"use client";

import { useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { HOMEPAGE_FAQ } from "@/lib/public-site/homepage-faq";
import PublicSectionTitle from "./public-site/PublicSectionTitle";
import styles from "./public-site/HomepageSupport.module.css";

export default function FAQSection() {
  const { locale } = useLanguage();
  const [openId, setOpenId] = useState<string | null>(null);
  const schema = {
    "@context": "https://schema.org", "@type": "FAQPage",
    mainEntity: HOMEPAGE_FAQ.map(item => ({ "@type": "Question", name: item[locale].question, acceptedAnswer: { "@type": "Answer", text: item[locale].answer } })),
  };
  return (
    <section id="faq" aria-labelledby="faq-heading" className={styles.section}>
      <PublicSectionTitle section="faq" id="faq-heading" />
      <div className={styles.questions}>
        {HOMEPAGE_FAQ.map(item => {
          const open = openId === item.id;
          const copy = item[locale];
          return (
            <div key={item.id} className={styles.question} data-open={open}>
              <h3>
                <button type="button" id={`faq-question-${item.id}`} aria-expanded={open} aria-controls={`faq-answer-${item.id}`} className={styles.trigger} onClick={() => setOpenId(current => current === item.id ? null : item.id)}>
                  <span>{copy.question}</span><span aria-hidden="true" className={styles.toggle}>{open ? "−" : "+"}</span>
                </button>
              </h3>
              <div id={`faq-answer-${item.id}`} role="region" aria-labelledby={`faq-question-${item.id}`} hidden={!open} className={styles.answer}><p>{copy.answer}</p></div>
            </div>
          );
        })}
      </div>
      <script id="faq-schema" type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema).replace(/</g, "\\u003c") }} />
    </section>
  );
}
