import { requirePortalRole } from "@/modules/rbac/guards";
import { createServiceClient } from "@/lib/supabase/service";
import { getStudentEvaluations } from "@/modules/student-evaluations/queries";
import { evaluationContextLabels } from "@/modules/student-evaluations/display-context";
import EvaluationFeed from "@/components/portal/shared/EvaluationFeed";
import LearningProgress from "@/components/portal/shared/LearningProgress";
import RecognitionBadges from "@/components/portal/shared/RecognitionBadges";
import { getStudentGameProfile } from "@/modules/gamification/xp-service";
import type { StudentEvaluation } from "@/modules/student-evaluations/types";
import EmptyState from "@/components/admin/EmptyState";

export default async function StudentEvaluationsPage() {
  const user = await requirePortalRole("student");
  const { data: student } = await createServiceClient()
    .from("students")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();
  const [evaluations, gameProfile, badges] = student
    ? await Promise.all([
        getStudentEvaluations(student.id, "student"),
        getStudentGameProfile(student.id),
        createServiceClient()
          .from("student_badges")
          .select("id, badge_name, description")
          .eq("student_id", student.id)
          .order("awarded_at", { ascending: false })
          .limit(6)
          .then((result) => result.data ?? []),
      ])
    : ([[], null, []] as [StudentEvaluation[], null, []]);
  const labels = evaluations.length
    ? await evaluationContextLabels(evaluations)
    : {};
  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <header>
        <h1 className="text-xl font-bold text-[#0B1F3A]">My Progress</h1>
        <p className="mt-1 text-sm font-semibold text-[#475569]">
          Your learning level, goals, and feedback from your instructor.
        </p>
      </header>
      <LearningProgress
        evaluations={evaluations}
        profile={gameProfile}
        audience="student"
      />
      <RecognitionBadges badges={badges} audience="student" />
      {evaluations.length ? (
        <section>
          <h2 className="mb-3 text-base font-bold text-[#0B1F3A]">
            Instructor evaluations
          </h2>
          <EvaluationFeed evaluations={evaluations} labels={labels} />
        </section>
      ) : (
        <EmptyState
          title="No evaluations yet"
          description="Your instructor's feedback will appear here once published."
        />
      )}
    </div>
  );
}
