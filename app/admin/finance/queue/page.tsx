import { requirePermission }       from '@/modules/rbac/guards'
import { getCollectionQueue }       from '@/modules/finance/queries'
import QueueClient                  from './QueueClient'
import Link                         from 'next/link'

export default async function CollectionsQueuePage() {
  const user  = await requirePermission('manage_financials')

  const branchFilter = user.globalRole === 'super_admin' ? undefined : user.branchIds

  const queue = await getCollectionQueue(branchFilter)

  const totalOverdue = queue.overdue30.length + queue.overdue14.length
  const totalDue     = queue.dueThisWeek.length + queue.dueSoon.length

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Link href="/admin/finance" className="text-sm text-[#64748B] hover:text-[#0B1F3A]">
            ← Finance Center
          </Link>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#FEE2E2] px-3 py-1 text-xs font-semibold text-[#EF4444]">
            {totalOverdue} overdue
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#FFFBEB] px-3 py-1 text-xs font-semibold text-[#B45309]">
            {totalDue} upcoming
          </span>
        </div>
      </div>

      {/* Queue sections */}
      {queue.overdue30.length > 0 && (
        <QueueSection
          title="Overdue 30+ Days"
          subtitle={`${queue.overdue30.length} accounts — critical priority`}
          items={queue.overdue30}
          color="bg-[#EF4444]"
          badgeCls="bg-[#FEE2E2] text-[#EF4444]"
          badgeLabel="CRITICAL"
        />
      )}

      {queue.overdue14.length > 0 && (
        <QueueSection
          title="Overdue 14+ Days"
          subtitle={`${queue.overdue14.length} accounts — high priority`}
          items={queue.overdue14}
          color="bg-orange-400"
          badgeCls="bg-orange-50 text-orange-600"
          badgeLabel="HIGH"
        />
      )}

      {queue.dueThisWeek.length > 0 && (
        <QueueSection
          title="Due This Week"
          subtitle={`${queue.dueThisWeek.length} accounts — follow up now`}
          items={queue.dueThisWeek}
          color="bg-[#F59E0B]"
          badgeCls="bg-[#FFFBEB] text-[#B45309]"
          badgeLabel="MEDIUM"
        />
      )}

      {queue.dueSoon.length > 0 && (
        <QueueSection
          title="Due Soon"
          subtitle={`${queue.dueSoon.length} accounts — upcoming`}
          items={queue.dueSoon}
          color="bg-[#38BDF8]"
          badgeCls="bg-[#EFF6FF] text-[#1D4ED8]"
          badgeLabel="LOW"
        />
      )}

      {totalOverdue === 0 && totalDue === 0 && (
        <div className="rounded-xl border border-[#A7F3D0] bg-[#E7F8EE] px-6 py-12 text-center">
          <p className="text-lg font-semibold text-[#15803D]">All clear!</p>
          <p className="mt-1 text-sm text-[#10B981]">No overdue or upcoming collections today.</p>
        </div>
      )}
    </div>
  )
}

// ─── Queue Section ────────────────────────────────────────────────────────────

import type { CollectionQueueItem } from '@/modules/finance/types'

function QueueSection({
  title, subtitle, items, color, badgeCls, badgeLabel,
}: {
  title:      string
  subtitle:   string
  items:      CollectionQueueItem[]
  color:      string
  badgeCls:   string
  badgeLabel: string
}) {
  return (
    <section>
      <div className="mb-3 flex items-center gap-3">
        <div className={`h-2 w-2 rounded-full ${color}`} />
        <div>
          <h2 className="text-sm font-semibold text-[#0B1F3A]">{title}</h2>
          <p className="text-xs text-[#94A3B8]">{subtitle}</p>
        </div>
        <span className={`ml-auto rounded-full px-2 py-0.5 text-[11px] font-bold ${badgeCls}`}>
          {badgeLabel}
        </span>
      </div>

      <div className="ds-card overflow-hidden">
        {/* Desktop table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="ds-table-head">
              <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                <th className="px-4 py-2.5 text-left text-xs font-medium text-[#64748B]">Student</th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-[#64748B]">Parent</th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-[#64748B]">Branch / Group</th>
                <th className="px-4 py-2.5 text-right text-xs font-medium text-[#64748B]">Remaining</th>
                <th className="px-4 py-2.5 text-center text-xs font-medium text-[#64748B]">Overdue</th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-[#64748B]">Last Contact</th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-[#64748B]">Promise</th>
                <th className="px-4 py-2.5 text-xs font-medium text-[#64748B]">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map(item => (
                <QueueClient key={item.account_id} item={item} mode="desktop" />
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile cards */}
        <div className="md:hidden divide-y divide-[#E2E8F0]">
          {items.map(item => (
            <QueueClient key={item.account_id} item={item} mode="mobile" />
          ))}
        </div>
      </div>
    </section>
  )
}
