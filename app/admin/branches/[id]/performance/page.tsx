import { createServiceClient } from '@/lib/supabase/service'
import { requirePermission }   from '@/modules/rbac/guards'
import { getBranch }           from '@/modules/branches/queries'
import { notFound }            from 'next/navigation'
import Link                    from 'next/link'

// ── Types ─────────────────────────────────────────────────────────────────────

interface BranchPerformanceData {
  // People
  activeStudents:   number
  newStudentsMonth: number
  activeGroups:     number
  activeInstructors: number
  // Academic
  sessionsThisMonth: number
  attendancePct:    number | null
  certsIssued:      number
  // Leads
  leadsTotal:       number
  leadsConverted:   number
  conversionRate:   number
  overdueFollowUps: number
  // Health
  groupsWithoutInstructor: number
  groupsWithoutCourse:     number
  healthScore:             number
}

// ── Query ─────────────────────────────────────────────────────────────────────

async function getBranchPerformance(branchId: string): Promise<BranchPerformanceData> {
  const db         = createServiceClient()
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()
  const today      = new Date().toISOString().slice(0, 10)

  const [
    studentsRes,
    newStudentsRes,
    groupsRes,
    instructorsRes,
    leadsRes,
    leadsConvertedRes,
    overdueRes,
    certsRes,
    groupsWithInstRes,
    allActiveGroupsRes,
  ] = await Promise.all([
    db.from('students').select('id', { count: 'exact', head: true }).eq('branch_id', branchId).eq('status', 'active').is('deleted_at', null),
    db.from('students').select('id', { count: 'exact', head: true }).eq('branch_id', branchId).eq('status', 'active').gte('created_at', monthStart),
    db.from('groups').select('id', { count: 'exact', head: true }).eq('branch_id', branchId).eq('status', 'active').is('deleted_at', null),
    db.from('instructors').select('id', { count: 'exact', head: true }).eq('branch_id', branchId).eq('status', 'active').is('deleted_at', null),
    db.from('leads').select('id', { count: 'exact', head: true }).eq('branch_id', branchId).not('status', 'in', '("CONVERTED","LOST")'),
    db.from('leads').select('id', { count: 'exact', head: true }).eq('branch_id', branchId).eq('status', 'CONVERTED').gte('updated_at', monthStart),
    db.from('leads').select('id', { count: 'exact', head: true }).eq('branch_id', branchId).lt('next_follow_up_at', today).not('next_follow_up_at', 'is', null).not('status', 'in', '("CONVERTED","LOST")'),
    db.from('certificates').select('id', { count: 'exact', head: true }).eq('branch_id', branchId).eq('status', 'active').gte('issued_at', monthStart),
    db.from('group_instructors').select('group_id').eq('group_id', branchId),
    db.from('groups').select('id').eq('branch_id', branchId).eq('status', 'active').is('deleted_at', null),
  ])

  const activeGroupIds: string[] = ((allActiveGroupsRes as any).data ?? []).map((g: any) => g.id as string)

  // Sessions this month (via branch_id on schedules)
  let sessionsThisMonth = 0
  const { count: sessionCount } = await db.from('schedules')
    .select('id', { count: 'exact', head: true })
    .eq('branch_id', branchId)
    .gte('scheduled_at', monthStart)
    .neq('status', 'cancelled')
  sessionsThisMonth = sessionCount ?? 0

  // Attendance rate
  let attendancePct: number | null = null
  if (sessionsThisMonth > 0) {
    const { data: schedIds } = await db.from('schedules')
      .select('id')
      .eq('branch_id', branchId)
      .gte('scheduled_at', monthStart)
      .neq('status', 'cancelled')
      .limit(200)

    const sIds = (schedIds ?? []).map((s: any) => s.id as string)
    if (sIds.length > 0) {
      const { data: attRows } = await db.from('attendance_records').select('status').in('schedule_id', sIds)
      const total   = (attRows ?? []).length
      const present = (attRows ?? []).filter(r => (r as any).status === 'present' || (r as any).status === 'late').length
      attendancePct = total > 0 ? Math.round((present / total) * 100) : null
    }
  }

  // Groups without instructor / course
  const groupsWithInstSet = new Set(
    ((groupsWithInstRes as any).data ?? []).map((r: any) => r.group_id as string)
  )
  let groupsWithoutInstructor = 0
  let groupsWithoutCourse     = 0
  if (activeGroupIds.length > 0) {
    const [giRes, gcRes] = await Promise.all([
      db.from('group_instructors').select('group_id').in('group_id', activeGroupIds),
      db.from('group_courses').select('group_id').in('group_id', activeGroupIds).eq('status', 'active'),
    ])
    const withInstSet   = new Set((giRes.data ?? []).map((r: any) => r.group_id as string))
    const withCourseSet = new Set((gcRes.data ?? []).map((r: any) => r.group_id as string))
    groupsWithoutInstructor = activeGroupIds.filter(gid => !withInstSet.has(gid)).length
    groupsWithoutCourse     = activeGroupIds.filter(gid => !withCourseSet.has(gid)).length
  }

  // Health score
  let healthScore = 0
  const activeStudents   = (studentsRes as any).count ?? 0
  const activeGroups     = (groupsRes as any).count ?? 0
  const activeInstructors = (instructorsRes as any).count ?? 0
  if (activeGroups > 0)                              healthScore += 20
  if (groupsWithoutInstructor === 0)                 healthScore += 20
  if (groupsWithoutCourse === 0)                     healthScore += 20
  if (attendancePct !== null && attendancePct >= 75) healthScore += 20
  if (sessionsThisMonth > 0)                         healthScore += 20

  const leadsTotal     = (leadsRes as any).count ?? 0
  const leadsConverted = (leadsConvertedRes as any).count ?? 0
  const conversionRate = leadsTotal > 0 ? Math.round((leadsConverted / leadsTotal) * 100) : 0

  return {
    activeStudents,
    newStudentsMonth: (newStudentsRes as any).count ?? 0,
    activeGroups,
    activeInstructors,
    sessionsThisMonth,
    attendancePct,
    certsIssued:      (certsRes as any).count ?? 0,
    leadsTotal,
    leadsConverted,
    conversionRate,
    overdueFollowUps: (overdueRes as any).count ?? 0,
    groupsWithoutInstructor,
    groupsWithoutCourse,
    healthScore,
  }
}

