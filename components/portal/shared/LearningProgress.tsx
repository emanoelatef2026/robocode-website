import Link from "next/link";
import type { StudentEvaluation } from "@/modules/student-evaluations/types";
import { EVALUATION_CRITERION_LABELS } from "@/modules/student-evaluations/types";
import type { StudentGameProfile } from "@/modules/gamification/types";
import { XP_AWARDS } from "@/modules/gamification/types";
import { evaluationHighlights } from "@/modules/gamification/progress";

type Audience = "student" | "parent";

function ProgressMark({ kind }: { kind: "spark" | "target" | "flame" }) {
  const paths = {
    spark: (
      <>
        <path d="m12 2 1.8 6.2L20 10l-6.2 1.8L12 18l-1.8-6.2L4 10l6.2-1.8L12 2Z" />
        <path d="m19 17 .6 1.4L21 19l-1.4.6L19 21l-.6-1.4L17 19l1.4-.6L19 17Z" />
      </>
    ),
    target: (
      <>
        <circle cx="12" cy="12" r="9" />
        <circle cx="12" cy="12" r="5" />
        <circle cx="12" cy="12" r="1" />
      </>
    ),
    flame: (
      <path d="M12 22c4.1 0 7-3 7-7 0-3.3-2-5.9-4.4-7.7.1 2.4-1.1 3.4-2 3.9C12.8 7.6 10.7 4.6 8 2c.2 3.9-.7 5.4-2 7.3C4.8 11 5 13 5 15c0 4 2.9 7 7 7Z" />
    ),
  };
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-5 w-5"
      aria-hidden
    >
      {paths[kind]}
    </svg>
  );
}

