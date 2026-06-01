/**
 * Super Admin: Sessions Monitor
 *
 * The Super Admin OBSERVES sessions — never records them.
 * Recording belongs to Instructors and Team Leaders.
 *
 * This page shows:
 *   - KPI overview (planned / completed / missing attendance / rate)
 *   - Filterable session table with per-session attendance %
 *   - Alerts: missing attendance, inactive groups, inactive instructors
 */

import { createServiceClient }  from '@/lib/supabase/service'
import { requirePermission }    from '@/modules/rbac/guards'
import { listBranches }         from '@/modules/branches/queries'
import { listGroups }           from '@/modules/groups/queries'
import AdminFilterSelect        from '@/components/admin/AdminFilterSelect'
import Pagination               from '@/components/admin/Pagination'
import Link                     from 'next/link'

// ── Types ─────────────────────────────────────────────────────────────────────

interface SessionRow {
  id:               string
  scheduled_at:     string
  duration_minutes: number | null
  status:           string
  topic:            string | null
  group_id:         string
  group_name:       string
  branch_name:      string
  instructor_name:  string | null
  total_enrolled:   number
  present_count:    number
  absent_count:     number
  attendance_pct:   number | null
  has_records:      boolean
  is_past:          boolean
}

interface SessionKPIs {
  planned:           number
  with_attendance:   number
  missing_att:       number
  cancelled:         number
  attendance_rate:   number | null
  students_absent:   number
  // Lifecycle-derived
  completion_rate:   number  // % of sessions that have attendance recorded
  avg_duration_min:  number | null
}

// ── Queries ───────────────────────────────────────────────────────────────────

async function getSessionKPIs(
  branchIds?: string[],
  dateFrom?:  string,
  dateTo?:    string
): Promise<SessionKPIs> {
  const db       = createServiceClient()
  const todayISO = new Date().toISOString()

  // Past + present sessions (not cancelled)
  let q = db.from('schedules')
    .select('id, status, duration_minutes, branch_id')
    .lte('scheduled_at', todayISO)

  if (branchIds?.length) q = q.in('branch_id', branchIds)
  if (dateFrom)          q = q.gte('scheduled_at', `${dateFrom}T00:00:00`)
  if (dateTo)            q = q.lte('scheduled_at', `${dateTo}T23:59:59`)

  const { data: allRows } = await q
  const allScheds    = (allRows ?? []) as any[]
  const cancelled    = allScheds.filter(s => s.status === 'cancelled').length
  const nonCancelled = allScheds.filter(s => s.status !== 'cancelled')
  const schedIds     = nonCancelled.map(s => s.id as string)

  if (schedIds.length === 0) {
    return { planned: 0, with_attendance: 0, missing_att: 0, cancelled, attendance_rate: null, students_absent: 0, completion_rate: 0, avg_duration_min: null }
  }

  // Attendance records
  const { data: attRows } = await db
    .from('attendance_records').select('schedule_id, status').in('schedule_id', schedIds)

  const withAtt    = new Set((attRows ?? []).map((r: any) => r.schedule_id as string))
  const missing    = schedIds.filter(id => !withAtt.has(id)).length
  const total      = (attRows ?? []).length
  const present    = (attRows ?? []).filter(r => (r as any).status === 'present' || (r as any).status === 'late').length
  const absent     = (attRows ?? []).filter(r => (r as any).status === 'absent').length
  const rate       = total > 0 ? Math.round((present / total) * 100) : null
  const completion = schedIds.length > 0 ? Math.round((withAtt.size / schedIds.length) * 100) : 0

  // Avg duration
  const durations   = nonCancelled.map(s => s.duration_minutes).filter((d): d is number => typeof d === 'number' && d > 0)
  const avgDuration = durations.length > 0 ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : null

  return {
    planned:          schedIds.length,
    with_attendance:  withAtt.size,
    missing_att:      missing,
    cancelled,
    attendance_rate:  rate,
    students_absent:  absent,
    completion_rate:  completion,
    avg_duration_min: avgDuration,
  }
}

