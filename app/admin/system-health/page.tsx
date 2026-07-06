import { createServiceClient }    from '@/lib/supabase/service'
import { requireAuth }            from '@/modules/rbac/guards'
import { redirect }               from 'next/navigation'
import { getEventSummaryCounts }  from '@/modules/observability'
import { getDeadLetterJobs }      from '@/modules/background-jobs'
import type { JobRow }            from '@/modules/background-jobs'
import Link                       from 'next/link'

// ── Types ─────────────────────────────────────────────────────────────────────

type Severity = 'critical' | 'warning' | 'info'

interface IssueItem {
  id:   string
  name: string
  sub?: string
  href: string
}

interface CheckSection {
  title:    string
  severity: Severity
  items:    IssueItem[]
  allClearText: string
}

// ── Data fetcher ──────────────────────────────────────────────────────────────

interface IntegrityRun {
  run_at:      string
  ok:          boolean
  counts:      Record<string, number>
  breached:    string[]
  duration_ms: number
}

async function getLatestIntegrityRun(): Promise<IntegrityRun | null> {
  const db = createServiceClient()
  const { data } = await db
    .from('integrity_check_runs')
    .select('run_at, ok, counts, breached, duration_ms')
    .order('run_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  return (data as IntegrityRun | null) ?? null
}

async function getHealthData() {
  const db          = createServiceClient()
  const twoWeeksAgo = new Date(Date.now() - 14 * 86400000).toISOString()
  const today       = new Date().toISOString().slice(0, 10)

  // ── Active groups ────────────────────────────────────────────────────────────
  const { data: activeGroupsData } = await db
    .from('groups')
    .select('id, name, branch_id, branches!groups_branch_id_fkey(name)')
    .eq('status', 'active')
    .is('deleted_at', null)
    .order('name')
    .limit(200)
  const activeGroups   = (activeGroupsData ?? []) as any[]
  const activeGroupIds = activeGroups.map(g => g.id as string)

  // Groups that have an instructor / course
  const [giData, gcData] = await Promise.all(
    activeGroupIds.length > 0
      ? [
          db.from('group_instructors').select('group_id').in('group_id', activeGroupIds),
          db.from('group_courses').select('group_id').in('group_id', activeGroupIds).eq('status', 'active'),
        ]
      : [{ data: [] }, { data: [] }]
  )
  const withInstrSet  = new Set((giData.data ?? []).map((r: any) => r.group_id as string))
  const withCourseSet = new Set((gcData.data ?? []).map((r: any) => r.group_id as string))

  const groupsWithoutInstructor: IssueItem[] = activeGroups
    .filter(g => !withInstrSet.has(g.id))
    .map(g => ({ id: g.id, name: g.name, sub: g.branches?.name ?? '—', href: `/admin/groups/${g.id}` }))

  const groupsWithoutCourse: IssueItem[] = activeGroups
    .filter(g => !withCourseSet.has(g.id))
    .map(g => ({ id: g.id, name: g.name, sub: g.branches?.name ?? '—', href: `/admin/groups/${g.id}` }))

  // ── Students without group ───────────────────────────────────────────────────
  const { data: activeStudData } = await db
    .from('students')
    .select(`id, branch_id,
      users!students_user_id_fkey(email, profiles!profiles_user_id_fkey(first_name, last_name)),
      branches!students_branch_id_fkey(name)`)
    .eq('status', 'active')
    .is('deleted_at', null)
    .limit(500)
  const { data: gsData } = await db.from('group_students').select('student_id').eq('status', 'active')
  const inGroupSet = new Set((gsData ?? []).map((r: any) => r.student_id as string))

  const studentsWithoutGroup: IssueItem[] = ((activeStudData ?? []) as any[])
    .filter(s => !inGroupSet.has(s.id))
    .slice(0, 50)
    .map(s => {
      const prof = s.users?.profiles
      const name = prof ? [prof.first_name, prof.last_name].filter(Boolean).join(' ') : null
      return { id: s.id, name: name || s.users?.email || 'Unknown', sub: s.branches?.name ?? '—', href: `/admin/students/${s.id}` }
    })

  // ── Inactive instructors ─────────────────────────────────────────────────────
  const { data: inactiveInstData } = await db
    .from('instructors')
    .select(`id, branch_id,
      users!instructors_user_id_fkey(email, profiles!profiles_user_id_fkey(first_name, last_name)),
      branches!instructors_branch_id_fkey(name)`)
    .eq('status', 'inactive')
    .is('deleted_at', null)
    .limit(30)
  const inactiveInstructors: IssueItem[] = ((inactiveInstData ?? []) as any[]).map(i => {
    const prof = i.users?.profiles
    return {
      id:   i.id,
      name: prof ? [prof.first_name, prof.last_name].filter(Boolean).join(' ') || i.users?.email : i.users?.email,
      sub:  i.branches?.name ?? '—',
      href: `/admin/instructors/${i.id}`,
    }
  })

  // ── Inactive team leaders ────────────────────────────────────────────────────
  const { data: tlRoleRow } = await db.from('roles').select('id').eq('name', 'team_leader').single()
  const inactiveTLs: IssueItem[] = []
  if (tlRoleRow) {
    const { data: allTLUsers } = await db
      .from('users')
      .select(`id, email, metadata, profiles!profiles_user_id_fkey(first_name, last_name)`)
      .not('metadata', 'is', null)
    for (const u of (allTLUsers ?? []) as any[]) {
      const meta = (u.metadata ?? {}) as Record<string, unknown>
      if (meta.tl_status === 'inactive') {
        const prof = u.profiles
        const name = prof ? [prof.first_name, prof.last_name].filter(Boolean).join(' ') : null
        inactiveTLs.push({ id: u.id, name: name || u.email, href: `/admin/team-leaders/${u.id}` })
      }
    }
  }

  // ── Leads without owner ──────────────────────────────────────────────────────
  const { data: unassignedLeadsData } = await db
    .from('leads')
    .select('id, child_name, created_at')
    .is('assigned_to', null)
    .not('status', 'in', '("CONVERTED","LOST")')
    .order('created_at', { ascending: true })
    .limit(30)
  const leadsWithoutOwner: IssueItem[] = ((unassignedLeadsData ?? []) as any[]).map(l => ({
    id:   l.id,
    name: l.child_name,
    sub:  `Created ${new Date(l.created_at).toLocaleDateString('en-GB')}`,
    href: `/admin/leads/${l.id}`,
  }))

  // ── Sessions without attendance (past 14 days) ───────────────────────────────
  const { data: recentScheds } = await db
    .from('schedules')
    .select('id, scheduled_at, group_courses!schedules_group_course_id_fkey(groups!group_courses_group_id_fkey(name))')
    .gte('scheduled_at', twoWeeksAgo)
    .lte('scheduled_at', new Date().toISOString())
    .neq('status', 'cancelled')
    .limit(200)
  const recentSchedIds = (recentScheds ?? []).map((s: any) => s.id as string)
  const sessionsWithoutAttendance: IssueItem[] = []
  if (recentSchedIds.length > 0) {
    const { data: attRows } = await db
      .from('attendance_records').select('schedule_id').in('schedule_id', recentSchedIds)
    const withAttSet = new Set((attRows ?? []).map((r: any) => r.schedule_id as string))
    for (const sched of (recentScheds ?? []) as any[]) {
      if (!withAttSet.has(sched.id)) {
        const groupName = sched.group_courses?.groups?.name ?? 'Unknown'
        sessionsWithoutAttendance.push({
          id:   sched.id,
          name: `${groupName} — ${new Date(sched.scheduled_at).toLocaleDateString('en-GB')}`,
          href: '/admin/sessions',
        })
      }
    }
  }

  // ── Open parent messages ─────────────────────────────────────────────────────
  const { data: openMsgData } = await db
    .from('parent_messages')
    .select('id, category, created_at, branches!parent_messages_branch_id_fkey(name)')
    .in('status', ['submitted', 'under_review'])
    .order('created_at', { ascending: true })
    .limit(20)
  const openMessages: IssueItem[] = ((openMsgData ?? []) as any[]).map(m => ({
    id:   m.id,
    name: `${(m.category as string).replace(/_/g, ' ')} message`,
    sub:  `${m.branches?.name ?? '—'} · ${new Date(m.created_at).toLocaleDateString('en-GB')}`,
    href: '/admin/communications',
  }))

  // ── Data integrity checks ─────────────────────────────────────────────────────

  const [dupEnrollData, balanceMismatch, orphanPayments, missingCodes] = await Promise.all([
    // Duplicate ACTIVE enrollments (same student + group)
    db.from('student_enrollments')
      .select('student_id, group_id')
      .eq('status', 'ACTIVE')
      .not('group_id', 'is', null)
      .limit(500),

    // Balance mismatch: |remaining - (net - paid)| > 1 EGP
    db.from('student_financial_accounts')
      .select('id, student_id, branch_id, net_amount, paid_amount, remaining_amount')
      .limit(1000),

    // Orphan payments (no account and no enrollment)
    db.from('finance_payments')
      .select('id, student_id, amount, payment_date')
      .is('account_id', null)
      .is('enrollment_id', null)
      .limit(50),

    // Active enrollments missing contract_code
    db.from('student_enrollments')
      .select(`id, student_id, students!student_enrollments_student_id_fkey(users!students_user_id_fkey(profiles!profiles_user_id_fkey(first_name, last_name)))`)
      .eq('status', 'ACTIVE')
      .is('contract_code', null)
      .limit(50),
  ])

  // Detect duplicates
  const enrollSeen = new Map<string, number>()
  for (const e of (dupEnrollData.data ?? []) as any[]) {
    const k = `${e.student_id}:${e.group_id}`
    enrollSeen.set(k, (enrollSeen.get(k) ?? 0) + 1)
  }
  const duplicateEnrollments: IssueItem[] = [...enrollSeen.entries()]
    .filter(([, c]) => c > 1)
    .map(([k]) => {
      const [sid] = k.split(':')
      return { id: k, name: 'Duplicate active enrollment', sub: `Student ${sid.slice(0, 8)}…`, href: `/admin/students/${sid}` }
    })

  // Balance mismatches
  const balanceMismatches: IssueItem[] = ((balanceMismatch.data ?? []) as any[])
    .filter(a => Math.abs(Number(a.remaining_amount) - (Number(a.net_amount) - Number(a.paid_amount))) > 1)
    .slice(0, 20)
    .map(a => ({
      id:   a.id,
      name: `Balance mismatch — EGP ${Math.abs(Number(a.remaining_amount) - (Number(a.net_amount) - Number(a.paid_amount))).toFixed(0)} diff`,
      sub:  `Account ${a.id.slice(0, 8)}…`,
      href: `/admin/finance`,
    }))

  const orphanPaymentItems: IssueItem[] = ((orphanPayments.data ?? []) as any[]).map(p => ({
    id:   p.id,
    name: `Orphan payment — EGP ${Number(p.amount).toFixed(0)}`,
    sub:  `${p.payment_date}`,
    href: `/admin/finance`,
  }))

  const missingContractCodes: IssueItem[] = ((missingCodes.data ?? []) as any[]).map(e => {
    const prof = e.students?.users?.profiles
    const name = prof ? [prof.first_name, prof.last_name].filter(Boolean).join(' ') : 'Unknown'
    return { id: e.id, name, sub: 'Missing contract code', href: `/admin/students/${e.student_id}` }
  })

  return {
    groupsWithoutInstructor,
    groupsWithoutCourse,
    studentsWithoutGroup,
    inactiveInstructors,
    inactiveTLs,
    leadsWithoutOwner,
    sessionsWithoutAttendance,
    openMessages,
    // Integrity
    duplicateEnrollments,
    balanceMismatches,
    orphanPaymentItems,
    missingContractCodes,
  }
}

// ── UI Components ─────────────────────────────────────────────────────────────

function CheckCard({ section }: { section: CheckSection }) {
  const { title, severity, items, allClearText } = section
  const severityColors: Record<Severity, { header: string; badge: string; empty: string }> = {
    critical: {
      header: 'text-[#DC2626]',
      badge:  'bg-[#FEE2E2] text-[#DC2626]',
      empty:  'bg-[#E7F8EE] border-[#A7F3D0] text-[#15803D]',
    },
    warning: {
      header: 'text-[#B45309]',
      badge:  'bg-[#FFFBEB] text-[#B45309]',
      empty:  'bg-[#E7F8EE] border-[#A7F3D0] text-[#15803D]',
    },
    info: {
      header: 'text-[#1D4ED8]',
      badge:  'bg-[#EFF6FF] text-[#1D4ED8]',
      empty:  'bg-[#EFF6FF] border-blue-200 text-[#2563EB]',
    },
  }
  const dot: Record<Severity, string> = { critical: 'bg-[#EF4444]', warning: 'bg-[#F59E0B]', info: 'bg-[#3B82F6]' }
  const colors = severityColors[severity]

  if (items.length === 0) {
    return (
      <div className={`rounded-xl border p-4 ${colors.empty}`}>
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-[#10B981]" />
          <p className="text-sm font-semibold">{title}</p>
          <span className="ml-auto rounded-full bg-[#E7F8EE] px-2 py-0.5 text-[11px] font-medium text-[#15803D]">All clear</span>
        </div>
      </div>
    )
  }

  return (
    <div className="overflow-hidden ds-card">
      <div className="flex items-center gap-2 border-b border-[#E2E8F0] px-4 py-3 bg-[#F8FAFC]">
        <span className={`h-2 w-2 rounded-full ${dot[severity]}`} />
        <p className={`text-sm font-semibold ${colors.header}`}>{title}</p>
        <span className={`ml-auto rounded-full px-2 py-0.5 text-[11px] font-medium ${colors.badge}`}>
          {items.length} issue{items.length !== 1 ? 's' : ''}
        </span>
      </div>
      <ul className="divide-y divide-[#E2E8F0]">
        {items.slice(0, 15).map(item => (
          <li key={item.id}>
            <Link
              href={item.href}
              className="flex items-center justify-between px-4 py-2.5 hover:bg-[#F8FAFC] transition"
            >
              <div>
                <p className="text-sm font-medium text-[#0B1F3A]">{item.name}</p>
                {item.sub && <p className="text-[11px] text-[#94A3B8]">{item.sub}</p>}
              </div>
              <svg viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5 text-[#CBD5E1] shrink-0">
                <path fillRule="evenodd" d="M6.22 3.22a.75.75 0 011.06 0l4.25 4.25a.75.75 0 010 1.06L7.28 12.78a.75.75 0 01-1.06-1.06L9.94 8 6.22 4.28a.75.75 0 010-1.06z" clipRule="evenodd" />
              </svg>
            </Link>
          </li>
        ))}
        {items.length > 15 && (
          <li className="px-4 py-2.5 text-xs text-[#94A3B8]">
            + {items.length - 15} more issues
          </li>
        )}
      </ul>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function SystemHealthPage() {
  const user = await requireAuth()
  if (user.globalRole !== 'super_admin') redirect('/admin')

  const [data, eventCounts, deadLetterJobs, executiveAlertsResult, latestIntegrityRun] = await Promise.all([
    getHealthData(),
    getEventSummaryCounts(24),
    getDeadLetterJobs(10),
    createServiceClient().from('v_executive_alerts').select('*').limit(20).then(r => r.data ?? [], () => []) as Promise<any[]>,
    getLatestIntegrityRun(),
  ])

  const sections: CheckSection[] = [
    // ── Data integrity (most critical) ──────────────────────────────────────────
    {
      title:        'Duplicate Active Enrollments',
      severity:     'critical',
      items:        data.duplicateEnrollments,
      allClearText: 'No duplicate active enrollments detected.',
    },
    {
      title:        'Financial Balance Mismatches',
      severity:     'critical',
      items:        data.balanceMismatches,
      allClearText: 'All account balances are consistent.',
    },
    {
      title:        'Orphan Payments (No Account)',
      severity:     'critical',
      items:        data.orphanPaymentItems,
      allClearText: 'All payments are linked to accounts.',
    },
    // ── Operational gaps ─────────────────────────────────────────────────────────
    {
      title:        'Groups Without Instructor',
      severity:     'critical',
      items:        data.groupsWithoutInstructor,
      allClearText: 'All active groups have instructors.',
    },
    {
      title:        'Groups Without Active Course',
      severity:     'critical',
      items:        data.groupsWithoutCourse,
      allClearText: 'All active groups have an active course.',
    },
    {
      title:        'Sessions Without Attendance (14 days)',
      severity:     'critical',
      items:        data.sessionsWithoutAttendance,
      allClearText: 'All recent sessions have attendance recorded.',
    },
    // ── Warnings ──────────────────────────────────────────────────────────────────
    {
      title:        'Enrollments Missing Contract Code',
      severity:     'warning',
      items:        data.missingContractCodes,
      allClearText: 'All enrollments have contract codes.',
    },
    {
      title:        'Leads Without Owner',
      severity:     'warning',
      items:        data.leadsWithoutOwner,
      allClearText: 'All active leads have owners.',
    },
    {
      title:        'Active Students Not in Any Group',
      severity:     'warning',
      items:        data.studentsWithoutGroup,
      allClearText: 'All active students are in at least one group.',
    },
    {
      title:        'Open Parent Messages (Unresolved)',
      severity:     'warning',
      items:        data.openMessages,
      allClearText: 'No open parent messages.',
    },
    // ── Info ──────────────────────────────────────────────────────────────────────
    {
      title:        'Inactive Instructors (Still in System)',
      severity:     'info',
      items:        data.inactiveInstructors,
      allClearText: 'No inactive instructors.',
    },
    {
      title:        'Inactive Team Leaders',
      severity:     'info',
      items:        data.inactiveTLs,
      allClearText: 'No inactive team leaders.',
    },
  ]

  const criticalCount = sections.filter(s => s.severity === 'critical').reduce((sum, s) => sum + s.items.length, 0)
  const warningCount  = sections.filter(s => s.severity === 'warning').reduce((sum, s) => sum + s.items.length, 0)
  const infoCount     = sections.filter(s => s.severity === 'info').reduce((sum, s) => sum + s.items.length, 0)
  const totalIssues   = criticalCount + warningCount + infoCount

  // Health score: start at 100, deduct for issues
  const healthScore = Math.max(0, Math.min(100,
    100
    - criticalCount * 10  // each critical costs 10 points
    - warningCount  * 3   // each warning costs 3 points
    - infoCount     * 1   // each info costs 1 point
  ))

  const scoreColor =
    healthScore >= 90 ? 'text-[#10B981]' :
    healthScore >= 75 ? 'text-[#2563EB]'    :
    healthScore >= 60 ? 'text-[#F59E0B]'   :
    'text-[#EF4444]'

  const scoreLabel =
    healthScore >= 90 ? 'Healthy' :
    healthScore >= 75 ? 'Good'    :
    healthScore >= 60 ? 'Watch'   :
    'Critical'

  const alerts = (executiveAlertsResult as any[])

  return (
    <div className="max-w-4xl space-y-5">
      {/* ── Actions ────────────────────────────────────────────────────── */}
      <div className="flex justify-end items-center gap-2">
        <Link href="/admin/system-events" className="rounded-lg border border-[#E2E8F0] px-3 py-1.5 text-[12px] font-medium text-[#64748B] hover:border-[#FF8A1F] hover:text-[#FF8A1F]">
          Event Log
        </Link>
        <Link href="/admin/executive" className="rounded-lg border border-[#E2E8F0] px-3 py-1.5 text-[12px] font-medium text-[#64748B] hover:border-[#FF8A1F] hover:text-[#FF8A1F]">
          Exec Ops
        </Link>
      </div>

      {/* ── Sprint 52: Observability KPIs ──────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
        {[
          { label: 'Health Score',          value: String(healthScore),                    cls: scoreColor },
          { label: 'Critical Events (24h)', value: String(eventCounts.critical),            cls: eventCounts.critical > 0 ? 'text-[#EF4444]' : 'text-[#10B981]', badge: eventCounts.critical > 0 },
          { label: 'Errors (24h)',           value: String(eventCounts.error),              cls: eventCounts.error > 0 ? 'text-orange-600' : 'text-[#10B981]', badge: false },
          { label: 'Automation Failures',   value: String(eventCounts.automation_failures), cls: eventCounts.automation_failures > 0 ? 'text-[#F59E0B]' : 'text-[#10B981]', badge: false },
          { label: 'Slow Queries',          value: String(eventCounts.slow_queries),        cls: eventCounts.slow_queries > 5 ? 'text-[#F59E0B]' : 'text-[#10B981]', badge: false },
          { label: 'Dead Letter Jobs',      value: String(deadLetterJobs.length),           cls: deadLetterJobs.length > 0 ? 'text-[#EF4444]' : 'text-[#10B981]', badge: deadLetterJobs.length > 0 },
          { label: 'Integrity Issues',      value: String(totalIssues),                    cls: criticalCount > 0 ? 'text-[#EF4444]' : warningCount > 0 ? 'text-[#F59E0B]' : 'text-[#10B981]', badge: criticalCount > 0 },
        ].map(k => (
          <div key={k.label} className={`rounded-xl border bg-white p-3 ${(k as any).badge ? 'border-[#FECACA]' : 'border-[#E2E8F0]'}`}>
            <p className={`text-xl font-bold ${k.cls}`}>{k.value}</p>
            <p className="text-[10px] text-[#64748B]">{k.label}</p>
          </div>
        ))}
      </div>

      {/* ── Executive Alerts (Sprint 52 Phase 13) ───────────────────────── */}
      {alerts.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-[14px] font-semibold text-[#0B1F3A]">Executive Alerts</h2>
          {alerts.map((a: any, i: number) => {
            const cls = a.severity === 'CRITICAL' ? 'border-[#FECACA] bg-[#FEE2E2] text-[#991B1B]'
              : a.severity === 'HIGH' ? 'border-orange-200 bg-orange-50 text-orange-800'
              : 'border-[#FDE68A] bg-[#FFFBEB] text-[#92400E]'
            return (
              <div key={i} className={`flex items-start gap-3 rounded-xl border p-3 ${cls}`}>
                <span className="text-base">{a.severity === 'CRITICAL' ? '🚨' : a.severity === 'HIGH' ? '⚠️' : '📊'}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">{a.alert_type?.replace(/_/g, ' ')}</p>
                  <p className="text-[12px]">{a.message}{a.branch_name ? ` — ${a.branch_name}` : ''}</p>
                </div>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${a.severity === 'CRITICAL' ? 'bg-[#FECACA] text-[#991B1B]' : 'bg-[#FDE68A] text-[#92400E]'}`}>
                  {a.severity}
                </span>
              </div>
            )
          })}
        </div>
      )}

      {/* ── Dead Letter Jobs (Sprint 52 Phase 6) ────────────────────────── */}
      {deadLetterJobs.length > 0 && (
        <div className="rounded-xl border border-[#FECACA] bg-white overflow-hidden">
          <div className="flex items-center justify-between border-b border-[#E2E8F0] px-4 py-3 bg-[#FEE2E2]">
            <p className="text-sm font-semibold text-[#991B1B]">Dead Letter Jobs ({deadLetterJobs.length})</p>
            <Link href="/admin/system-events?type=JOB_DEAD_LETTER" className="text-[11px] text-[#EF4444] hover:underline">View all →</Link>
          </div>
          <div className="divide-y divide-[#F1F5F9]">
            {deadLetterJobs.slice(0, 5).map((job: JobRow) => (
              <div key={job.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-[#0B1F3A]">{job.type}</p>
                  <p className="text-[11px] text-[#EF4444] truncate max-w-80">{job.error ?? 'Unknown error'}</p>
                </div>
                <p className="text-[11px] text-[#94A3B8]">{new Date(job.created_at).toLocaleDateString('en-GB')}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Phase 6: daily integrity-check cron result ──────────────────── */}
      <div className={`ds-card overflow-hidden ${latestIntegrityRun && !latestIntegrityRun.ok ? 'border-[#FECACA]' : ''}`}>
        <div className={`flex items-center justify-between px-4 py-3 border-b border-[#E2E8F0] ${latestIntegrityRun && !latestIntegrityRun.ok ? 'bg-[#FEE2E2]' : 'bg-[#F8FAFC]'}`}>
          <p className={`text-sm font-semibold ${latestIntegrityRun && !latestIntegrityRun.ok ? 'text-[#991B1B]' : 'text-[#0B1F3A]'}`}>
            Daily Integrity Check {latestIntegrityRun ? `(${new Date(latestIntegrityRun.run_at).toLocaleString('en-GB')})` : ''}
          </p>
          {latestIntegrityRun && (
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${latestIntegrityRun.ok ? 'bg-[#E7F8EE] text-[#15803D]' : 'bg-[#FECACA] text-[#991B1B]'}`}>
              {latestIntegrityRun.ok ? 'All clear' : `${latestIntegrityRun.breached.length} breached`}
            </span>
          )}
        </div>
        {!latestIntegrityRun ? (
          <p className="px-4 py-3 text-sm text-[#94A3B8]">No integrity-check run recorded yet.</p>
        ) : (
          <ul className="divide-y divide-[#E2E8F0]">
            {Object.entries(latestIntegrityRun.counts).map(([key, value]) => {
              const breached = latestIntegrityRun.breached.includes(key)
              return (
                <li key={key} className="flex items-center justify-between px-4 py-2 text-sm">
                  <span className="text-[#64748B]">{key.replace(/_/g, ' ')}</span>
                  <span className={`font-semibold ${breached ? 'text-[#DC2626]' : 'text-[#0B1F3A]'}`}>{value}</span>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {/* ── Original issue counts header ────────────────────────────────── */}
      <div className="flex items-center gap-2">
        <h2 className="text-[15px] font-semibold text-[#0B1F3A]">Integrity &amp; Operational Gaps</h2>
        {criticalCount > 0 && <span className="rounded-full bg-[#FEE2E2] px-2 py-0.5 text-[10px] font-semibold text-[#DC2626]">{criticalCount} critical</span>}
        {warningCount > 0 && <span className="rounded-full bg-[#FFFBEB] px-2 py-0.5 text-[10px] font-semibold text-[#B45309]">{warningCount} warnings</span>}
        {infoCount > 0 && <span className="rounded-full bg-[#EFF6FF] px-2 py-0.5 text-[10px] font-semibold text-[#1D4ED8]">{infoCount} info</span>}
      </div>

      {/* ── Health Score ───────────────────────────────────────────────── */}
      <div className="ds-card p-5 flex items-center gap-6">
        <div className="text-center shrink-0">
          <p className={`text-5xl font-black ${scoreColor}`}>{healthScore}</p>
          <p className="text-xs font-semibold text-[#94A3B8] mt-1">/ 100</p>
        </div>
        <div className="flex-1">
          <p className={`text-lg font-bold ${scoreColor}`}>System {scoreLabel}</p>
          <div className="mt-2 h-2.5 rounded-full bg-[#F1F5F9] overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${healthScore >= 90 ? 'bg-[#10B981]' : healthScore >= 75 ? 'bg-[#3B82F6]' : healthScore >= 60 ? 'bg-[#F59E0B]' : 'bg-[#EF4444]'}`}
              style={{ width: `${healthScore}%` }}
            />
          </div>
          <p className="mt-1.5 text-[11px] text-[#94A3B8]">
            {criticalCount} critical · {warningCount} warnings · {infoCount} info · {totalIssues} total issues
          </p>
        </div>
      </div>

      {/* ── Score summary row ──────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-3">
        <div className={`rounded-xl border p-4 ${criticalCount > 0 ? 'border-[#FECACA] bg-[#FEE2E2]' : 'border-[#A7F3D0] bg-[#E7F8EE]'}`}>
          <p className={`text-2xl font-bold ${criticalCount > 0 ? 'text-[#EF4444]' : 'text-[#10B981]'}`}>{criticalCount}</p>
          <p className="mt-0.5 text-xs font-medium text-[#64748B]">Critical Issues</p>
        </div>
        <div className={`rounded-xl border p-4 ${warningCount > 0 ? 'border-[#FDE68A] bg-[#FFFBEB]' : 'border-[#A7F3D0] bg-[#E7F8EE]'}`}>
          <p className={`text-2xl font-bold ${warningCount > 0 ? 'text-[#F59E0B]' : 'text-[#10B981]'}`}>{warningCount}</p>
          <p className="mt-0.5 text-xs font-medium text-[#64748B]">Warnings</p>
        </div>
        <div className={`rounded-xl border p-4 ${infoCount > 0 ? 'border-blue-200 bg-[#EFF6FF]' : 'border-[#A7F3D0] bg-[#E7F8EE]'}`}>
          <p className={`text-2xl font-bold ${infoCount > 0 ? 'text-[#2563EB]' : 'text-[#10B981]'}`}>{infoCount}</p>
          <p className="mt-0.5 text-xs font-medium text-[#64748B]">Info</p>
        </div>
      </div>

      {/* ── All clear ──────────────────────────────────────────────────── */}
      {totalIssues === 0 && (
        <div className="rounded-xl border border-[#A7F3D0] bg-[#E7F8EE] px-6 py-8 text-center">
          <p className="text-2xl">✓</p>
          <p className="mt-2 text-base font-semibold text-[#15803D]">System is healthy</p>
          <p className="mt-1 text-sm text-[#10B981]">No operational issues detected.</p>
        </div>
      )}

      {/* ── Check sections ─────────────────────────────────────────────── */}
      {sections.map(section => (
        <CheckCard key={section.title} section={section} />
      ))}
    </div>
  )
}
