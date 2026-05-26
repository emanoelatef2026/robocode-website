"use client";

import { useEffect, useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import SectionTitle from "@/components/ui/SectionTitle";
import LogoRail, { type LogoRailItem } from "@/components/ui/LogoRail";

interface Accreditation {
  id:          string;
  name:        string;
  logo_url:    string;
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

  // Hide entirely when loading or empty — no empty container rendered
  if (loading || items.length === 0) return null;

  const rail: LogoRailItem[] = items.map((a) => ({
    id:       a.id,
    name:     a.name,
    logo_url: a.logo_url,
    href:     a.website_url ?? null,
  }));

  return (
    <section id="accreditations" className="relative z-10 mx-auto max-w-7xl px-6 pb-16 md:pb-24">

      <SectionTitle
        eyebrow={t("accreditations.eyebrow")}
        heading={
          <>{t("accreditations.heading1")}{" "}
          <span className="text-[#38BDF8]">{t("accreditations.heading2")}</span></>
        }
        body={t("accreditations.body")}
        accent="navy"
      />

      <div className="mt-10 md:mt-16">
        <LogoRail items={rail} variant="accreditations" />
      </div>

    </section>
  );
}
