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
        <div>
          <div className="flex items-center gap-2">
            <Link href="/admin/finance" className="text-sm text-[#64748B] hover:text-[#0B1F3A]">
              ← Finance Center
            </Link>
          </div>
          <h1 className="mt-1 text-xl font-semibold text-[#0B1F3A]">Collections Queue</h1>
          <p className="mt-0.5 text-sm text-[#64748B]">
            Daily collections workspace — {totalOverdue} overdue · {totalDue} upcoming
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-3 py-1 text-xs font-semibold text-red-600">
            {totalOverdue} overdue
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
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
          color="bg-red-400"
          badgeCls="bg-red-50 text-red-600"
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
          color="bg-amber-400"
          badgeCls="bg-amber-50 text-amber-700"
          badgeLabel="MEDIUM"
        />
      )}

      {queue.dueSoon.length > 0 && (
        <QueueSection
          title="Due Soon"
          subtitle={`${queue.dueSoon.length} accounts — upcoming`}
          items={queue.dueSoon}
          color="bg-blue-400"
          badgeCls="bg-blue-50 text-blue-700"
          badgeLabel="LOW"
        />
      )}

      {totalOverdue === 0 && totalDue === 0 && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-6 py-12 text-center">
          <p className="text-lg font-semibold text-emerald-700">All clear!</p>
          <p className="mt-1 text-sm text-emerald-600">No overdue or upcoming collections today.</p>
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

      <div className="rounded-xl border border-[#E2E8F0] bg-white overflow-hidden">
        {/* Desktop table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
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
