import { requirePortalRole } from "@/modules/rbac/guards";
import {
  getParentChildren,
  getChildEvaluations,
} from "@/modules/parents/parent-portal-queries";
import { evaluationContextLabels } from "@/modules/student-evaluations/display-context";
import EvaluationFeed from "@/components/portal/shared/EvaluationFeed";
import LearningProgress from "@/components/portal/shared/LearningProgress";
import RecognitionBadges from "@/components/portal/shared/RecognitionBadges";
import { getStudentGameProfile } from "@/modules/gamification/xp-service";
import { createServiceClient } from "@/lib/supabase/service";
import ChildSelector from "@/components/portal/parent/ChildSelector";
import NoChildrenLinked from "@/components/portal/parent/NoChildrenLinked";
import EmptyState from "@/components/admin/EmptyState";

export default async function ParentEvaluationsPage({
  searchParams,
}: {
  searchParams: Promise<{ child?: string }>;
}) {
  const { child } = await searchParams;
  const user = await requirePortalRole("parent");
  const children = await getParentChildren(user.id);
  if (!children.length) return <NoChildrenLinked />;
  const selected = children.find((c) => c.student_id === child) ?? children[0];
  const [evaluations, gameProfile, badges] = await Promise.all([
    getChildEvaluations(user.id, selected.student_id),
    getStudentGameProfile(selected.student_id),
    createServiceClient()
      .from("student_badges")
      .select("id, badge_name, description")
      .eq("student_id", selected.student_id)
      .order("awarded_at", { ascending: false })
      .limit(6)
      .then((result) => result.data ?? []),
  ]);
  const labels = evaluations.length
    ? await evaluationContextLabels(evaluations)
    : {};
  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <header>
        <h1 className="text-xl font-bold text-[#0B1F3A]">Learning Progress</h1>
        <p className="mt-1 text-sm font-semibold text-[#475569]">
          A clear view of {selected.student_name}&apos;s growth and next steps.
        </p>
      </header>
      <ChildSelector
        linkedChildren={children}
        selectedId={selected.student_id}
        hrefFor={(id) => `/portal/parent/evaluations?child=${id}`}
      />
      <LearningProgress
        evaluations={evaluations}
        profile={gameProfile}
        audience="parent"
        name={selected.student_name}
      />
      <RecognitionBadges badges={badges} audience="parent" />
      {evaluations.length ? (
        <section>
          <h2 className="mb-3 text-base font-bold text-[#0B1F3A]">
            Instructor evaluations
          </h2>
          <EvaluationFeed evaluations={evaluations} labels={labels} />
        </section>
      ) : (
        <EmptyState
          title="No evaluations shared yet"
          description="The instructor's feedback will appear here once published for parents."
        />
      )}
    </div>
  );
}
