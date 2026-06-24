import { getGroupHealthData } from '@/modules/tl-dashboard/dashboard-v2-queries'
import GroupHealthBoardClient from './GroupHealthBoardClient'

export default async function GroupHealthBoard({ branchIds }: { branchIds: string[] }) {
  const groups = await getGroupHealthData(branchIds)

  const dangerCount  = groups.filter(g => g.health_status === 'danger').length
  const warningCount = groups.filter(g => g.health_status === 'warning').length

  return (
    <section id="group-health">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h2 className="text-[16px] font-bold text-[#0B1F3A]">Group Health Board</h2>
          <span className="rounded-full bg-[#F1F5F9] px-2.5 py-0.5 text-[11px] font-medium text-[#64748B]">
            {groups.length} groups
          </span>
          {dangerCount > 0 && (
            <span className="rounded-full bg-[#FEE2E2] px-2.5 py-0.5 text-[11px] font-semibold text-[#DC2626]">
              {dangerCount} at risk
            </span>
          )}
          {warningCount > 0 && (
            <span className="rounded-full bg-[#FFFBEB] px-2.5 py-0.5 text-[11px] font-semibold text-[#B45309]">
              {warningCount} warning
            </span>
          )}
        </div>
      </div>

      {groups.length === 0 ? (
        <div className="rounded-2xl border border-[#E2E8F0] bg-white px-5 py-10 text-center">
          <p className="text-[14px] font-medium text-[#64748B]">No active groups found</p>
          <p className="mt-1 text-[12px] text-[#94A3B8]">Create a group to get started.</p>
        </div>
      ) : (
        <GroupHealthBoardClient groups={groups} />
      )}
    </section>
  )
}
