import { requirePermission }       from '@/modules/rbac/guards'
import { listStudentOperations }   from '@/modules/finance/queries'
import CollectionsView             from './CollectionsView'
import type { StudentOperationsRow } from '@/modules/finance/types'

export const dynamic = 'force-dynamic'

export default async function CollectionsPage() {
  const user = await requirePermission('manage_financials')

  if (!user.branchIds.length) {
    return (
      <div className="flex min-h-60 items-center justify-center">
        <div className="text-center">
          <p className="text-sm font-medium text-[#0B1F3A]">No branch assigned</p>
          <p className="mt-1 text-xs text-[#94A3B8]">Contact your administrator.</p>
        </div>
      </div>
    )
  }

  const allRows = await listStudentOperations(user.branchIds)
  const today   = new Date().toISOString().slice(0, 10)

  // ── Section groupings ─────────────────────────────────────────────────────
  const dueToday:    StudentOperationsRow[] = []
  const overdue:     StudentOperationsRow[] = []
  const milestone:   StudentOperationsRow[] = []
  const absentUnpaid: StudentOperationsRow[] = []
  const highRisk:    StudentOperationsRow[] = []

  const addedIds = new Set<string>()

  const track = (arr: StudentOperationsRow[], row: StudentOperationsRow) => {
    const key = row.enrollment_id ?? row.student_id
    if (!addedIds.has(key)) {
      addedIds.add(key)
      arr.push(row)
    }
  }

  for (const row of allRows) {
    if (row.next_due_date === today && row.remaining_amount > 0) {
      dueToday.push(row); addedIds.add(row.enrollment_id ?? row.student_id)
    }
  }

  for (const row of allRows) {
    if ((row.financial_status === 'OVERDUE' || row.financial_status === 'BLOCKED') && row.days_overdue > 0) {
      track(overdue, row)
    }
  }

  for (const row of allRows) {
    if (row.risk_flags.some(f => f.startsWith('milestone_'))) {
      track(milestone, row)
    }
  }

  for (const row of allRows) {
    if (row.consecutive_absences >= 2 && row.remaining_amount > 0) {
      track(absentUnpaid, row)
    }
  }

  for (const row of allRows) {
    if (row.risk_level === 'HIGH') {
      track(highRisk, row)
    }
  }

  const sections = [
    { id: 'due',       label: 'Due Today',             rows: dueToday,    color: 'bg-[#3B82F6]',   emptyMsg: 'No payments due today.' },
    { id: 'overdue',   label: 'Overdue / Blocked',      rows: overdue,     color: 'bg-[#EF4444]',    emptyMsg: 'No overdue students.' },
    { id: 'milestone', label: 'Session Milestone',      rows: milestone,   color: 'bg-[#F59E0B]',  emptyMsg: 'No milestone alerts.' },
    { id: 'absent',    label: 'Absent + Unpaid',        rows: absentUnpaid,color: 'bg-[#FF8A1F]', emptyMsg: 'No absent+unpaid students.' },
    { id: 'highrisk',  label: 'High Risk (All)',        rows: highRisk,    color: 'bg-[#EF4444]',    emptyMsg: 'No high-risk students.' },
  ]

  const totalOutstanding = allRows.reduce((s, r) => s + r.remaining_amount, 0)
  const totalDueToday    = dueToday.reduce((s, r) => s + r.remaining_amount, 0)
  const totalOverdue     = overdue.reduce((s, r) => s + r.remaining_amount, 0)

  return (
    <CollectionsView
      sections={sections}
      branchIds={user.branchIds}
      stats={{ totalOutstanding, totalDueToday, totalOverdue, overdueCount: overdue.length, milestoneCount: milestone.length }}
    />
  )
}
