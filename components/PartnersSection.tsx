"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import PublicSectionTitle from "./public-site/PublicSectionTitle";
import styles from "./public-site/HomepageSupport.module.css";

interface Partner { id: string; name: string; logo_url: string; website_url: string | null; }

export default function PartnersSection() {
  const [items, setItems] = useState<Partner[]>([]);
  const [failedImages, setFailedImages] = useState<ReadonlySet<string>>(new Set());

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/partners", { signal: controller.signal })
      .then(response => { if (!response.ok) throw new Error("Partners unavailable"); return response.json(); })
      .then(data => { if (Array.isArray(data)) setItems(Array.from(new Map(data.map((item: Partner) => [item.id, item])).values())); })
      .catch(error => { if (error.name !== "AbortError") console.error(error); });
    return () => controller.abort();
  }, []);

  if (items.length === 0) return null;

  return (
    <section id="partners" aria-labelledby="partners-heading" className={styles.section}>
      <div className={styles.partnerFrame}>
      <PublicSectionTitle section="partners" id="partners-heading" />
      <ul className={styles.partners} role="list">
        {items.map(partner => {
          const logo = failedImages.has(partner.id) ? <span className={styles.partnerName}>{partner.name}</span> : (
            <span className={styles.partnerArtwork}><Image src={partner.logo_url} alt={partner.name} fill sizes="(max-width: 639px) 144px, 200px" className="object-contain" onError={() => setFailedImages(current => new Set(current).add(partner.id))} /></span>
          );
          return (
            <li key={partner.id} className={styles.partner}>
              {partner.website_url ? <a href={partner.website_url} target="_blank" rel="noopener noreferrer" aria-label={partner.name} className={styles.partnerContent}>{logo}</a> : <div className={styles.partnerContent}>{logo}</div>}
            </li>
          );
        })}
      </ul>
      </div>
    </section>
  );
}
