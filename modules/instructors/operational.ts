import 'server-only'
import { createServiceClient } from '@/lib/supabase/service'
import type {
  InstructorOperationalRow,
  FullInstructor,
  InstructorGroupDetail,
  InstructorStudentRow,
  InstructorSessionRow,
  InstructorAttendanceStats,
  InstructorPerformanceMetrics,
  InstructorFinanceSummary,
  InstructorNote,
  InstructorCertification,
  InstructorDetailData,
  InstructorFormOptions,
} from './types'

// ── Local raw DB row types (replaces `any` casts on Supabase results) ─────────

interface RawBranch   { name: string }
interface RawProfile  { first_name: string | null; last_name: string | null }
interface RawUserJoin { email: string; phone: string | null; profiles: RawProfile | null }

interface RawInstructorRow {
  id: string; user_id: string; branch_id: string
  employee_id: string | null; hire_date: string | null
  instructor_code: string | null; status: string
  specializations: string[] | null; salary_per_session: number | null
  bio: string | null; alt_phone: string | null
  instagram_url: string | null; facebook_url: string | null
  whatsapp_number: string | null; currency: string | null
  wallet_number: string | null; bank_account_number: string | null
  instapay_number: string | null; payment_notes: string | null
  working_days: string[] | null; max_weekly_load: number | null
  internal_notes: string | null; created_at: string; updated_at: string
  users: RawUserJoin | null; branches: RawBranch | null
}

interface RawGroupMeta {
  id: string; name: string; code: string | null; type: string
  status: string; branch_id: string; capacity: number | null
  branches: RawBranch | null
}
interface RawGiRow  { group_id: string; role: string | null; groups: RawGroupMeta | null }
interface RawGcRow  { id: string; group_id: string; instructor_id: string | null; status: string; groups: RawGroupMeta | null; courses: { id: string; title: string } | null }
interface RawIbRow  { instructor_id: string; branch_id: string; branches: RawBranch | null }
interface RawGcIdRow { id: string; instructor_id: string | null; group_id: string }
interface RawGiIdRow { instructor_id: string; group_id: string }
interface RawGsIdRow { group_id: string }
interface RawSchedRow { id: string; group_course_id: string; status: string; scheduled_at: string; duration_minutes: number | null; topic: string | null }
interface RawGsFullRow { group_id: string; student_id: string; students: RawStudentMeta | null }
interface RawStudentMeta { id: string; user_id: string; users: { email: string; profiles: RawProfile | null } | null }
interface RawEnrollRow { student_id: string; status: string; total_amount: number | null; paid_amount: number | null; remaining_sessions: number | null }
interface RawNoteRow { id: string; content: string; category: string; author_id: string; created_at: string; updated_at: string; users: { profiles: RawProfile | null } | null }
interface RawCertRow { id: string; certification: string; level: string | null; status: string; issued_at: string | null; expires_at: string | null; notes: string | null; created_at: string; updated_at: string }
interface RawBranchRow { id: string; name: string }
interface RawGroupFormRow { id: string; name: string; code: string | null; branch_id: string; status: string; capacity: number | null; branches: RawBranch | null; group_instructors: { instructor_id: string }[] | null }
interface RawVisibilityRow { id?: string; instructor_id?: string }
interface RawCrossRow { instructor_id: string | null; groups: { branch_id: string } | null }
interface RawAttendanceRow { schedule_id: string }

// ── helpers ───────────────────────────────────────────────────────────────────

function computeHealthScore(
  attendanceCompliance: number,
  activeGroups: number,
  atRiskStudents: number,
  totalStudents: number,
): number {
  const attendanceScore = attendanceCompliance
  const groupScore      = activeGroups > 0 ? 100 : 30
  const riskPenalty     = totalStudents > 0
    ? Math.min(40, (atRiskStudents / totalStudents) * 60)
    : 0
  const raw = attendanceScore * 0.55 + groupScore * 0.25 - riskPenalty * 0.20
  return Math.round(Math.max(0, Math.min(100, raw)))
}

function healthLabel(score: number): 'Excellent' | 'Good' | 'Warning' | 'Critical' {
  if (score >= 80) return 'Excellent'
  if (score >= 60) return 'Good'
  if (score >= 40) return 'Warning'
  return 'Critical'
}

