"use client";

import { useEffect, useState } from "react";
import PublicSectionTitle from "./public-site/PublicSectionTitle";
import LogoRail, { type LogoRailItem } from "@/components/ui/LogoRail";

interface Partner {
  id:          string;
  name:        string;
  logo_url:    string;
  website_url: string | null;
}

export default function PartnersSection() {
  const [items,   setItems] = useState<Partner[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/partners")
      .then((r) => r.json())
      .then((d) => setItems(Array.isArray(d) ? d : []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  // Hide entirely when loading or empty — no empty container rendered
  if (loading || items.length === 0) return null;

  const rail: LogoRailItem[] = items.map((p) => ({
    id:       p.id,
    name:     p.name,
    logo_url: p.logo_url,
    href:     p.website_url,
  }));

  return (
    <section id="partners" className="relative z-10 mx-auto max-w-7xl px-6 pb-16 md:pb-24">

      <PublicSectionTitle section="partners" />

      <div className="mt-10 md:mt-16">
        <LogoRail items={rail} variant="partners" />
      </div>

    </section>
  );
}
