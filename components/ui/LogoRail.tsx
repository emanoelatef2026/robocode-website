"use client";

import { useState } from "react";
import Image from "next/image";

// ── Types ──────────────────────────────────────────────────────────────────────

export interface LogoRailItem {
  id:       string;
  name:     string;
  logo_url: string;
  href?:    string | null;
}

export type RailVariant = "accreditations" | "partners";

// ── Variant tokens ─────────────────────────────────────────────────────────────
//
// slotH / slotW: fixed-size render zone for the logo.
//   - All logos render inside this box via fill + object-contain.
//   - max-width caps wide logos; fixed height equalises tall/square logos.
//   - ~3:1 (accreditations) and ~2.5:1 (partners) aspect → most real logos fit
//     visually balanced without letterboxing.
//
// speedPer: seconds added to the marquee cycle per logo item.
//   Higher = slower, more elegant.

interface VariantCfg {
  slotH:      string;
  slotW:      string;
  gapClass:   string;
  speedPer:   number;
  opacity:    string;
  scaleHover: string;
  sizes:      string;
}

const VARIANTS: Record<RailVariant, VariantCfg> = {
  accreditations: {
    slotH:      "h-28 md:h-36",
    slotW:      "w-56 md:w-72",
    gapClass:   "gap-10 md:gap-16",
    speedPer:   9,
    opacity:    "",
    scaleHover: "hover:scale-[1.03]",
    sizes:      "(max-width: 768px) 224px, 288px",
  },
  partners: {
    slotH:      "h-32 md:h-40",
    slotW:      "w-64 md:w-80",
    gapClass:   "gap-12 md:gap-18",
    speedPer:   7,
    opacity:    "",
    scaleHover: "hover:scale-[1.05]",
    sizes:      "(max-width: 768px) 256px, 320px",
  },
};

// ── Marquee threshold ──────────────────────────────────────────────────────────
// ≤ this count → static centered row; > this → infinite marquee

const MARQUEE_THRESHOLD = 5;

// ── Logo slot ─────────────────────────────────────────────────────────────────
// Defined outside LogoRail to maintain stable component identity between renders.

function RailSlot({
  item,
  cfg,
}: {
  item: LogoRailItem;
  cfg:  VariantCfg;
}) {
  const slot = (
    <div
      className={[
        "group relative shrink-0",
        cfg.slotH,
        cfg.slotW,
        cfg.scaleHover,
        "transition-transform duration-500",
      ].join(" ")}
    >
      <Image
        src={item.logo_url}
        alt={item.name}
        fill
        sizes={cfg.sizes}
        className="object-contain object-center"
      />
    </div>
  );

  if (item.href) {
    return (
      <a
        href={item.href}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={item.name}
        className="flex items-center"
      >
        {slot}
      </a>
    );
  }

  return <div className="flex items-center">{slot}</div>;
}

// ── LogoRail ──────────────────────────────────────────────────────────────────

export default function LogoRail({
  items,
  variant,
}: {
  items:   LogoRailItem[];
  variant: RailVariant;
}) {
  const cfg           = VARIANTS[variant];
  const [paused, setPaused] = useState(false);
  const useMarquee    = items.length > MARQUEE_THRESHOLD;
  const duration      = Math.max(30, items.length * cfg.speedPer);

  // ── Static centered row ──────────────────────────────────────────────────

  if (!useMarquee) {
    return (
      <div className={`flex flex-wrap items-center justify-center ${cfg.gapClass}`}>
        {items.map((item) => (
          <RailSlot key={item.id} item={item} cfg={cfg} />
        ))}
      </div>
    );
  }

  // ── Infinite marquee ─────────────────────────────────────────────────────
  // Track = [...items, ...items]. Animation moves -50% → seamless visual loop.
  // .marquee-track class auto-swaps to marquee-rtl keyframe in RTL (globals.css).

  const track = [...items, ...items];

  return (
    <div
      className="relative overflow-hidden"
      style={{
        maskImage:
          "linear-gradient(to right, transparent 0%, black 10%, black 90%, transparent 100%)",
        WebkitMaskImage:
          "linear-gradient(to right, transparent 0%, black 10%, black 90%, transparent 100%)",
      }}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div
        className={`marquee-track flex items-center ${cfg.gapClass}`}
        style={{
          width:               "max-content",
          animation:           `marquee ${duration}s linear infinite`,
          animationPlayState:  paused ? "paused" : "running",
          willChange:          "transform",
        }}
      >
        {track.map((item, i) => (
          <RailSlot key={`${item.id}-${i}`} item={item} cfg={cfg} />
        ))}
      </div>
    </div>
  );
}
