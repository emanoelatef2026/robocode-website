"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useLanguage } from "@/contexts/LanguageContext";
import SectionTitle from "@/components/ui/SectionTitle";

interface Accreditation {
  id:           string;
  name:         string;
  logo_url:     string;
  website_url?: string | null;
}

export default function AccreditationsSection() {
  const { t }               = useLanguage();
  const [items,   setItems] = useState<Accreditation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/accreditations")
      .then((r) => r.json())
      .then((d) => setItems(Array.isArray(d) ? d : []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading || items.length === 0) return null;

  return (
    <section id="accreditations" className="relative z-10 mx-auto max-w-7xl px-6 pb-16 md:pb-24">

      <SectionTitle
        heading={
          <>{t("accreditations.heading1")}{" "}
          <span className="text-[#FF8A1F]">{t("accreditations.heading2")}</span></>
        }
        body={t("accreditations.body")}
      />

      {/* Static grid: 2-col mobile → 4-col desktop. No carousel, no animation. */}
      <div className="mt-10 grid grid-cols-2 items-center justify-items-center gap-8 md:mt-14 md:gap-10 lg:grid-cols-4 lg:gap-16">
        {items.map((item) => {
          const logo = (
            <div className="relative h-20 w-full max-w-44 transition-opacity duration-200 hover:opacity-80">
              <Image
                src={item.logo_url}
                alt={item.name}
                fill
                sizes="(max-width: 1024px) 45vw, 20vw"
                className="object-contain object-center"
              />
            </div>
          );

          return item.website_url ? (
            <a
              key={item.id}
              href={item.website_url}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={item.name}
              className="flex w-full justify-center"
            >
              {logo}
            </a>
          ) : (
            <div key={item.id} className="flex w-full justify-center">
              {logo}
            </div>
          );
        })}
      </div>

    </section>
  );
}
