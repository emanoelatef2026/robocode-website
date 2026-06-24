"use client";

// ── Component ─────────────────────────────────────────────────────────────────

interface CharacterLimitHintProps {
  current: number;
  max: number;
}

export default function CharacterLimitHint({ current, max }: CharacterLimitHintProps) {
  const pct       = current / max;
  const isWarning = pct >= 0.8 && pct < 1;
  const isOver    = current > max;

  return (
    <p
      className={[
        "mt-0.5 text-right text-[11px] tabular-nums transition-colors",
        isOver    ? "text-[#EF4444]"   :
        isWarning ? "text-[#F59E0B]" :
                    "text-[#CBD5E1]",
      ].join(" ")}
    >
      {current}/{max}
    </p>
  );
}