async function listSessions({
  page = 1,
  perPage = 25,
  branchIds,
  groupId,
  dateFrom,
  dateTo,
  missingOnly = false,
}: {
  page?:        number
  perPage?:     number
  branchIds?:   string[]
  groupId?:     string
  dateFrom?:    string
  dateTo?:      string
  missingOnly?: boolean
}): Promise<{ data: SessionRow[]; total: number; page: number; perPage: number; totalPages: number }> {
  const db   = createServiceClient()
  const from = (page - 1) * perPage
  const to   = from + perPage - 1
  const now  = new Date().toISOString()

  let q = db
    .from('schedules')
    .select(
      `id, scheduled_at, duration_minutes, status, topic, branch_id,
       group_courses!schedules_group_course_id_fkey(
         group_id,
         instructor_id,
         groups!group_courses_group_id_fkey(id, name, branches!groups_branch_id_fkey(name)),
         instructors!group_courses_instructor_id_fkey(
           users!instructors_user_id_fkey(profiles!profiles_user_id_fkey(first_name, last_name))
         )
       )`,
      { count: 'exact' }
    )
    .neq('status', 'cancelled')
    .order('scheduled_at', { ascending: false })
    .range(from, to)

  if (branchIds?.length) q = q.in('branch_id', branchIds)
  if (dateFrom)          q = q.gte('scheduled_at', `${dateFrom}T00:00:00`)
  if (dateTo)            q = q.lte('scheduled_at', `${dateTo}T23:59:59`)
  if (groupId) {
    const { data: gcIds } = await db.from('group_courses').select('id').eq('group_id', groupId).eq('status', 'active')
    const ids = (gcIds ?? []).map((r: any) => r.id as string)
    if (ids.length > 0) q = q.in('group_course_id', ids)
    else return { data: [], total: 0, page, perPage, totalPages: 0 }
  }

  const { data: rows, count, error } = await q
  if (error) throw new Error(error.message)

  const schedIds  = (rows ?? []).map((r: any) => r.id as string)
  const attMap: Record<string, { present: number; absent: number; late: number; total: number }> = {}
  if (schedIds.length > 0) {
    const { data: attRows } = await db
      .from('attendance_records').select('schedule_id, status').in('schedule_id', schedIds)
    for (const r of attRows ?? []) {
      const sid = (r as any).schedule_id as string
      if (!attMap[sid]) attMap[sid] = { present: 0, absent: 0, late: 0, total: 0 }
      attMap[sid].total++
      if ((r as any).status === 'present')     attMap[sid].present++
      else if ((r as any).status === 'absent') attMap[sid].absent++
      else if ((r as any).status === 'late')   attMap[sid].late++
    }
  }

  let sessions: SessionRow[] = (rows ?? []).map((r: any) => {
    const gc   = r.group_courses
    const grp  = gc?.groups
    const inst = gc?.instructors?.users?.profiles
    const att  = attMap[r.id] ?? { present: 0, absent: 0, late: 0, total: 0 }
    const pct  = att.total > 0 ? Math.round(((att.present + att.late) / att.total) * 100) : null
    const past = new Date(r.scheduled_at) < new Date()

    return {
      id:               r.id,
      scheduled_at:     r.scheduled_at,
      duration_minutes: r.duration_minutes ?? null,
      status:           r.status,
      topic:            r.topic ?? null,
      group_id:         grp?.id ?? '',
      group_name:       grp?.name ?? '—',
      branch_name:      grp?.branches?.name ?? r.branch_id ?? '—',
      instructor_name:  inst ? [inst.first_name, inst.last_name].filter(Boolean).join(' ') || null : null,
      total_enrolled:   att.total,
      present_count:    att.present + att.late,
      absent_count:     att.absent,
      attendance_pct:   pct,
      has_records:      att.total > 0,
      is_past:          past,
    }
  })

  if (missingOnly) {
    sessions = sessions.filter(s => s.is_past && !s.has_records)
  }

  return { data: sessions, total: count ?? 0, page, perPage, totalPages: Math.ceil((count ?? 0) / perPage) }
}

