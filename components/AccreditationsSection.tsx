"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import PublicSectionTitle from "./public-site/PublicSectionTitle";
import { mapHomepageLearningLogos } from "@/lib/public-site/learning-logos";
import styles from "./public-site/LearningLogoFrame.module.css";

interface Accreditation {
  id:           string;
  name:         string;
  logo_url:     string;
  website_url?: string | null;
}

export default function AccreditationsSection() {
  const [items,   setItems] = useState<Accreditation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/accreditations")
      .then((r) => r.json())
      .then((d) => setItems(Array.isArray(d) ? mapHomepageLearningLogos(d) : []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading || items.length === 0) return null;

  return (
    <section id="accreditations" aria-labelledby="learning-logos-heading" className={styles.section}>
      <div className={styles.frame}>
      <PublicSectionTitle section="accreditations" id="learning-logos-heading" />
      <div className={styles.grid}>
        {items.map((item) => {
          const logo = (
            <div className={styles.artwork}>
              <Image
                src={item.logo_url}
                alt={item.name}
                fill
                sizes="(max-width: 639px) 120px, 160px"
                className="object-contain object-center"
              />
            </div>
          );

          return (
            <div key={item.id} className={styles.card} data-logo-kind={item.name.toLowerCase().includes("stem") ? "stem" : item.name.toLowerCase().includes("code.org") ? "square" : "wide"}>
              {logo}
            </div>
          );
        })}
      </div>
      </div>
    </section>
  );
}
