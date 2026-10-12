import { LEVEL_THRESHOLDS, MAX_LEVEL } from "./types";
import type { StudentEvaluation } from "@/modules/student-evaluations/types";

// The stored streak is updated when XP is awarded. On read, hide a streak that
// has expired since the last activity without changing historical records.
export function activeLearningStreak(
  stored: number,
  lastActivityDate: string | null,
  now = new Date(),
): number {
  if (!lastActivityDate || stored <= 0) return 0;
  const today = now.toISOString().slice(0, 10);
  const yesterday = new Date(now);
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  return lastActivityDate === today ||
    lastActivityDate === yesterday.toISOString().slice(0, 10)
    ? stored
    : 0;
}

export function xpMilestone(totalXp: number) {
  const nextIndex = LEVEL_THRESHOLDS.findIndex((value) => value > totalXp);
  if (nextIndex === -1) return { level: MAX_LEVEL, remaining: 0, percent: 100 };
  const currentStart = LEVEL_THRESHOLDS[nextIndex - 1];
  const next = LEVEL_THRESHOLDS[nextIndex];
  return {
    level: nextIndex,
    remaining: next - totalXp,
    percent: Math.round(
      ((totalXp - currentStart) / (next - currentStart)) * 100,
    ),
  };
}

export function evaluationHighlights(evaluations: StudentEvaluation[]) {
  const rated = evaluations.filter(
    (e) => e.rating != null && e.criterion !== "CUSTOM",
  );
  const bySkill = new Map<string, { total: number; count: number }>();
  for (const evaluation of rated) {
    const current = bySkill.get(evaluation.criterion) ?? { total: 0, count: 0 };
    bySkill.set(evaluation.criterion, {
      total: current.total + Number(evaluation.rating),
      count: current.count + 1,
    });
  }
  const skills = [...bySkill]
    .map(([criterion, value]) => ({
      criterion,
      average: Math.round((value.total / value.count) * 10) / 10,
      count: value.count,
    }))
    .sort((a, b) => b.average - a.average || b.count - a.count);
  return {
    skills,
    nextGoal:
      evaluations.find((e) => e.next_goal?.trim())?.next_goal?.trim() ?? null,
    latestPraise:
      evaluations.find((e) => e.feedback?.trim())?.feedback?.trim() ?? null,
  };
}