function groupHealth(attendanceRate: number): 'excellent' | 'good' | 'warning' | 'critical' {
  if (attendanceRate >= 80) return 'excellent'
  if (attendanceRate >= 60) return 'good'
  if (attendanceRate >= 40) return 'warning'
  return 'critical'
}

function resolveInstructorGroups(giRows: RawGiRow[], gcRows: RawGcRow[]): {
  groupIds: string[]
  roleMap: Record<string, 'lead' | 'assistant'>
  gcIdMap: Record<string, string>
} {
  const roleMap: Record<string, 'lead' | 'assistant'> = {}
  const gcIdMap: Record<string, string> = {}
  const groupIds = new Set<string>()

  for (const r of giRows ?? []) {
    if (r.group_id) {
      groupIds.add(r.group_id)
      roleMap[r.group_id] = (r.role as 'lead' | 'assistant') ?? 'lead'
    }
  }
  for (const r of gcRows ?? []) {
    if (r.group_id) {
      groupIds.add(r.group_id)
      if (!roleMap[r.group_id]) roleMap[r.group_id] = 'lead'
      gcIdMap[r.group_id] = r.id
    }
  }
  return { groupIds: [...groupIds], roleMap, gcIdMap }
}

// ── listInstructorsOperational ────────────────────────────────────────────────