// ── Alerts ────────────────────────────────────────────────────────────────────

async function getAttendanceAlerts(branchIds?: string[]) {
  const db          = createServiceClient()
  const twoWeeksAgo = new Date(Date.now() - 14 * 86400000).toISOString()
  const now         = new Date().toISOString()

  // Past sessions missing attendance
  let missQ = db.from('schedules')
    .select('id')
    .neq('status', 'cancelled')
    .lte('scheduled_at', now)
    .gte('scheduled_at', twoWeeksAgo)
  if (branchIds?.length) missQ = missQ.in('branch_id', branchIds)
  const { data: recentScheds } = await missQ
  const recentIds = (recentScheds ?? []).map((s: any) => s.id as string)
  let missingSessions = 0
  if (recentIds.length > 0) {
    const { data: attRows } = await db.from('attendance_records').select('schedule_id').in('schedule_id', recentIds)
    const withAtt   = new Set((attRows ?? []).map((r: any) => r.schedule_id as string))
    missingSessions = recentIds.filter(id => !withAtt.has(id)).length
  }

  // Active groups with no session in 14 days
  let groupQ = db.from('groups').select('id, name').eq('status', 'active').is('deleted_at', null)
  if (branchIds?.length) groupQ = groupQ.in('branch_id', branchIds)
  const { data: activeGroups } = await groupQ
  const activeGroupIds = (activeGroups ?? []).map((g: any) => g.id as string)
  let inactiveGroups = 0
  if (activeGroupIds.length > 0) {
    const { data: gcRows } = await db.from('group_courses').select('id, group_id').in('group_id', activeGroupIds).eq('status', 'active')
    const gcIds       = (gcRows ?? []).map((r: any) => r.id as string)
    const gcGroupMap  = Object.fromEntries((gcRows ?? []).map((r: any) => [r.id as string, r.group_id as string]))
    if (gcIds.length > 0) {
      const { data: recentGrpScheds } = await db.from('schedules').select('group_course_id').in('group_course_id', gcIds).gte('scheduled_at', twoWeeksAgo).neq('status', 'cancelled')
      const activeGcSet = new Set((recentGrpScheds ?? []).map((s: any) => s.group_course_id as string))
      inactiveGroups = gcIds.filter(gcId => !activeGcSet.has(gcId)).length
    }
  }

  return { missingSessions, inactiveGroups }
}

// ── UI Components ─────────────────────────────────────────────────────────────

function KPICard({ label, value, sub, alert = false }: { label: string; value: string | number; sub?: string; alert?: boolean }) {
  return (
    <div className={`rounded-xl border p-4 bg-white ${alert && value !== 0 && value !== '—' ? 'border-red-200' : 'border-[#E2E8F0]'}`}>
      <p className={`text-2xl font-bold ${alert && value !== 0 && value !== '—' ? 'text-red-600' : 'text-[#0B1F3A]'}`}>{value}</p>
      <p className="mt-0.5 text-xs text-[#64748B]">{label}</p>
      {sub && <p className="mt-1 text-[11px] text-[#94A3B8]">{sub}</p>}
    </div>
  )
}

