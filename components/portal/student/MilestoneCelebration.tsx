"use client";

import { useEffect, useState } from "react";

type Milestone = "level" | "badge" | null;

export default function MilestoneCelebration({
  studentId,
  level,
  badges,
}: {
  studentId: string;
  level: number;
  badges: number;
}) {
  const [milestone, setMilestone] = useState<Milestone>(null);

  useEffect(() => {
    const key = `robocode:milestones:${studentId}`;
    let nextMilestone: Milestone = null;
    try {
      const previous = window.localStorage.getItem(key);
      if (previous) {
        const saved = JSON.parse(previous) as {
          level?: number;
          badges?: number;
        };
        if (level > (saved.level ?? level)) nextMilestone = "level";
        else if (badges > (saved.badges ?? badges)) nextMilestone = "badge";
      }
    } catch {
      // Private browsing or blocked storage must not affect the dashboard.
    }
    const timer = window.setTimeout(() => {
      if (nextMilestone) setMilestone(nextMilestone);
      try {
        window.localStorage.setItem(key, JSON.stringify({ level, badges }));
      } catch {
        /* storage unavailable */
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [studentId, level, badges]);

  if (!milestone) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Learning milestone"
      className="fixed inset-0 z-[90] grid place-items-center bg-[#07182D]/65 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) setMilestone(null);
      }}
    >
      <div className="relative w-full max-w-sm overflow-hidden rounded-3xl border border-[#D7E0EA] bg-white p-7 text-center shadow-2xl">
        <div className="pointer-events-none absolute -left-5 -top-5 h-20 w-20 rounded-full bg-[#BDECF5]/50" />
        <div className="pointer-events-none absolute -bottom-7 -right-6 h-24 w-24 rounded-full bg-[#FFF1E7]" />
        <div className="relative mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-[#FFF1E7] text-[#C2410C]">
          <svg
            viewBox="0 0 24 24"
            className="h-9 w-9"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="M12 2 14.7 8.4 21.5 9l-5.2 4.5 1.6 6.7L12 16.6l-5.9 3.6 1.6-6.7L2.5 9l6.8-.6L12 2Z" />
          </svg>
        </div>
        <h2 className="relative mt-5 text-2xl font-extrabold text-[#0B1F3A]">
          {milestone === "level"
            ? `Level ${level} unlocked!`
            : "A new badge is yours!"}
        </h2>
        <p className="relative mt-2 text-sm leading-relaxed text-[#475569]">
          {milestone === "level"
            ? "Your learning and effort are adding up. Keep building toward your next goal."
            : "Your work earned a new recognition. See it in your achievements."}
        </p>
        <button
          autoFocus
          type="button"
          onClick={() => setMilestone(null)}
          className="relative mt-6 min-h-11 w-full rounded-xl bg-[#C2410C] px-4 text-sm font-bold text-white hover:bg-[#9A3412]"
        >
          Keep learning
        </button>
      </div>
    </div>
  );
}