export async function listInstructorsOperational(
  branchIds: string[],
): Promise<InstructorOperationalRow[]> {
  const db = createServiceClient()

  let query = db
    .from('instructors')
    .select(
      `id, user_id, branch_id, employee_id, hire_date, instructor_code, status, specializations,
       salary_per_session, created_at,
       users!instructors_user_id_fkey(email, phone, profiles!profiles_user_id_fkey(first_name, last_name)),
       branches!instructors_branch_id_fkey(name)`
    )
    .is('deleted_at', null)
    .order('created_at', { ascending: false })

  if (branchIds.length > 0) {
    const [homeRes, ibRes, gcCrossRes] = await Promise.all([
      db.from('instructors').select('id').in('branch_id', branchIds).is('deleted_at', null),
      db.from('instructor_branches').select('instructor_id').in('branch_id', branchIds),
      db.from('group_courses')
        .select('instructor_id, groups!group_courses_group_id_fkey(branch_id)')
        .eq('status', 'active')
        .not('instructor_id', 'is', null),
    ])
    const ids = new Set<string>()
    for (const r of (homeRes.data ?? []) as unknown as RawVisibilityRow[])    ids.add(r.id ?? '')
    for (const r of (ibRes.data ?? []) as unknown as RawVisibilityRow[])      ids.add(r.instructor_id ?? '')
    for (const r of (gcCrossRes.data ?? []) as unknown as RawCrossRow[]) {
      if (r.groups?.branch_id && branchIds.includes(r.groups.branch_id) && r.instructor_id)
        ids.add(r.instructor_id)
    }
    ids.delete('')
    if (ids.size === 0) return []
    query = query.in('id', [...ids])
  }

  const { data, error } = await query
  if (error) throw new Error(error.message)

  const rows: InstructorOperationalRow[] = ((data ?? []) as unknown as RawInstructorRow[]).map(row => ({
    id:                   row.id,
    user_id:              row.user_id,
    branch_id:            row.branch_id,
    branch_name:          row.branches?.name ?? '',
    branch_ids:           [row.branch_id].filter(Boolean),
    branch_names:         row.branches?.name ? [row.branches.name] : [],
    employee_id:          row.employee_id ?? null,
    hire_date:            row.hire_date ?? null,
    instructor_code:      row.instructor_code ?? null,
    status:               row.status as InstructorOperationalRow['status'],
    specializations:      row.specializations ?? [],
    user_email:           row.users?.email ?? '',
    first_name:           row.users?.profiles?.first_name ?? null,
    last_name:            row.users?.profiles?.last_name ?? null,
    phone:                row.users?.phone ?? null,
    salary_per_session:   row.salary_per_session ?? null,
    created_at:           row.created_at,
    group_count:          0,
    student_count:        0,
    health_score:         0,
    attendance_compliance: 0,
    today_sessions_count: 0,
  }))

  if (rows.length === 0) return rows

  const ids = rows.map(r => r.id)

  // Batch fetch: instructor_branches, group_courses, group_instructors
  const [ibAll, gcRes, giRes] = await Promise.all([
    db.from('instructor_branches')
      .select('instructor_id, branch_id, branches!instructor_branches_branch_id_fkey(name)')
      .in('instructor_id', ids),
    db.from('group_courses')
      .select('id, instructor_id, group_id')
      .in('instructor_id', ids)
      .eq('status', 'active')
      .not('instructor_id', 'is', null),
    db.from('group_instructors')
      .select('instructor_id, group_id')
      .in('instructor_id', ids),
  ])

  // Populate branch_ids / branch_names from instructor_branches
  const branchIdsByInstr: Record<string, string[]>  = {}
  const branchNamesByInstr: Record<string, string[]> = {}
  for (const r of (ibAll.data ?? []) as unknown as RawIbRow[]) {
    const iid   = r.instructor_id
    const bid   = r.branch_id
    const bname = r.branches?.name ?? ''
    if (!branchIdsByInstr[iid]) { branchIdsByInstr[iid] = []; branchNamesByInstr[iid] = [] }
    if (!branchIdsByInstr[iid].includes(bid)) {
      branchIdsByInstr[iid].push(bid)
      branchNamesByInstr[iid].push(bname)
    }
  }

  // group_id sets per instructor
  const groupIdsByInstructor: Record<string, Set<string>> = {}
  const gcIdsByInstructor: Record<string, string[]> = {}
  for (const r of (gcRes.data ?? []) as unknown as RawGcIdRow[]) {
    const iid  = r.instructor_id ?? ''
    const gid  = r.group_id
    const gcid = r.id
    if (!iid) continue
    if (!groupIdsByInstructor[iid]) groupIdsByInstructor[iid] = new Set()
    groupIdsByInstructor[iid].add(gid)
    if (!gcIdsByInstructor[iid]) gcIdsByInstructor[iid] = []
    gcIdsByInstructor[iid].push(gcid)
  }
  for (const r of (giRes.data ?? []) as unknown as RawGiIdRow[]) {
    const iid = r.instructor_id
    const gid = r.group_id
    if (!groupIdsByInstructor[iid]) groupIdsByInstructor[iid] = new Set()
    groupIdsByInstructor[iid].add(gid)
  }

  const allGroupIds = new Set<string>()
  for (const gids of Object.values(groupIdsByInstructor)) gids.forEach(g => allGroupIds.add(g))

  // Batch student counts via group_students
  const studentCountByGroup: Record<string, number> = {}
  if (allGroupIds.size > 0) {
    const { data: gsData } = await db
      .from('group_students')
      .select('group_id')
      .in('group_id', [...allGroupIds])
      .eq('status', 'active')
    for (const r of (gsData ?? []) as unknown as RawGsIdRow[]) {
      studentCountByGroup[r.group_id] = (studentCountByGroup[r.group_id] ?? 0) + 1
    }
  }

  // Today sessions count
  const allGcIds = ((gcRes.data ?? []) as unknown as RawGcIdRow[]).map(r => r.id)
  const todaySessionsByInstructor: Record<string, number> = {}
  if (allGcIds.length > 0) {
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0)
    const todayEnd   = new Date(); todayEnd.setHours(23, 59, 59, 999)

    const { data: todaySched } = await db
      .from('schedules')
      .select('group_course_id')
      .in('group_course_id', allGcIds)
      .gte('scheduled_at', todayStart.toISOString())
      .lte('scheduled_at', todayEnd.toISOString())
      .neq('status', 'cancelled')

    const instrByGcId: Record<string, string> = {}
    for (const r of (gcRes.data ?? []) as unknown as RawGcIdRow[]) {
      instrByGcId[r.id] = r.instructor_id ?? ''
    }

    for (const s of (todaySched ?? []) as { group_course_id: string }[]) {
      const gcid = s.group_course_id
      const iid  = instrByGcId[gcid]
      if (iid) todaySessionsByInstructor[iid] = (todaySessionsByInstructor[iid] ?? 0) + 1
    }
  }

  // Populate rows
  for (const row of rows) {
    if (branchIdsByInstr[row.id]?.length) {
      row.branch_ids   = branchIdsByInstr[row.id]
      row.branch_names = branchNamesByInstr[row.id]
    }

    const gids = groupIdsByInstructor[row.id] ?? new Set<string>()
    row.group_count   = gids.size
    row.student_count = [...gids].reduce((sum, gid) => sum + (studentCountByGroup[gid] ?? 0), 0)

    const isActive = row.status === 'active'
    const gc = row.group_count
    row.health_score = isActive ? (gc >= 3 ? 90 : gc >= 1 ? 75 : 50) : 30
    row.attendance_compliance = 0

    row.today_sessions_count = todaySessionsByInstructor[row.id] ?? 0
  }

  return rows
}

