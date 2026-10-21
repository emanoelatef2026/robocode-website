"use client";

import { useEffect, useRef, useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { ONLINE_COPY, ONLINE_PROGRAMS, type OnlineProgram } from "@/lib/public-site/online-programs";
import styles from "./OnlineOffer.module.css";
import PublicSectionTitle from "./PublicSectionTitle";

export default function ProgramsSection() {
  const { locale, dir } = useLanguage();
  const copy = ONLINE_COPY[locale];
  const [selected, setSelected] = useState<OnlineProgram | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!selected || !dialog) return;
    dialog.showModal();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      if (dialog.open) dialog.close();
      document.body.style.overflow = previousOverflow;
    };
  }, [selected]);

  function closeDetails() {
    dialogRef.current?.close();
    setSelected(null);
  }

  return (
    <section id="programs" aria-labelledby="online-programs-heading" className={styles.section} dir={dir}>
      <span id="learning-journey" className={styles.alias} aria-hidden="true" />
      <header className={styles.header}>
        <PublicSectionTitle section="programs" id="online-programs-heading" />
      </header>

      <div className={styles.grid}>
        {ONLINE_PROGRAMS.map((program) => (
          <article key={program.id} className={styles.card} aria-labelledby={`${program.id}-title`}>
            <div className={styles.ageVisual}>
              <div className={styles.ageLabel}>{copy.ages}</div>
              <p className={styles.ageNumber}><bdi dir="ltr">{program.ages[0]}–{program.ages[1]}</bdi><span className={styles.ageUnit}>{copy.years}</span></p>
            </div>
            <div className={styles.cardBody}>
              <h3 id={`${program.id}-title`} className={styles.title}>{program.title[locale]}</h3>
              <p className={styles.description}>{program.description[locale]}</p>
              <ul className={styles.skills} aria-label={copy.skills}>
                {program.skills.map((skill) => <li key={skill.en} className={styles.skill}>{skill[locale]}</li>)}
              </ul>
              <button
                type="button"
                className={styles.action}
                aria-haspopup="dialog"
                aria-controls="online-pathway-preview"
                aria-label={`${copy.details}: ${program.title[locale]}`}
                onClick={() => setSelected(program)}
              >
                {copy.details}<span aria-hidden="true">{dir === "rtl" ? "←" : "→"}</span>
              </button>
            </div>
          </article>
        ))}
      </div>

      <dialog
        id="online-pathway-preview"
        ref={dialogRef}
        className={styles.dialog}
        aria-labelledby="online-pathway-title"
        dir={dir}
        onClose={() => setSelected(null)}
        onClick={(event) => {
          if (event.target !== event.currentTarget) return;
          const bounds = event.currentTarget.getBoundingClientRect();
          // A click on the dialog's own scrollbar/padding is not a backdrop click.
          if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) closeDetails();
        }}
      >
        {selected ? (
          <>
            <header className={styles.dialogHeader}>
              <div>
                <p className={styles.eyebrow}>{copy.preview} · <bdi dir="ltr">{selected.ages[0]}–{selected.ages[1]}</bdi> {copy.years}</p>
                <h3 id="online-pathway-title" className={styles.title}>{selected.title[locale]}</h3>
              </div>
              <button type="button" className={styles.close} aria-label={copy.close} onClick={closeDetails}>×</button>
            </header>
            <div className={styles.dialogBody}>
              <p className={styles.description}>{selected.description[locale]}</p>
              <ol className={styles.roadmap}>
                {selected.semesters.map((semester, index) => (
                  <li key={semester.title.en} className={styles.roadmapItem}>
                    <span className={styles.stepNumber} aria-hidden="true">{index + 1}</span>
                    <div>
                      <span className={styles.stepLabel}>{copy.semester} {index + 1}</span>
                      <h4 className={styles.stepTitle}>{semester.title[locale]}</h4>
                      <p className={styles.small}>{semester.description[locale]}</p>
                    </div>
                  </li>
                ))}
              </ol>
              <p className={styles.small}>{copy.roadmapNote}</p>
              <div className={styles.dialogFooter}>
                <button type="button" className={styles.action} onClick={() => { closeDetails(); document.getElementById("pricing")?.scrollIntoView({ behavior: "instant", block: "start" }); }}>{copy.seePrices}</button>
                <a href="/book-session" className={`${styles.action} ${styles.primary}`}>{copy.trial}</a>
              </div>
            </div>
          </>
        ) : null}
      </dialog>
    </section>
  );
}
