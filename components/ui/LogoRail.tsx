"use client";

import { useRef, useState } from "react";
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

interface VariantCfg {
  slotH:      string;
  slotW:      string;
  gapClass:   string;
  speedPer:   number;
  scaleHover: string;
  sizes:      string;
}

const VARIANTS: Record<RailVariant, VariantCfg> = {
  accreditations: {
    slotH:      "h-24 md:h-32",
    slotW:      "w-48 md:w-64",
    gapClass:   "gap-8 md:gap-14",
    speedPer:   8,
    scaleHover: "hover:scale-[1.03]",
    sizes:      "(max-width: 768px) 192px, 256px",
  },
  partners: {
    slotH:      "h-28 md:h-36",
    slotW:      "w-56 md:w-72",
    gapClass:   "gap-8 md:gap-12",
    speedPer:   6,
    scaleHover: "hover:scale-[1.04]",
    sizes:      "(max-width: 768px) 224px, 288px",
  },
};

// ── Logo slot ──────────────────────────────────────────────────────────────────

function RailSlot({ item, cfg }: { item: LogoRailItem; cfg: VariantCfg }) {
  const slot = (
    <div
      className={[
        "relative shrink-0",
        cfg.slotH,
        cfg.slotW,
        cfg.scaleHover,
        "transition-transform duration-400",
      ].join(" ")}
    >
      <Image
        src={item.logo_url}
        alt={item.name}
        fill
        sizes={cfg.sizes}
        className="object-contain object-center"
        draggable={false}
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
//
// Autoplay: CSS @keyframes marquee (translateX 0 → -50%).
// Drag:     pointer events capture current transform, apply delta,
//           then restart animation with negative delay so it resumes
//           from the exact visual position where the drag ended.

export default function LogoRail({
  items,
  variant,
}: {
  items:   LogoRailItem[];
  variant: RailVariant;
}) {
  const cfg     = VARIANTS[variant];
  const copies  = items.length < 3 ? 4 : 2;
  const track   = Array.from({ length: copies }, () => items).flat();
  const duration = Math.max(28, items.length * cfg.speedPer);

  const trackRef     = useRef<HTMLDivElement>(null);
  const [hovered, setHovered] = useState(false);

  // Drag state — kept in a ref so callbacks never need re-binding
  const drag = useRef({
    active:     false,
    startX:     0,
    capturedTx: 0,           // translateX at drag start (px)
    resumeTimer: null as ReturnType<typeof setTimeout> | null,
  });

  // ── Helpers ──────────────────────────────────────────────────────────────

  function getTranslateX(el: HTMLElement): number {
    const m = new DOMMatrix(getComputedStyle(el).transform);
    return m.m41;
  }

  function restartFrom(txPx: number) {
    const el = trackRef.current;
    if (!el) return;
    // halfW = one repeating unit = scrollWidth / 2 (matches the -50% keyframe)
    const halfW = el.scrollWidth / 2;
    // Normalise txPx into the range (-halfW, 0]
    let norm = txPx % -halfW;
    if (norm > 0) norm -= halfW;
    // Fraction through the animation cycle
    const pct   = Math.abs(norm) / halfW;
    const delay = pct * duration;
    // Clear any manual transform, then restart animation mid-cycle
    el.style.animation     = "none";
    el.style.transform     = "";
    void el.offsetWidth;  // force reflow so the 'none' takes effect
    el.style.animation     = `marquee ${duration}s linear infinite`;
    el.style.animationDelay = `-${delay}s`;
  }

  // ── Pointer handlers (unified mouse + touch via pointer events) ───────────

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    const el = trackRef.current;
    if (!el) return;

    if (drag.current.resumeTimer) clearTimeout(drag.current.resumeTimer);
    drag.current.active     = true;
    drag.current.startX     = e.clientX;
    drag.current.capturedTx = getTranslateX(el);

    // Freeze the CSS animation and hold position via inline transform
    el.style.animation = "none";
    el.style.transform = `translateX(${drag.current.capturedTx}px)`;

    // Capture pointer so we get move/up even outside the element
    (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
    e.preventDefault();
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!drag.current.active) return;
    const el = trackRef.current;
    if (!el) return;
    const dx = e.clientX - drag.current.startX;
    el.style.transform = `translateX(${drag.current.capturedTx + dx}px)`;
  }

  function onPointerUp(e: React.PointerEvent<HTMLDivElement>) {
    if (!drag.current.active) return;
    drag.current.active = false;
    const dx      = e.clientX - drag.current.startX;
    const finalTx = drag.current.capturedTx + dx;

    // Resume autoplay after a short pause so the user sees where they landed
    drag.current.resumeTimer = setTimeout(() => {
      restartFrom(finalTx);
    }, 1200);
  }

  // ── Render ────────────────────────────────────────────────────────────────

  const animStyle: React.CSSProperties = {
    width:              "max-content",
    animation:          `marquee ${duration}s linear infinite`,
    animationPlayState: hovered ? "paused" : "running",
    willChange:         "transform",
    cursor:             "grab",
    userSelect:         "none",
  };

  return (
    <div
      className="relative overflow-hidden"
      style={{
        maskImage:
          "linear-gradient(to right, transparent 0%, black 8%, black 92%, transparent 100%)",
        WebkitMaskImage:
          "linear-gradient(to right, transparent 0%, black 8%, black 92%, transparent 100%)",
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div
        ref={trackRef}
        className={`flex items-center ${cfg.gapClass}`}
        style={animStyle}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        {track.map((item, i) => (
          <RailSlot key={`${item.id}-${i}`} item={item} cfg={cfg} />
        ))}
      </div>
    </div>
  );
}
