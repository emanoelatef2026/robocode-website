"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useLanguage } from "@/contexts/LanguageContext";
import { ONLINE_COPY, ONLINE_PROGRAMS, type OnlineProgram } from "@/lib/public-site/online-programs";
import styles from "./OnlineOffer.module.css";
import PublicSectionTitle from "./PublicSectionTitle";
import { PATHWAY_TOOLS, PATHWAY_VISUALS, type PathwayToolId } from "@/lib/public-site/pathway-visuals";

function ToolBadge({ id }: { id: PathwayToolId }) {
  const tool = PATHWAY_TOOLS[id];
  return (
    <span className={styles.toolBadge} title={tool.name}>
      <span className={`${styles.toolLogo} ${tool.dark ? styles.toolLogoDark : ""}`}>
        <Image src={`/images/pathways/tools/${tool.image}`} alt={tool.name} width={68} height={44} unoptimized />
      </span>
    </span>
  );
}

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
        {ONLINE_PROGRAMS.map((program) => {
          const visual = PATHWAY_VISUALS[program.id];
          return (
          <article key={program.id} className={styles.card} aria-labelledby={`${program.id}-title`}>
            <div className={styles.cover}>
              <Image src={visual.image} alt={visual.alt[locale]} fill sizes="(min-width: 1200px) 290px, (min-width: 640px) 50vw, 100vw" className={styles.coverImage} />
              <p className={styles.agePill}><bdi dir="ltr">{program.ages[0]}–{program.ages[1]}</bdi> {copy.years}</p>
              <div className={styles.coverTools} aria-hidden="true">
                {visual.coverTools.map((id) => <span key={id}><Image src={`/images/pathways/tools/${PATHWAY_TOOLS[id].image}`} alt="" width={44} height={32} unoptimized /></span>)}
              </div>
            </div>
            <div className={styles.cardBody}>
              <h3 id={`${program.id}-title`} className={styles.title}>{visual.title[locale]}</h3>
              <p className={styles.cardSummary}>{visual.summary[locale]}</p>
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
        );})}
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
              <div className={styles.dialogCover}>
                <Image src={PATHWAY_VISUALS[selected.id].image} alt={PATHWAY_VISUALS[selected.id].alt[locale]} fill sizes="(min-width: 800px) 660px, 90vw" className={styles.coverImage} />
              </div>
              <p className={styles.description}>{selected.description[locale]}</p>
              <p className={styles.studyLine}>{copy.format}</p>
              <ol className={styles.roadmap}>
                {selected.semesters.map((semester, index) => (
                  <li key={semester.title.en} className={styles.roadmapItem}>
                    <span className={styles.stepNumber} aria-hidden="true">{index + 1}</span>
                    <div>
                      <span className={styles.stepLabel}>{copy.semester} {index + 1}</span>
                      <h4 className={styles.stepTitle}>{semester.title[locale]}</h4>
                      <p className={styles.small}>{semester.description[locale]}</p>
                      <div className={styles.toolList}>
                        {PATHWAY_VISUALS[selected.id].semesterTools[index].map((id) => <ToolBadge key={id} id={id} />)}
                      </div>
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
