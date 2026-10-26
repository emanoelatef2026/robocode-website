"use client";

import { useLanguage } from "@/contexts/LanguageContext";
import { ONLINE_COPY, ONLINE_PLANS, formatOnlinePrice } from "@/lib/public-site/online-programs";
import styles from "./OnlineOffer.module.css";
import PublicSectionTitle from "./PublicSectionTitle";

function Check() {
  return <svg className={styles.check} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="m5 12 4 4L19 6" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

export default function OnlinePricingSection() {
  const { locale, dir } = useLanguage();
  const copy = ONLINE_COPY[locale];

  return (
    <section id="pricing" aria-labelledby="online-pricing-heading" className={styles.section} dir={dir}>
        <header className={styles.header}>
          <PublicSectionTitle section="pricing" id="online-pricing-heading" />
        </header>
        <div className={styles.priceGrid}>
          {ONLINE_PLANS.map((plan) => {
            const group = plan.id === "group";
            const title = group ? copy.groupTitle : copy.individualTitle;
            const benefits = [
              group ? copy.groupSize : copy.individualSize,
              group
                ? (locale === "ar" ? "تعلّم وتفاعل مع زملاء في نفس المستوى" : "Learn and collaborate with peers at a similar level")
                : (locale === "ar" ? "اهتمام المدرب بالكامل لطالب واحد" : "The instructor’s full attention for one student"),
              copy.schedule,
              `${copy.weekly} · ${copy.duration}`,
              copy.progress,
              copy.portfolio,
              copy.certificate,
            ];
            return (
              <article key={plan.id} className={styles.priceCard} aria-labelledby={`online-plan-${plan.id}`}>
                <p className={styles.badge}>{group ? (locale === "ar" ? "مجموعة صغيرة" : "Small group") : (locale === "ar" ? "مدرب خاص لطفلك" : "Just your child & the instructor")}</p>
                <div>
                  <h3 id={`online-plan-${plan.id}`} className={styles.title}>{title}</h3>
                </div>
                <div>
                  <p className={styles.price}><bdi dir="ltr" className={styles.priceAmount}>{formatOnlinePrice(plan.amount, locale)}</bdi><span className={styles.currency}>{copy.currency}</span></p>
                  <p className={styles.priceUnit}>{locale === "ar" ? "للطالب · سيمستر واحد أونلاين" : "per student · one online semester"}</p>
                </div>
                <ul className={styles.planBenefits}>
                  {benefits.map((benefit) => <li key={benefit}><Check /><span>{benefit}</span></li>)}
                </ul>
                <a href="#contact" className={`${styles.action} ${group ? styles.primary : styles.navy} ${styles.priceAction}`}>
                  {group ? copy.groupEnquiry : copy.individualEnquiry}
                </a>
              </article>
            );
          })}
        </div>
    </section>
  );
}
