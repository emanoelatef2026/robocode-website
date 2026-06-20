import { requirePermission }   from '@/modules/rbac/guards'
import { requireAuth }         from '@/modules/rbac/guards'
import { createServiceClient } from '@/lib/supabase/service'
import Link                    from 'next/link'

// ── Types ─────────────────────────────────────────────────────────────────────

interface MonthlyExpense {
  month:        string
  label:        string
  instructors:  number
  staff:        number
  total:        number
}

interface StaffExpenseRow {
  name:         string
  role:         string
  branch_name:  string
  amount:       number
  payment_type: string
}

// ── Data ──────────────────────────────────────────────────────────────────────

async function getExpenseData(branchIds: string[] | null) {
  const db     = createServiceClient()
  const now    = new Date()
  const scoped = Array.isArray(branchIds) && branchIds.length > 0

  // Last 6 months
  const months: string[] = []
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }
  const rangeStart = `${months[0]}-01`
  const rangeEnd   = now.toISOString().slice(0, 10)

  // Staff payment records in range
  let staffQ = db
    .from('staff_payment_records')
    .select(`
      amount, payment_date, payment_type,
      staff_members!staff_payment_records_staff_member_id_fkey(
        name, role, branch_id,
        branches!staff_members_branch_id_fkey(name)
      )
    `)
    .gte('payment_date', rangeStart)
    .lte('payment_date', rangeEnd)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (scoped) staffQ = (staffQ as any).in('branch_id', branchIds!)
  const { data: staffPayData } = await staffQ
  const staffPayments = ((staffPayData ?? []) as any[])

  // Completed sessions in range (instructor payroll proxy)
  let sessQ = db
    .from('schedules')
    .select(`id, branch_id, scheduled_at,
      group_courses!schedules_group_course_id_fkey(
        session_rate,
        instructors!group_courses_instructor_id_fkey(
          default_session_rate,
          users!instructors_user_id_fkey(
            profiles!profiles_user_id_fkey(first_name, last_name)
          )
        )
      )`)
    .eq('status', 'completed')
    .gte('scheduled_at', `${rangeStart}T00:00:00`)
    .lte('scheduled_at', `${rangeEnd}T23:59:59`)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (scoped) sessQ = (sessQ as any).in('branch_id', branchIds!)
  const { data: sessData } = await sessQ
  const sessions = ((sessData ?? []) as any[])

  // ── Monthly breakdown ──────────────────────────────────────────────────────
  const monthlyData: MonthlyExpense[] = months.map(m => {
    const d     = new Date(`${m}-01`)
    const label = d.toLocaleString('en-US', { month: 'short', year: 'numeric' })

    const staffAmt = staffPayments
      .filter((p: any) => (p.payment_date as string).startsWith(m))
      .reduce((s: number, p: any) => s + Number(p.amount), 0)

    const instrAmt = sessions
      .filter((s: any) => (s.scheduled_at as string).startsWith(m))
      .reduce((sum: number, s: any) => {
        const gc   = s.group_courses
        const rate = Number(gc?.session_rate ?? gc?.instructors?.default_session_rate ?? 0)
        return sum + rate
      }, 0)

    return { month: m, label, instructors: instrAmt, staff: staffAmt, total: instrAmt + staffAmt }
  })

  // ── Staff rows for detail table ────────────────────────────────────────────
  const staffAggMap: Record<string, StaffExpenseRow & { count: number }> = {}
  for (const p of staffPayments) {
    const sm   = (p as any).staff_members
    const key  = `${sm?.name ?? '—'}:${sm?.branch_id ?? ''}`
    if (!staffAggMap[key]) {
      staffAggMap[key] = {
        name:         sm?.name ?? '—',
        role:         sm?.role ?? '—',
        branch_name:  sm?.branches?.name ?? '—',
        amount:       0,
        payment_type: (p as any).payment_type ?? '—',
        count:        0,
      }
    }
    staffAggMap[key].amount += Number((p as any).amount)
    staffAggMap[key].count++
  }
  const staffRows = Object.values(staffAggMap).sort((a, b) => b.amount - a.amount)

  // ── KPIs ──────────────────────────────────────────────────────────────────
  const totalInstructorCost = monthlyData.reduce((s, m) => s + m.instructors, 0)
  const totalStaffCost      = monthlyData.reduce((s, m) => s + m.staff, 0)
  const totalExpenses       = totalInstructorCost + totalStaffCost
  const thisMonth           = monthlyData[monthlyData.length - 1]

  return { monthlyData, staffRows, totalInstructorCost, totalStaffCost, totalExpenses, thisMonth }
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return `EGP ${new Intl.NumberFormat('en-EG', { maximumFractionDigits: 0 }).format(n)}`
}