// ── getInstructorDetailData ───────────────────────────────────────────────────

export async function getInstructorDetailData(instructorId: string): Promise<InstructorDetailData | null> {
  const db = createServiceClient()

  const { data: instrRaw, error: instrError } = await db
    .from('instructors')
    .select(
      `id, user_id, branch_id, employee_id, hire_date, instructor_code, status, specializations,
       bio, alt_phone, instagram_url, facebook_url, whatsapp_number,
       salary_per_session, currency, wallet_number, bank_account_number,
       instapay_number, payment_notes, working_days, max_weekly_load, internal_notes,
       created_at, updated_at,
       users!instructors_user_id_fkey(email, phone, profiles!profiles_user_id_fkey(first_name, last_name)),
       branches!instructors_branch_id_fkey(name)`
    )
    .eq('id', instructorId)
    .is('deleted_at', null)
    .single()

  if (instrError) {
    console.error('[getInstructorDetailData] instructor fetch failed:', instrError.message, instrError.details ?? '', { instructorId })
    return null
  }
  if (!instrRaw) return null
  const instrRow = instrRaw as unknown as RawInstructorRow

  // Fetch instructor_branches for multi-branch data
  const { data: ibData, error: ibError } = await db
    .from('instructor_branches')
    .select('branch_id, branches!instructor_branches_branch_id_fkey(name)')
    .eq('instructor_id', instructorId)
  if (ibError) console.error('[getInstructorDetailData] instructor_branches fetch failed:', ibError.message, { instructorId })

  const branch_ids:   string[] = []
  const branch_names: string[] = []
  for (const r of (ibData ?? []) as unknown as { branch_id: string; branches: RawBranch | null }[]) {
    branch_ids.push(r.branch_id)
    branch_names.push(r.branches?.name ?? '')
  }
  if (branch_ids.length === 0 && instrRow.branch_id) {
    branch_ids.push(instrRow.branch_id)
    branch_names.push(instrRow.branches?.name ?? '')
  }

  const instructor: FullInstructor = {
    id:                 instrRow.id,
    user_id:            instrRow.user_id,
    branch_id:          instrRow.branch_id,
    branch_name:        instrRow.branches?.name ?? '',
    branch_ids,
    branch_names,
    employee_id:        instrRow.employee_id ?? null,
    hire_date:          instrRow.hire_date ?? null,
    instructor_code:    instrRow.instructor_code ?? null,
    status:             instrRow.status as FullInstructor['status'],
    specializations:    instrRow.specializations ?? [],
    user_email:         instrRow.users?.email ?? '',
    first_name:         instrRow.users?.profiles?.first_name ?? null,
    last_name:          instrRow.users?.profiles?.last_name ?? null,
    phone:              instrRow.users?.phone ?? null,
    alt_phone:          instrRow.alt_phone ?? null,
    bio:                instrRow.bio ?? null,
    instagram_url:      instrRow.instagram_url ?? null,
    facebook_url:       instrRow.facebook_url ?? null,
    whatsapp_number:    instrRow.whatsapp_number ?? null,
    salary_per_session: instrRow.salary_per_session ?? null,
    currency:           instrRow.currency ?? 'EGP',
    wallet_number:      instrRow.wallet_number ?? null,
    instapay_number:    instrRow.instapay_number ?? null,
    payment_notes:      instrRow.payment_notes ?? null,
    working_days:       instrRow.working_days ?? [],
    max_weekly_load:    instrRow.max_weekly_load ?? null,
    internal_notes:     instrRow.internal_notes ?? null,
    created_at:         instrRow.created_at,
    updated_at:         instrRow.updated_at,
  }

  // 2. Fetch groups
  const [giRes, gcRes] = await Promise.all([
    db.from('group_instructors')
      .select('group_id, role, groups!group_instructors_group_id_fkey(id,name,code,type,status,branch_id,capacity,branches!groups_branch_id_fkey(name))')
      .eq('instructor_id', instructorId),
    db.from('group_courses')
      .select('id, group_id, course_id, status, groups!group_courses_group_id_fkey(id,name,code,type,status,branch_id,capacity,branches!groups_branch_id_fkey(name)), courses!group_courses_course_id_fkey(id,title)')
      .eq('instructor_id', instructorId)
      .eq('status', 'active'),
  ])

  if (giRes.error) console.error('[getInstructorDetailData] group_instructors fetch failed:', giRes.error.message, { instructorId })
  if (gcRes.error) console.error('[getInstructorDetailData] group_courses fetch failed:', gcRes.error.message, { instructorId })

  const giRows = (giRes.data ?? []) as unknown as RawGiRow[]
  const gcRows = (gcRes.data ?? []) as unknown as RawGcRow[]

  const { groupIds, roleMap, gcIdMap } = resolveInstructorGroups(giRows, gcRows)

  // Build group meta map
  type GroupMeta = RawGroupMeta & { branch_name: string; course_id: string | null; course_name: string | null; gc_id?: string }
  const groupMetaMap: Record<string, GroupMeta> = {}
  for (const r of giRows) {
    const g = r.groups
    if (g) groupMetaMap[g.id] = { ...g, branch_name: g.branches?.name ?? '', course_id: null, course_name: null }
  }
  for (const r of gcRows) {
    const g = r.groups
    const c = r.courses
    if (g) {
      groupMetaMap[g.id] = {
        ...g,
        branch_name: g.branches?.name ?? '',
        course_id:   c?.id ?? null,
        course_name: c?.title ?? null,
        gc_id:       r.id,
      }
    }
  }

  if (groupIds.length === 0) {
    const [certRes, notesRes] = await Promise.all([
      db.from('instructor_certifications').select('*').eq('instructor_id', instructorId).order('created_at', { ascending: false }),
      db.from('instructor_notes').select('id, content, category, author_id, created_at, updated_at, users!instructor_notes_author_id_fkey(profiles!profiles_user_id_fkey(first_name,last_name))').eq('instructor_id', instructorId).order('created_at', { ascending: false }),
    ])

    const certifications: InstructorCertification[] = ((certRes.data ?? []) as unknown as RawCertRow[]).map(r => ({
      id: r.id, instructor_id: instructorId, certification: r.certification,
      level: r.level, status: r.status, issued_at: r.issued_at, expires_at: r.expires_at,
      notes: r.notes, created_at: r.created_at, updated_at: r.updated_at,
    }))
    const notes: InstructorNote[] = ((notesRes.data ?? []) as unknown as RawNoteRow[]).map(r => ({
      id: r.id, content: r.content, category: r.category, author_id: r.author_id,
      author_name: r.users?.profiles
        ? `${r.users.profiles.first_name ?? ''} ${r.users.profiles.last_name ?? ''}`.trim() || null
        : null,
      created_at: r.created_at, updated_at: r.updated_at,
    }))
    const emptyPerf: InstructorPerformanceMetrics = {
      health_score: 30, health_label: 'Warning',
      attendance_compliance: 0, active_groups: 0, total_students: 0,
      low_attendance_groups: 0, at_risk_students: 0, group_count: 0,
    }
    return {
      instructor, groups: [], sessions: [], students: [],
      attendance_stats: { total_sessions: 0, sessions_completed: 0, sessions_with_attendance: 0, compliance_rate: 0, sessions_missing_attendance: 0 },
      performance: emptyPerf,
      finance: { total_revenue: 0, students_with_balance: 0, students_overdue: 0, total_outstanding: 0, active_contracts: 0 },
      notes, certifications,
    }
  }

  // 3. Fetch group details in parallel
  const gcIds = Object.values(gcIdMap)
  const sevenDaysAgo       = new Date(Date.now() - 7  * 86400000).toISOString()
  const twentyOneDaysAhead = new Date(Date.now() + 21 * 86400000).toISOString()

  const [gsRes, sessionRes, certRes, notesRes] = await Promise.all([
    db.from('group_students')
      .select('group_id, student_id, students!group_students_student_id_fkey(id,user_id,users!students_user_id_fkey(email,profiles!profiles_user_id_fkey(first_name,last_name)))')
      .in('group_id', groupIds)
      .eq('status', 'active'),
    gcIds.length > 0
      ? db.from('schedules')
        .select('id, group_course_id, status, scheduled_at, duration_minutes, topic')
        .in('group_course_id', gcIds)
        .order('scheduled_at', { ascending: true })
      : Promise.resolve({ data: [] as RawSchedRow[] }),
    db.from('instructor_certifications').select('*').eq('instructor_id', instructorId).order('created_at', { ascending: false }),
    db.from('instructor_notes').select('id, content, category, author_id, created_at, updated_at, users!instructor_notes_author_id_fkey(profiles!profiles_user_id_fkey(first_name,last_name))').eq('instructor_id', instructorId).order('created_at', { ascending: false }),
  ])

  // 4. Build group student maps
  const studentsByGroup: Record<string, RawStudentMeta[]> = {}
  for (const r of (gsRes.data ?? []) as unknown as RawGsFullRow[]) {
    const gid = r.group_id
    if (!studentsByGroup[gid]) studentsByGroup[gid] = []
    if (r.students) studentsByGroup[gid].push(r.students)
  }

  // 5. Build session stats per gc_id → group_id
  const gcToGroup: Record<string, string> = {}
  for (const [gid, gcId] of Object.entries(gcIdMap)) gcToGroup[gcId] = gid

  const sessionsByGroup: Record<string, { total: number; completed: number }> = {}
  const sessionData = (sessionRes as { data: RawSchedRow[] | null }).data ?? []
  for (const s of sessionData) {
    const gid = gcToGroup[s.group_course_id]
    if (!gid) continue
    if (!sessionsByGroup[gid]) sessionsByGroup[gid] = { total: 0, completed: 0 }
    sessionsByGroup[gid].total++
    if (s.status === 'completed') sessionsByGroup[gid].completed++
  }

  // 6. Attendance records for completed sessions
  const completedScheduleIds = sessionData
    .filter(s => s.status === 'completed')
    .map(s => s.id)

  const attendedScheduleIds = new Set<string>()
  if (completedScheduleIds.length > 0) {
    const { data: arData } = await db
      .from('attendance_records')
      .select('schedule_id')
      .in('schedule_id', completedScheduleIds)
    for (const r of (arData ?? []) as RawAttendanceRow[]) attendedScheduleIds.add(r.schedule_id)
  }

  // Attendance compliance per group
  const attendanceRateByGroup: Record<string, number> = {}
  for (const [gid, stats] of Object.entries(sessionsByGroup)) {
    if (stats.completed === 0) { attendanceRateByGroup[gid] = 100; continue }
    const gcId = gcIdMap[gid]
    const completedForGroup = sessionData.filter(s => s.group_course_id === gcId && s.status === 'completed')
    const withAttendance    = completedForGroup.filter(s => attendedScheduleIds.has(s.id)).length
    attendanceRateByGroup[gid] = Math.round((withAttendance / completedForGroup.length) * 100)
  }

  // 7. Build groups list
  const groups: InstructorGroupDetail[] = groupIds.map(gid => {
    const meta = groupMetaMap[gid]
    if (!meta) return null
    const sessions     = sessionsByGroup[gid] ?? { total: 0, completed: 0 }
    const attendanceRate = attendanceRateByGroup[gid] ?? 100
    return {
      id:              gid,
      name:            meta.name,
      code:            meta.code ?? null,
      type:            meta.type ?? '',
      status:          meta.status ?? 'active',
      branch_id:       meta.branch_id,
      branch_name:     meta.branch_name,
      course_id:       meta.course_id ?? null,
      course_name:     meta.course_name ?? null,
      student_count:   (studentsByGroup[gid] ?? []).length,
      capacity:        meta.capacity ?? 0,
      sessions_done:   sessions.completed,
      total_sessions:  sessions.total,
      attendance_rate: attendanceRate,
      role:            roleMap[gid] ?? 'lead',
      health:          groupHealth(attendanceRate),
    } satisfies InstructorGroupDetail
  }).filter(Boolean) as InstructorGroupDetail[]

  // 8. Build students list (derived from groups)
  const uniqueStudents = new Map<string, InstructorStudentRow>()
  for (const r of (gsRes.data ?? []) as unknown as RawGsFullRow[]) {
    const gid = r.group_id
    const stu = r.students
    if (!stu) continue
    const sid = stu.id
    if (uniqueStudents.has(sid)) continue
    const groupMeta = groupMetaMap[gid]
    uniqueStudents.set(sid, {
      student_id:         sid,
      first_name:         stu.users?.profiles?.first_name ?? null,
      last_name:          stu.users?.profiles?.last_name ?? null,
      user_email:         stu.users?.email ?? '',
      group_id:           gid,
      group_name:         groupMeta?.name ?? '',
      attendance_rate:    attendanceRateByGroup[gid] ?? 100,
      remaining_sessions: null,
      balance:            0,
      risk:               'LOW' as const,
    })
  }
  const students = [...uniqueStudents.values()]

  // 9. Finance: query student_enrollments
  const finance: InstructorFinanceSummary = {
    total_revenue: 0, students_with_balance: 0, students_overdue: 0,
    total_outstanding: 0, active_contracts: 0,
  }
  const studentIds = students.map(s => s.student_id)
  if (studentIds.length > 0) {
    const { data: enrollData } = await db
      .from('student_enrollments')
      .select('id, student_id, status, total_amount, paid_amount, remaining_sessions')
      .in('student_id', studentIds)
      .not('status', 'in', '("cancelled","withdrawn")')

    const paymentMap: Record<string, { paid: number; remaining: number; overdue: boolean }> = {}
    for (const e of (enrollData ?? []) as unknown as RawEnrollRow[]) {
      const sid       = e.student_id
      const paid      = Number(e.paid_amount ?? 0)
      const total     = Number(e.total_amount ?? 0)
      const remaining = total - paid
      if (!paymentMap[sid]) paymentMap[sid] = { paid: 0, remaining: 0, overdue: false }
      paymentMap[sid].paid      += paid
      paymentMap[sid].remaining += remaining
      if (remaining > 0) paymentMap[sid].overdue = true
    }
    finance.total_revenue         = Object.values(paymentMap).reduce((s, v) => s + v.paid, 0)
    finance.total_outstanding     = Object.values(paymentMap).reduce((s, v) => s + v.remaining, 0)
    finance.students_with_balance = Object.values(paymentMap).filter(v => v.remaining > 0).length
    finance.students_overdue      = Object.values(paymentMap).filter(v => v.overdue).length
    finance.active_contracts      = ((enrollData ?? []) as unknown as RawEnrollRow[]).filter(e => e.status === 'active').length

    for (const s of students) {
      const fin = paymentMap[s.student_id]
      if (fin) {
        s.balance = fin.remaining
        if (fin.remaining > 500) s.risk = 'HIGH'
        else if (fin.remaining > 0) s.risk = 'MEDIUM'
      }
    }
  }

  // 10. Attendance stats aggregate
  const totalSessions  = Object.values(sessionsByGroup).reduce((s, v) => s + v.total, 0)
  const totalCompleted = Object.values(sessionsByGroup).reduce((s, v) => s + v.completed, 0)
  const sessionsWithAttendance = attendedScheduleIds.size
  const complianceRate = totalCompleted > 0
    ? Math.round((sessionsWithAttendance / totalCompleted) * 100)
    : 100

  const attendance_stats: InstructorAttendanceStats = {
    total_sessions:              totalSessions,
    sessions_completed:          totalCompleted,
    sessions_with_attendance:    sessionsWithAttendance,
    compliance_rate:             complianceRate,
    sessions_missing_attendance: Math.max(0, totalCompleted - sessionsWithAttendance),
  }

  // 11. Performance metrics
  const activeGroups        = groups.filter(g => g.status === 'active').length
  const lowAttendanceGroups = groups.filter(g => g.attendance_rate < 60).length
  const atRiskStudents      = students.filter(s => s.risk === 'HIGH').length
  const healthScore         = computeHealthScore(complianceRate, activeGroups, atRiskStudents, students.length)

  const performance: InstructorPerformanceMetrics = {
    health_score:          healthScore,
    health_label:          healthLabel(healthScore),
    attendance_compliance: complianceRate,
    active_groups:         activeGroups,
    total_students:        students.length,
    low_attendance_groups: lowAttendanceGroups,
    at_risk_students:      atRiskStudents,
    group_count:           groups.length,
  }

  // 12. Certifications + notes
  const certifications: InstructorCertification[] = ((certRes.data ?? []) as unknown as RawCertRow[]).map(r => ({
    id: r.id, instructor_id: instructorId, certification: r.certification,
    level: r.level, status: r.status, issued_at: r.issued_at, expires_at: r.expires_at,
    notes: r.notes, created_at: r.created_at, updated_at: r.updated_at,
  }))
  const notes: InstructorNote[] = ((notesRes.data ?? []) as unknown as RawNoteRow[]).map(r => ({
    id: r.id, content: r.content, category: r.category, author_id: r.author_id,
    author_name: r.users?.profiles
      ? `${r.users.profiles.first_name ?? ''} ${r.users.profiles.last_name ?? ''}`.trim() || null
      : null,
    created_at: r.created_at, updated_at: r.updated_at,
  }))

  // 13. Build operational sessions (past 7d + future 21d)
  const sessions: InstructorSessionRow[] = sessionData
    .filter(s => {
      if (!s.scheduled_at) return false
      return s.scheduled_at >= sevenDaysAgo && s.scheduled_at <= twentyOneDaysAhead
    })
    .map(s => {
      const gid  = gcToGroup[s.group_course_id]
      const meta = gid ? groupMetaMap[gid] : null
      return {
        id:                   s.id,
        group_course_id:      s.group_course_id,
        group_id:             gid ?? '',
        group_name:           meta?.name ?? '',
        course_name:          meta?.course_name ?? null,
        scheduled_at:         s.scheduled_at,
        duration_minutes:     s.duration_minutes ?? 60,
        status:               s.status,
        topic:                s.topic ?? null,
        attendance_submitted: attendedScheduleIds.has(s.id),
        student_count:        gid ? (studentsByGroup[gid] ?? []).length : 0,
      } satisfies InstructorSessionRow
    })

  return { instructor, groups, sessions, students, attendance_stats, performance, finance, notes, certifications }
}

