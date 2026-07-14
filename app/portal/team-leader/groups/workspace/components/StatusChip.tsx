import StatusBadge from '@/components/admin/StatusBadge'
import { getCohortLifecycleStage } from '@/modules/groups/lifecycle-stage'

// Renders a cohort's lifecycle-stage badge via the canonical StatusBadge
// component (Phase 1) — 'cancelled' is a separate, unrelated concept
// (DOMAIN_RULES.md Rule 2/11) and is shown as-is, never run through the
// Draft/Open/Running/Completed/Archived derivation.
export function StatusChip({
  group,
}: {
  group: { status: string; has_course?: boolean; has_instructor?: boolean; graduated_from_group_id?: string | null }
}) {
  if (group.status === 'cancelled') {
    return <StatusBadge status="cancelled" dot />
  }
  const stage = getCohortLifecycleStage(group)
  // Phase 2: a cohort born from graduation that's still Draft hasn't had its
  // course/instructor/schedule configured yet — surface that distinctly so
  // it's not confused with an ordinary from-scratch Draft.
  if (stage === 'draft' && group.graduated_from_group_id) {
    return <StatusBadge status="setup_required" dot />
  }
  return <StatusBadge status={stage} dot />
}

export function RiskBadge({ level }: { level: 'HIGH' | 'MEDIUM' | 'LOW' }) {
  const cls = level === 'HIGH'   ? 'bg-[#FEE2E2] text-[#DC2626]'
            : level === 'MEDIUM' ? 'bg-[#FFFBEB] text-[#B45309]'
                                 : 'bg-[#E7F8EE] text-[#15803D]'
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${cls}`}>
      {level}
    </span>
  )
}
