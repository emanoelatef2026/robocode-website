import { createServiceClient } from '@/lib/supabase/service'
import { requireAuth }         from '@/modules/rbac/guards'
import { redirect }            from 'next/navigation'
import Link                    from 'next/link'

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
  let inactiveTLs: IssueItem[] = []
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
      header: 'text-red-700',
      badge:  'bg-red-100 text-red-700',
      empty:  'bg-emerald-50 border-emerald-200 text-emerald-700',
    },
    warning: {
      header: 'text-amber-700',
      badge:  'bg-amber-100 text-amber-700',
      empty:  'bg-emerald-50 border-emerald-200 text-emerald-700',
    },
    info: {
      header: 'text-blue-700',
      badge:  'bg-blue-100 text-blue-700',
      empty:  'bg-blue-50 border-blue-200 text-blue-600',
    },
  }
  const dot: Record<Severity, string> = { critical: 'bg-red-500', warning: 'bg-amber-500', info: 'bg-blue-500' }
  const colors = severityColors[severity]

  if (items.length === 0) {
    return (
      <div className={`rounded-xl border p-4 ${colors.empty}`}>
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-emerald-400" />
          <p className="text-sm font-semibold">{title}</p>
          <span className="ml-auto rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-700">All clear</span>
        </div>
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-xl border border-[#E2E8F0] bg-white">
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

  const data = await getHealthData()

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
    healthScore >= 90 ? 'text-emerald-600' :
    healthScore >= 75 ? 'text-blue-600'    :
    healthScore >= 60 ? 'text-amber-600'   :
    'text-red-600'

  const scoreLabel =
    healthScore >= 90 ? 'Healthy' :
    healthScore >= 75 ? 'Good'    :
    healthScore >= 60 ? 'Watch'   :
    'Critical'

  return (
    <div className="max-w-4xl space-y-5">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-[#0B1F3A]">System Health</h1>
          <p className="mt-0.5 text-sm text-[#64748B]">Data integrity and operational gap report — all items are clickable</p>
        </div>
        <div className="flex items-center gap-2 text-right">
          {criticalCount > 0 && (
            <span className="rounded-full bg-red-100 px-2.5 py-1 text-xs font-semibold text-red-700">
              {criticalCount} critical
            </span>
          )}
          {warningCount > 0 && (
            <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-700">
              {warningCount} warnings
            </span>
          )}
          {infoCount > 0 && (
            <span className="rounded-full bg-blue-100 px-2.5 py-1 text-xs font-semibold text-blue-700">
              {infoCount} info
            </span>
          )}
        </div>
      </div>

      {/* ── Health Score ───────────────────────────────────────────────── */}
      <div className="rounded-xl border border-[#E2E8F0] bg-white p-5 flex items-center gap-6">
        <div className="text-center shrink-0">
          <p className={`text-5xl font-black ${scoreColor}`}>{healthScore}</p>
          <p className="text-xs font-semibold text-[#94A3B8] mt-1">/ 100</p>
        </div>
        <div className="flex-1">
          <p className={`text-lg font-bold ${scoreColor}`}>System {scoreLabel}</p>
          <div className="mt-2 h-2.5 rounded-full bg-[#F1F5F9] overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${healthScore >= 90 ? 'bg-emerald-500' : healthScore >= 75 ? 'bg-blue-500' : healthScore >= 60 ? 'bg-amber-500' : 'bg-red-500'}`}
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
        <div className={`rounded-xl border p-4 ${criticalCount > 0 ? 'border-red-200 bg-red-50' : 'border-emerald-200 bg-emerald-50'}`}>
          <p className={`text-2xl font-bold ${criticalCount > 0 ? 'text-red-600' : 'text-emerald-600'}`}>{criticalCount}</p>
          <p className="mt-0.5 text-xs font-medium text-[#64748B]">Critical Issues</p>
        </div>
        <div className={`rounded-xl border p-4 ${warningCount > 0 ? 'border-amber-200 bg-amber-50' : 'border-emerald-200 bg-emerald-50'}`}>
          <p className={`text-2xl font-bold ${warningCount > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>{warningCount}</p>
          <p className="mt-0.5 text-xs font-medium text-[#64748B]">Warnings</p>
        </div>
        <div className={`rounded-xl border p-4 ${infoCount > 0 ? 'border-blue-200 bg-blue-50' : 'border-emerald-200 bg-emerald-50'}`}>
          <p className={`text-2xl font-bold ${infoCount > 0 ? 'text-blue-600' : 'text-emerald-600'}`}>{infoCount}</p>
          <p className="mt-0.5 text-xs font-medium text-[#64748B]">Info</p>
        </div>
      </div>

      {/* ── All clear ──────────────────────────────────────────────────── */}
      {totalIssues === 0 && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-6 py-8 text-center">
          <p className="text-2xl">✓</p>
          <p className="mt-2 text-base font-semibold text-emerald-700">System is healthy</p>
          <p className="mt-1 text-sm text-emerald-600">No operational issues detected.</p>
        </div>
      )}

      {/* ── Check sections ─────────────────────────────────────────────── */}
      {sections.map(section => (
        <CheckCard key={section.title} section={section} />
      ))}
    </div>
  )
}