function KPI({ label, value, sub, color = 'bg-slate-300' }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="rounded-xl border border-[#E2E8F0] bg-white p-4">
      <div className={`mb-2.5 h-1.5 w-8 rounded-full ${color} opacity-80`} />
      <p className="text-xl font-bold text-[#0B1F3A]">{value}</p>
      <p className="mt-0.5 text-xs font-medium text-[#64748B]">{label}</p>
      {sub && <p className="mt-1 text-[11px] text-[#94A3B8]">{sub}</p>}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function ExpenseCenterPage() {
  const user = await requireAuth()
  await requirePermission('manage_financials')

  const isSuperAdmin = user.globalRole === 'super_admin'
  const branchFilter = isSuperAdmin ? null : user.branchIds
  const d = await getExpenseData(branchFilter)

  const maxTotal = Math.max(...d.monthlyData.map(m => m.total), 1)

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-[#0B1F3A]">Expense Center</h1>
          <p className="mt-0.5 text-sm text-[#64748B]">Payroll and operational cost overview</p>
        </div>
        <Link
          href="/admin/payroll"
          className="rounded-lg border border-[#E2E8F0] px-3 py-2 text-xs font-medium text-[#64748B] hover:border-[#CBD5E1] transition"
        >
          Payroll →
        </Link>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KPI label="Total Expenses (6mo)"     value={fmt(d.totalExpenses)}         color="bg-red-400" />
        <KPI label="Instructor Cost (sessions)" value={fmt(d.totalInstructorCost)} color="bg-violet-400" />
        <KPI label="Staff Payroll"             value={fmt(d.totalStaffCost)}        color="bg-indigo-400" />
        <KPI label="This Month"
          value={fmt(d.thisMonth.total)}
          sub={`Inst: ${fmt(d.thisMonth.instructors)} / Staff: ${fmt(d.thisMonth.staff)}`}
          color="bg-amber-400"
        />
      </div>

      {/* Monthly trend */}
      <div className="rounded-xl border border-[#E2E8F0] bg-white">
        <div className="border-b border-[#E2E8F0] px-5 py-3 flex items-center justify-between">
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-[#94A3B8]">Monthly Expenses — Last 6 Months</p>
          <div className="flex items-center gap-4 text-[11px] text-[#64748B]">
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-violet-400" /> Instructors</span>
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-indigo-400" /> Staff</span>
          </div>
        </div>
        <div className="p-5">
          <div className="flex items-end gap-3">
            {d.monthlyData.map(m => {
              const iHeight = maxTotal > 0 ? Math.round((m.instructors / maxTotal) * 100) : 2
              const sHeight = maxTotal > 0 ? Math.round((m.staff       / maxTotal) * 100) : 2
              return (
                <div key={m.month} className="flex flex-1 flex-col items-center gap-1.5">
                  <p className="text-[10px] font-semibold text-[#0B1F3A]">
                    {m.total > 0 ? fmt(m.total).replace('EGP ', '') : '—'}
                  </p>
                  <div className="flex w-full items-end gap-0.5">
                    <div className="flex-1 rounded-t-sm bg-violet-400" style={{ height: `${Math.max(iHeight, 2)}px` }} />
                    <div className="flex-1 rounded-t-sm bg-indigo-400" style={{ height: `${Math.max(sHeight, 2)}px` }} />
                  </div>
                  <p className="text-[10px] text-[#94A3B8]">{m.label}</p>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Staff payments detail */}
      {d.staffRows.length > 0 && (
        <div className="rounded-xl border border-[#E2E8F0] bg-white">
          <div className="border-b border-[#E2E8F0] px-5 py-3">
            <p className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-[#94A3B8]">Staff Payments (6 months)</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                  <th className="px-5 py-3 text-left text-xs font-medium text-[#64748B]">Name</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-[#64748B]">Role</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-[#64748B]">Branch</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-[#64748B]">Type</th>
                  <th className="px-5 py-3 text-right text-xs font-medium text-[#64748B]">Total Paid</th>
                </tr>
              </thead>
              <tbody>
                {d.staffRows.map((r, i) => (
                  <tr key={i} className="border-b border-[#E2E8F0] last:border-0 hover:bg-[#F8FAFC]">
                    <td className="px-5 py-3 font-medium text-[#0B1F3A]">{r.name}</td>
                    <td className="px-5 py-3 text-[#64748B]">{r.role}</td>
                    <td className="px-5 py-3 text-[#64748B]">{r.branch_name}</td>
                    <td className="px-5 py-3">
                      <span className="rounded-full bg-[#F1F5F9] px-2 py-0.5 text-[11px] font-medium text-[#64748B]">
                        {r.payment_type}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right font-semibold text-red-600">{fmt(r.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {d.staffRows.length === 0 && d.totalInstructorCost === 0 && (
        <div className="rounded-xl border border-[#E2E8F0] bg-white flex flex-col items-center justify-center py-14 text-center">
          <p className="text-sm font-medium text-[#0B1F3A]">No expense data in the last 6 months</p>
          <p className="mt-1 text-xs text-[#94A3B8]">Payroll records and completed sessions will appear here.</p>
          <Link href="/admin/payroll" className="mt-4 text-xs font-medium text-[#FF8A1F] hover:underline">Go to Payroll →</Link>
        </div>
      )}
    </div>
  )
}