export default function LearningProgress({
  evaluations,
  profile,
  audience,
  name,
  childId,
  compact = false,
}: {
  evaluations: StudentEvaluation[];
  profile: StudentGameProfile | null;
  audience: Audience;
  name?: string;
  childId?: string;
  compact?: boolean;
}) {
  const { skills, nextGoal, latestPraise } = evaluationHighlights(evaluations);
  const strongestSkill = skills[0];
  const firstName = name?.split(" ")[0] || "your child";
  const goal =
    nextGoal ??
    (audience === "student"
      ? "Keep building, attending, and sharing what you learn. Your next instructor goal will appear here."
      : `Your next instructor goal for ${firstName} will appear here after an evaluation is shared.`);

  return (
    <div className="space-y-4">
      <section className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-[#D7E0EA] bg-[#0B1F3A] p-5 text-white">
          <div className="flex items-center gap-2 text-sm font-bold text-[#BDECF5]">
            <ProgressMark kind="spark" /> Learning level
          </div>
          <div className="mt-3 flex items-end justify-between gap-3">
            <div>
              <p className="text-3xl font-extrabold">
                Level {profile?.currentLevel ?? 1}
              </p>
              <p className="mt-1 text-sm font-semibold text-white/80">
                {(profile?.totalXp ?? 0).toLocaleString()} XP earned
              </p>
            </div>
            <span className="text-right text-xs font-bold text-[#FFD166]">
              {profile && profile.progress.level < 15
                ? `${(profile.progress.nextLevelXp - profile.totalXp).toLocaleString()} XP to next level`
                : "Keep growing"}
            </span>
          </div>
          <div
            role="progressbar"
            aria-label="Progress to next level"
            aria-valuenow={profile?.progress.progressPct ?? 0}
            aria-valuemin={0}
            aria-valuemax={100}
            className="mt-4 h-2.5 overflow-hidden rounded-full bg-white/20"
          >
            <div
              className="h-full rounded-full bg-[#FF8A1F]"
              style={{ width: `${profile?.progress.progressPct ?? 0}%` }}
            />
          </div>
          <p className="mt-2 text-xs font-medium text-white/80">
            XP comes from recorded attendance, graded work, projects, and
            certificates.
          </p>
        </div>
        <div className="rounded-2xl border border-[#D7E0EA] bg-white p-5">
          <div className="flex items-center gap-2 text-sm font-bold text-[#0B1F3A]">
            <span className="text-[#C2410C]">
              <ProgressMark kind="flame" />
            </span>{" "}
            Learning streak
          </div>
          <p className="mt-3 text-3xl font-extrabold text-[#0B1F3A]">
            {profile?.currentStreak ?? 0}{" "}
            <span className="text-base font-semibold text-[#475569]">
              learning days
            </span>
          </p>
          <p className="mt-1 text-sm font-semibold text-[#475569]">
            Personal best: {profile?.bestStreak ?? 0} days
          </p>
          <p className="mt-3 text-xs leading-relaxed text-[#475569]">
            A streak grows on consecutive calendar days with recorded attendance
            or graded work. One day counts once.
          </p>
        </div>
      </section>
      <details className="rounded-2xl border border-[#D7E0EA] bg-white px-4 py-3 text-sm text-[#334155]">
        <summary className="cursor-pointer font-bold text-[#0B1F3A]">
          How XP and streak work
        </summary>
        <div className="mt-3 grid gap-x-6 gap-y-2 sm:grid-cols-2">
          <p>
            Present at a session{" "}
            <strong>+{XP_AWARDS.ATTENDANCE_PRESENT} XP</strong> (late: +
            {XP_AWARDS.ATTENDANCE_LATE})
          </p>
          <p>
            Assignment graded{" "}
            <strong>+{XP_AWARDS.ASSIGNMENT_SUBMITTED} XP</strong>, or +
            {XP_AWARDS.ASSIGNMENT_EXCELLENT} for 90%+
          </p>
          <p>
            Portfolio project <strong>+{XP_AWARDS.PORTFOLIO_PROJECT} XP</strong>
            , or +{XP_AWARDS.VIDEO_CHALLENGE} when created with a video
          </p>
          <p>
            Certificate earned{" "}
            <strong>+{XP_AWARDS.CERTIFICATE_EARNED} XP</strong>
          </p>
        </div>
        <p className="mt-3 border-t border-[#E2E8F0] pt-3 text-xs leading-relaxed text-[#475569]">
          A streak counts consecutive days with recorded attendance or graded
          work. XP can also come from achievement bonuses. Adding a video to the
          separate video gallery does not currently award XP.
        </p>
      </details>
      {strongestSkill && strongestSkill.average >= 4 && (
        <div className="flex items-start gap-3 rounded-2xl border border-[#BDECF5] bg-[#EFFBFE] p-4 text-[#0B1F3A]">
          <span className="rounded-xl bg-white p-2 text-[#0E7490]">
            <ProgressMark kind="spark" />
          </span>
          <div>
            <p className="text-sm font-bold">Strength spotlight</p>
            <p className="mt-0.5 text-sm text-[#334155]">
              {audience === "student" ? "You are" : `${firstName} is`} doing
              especially well in{" "}
              {EVALUATION_CRITERION_LABELS[
                strongestSkill.criterion as keyof typeof EVALUATION_CRITERION_LABELS
              ] ?? strongestSkill.criterion}
              .
            </p>
          </div>
        </div>
      )}
      <section className="rounded-2xl border border-[#F5D5BE] bg-[#FFF7ED] p-5">
        <div className="flex items-center gap-2 text-sm font-bold text-[#9A3412]">
          <ProgressMark kind="target" />{" "}
          {audience === "student" ? "Your next goal" : "Next learning goal"}
        </div>
        <p className="mt-2 text-base font-semibold leading-relaxed text-[#0B1F3A]">
          {goal}
        </p>
        {!compact && latestPraise && (
          <p className="mt-3 border-t border-[#F5D5BE] pt-3 text-sm leading-relaxed text-[#334155]">
            <span className="font-bold">Instructor feedback: </span>
            {latestPraise}
          </p>
        )}
      </section>
      {!compact && (
        <section className="rounded-2xl border border-[#D7E0EA] bg-white p-5">
          <h2 className="text-base font-bold text-[#0B1F3A]">
            {audience === "student"
              ? "Your skills"
              : `${firstName}'s strengths`}
          </h2>
          <p className="mt-1 text-sm text-[#475569]">
            Based on instructor ratings shared with{" "}
            {audience === "student" ? "you" : "parents"}.
          </p>
          {skills.length ? (
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {skills.slice(0, 6).map((skill) => (
                <div key={skill.criterion}>
                  <div className="mb-1 flex justify-between gap-3 text-sm font-semibold">
                    <span className="text-[#0B1F3A]">
                      {EVALUATION_CRITERION_LABELS[
                        skill.criterion as keyof typeof EVALUATION_CRITERION_LABELS
                      ] ?? skill.criterion}
                    </span>
                    <span className="text-[#0E7490]">{skill.average}/5</span>
                  </div>
                  <div
                    role="progressbar"
                    aria-label={`${skill.criterion} rating`}
                    aria-valuenow={skill.average}
                    aria-valuemin={0}
                    aria-valuemax={5}
                    className="h-2 overflow-hidden rounded-full bg-[#E8EEF4]"
                  >
                    <div
                      className="h-full rounded-full bg-[#0E7490]"
                      style={{ width: `${skill.average * 20}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-4 rounded-xl bg-[#F6F8FB] p-4 text-sm font-semibold text-[#64748B]">
              Skill progress will appear as the instructor shares ratings.
            </p>
          )}
        </section>
      )}
      {compact && (
        <Link
          href={
            audience === "student"
              ? "/portal/student/evaluations"
              : `/portal/parent/evaluations${childId ? `?child=${encodeURIComponent(childId)}` : ""}`
          }
          className="inline-flex min-h-10 items-center text-sm font-bold text-[#0E7490] hover:underline"
        >
          See all evaluations →
        </Link>
      )}
    </div>
  );
}
