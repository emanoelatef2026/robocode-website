import { requirePermission }   from '@/modules/rbac/guards'
import { requireAuth }         from '@/modules/rbac/guards'
import { createServiceClient } from '@/lib/supabase/service'
import Link                    from 'next/link'

// ── Types ─────────────────────────────────────────────────────────────────────

interface MonthlyRevenue {
  month:     string  // YYYY-MM
  label:     string  // 'Jan 2026'
  collected: number
  expected:  number
  rate:      number
}

interface BranchRevenue {
  branch_id:   string
  branch_name: string
  collected:   number
  outstanding: number
  total:       number
  students:    number
  rate:        number
}

// ── Data ──────────────────────────────────────────────────────────────────────

async function getRevenueData(branchIds: string[] | null) {
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

  // Payments in range
  const payQ = db
    .from('finance_payments')
    .select('amount, payment_date, account_id')
    .gte('payment_date', rangeStart)
    .lte('payment_date', rangeEnd)
  const payRes = await (scoped
    ? (payQ as any).in('account_id',
        await db.from('student_financial_accounts').select('id').in('branch_id', branchIds!).then((r: any) => (r.data ?? []).map((x: any) => x.id as string))
      )
    : payQ)
  const payments = ((payRes as any).data ?? []) as any[]

  // Financial accounts summary (all time — for branch totals)
  let accQ = db.from('student_financial_accounts').select('id, branch_id, net_amount, paid_amount, remaining_amount, status')
  if (scoped) accQ = (accQ as any).in('branch_id', branchIds!)
  const { data: accData } = await accQ
  const accounts = (accData ?? []) as any[]

  // Branches
  let branchQ = db.from('branches').select('id, name').eq('is_active', true).is('deleted_at', null)
  if (scoped) branchQ = (branchQ as any).in('id', branchIds!)
  const { data: branchData } = await branchQ
  const branches = ((branchData ?? []) as any[])

  // Students per branch via active group memberships (groups are the operational source of truth)
  const stuByBranch: Record<string, number> = {}
  {
    let groupQ = db.from('groups').select('id, branch_id').eq('status', 'active').is('deleted_at', null)
    if (scoped) groupQ = (groupQ as any).in('branch_id', branchIds!)
    const { data: groupRows } = await groupQ
    const activeGroupIds = (groupRows ?? []).map((g: any) => g.id as string)
    const groupBranchMap = Object.fromEntries((groupRows ?? []).map((g: any) => [g.id as string, g.branch_id as string]))

    if (activeGroupIds.length > 0) {
      const { data: stuRows } = await db.from('students').select('id').eq('status', 'active').is('deleted_at', null)
      const activeStudentSet = new Set((stuRows ?? []).map((s: any) => s.id as string))

      const { data: gsRows } = await db.from('group_students').select('student_id, group_id').in('group_id', activeGroupIds).eq('status', 'active')
      const studentBranchSets: Record<string, Set<string>> = {}
      for (const gs of (gsRows ?? []) as any[]) {
        if (!activeStudentSet.has(gs.student_id)) continue
        const bid = groupBranchMap[gs.group_id]
        if (!bid) continue
        if (!studentBranchSets[bid]) studentBranchSets[bid] = new Set()
        studentBranchSets[bid].add(gs.student_id)
      }
      for (const [bid, set] of Object.entries(studentBranchSets)) stuByBranch[bid] = set.size
    }
  }

  // ── Monthly trend ──────────────────────────────────────────────────────────
  const monthlyData: MonthlyRevenue[] = months.map(m => {
    const d         = new Date(`${m}-01`)
    const label     = d.toLocaleString('en-US', { month: 'short', year: 'numeric' })
    const collected = payments
      .filter((p: any) => (p.payment_date as string).startsWith(m))
      .reduce((s: number, p: any) => s + Number(p.amount), 0)
    const expected  = accounts
      .reduce((s: number, a: any) => s + Number(a.net_amount), 0) / 6  // rough monthly estimate
    const rate = expected > 0 ? Math.min(100, Math.round((collected / expected) * 100)) : 0
    return { month: m, label, collected, expected, rate }
  })

  // ── Branch breakdown ───────────────────────────────────────────────────────
  const branchMap: Record<string, BranchRevenue> = {}
  for (const a of accounts) {
    const bid = (a as any).branch_id as string
    if (!branchMap[bid]) branchMap[bid] = { branch_id: bid, branch_name: '', collected: 0, outstanding: 0, total: 0, students: 0, rate: 0 }
    branchMap[bid].collected   += Number(a.paid_amount)
    branchMap[bid].outstanding += Number(a.remaining_amount)
    branchMap[bid].total       += Number(a.net_amount)
  }
  for (const b of branches) {
    const bid = (b as any).id as string
    if (!branchMap[bid]) branchMap[bid] = { branch_id: bid, branch_name: (b as any).name, collected: 0, outstanding: 0, total: 0, students: 0, rate: 0 }
    branchMap[bid].branch_name = (b as any).name
    branchMap[bid].students    = stuByBranch[bid] ?? 0
    if (branchMap[bid].total > 0) branchMap[bid].rate = Math.round((branchMap[bid].collected / branchMap[bid].total) * 100)
  }
  const branchRows = Object.values(branchMap).filter(b => b.branch_name).sort((a, b) => b.collected - a.collected)

  // ── Overall KPIs ──────────────────────────────────────────────────────────
  const totalCollected   = accounts.reduce((s: number, a: any) => s + Number(a.paid_amount), 0)
  const totalOutstanding = accounts.reduce((s: number, a: any) => s + Number(a.remaining_amount), 0)
  const totalExpected    = accounts.reduce((s: number, a: any) => s + Number(a.net_amount), 0)
  const overallRate      = totalExpected > 0 ? Math.round((totalCollected / totalExpected) * 100) : 0
  const collectedThisMonth = payments
    .filter((p: any) => (p.payment_date as string).startsWith(months[months.length - 1]))
    .reduce((s: number, p: any) => s + Number(p.amount), 0)

  return { monthlyData, branchRows, totalCollected, totalOutstanding, totalExpected, overallRate, collectedThisMonth }
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

export default async function RevenueCenterPage() {
  const user = await requireAuth()
  await requirePermission('manage_financials')

  const isSuperAdmin = user.globalRole === 'super_admin'
  const branchFilter = isSuperAdmin ? null : user.branchIds
  const d = await getRevenueData(branchFilter)

  const maxCollected = Math.max(...d.monthlyData.map(m => m.collected), 1)

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-[#0B1F3A]">Revenue Center</h1>
          <p className="mt-0.5 text-sm text-[#64748B]">Student payment collections overview</p>
        </div>
        <Link
          href="/admin/finance"
          className="rounded-lg border border-[#E2E8F0] px-3 py-2 text-xs font-medium text-[#64748B] hover:border-[#CBD5E1] transition"
        >
          Finance Center →
        </Link>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KPI label="Total Collected"      value={fmt(d.totalCollected)}      color="bg-emerald-400" />
        <KPI label="Outstanding Balance"  value={fmt(d.totalOutstanding)}    color="bg-amber-400" />
        <KPI label="Overall Collection %" value={`${d.overallRate}%`}
          sub={`of ${fmt(d.totalExpected)} billed`}
          color={d.overallRate >= 80 ? 'bg-emerald-400' : d.overallRate >= 50 ? 'bg-amber-400' : 'bg-red-400'}
        />
        <KPI label="Collected This Month" value={fmt(d.collectedThisMonth)} color="bg-blue-400" />
      </div>

      {/* Monthly trend */}
      <div className="rounded-xl border border-[#E2E8F0] bg-white">
        <div className="border-b border-[#E2E8F0] px-5 py-3">
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-[#94A3B8]">Monthly Collections — Last 6 Months</p>
        </div>
        <div className="p-5">
          <div className="flex items-end gap-3">
            {d.monthlyData.map(m => {
              const height = maxCollected > 0 ? Math.round((m.collected / maxCollected) * 120) : 4
              return (
                <div key={m.month} className="flex flex-1 flex-col items-center gap-1.5">
                  <p className="text-[10px] font-semibold text-[#0B1F3A]">
                    {m.collected > 0 ? fmt(m.collected).replace('EGP ', '') : '—'}
                  </p>
                  <div
                    className="w-full rounded-t-md bg-emerald-400 transition-all"
                    style={{ height: `${Math.max(height, 4)}px` }}
                  />
                  <p className="text-[10px] text-[#94A3B8]">{m.label}</p>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Branch breakdown */}
      {d.branchRows.length > 0 && (
        <div className="rounded-xl border border-[#E2E8F0] bg-white">
          <div className="border-b border-[#E2E8F0] px-5 py-3">
            <p className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-[#94A3B8]">By Branch</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                  <th className="px-5 py-3 text-left text-xs font-medium text-[#64748B]">Branch</th>
                  <th className="px-5 py-3 text-right text-xs font-medium text-[#64748B]">Students</th>
                  <th className="px-5 py-3 text-right text-xs font-medium text-[#64748B]">Collected</th>
                  <th className="px-5 py-3 text-right text-xs font-medium text-[#64748B]">Outstanding</th>
                  <th className="px-5 py-3 text-right text-xs font-medium text-[#64748B]">Rate</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-[#64748B]">Progress</th>
                </tr>
              </thead>
              <tbody>
                {d.branchRows.map(b => (
                  <tr key={b.branch_id} className="border-b border-[#E2E8F0] last:border-0 hover:bg-[#F8FAFC]">
                    <td className="px-5 py-3 font-medium text-[#0B1F3A]">{b.branch_name}</td>
                    <td className="px-5 py-3 text-right text-[#64748B]">{b.students}</td>
                    <td className="px-5 py-3 text-right font-medium text-emerald-700">{fmt(b.collected)}</td>
                    <td className="px-5 py-3 text-right text-amber-600">{fmt(b.outstanding)}</td>
                    <td className="px-5 py-3 text-right">
                      <span className={`font-semibold ${b.rate >= 80 ? 'text-emerald-700' : b.rate >= 50 ? 'text-amber-600' : 'text-red-600'}`}>
                        {b.rate}%
                      </span>
                    </td>
                    <td className="px-5 py-3 w-32">
                      <div className="h-2 w-full overflow-hidden rounded-full bg-[#E2E8F0]">
                        <div
                          className={`h-full rounded-full ${b.rate >= 80 ? 'bg-emerald-400' : b.rate >= 50 ? 'bg-amber-400' : 'bg-red-400'}`}
                          style={{ width: `${b.rate}%` }}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
