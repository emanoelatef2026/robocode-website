import { createServiceClient }          from '@/lib/supabase/service'
import { requirePermission }            from '@/modules/rbac/guards'
import { getTeamLeader }                from '@/modules/team-leaders/queries'
import { notFound }                     from 'next/navigation'
import Link                             from 'next/link'

// ── Types ─────────────────────────────────────────────────────────────────────

interface TLPerformanceData {
  // People managed
  activeStudents:     number
  activeGroups:       number
  activeInstructors:  number
  // Leads
  leadsConverted:     number
  leadsTotal:         number
  conversionRate:     number
  overdueFollowUps:   number
  // Academic
  sessionsThisMonth:  number
  attendancePct:      number | null
  certsIssued:        number
  // Ops health
  groupsWithoutInstructor: number
  healthScore:        number
}

// ── Query ─────────────────────────────────────────────────────────────────────

async function getTLPerformance(userId: string, branchIds: string[]): Promise<TLPerformanceData> {
  if (!branchIds.length) {
    return {
      activeStudents: 0, activeGroups: 0, activeInstructors: 0,
      leadsConverted: 0, leadsTotal: 0, conversionRate: 0, overdueFollowUps: 0,
      sessionsThisMonth: 0, attendancePct: null, certsIssued: 0,
      groupsWithoutInstructor: 0, healthScore: 0,
    }
  }

  const db         = createServiceClient()
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()
  const today      = new Date().toISOString().slice(0, 10)

  const [
    studentsRes,
    groupsRes,
    instructorsRes,
    leadsRes,
    leadsConvertedRes,
    overdueRes,
    certsRes,
    activeGroupsRes,
  ] = await Promise.all([
    db.from('students').select('id', { count: 'exact', head: true }).in('branch_id', branchIds).eq('status', 'active').is('deleted_at', null),
    db.from('groups').select('id', { count: 'exact', head: true }).in('branch_id', branchIds).eq('status', 'active').is('deleted_at', null),
    db.from('instructors').select('id', { count: 'exact', head: true }).in('branch_id', branchIds).eq('status', 'active').is('deleted_at', null),
    db.from('leads').select('id', { count: 'exact', head: true }).eq('assigned_to', userId).not('status', 'in', '("CONVERTED","LOST")'),
    db.from('leads').select('id', { count: 'exact', head: true }).eq('assigned_to', userId).eq('status', 'CONVERTED').gte('updated_at', monthStart),
    db.from('leads').select('id', { count: 'exact', head: true }).eq('assigned_to', userId).lt('next_follow_up_at', today).not('next_follow_up_at', 'is', null).not('status', 'in', '("CONVERTED","LOST")'),
    db.from('certificates').select('id', { count: 'exact', head: true }).in('branch_id', branchIds).eq('status', 'active').gte('issued_at', monthStart),
    db.from('groups').select('id').in('branch_id', branchIds).eq('status', 'active').is('deleted_at', null),
  ])

  const activeGroupIds: string[] = ((activeGroupsRes as any).data ?? []).map((g: any) => g.id as string)

  // Sessions and attendance
  let sessionsThisMonth = 0
  let attendancePct: number | null = null
  for (const bId of branchIds) {
    const { count: sc } = await db.from('schedules')
      .select('id', { count: 'exact', head: true })
      .eq('branch_id', bId)
      .gte('scheduled_at', monthStart)
      .neq('status', 'cancelled')
    sessionsThisMonth += sc ?? 0
  }

  if (sessionsThisMonth > 0) {
    const { data: schedIds } = await db.from('schedules')
      .select('id')
      .in('branch_id', branchIds)
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

  // Groups without instructor
  let groupsWithoutInstructor = 0
  if (activeGroupIds.length > 0) {
    const { data: giRows } = await db.from('group_instructors').select('group_id').in('group_id', activeGroupIds)
    const withInstSet = new Set((giRows ?? []).map((r: any) => r.group_id as string))
    groupsWithoutInstructor = activeGroupIds.filter(gid => !withInstSet.has(gid)).length
  }

  // Health score
  let healthScore = 0
  const activeStudents  = (studentsRes as any).count ?? 0
  const activeGroups    = (groupsRes as any).count ?? 0
  const leadsConverted  = (leadsConvertedRes as any).count ?? 0
  const leadsTotal      = (leadsRes as any).count ?? 0

  if (activeGroups > 0)                              healthScore += 25
  if (groupsWithoutInstructor === 0)                 healthScore += 25
  if (attendancePct !== null && attendancePct >= 75) healthScore += 25
  if (leadsConverted > 0)                            healthScore += 25

  const conversionRate = leadsTotal > 0 ? Math.round((leadsConverted / leadsTotal) * 100) : 0

  return {
    activeStudents,
    activeGroups,
    activeInstructors: (instructorsRes as any).count ?? 0,
    leadsConverted,
    leadsTotal,
    conversionRate,
    overdueFollowUps: (overdueRes as any).count ?? 0,
    sessionsThisMonth,
    attendancePct,
    certsIssued:      (certsRes as any).count ?? 0,
    groupsWithoutInstructor,
    healthScore,
  }
}

// ── Components ────────────────────────────────────────────────────────────────

function KPI({
  label, value, sub, alert = false,
}: {
  label: string; value: string | number; sub?: string; alert?: boolean
}) {
  return (
    <div className={`rounded-xl border p-4 ${alert && value !== 0 ? 'border-[#FECACA] bg-[#FEE2E2]' : 'border-[#E2E8F0] bg-white'}`}>
      <p className={`text-2xl font-bold ${alert && value !== 0 ? 'text-[#EF4444]' : 'text-[#0B1F3A]'}`}>{value}</p>
      <p className="mt-0.5 text-xs text-[#64748B]">{label}</p>
      {sub && <p className="mt-1 text-[11px] text-[#94A3B8]">{sub}</p>}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

interface Props { params: Promise<{ id: string }> }

export default async function TLPerformancePage({ params }: Props) {
  await requirePermission('manage_system')
  const { id } = await params

  const tl = await getTeamLeader(id)
  if (!tl) notFound()

  const perf = await getTLPerformance(tl.user_id, tl.branch_ids)
  const name = tl.first_name && tl.last_name ? `${tl.first_name} ${tl.last_name}` : tl.email
  const now  = new Date()

  return (
    <div className="max-w-3xl space-y-6">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <Link href={`/admin/team-leaders/${id}`} className="text-sm text-[#64748B] hover:text-[#0B1F3A]">
          ← {name}
        </Link>
        <div className="text-right">
          <p className={`text-3xl font-bold ${perf.healthScore >= 75 ? 'text-[#10B981]' : perf.healthScore >= 50 ? 'text-[#F59E0B]' : 'text-[#EF4444]'}`}>
            {perf.healthScore}
          </p>
          <p className="text-xs text-[#94A3B8]">Performance Score</p>
        </div>
      </div>

      {/* ── Managed Resources ──────────────────────────────────────────── */}
      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-[#94A3B8]">Managed Resources</h2>
        <div className="grid grid-cols-3 gap-3">
          <KPI label="Active Students"    value={perf.activeStudents} />
          <KPI label="Active Groups"      value={perf.activeGroups} />
          <KPI label="Active Instructors" value={perf.activeInstructors} />
        </div>
      </section>

      {/* ── Lead Pipeline ──────────────────────────────────────────────── */}
      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-[#94A3B8]">Lead Pipeline (My Leads)</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <KPI label="Active Leads"       value={perf.leadsTotal} />
          <KPI label="Converted (month)"  value={perf.leadsConverted} />
          <KPI label="Conversion Rate"    value={`${perf.conversionRate}%`}
            sub={`${perf.leadsConverted} of ${perf.leadsTotal}`} />
          <KPI label="Overdue Follow-Ups" value={perf.overdueFollowUps} alert />
        </div>
      </section>

      {/* ── Academic ───────────────────────────────────────────────────── */}
      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-[#94A3B8]">Academic (This Month)</h2>
        <div className="grid grid-cols-3 gap-3">
          <KPI label="Sessions"            value={perf.sessionsThisMonth} />
          <KPI label="Attendance Rate"     value={perf.attendancePct !== null ? `${perf.attendancePct}%` : '—'} />
          <KPI label="Certificates Issued" value={perf.certsIssued} />
        </div>
      </section>

      {/* ── Ops Alerts ─────────────────────────────────────────────────── */}
      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-[#94A3B8]">Operational Alerts</h2>
        {perf.groupsWithoutInstructor > 0 ? (
          <div className="rounded-xl border border-[#FECACA] bg-[#FEE2E2] px-4 py-3 text-sm font-medium text-[#DC2626]">
            {perf.groupsWithoutInstructor} active group{perf.groupsWithoutInstructor !== 1 ? 's' : ''} without instructor.
            <Link href="/admin/system-health" className="ml-2 underline">Fix →</Link>
          </div>
        ) : (
          <div className="rounded-xl border border-[#A7F3D0] bg-[#E7F8EE] px-4 py-3 text-sm font-medium text-[#15803D]">
            All groups have instructors assigned.
          </div>
        )}
      </section>

      {/* ── Quick links ────────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-2">
        {tl.branch_ids.map(bid => (
          <Link key={bid} href={`/admin/branches/${bid}/performance`} className="rounded-lg border border-[#E2E8F0] px-3 py-2 text-xs font-medium text-[#64748B] hover:border-[#FF8A1F] hover:text-[#FF8A1F]">
            Branch Performance →
          </Link>
        ))}
        <Link href={`/admin/leads?assigned=${tl.user_id}`} className="rounded-lg border border-[#E2E8F0] px-3 py-2 text-xs font-medium text-[#64748B] hover:border-[#FF8A1F] hover:text-[#FF8A1F]">
          My Leads →
        </Link>
      </div>
    </div>
  )
}