function AttPill({ pct, hasRecords }: { pct: number | null; hasRecords: boolean }) {
  if (!hasRecords) return <span className="inline-block rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500">No records</span>
  if (pct === null) return <span className="text-xs text-[#94A3B8]">—</span>
  const cls = pct >= 80 ? 'bg-emerald-100 text-emerald-700' : pct >= 60 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
  return <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ${cls}`}>{pct}%</span>
}

// ── Page ──────────────────────────────────────────────────────────────────────

interface Props {
  searchParams: Promise<{
    page?:    string
    branch?:  string
    group?:   string
    from?:    string
    to?:      string
    missing?: string
  }>
}

export default async function AttendanceMonitorPage({ searchParams }: Props) {
  const user   = await requirePermission('manage_attendance')
  const params = await searchParams

  const isSuperAdmin = user.globalRole === 'super_admin'
  const branchScope  = isSuperAdmin ? undefined : (user.branchIds.length > 0 ? user.branchIds : undefined)

  const page        = Number(params.page ?? 1)
  const branchParam = params.branch
  const groupParam  = params.group
  const dateFrom    = params.from
  const dateTo      = params.to
  const missingOnly = params.missing === '1'

  const effectiveBranchIds = branchParam ? [branchParam] : branchScope

  const [result, kpis, alerts, branchesRes, groupsRes] = await Promise.all([
    listSessions({ page, perPage: 25, branchIds: effectiveBranchIds, groupId: groupParam, dateFrom, dateTo, missingOnly }),
    getSessionKPIs(effectiveBranchIds, dateFrom, dateTo),
    getAttendanceAlerts(effectiveBranchIds),
    listBranches({ perPage: 100 }),
    listGroups({ perPage: 200, branchId: effectiveBranchIds }),
  ])

  return (
    <div>
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-[#0B1F3A]">Sessions Monitor</h1>
          <p className="mt-0.5 text-sm text-[#64748B]">
            Operational visibility into all sessions and attendance quality
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0] px-3 py-2 text-xs text-[#64748B]">
          <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5 text-[#94A3B8]">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
          </svg>
          Recording is done by Instructors & Team Leaders
        </div>
      </div>

      {/* ── Alerts ─────────────────────────────────────────────────────── */}
      {(alerts.missingSessions > 0 || alerts.inactiveGroups > 0) && (
        <div className="mb-5 space-y-2">
          {alerts.missingSessions > 0 && (
            <div className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
              <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 shrink-0"><path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" /></svg>
              {alerts.missingSessions} session{alerts.missingSessions !== 1 ? 's' : ''} held in the last 14 days with no attendance recorded
              <Link href="?missing=1" className="ml-auto text-xs underline">Show →</Link>
            </div>
          )}
          {alerts.inactiveGroups > 0 && (
            <div className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-700">
              <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 shrink-0"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" /></svg>
              {alerts.inactiveGroups} active group{alerts.inactiveGroups !== 1 ? 's' : ''} with no session in 14+ days
              <Link href="/admin/system-health" className="ml-auto text-xs underline">System Health →</Link>
            </div>
          )}
        </div>
      )}

      {/* ── KPIs — Lifecycle ──────────────────────────────────────────── */}
      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-7">
        <KPICard label="Sessions"             value={kpis.planned} />
        <KPICard label="With Attendance"      value={kpis.with_attendance} />
        <KPICard label="Missing Attendance"   value={kpis.missing_att} alert sub="Past sessions only" />
        <KPICard label="Cancelled"            value={kpis.cancelled} />
        <KPICard label="Completion Rate"      value={`${kpis.completion_rate}%`}
          sub="sessions with records" />
        <KPICard label="Attendance Rate"      value={kpis.attendance_rate !== null ? `${kpis.attendance_rate}%` : '—'} />
        <KPICard label="Avg Duration"         value={kpis.avg_duration_min !== null ? `${kpis.avg_duration_min}m` : '—'} />
      </div>

      {/* ── Filters ────────────────────────────────────────────────────── */}
      <div className="mb-4 rounded-xl border border-[#E2E8F0] bg-white">
        <div className="flex flex-wrap items-center gap-2 px-4 py-3">
          {isSuperAdmin && (
            <AdminFilterSelect param="branch" placeholder="All branches"
              options={branchesRes.data.map(b => ({ value: b.id, label: b.name }))} />
          )}
          <AdminFilterSelect param="group" placeholder="All groups"
            options={groupsRes.data.map(g => ({ value: g.id, label: g.name }))} />

          <label className="flex items-center gap-1.5 text-xs text-[#64748B]">
            From
            <span className="rounded border border-[#E2E8F0] px-2 py-1.5 text-xs text-[#0B1F3A]">{dateFrom ?? 'start'}</span>
          </label>
          <label className="flex items-center gap-1.5 text-xs text-[#64748B]">
            To
            <span className="rounded border border-[#E2E8F0] px-2 py-1.5 text-xs text-[#0B1F3A]">{dateTo ?? 'now'}</span>
          </label>

          <Link
            href={missingOnly ? '/admin/attendance' : '/admin/attendance?missing=1'}
            className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
              missingOnly ? 'border-red-300 bg-red-50 text-red-700' : 'border-[#E2E8F0] text-[#64748B] hover:border-red-300 hover:text-red-600'
            }`}
          >
            {missingOnly ? '✕ Missing only' : 'Show missing only'}
          </Link>
        </div>
      </div>

      {/* ── Session table ──────────────────────────────────────────────── */}
      <div className="rounded-xl border border-[#E2E8F0] bg-white">
        {result.data.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
            <p className="text-sm font-medium text-[#0B1F3A]">No sessions found</p>
            <p className="mt-1 text-xs text-[#94A3B8]">
              {missingOnly ? 'All sessions have attendance recorded. Well done.' : 'Sessions appear here once scheduled.'}
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                    <th className="px-4 py-3 text-left text-xs font-medium text-[#64748B]">Date & Time</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-[#64748B]">Group</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-[#64748B]">Instructor</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-[#64748B]">Branch</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-[#64748B]">Present</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-[#64748B]">Absent</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-[#64748B]">Rate</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-[#64748B]">Topic</th>
                  </tr>
                </thead>
                <tbody>
                  {result.data.map(s => {
                    const isMissing = s.is_past && !s.has_records
                    return (
                      <tr
                        key={s.id}
                        className={`border-b border-[#E2E8F0] last:border-0 ${isMissing ? 'bg-red-50/40 hover:bg-red-50' : 'hover:bg-[#F8FAFC]'}`}
                      >
                        <td className="px-4 py-3">
                          <div className="font-medium text-[#0B1F3A]">
                            {new Date(s.scheduled_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                          </div>
                          <div className="text-[11px] text-[#94A3B8]">
                            {new Date(s.scheduled_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                            {s.duration_minutes ? ` · ${s.duration_minutes}m` : ''}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <Link href={`/admin/groups/${s.group_id}`} className="font-medium text-[#0B1F3A] hover:text-[#FF8A1F]">
                            {s.group_name}
                          </Link>
                        </td>
                        <td className="px-4 py-3 text-[#64748B]">{s.instructor_name ?? '—'}</td>
                        <td className="px-4 py-3 text-[#64748B]">{s.branch_name}</td>
                        <td className="px-4 py-3 text-center font-medium text-emerald-700">
                          {s.has_records ? s.present_count : '—'}
                        </td>
                        <td className="px-4 py-3 text-center font-medium text-red-600">
                          {s.has_records ? s.absent_count : '—'}
                        </td>
                        <td className="px-4 py-3">
                          <AttPill pct={s.attendance_pct} hasRecords={s.has_records} />
                          {isMissing && <span className="ml-1.5 text-[10px] font-semibold text-red-500">Missing!</span>}
                        </td>
                        <td className="px-4 py-3 text-xs text-[#64748B]">
                          {s.topic ? <span className="max-w-25 truncate block" title={s.topic}>{s.topic}</span> : '—'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <Pagination page={result.page} totalPages={result.totalPages} total={result.total} perPage={result.perPage} />
          </>
        )}
      </div>
    </div>
  )
}