// ── Components ────────────────────────────────────────────────────────────────

function KPICard({
  label, value, sub, color = 'bg-slate-300', alert = false,
}: {
  label: string; value: number | string; sub?: string; color?: string; alert?: boolean
}) {
  return (
    <div className={`rounded-xl border p-4 ${alert && value !== 0 ? 'border-red-200 bg-red-50' : 'border-[#E2E8F0] bg-white'}`}>
      <div className={`mb-2 h-1.5 w-7 rounded-full ${color} opacity-80`} />
      <p className={`text-2xl font-bold ${alert && value !== 0 ? 'text-red-600' : 'text-[#0B1F3A]'}`}>{value}</p>
      <p className="mt-0.5 text-xs text-[#64748B]">{label}</p>
      {sub && <p className="mt-1 text-[11px] text-[#94A3B8]">{sub}</p>}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

interface Props { params: Promise<{ id: string }> }

export default async function BranchPerformancePage({ params }: Props) {
  await requirePermission('manage_branches')
  const { id } = await params

  const branch = await getBranch(id)
  if (!branch) notFound()

  const perf = await getBranchPerformance(id)
  const now  = new Date()

  return (
    <div className="max-w-4xl space-y-6">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between">
        <div>
          <Link href={`/admin/branches/${id}`} className="text-sm text-[#64748B] hover:text-[#0B1F3A]">
            ← {branch.name}
          </Link>
          <h1 className="mt-2 text-xl font-semibold text-[#0B1F3A]">{branch.name} — Performance</h1>
          <p className="mt-0.5 text-sm text-[#64748B]">
            {now.toLocaleString('en-US', { month: 'long', year: 'numeric' })} snapshot
          </p>
        </div>
        <div className="text-right">
          <p className={`text-3xl font-bold ${perf.healthScore >= 80 ? 'text-emerald-600' : perf.healthScore >= 50 ? 'text-amber-600' : 'text-red-600'}`}>
            {perf.healthScore}
          </p>
          <p className="text-xs text-[#94A3B8]">Health Score</p>
        </div>
      </div>

      {/* ── People ─────────────────────────────────────────────────────── */}
      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-[#94A3B8]">People</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <KPICard label="Active Students"   value={perf.activeStudents}   color="bg-emerald-400" />
          <KPICard label="New This Month"    value={perf.newStudentsMonth} color="bg-teal-400"    sub="Students enrolled" />
          <KPICard label="Active Groups"     value={perf.activeGroups}     color="bg-blue-400" />
          <KPICard label="Instructors"       value={perf.activeInstructors} color="bg-indigo-400" />
        </div>
      </section>

      {/* ── Academic ───────────────────────────────────────────────────── */}
      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-[#94A3B8]">Academic</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <KPICard label="Sessions This Month"  value={perf.sessionsThisMonth} color="bg-violet-400" />
          <KPICard label="Attendance Rate"      value={perf.attendancePct !== null ? `${perf.attendancePct}%` : '—'} color={perf.attendancePct !== null && perf.attendancePct >= 75 ? 'bg-emerald-400' : 'bg-amber-400'} />
          <KPICard label="Certificates Issued"  value={perf.certsIssued}       color="bg-sky-400" sub="This month" />
        </div>
      </section>

      {/* ── Lead Pipeline ──────────────────────────────────────────────── */}
      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-[#94A3B8]">Lead Pipeline</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <KPICard label="Active Leads"      value={perf.leadsTotal}       color="bg-violet-400" />
          <KPICard label="Converted (month)" value={perf.leadsConverted}   color="bg-emerald-400" />
          <KPICard label="Conversion Rate"   value={`${perf.conversionRate}%`} color={perf.conversionRate >= 30 ? 'bg-emerald-400' : 'bg-amber-400'} />
          <KPICard label="Overdue Follow-Ups" value={perf.overdueFollowUps} color="bg-red-400" alert />
        </div>
      </section>

      {/* ── Operational health ─────────────────────────────────────────── */}
      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-[#94A3B8]">Operational Health</h2>
        <div className="grid grid-cols-2 gap-3">
          <KPICard
            label="Groups Without Instructor"
            value={perf.groupsWithoutInstructor}
            color="bg-red-400"
            alert
            sub={perf.groupsWithoutInstructor > 0 ? 'Needs immediate attention' : undefined}
          />
          <KPICard
            label="Groups Without Course"
            value={perf.groupsWithoutCourse}
            color="bg-red-400"
            alert
            sub={perf.groupsWithoutCourse > 0 ? 'Cannot become active' : undefined}
          />
        </div>

        {perf.groupsWithoutInstructor === 0 && perf.groupsWithoutCourse === 0 && (
          <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
            All groups are properly configured.
          </div>
        )}
      </section>

      {/* ── Quick links ────────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-2 pt-2">
        <Link href={`/admin/students?branch=${id}`} className="rounded-lg border border-[#E2E8F0] px-3 py-2 text-xs font-medium text-[#64748B] hover:border-[#FF8A1F] hover:text-[#FF8A1F]">
          Students →
        </Link>
        <Link href={`/admin/groups?branch=${id}`} className="rounded-lg border border-[#E2E8F0] px-3 py-2 text-xs font-medium text-[#64748B] hover:border-[#FF8A1F] hover:text-[#FF8A1F]">
          Groups →
        </Link>
        <Link href={`/admin/leads?branch=${id}`} className="rounded-lg border border-[#E2E8F0] px-3 py-2 text-xs font-medium text-[#64748B] hover:border-[#FF8A1F] hover:text-[#FF8A1F]">
          Leads →
        </Link>
        <Link href={`/admin/sessions?branch=${id}`} className="rounded-lg border border-[#E2E8F0] px-3 py-2 text-xs font-medium text-[#64748B] hover:border-[#FF8A1F] hover:text-[#FF8A1F]">
          Sessions →
        </Link>
      </div>
    </div>
  )
}