// ── getInstructorFormOptions ───────────────────────────────────────────────────

export async function getInstructorFormOptions(branchIds: string[]): Promise<InstructorFormOptions> {
  const db = createServiceClient()

  const branchQuery = branchIds.length > 0
    ? db.from('branches').select('id, name').in('id', branchIds).eq('active', true).order('name')
    : db.from('branches').select('id, name').eq('active', true).order('name')

  const groupQuery = branchIds.length > 0
    ? db.from('groups').select('id, name, code, branch_id, status, capacity, branches!groups_branch_id_fkey(name), group_instructors(instructor_id)').in('branch_id', branchIds).not('status', 'in', '("cancelled","archived")').is('deleted_at', null).order('name')
    : db.from('groups').select('id, name, code, branch_id, status, capacity, branches!groups_branch_id_fkey(name), group_instructors(instructor_id)').not('status', 'in', '("cancelled","archived")').is('deleted_at', null).order('name')

  const [branchRes, groupRes] = await Promise.all([branchQuery, groupQuery])

  const branches = ((branchRes.data ?? []) as RawBranchRow[]).map(b => ({ id: b.id, name: b.name }))

  const groupFormRows = (groupRes.data ?? []) as unknown as RawGroupFormRow[]
  const groupFormIds  = groupFormRows.map(g => g.id)

  const { data: gsData } = groupFormIds.length > 0
    ? await db.from('group_students').select('group_id').in('group_id', groupFormIds).eq('status', 'active')
    : { data: [] as RawGsIdRow[] }

  const studentCountByGroup: Record<string, number> = {}
  for (const r of (gsData ?? []) as unknown as RawGsIdRow[]) {
    studentCountByGroup[r.group_id] = (studentCountByGroup[r.group_id] ?? 0) + 1
  }

  const groups = groupFormRows.map(g => ({
    id:             g.id,
    name:           g.name,
    code:           g.code ?? null,
    branch_id:      g.branch_id,
    branch_name:    g.branches?.name ?? '',
    status:         g.status,
    student_count:  studentCountByGroup[g.id] ?? 0,
    has_instructor: (g.group_instructors?.length ?? 0) > 0,
  }))

  return { branches, groups }
}
