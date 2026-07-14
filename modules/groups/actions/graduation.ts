'use server'

// Phase 2 — Graduation Wizard Server Actions. Activates
// student_enrollments.renewal_of and groups.series_id (dormant since Phase
// 0) via one atomic commit. See docs/DOMAIN_RULES.md and
// docs/GROUP_SERIES_RULES.md for the invariants this module must not
// violate — in particular: historical rows are never rewritten, no
// financial account is ever created here, and the next cohort's
// course/instructor/schedule configuration is never attempted automatically
// (round 3 adjustment #4) — see commitCohortGraduation's comment.

import { revalidatePath }      from 'next/cache'
import { createServiceClient } from '@/lib/supabase/service'
import { requirePermission, isBranchAccessible } from '@/modules/rbac/guards'
import { computeCohortHealthWarnings, type CohortHealthWarning } from './cohort-health'
import {
  recommendDecision, allDecided, buildGraduationRpcPayload, decisionCountsSummary,
} from './graduation-helpers'
import type {
  GraduationDecision, WizardDecision, NextCohortDraft,
  CommitGraduationInput, CommitGraduationResult,
} from './graduation-helpers'
import type { ActionResult } from '@/types/app'

const GROUPS_PATH = '/portal/team-leader/groups'

type DB = ReturnType<typeof createServiceClient>

function fullName(profile: { first_name?: string | null; last_name?: string | null } | null | undefined): string | null {
  if (!profile) return null
  const n = [profile.first_name, profile.last_name].filter(Boolean).join(' ')
  return n || null
}

// ── Shared: fetch + branch-check the old cohort ──────────────────────────────

async function loadOldCohort(db: DB, groupId: string) {
  const { data } = await db
    .from('groups')
    .select('id, branch_id, name, status, day_of_week, time, start_date, end_date, completed_sessions, series_id, robocode_share_percent, type, capacity, waitlist_capacity, semester_id, graduated_at, graduated_to_group_id')
    .eq('id', groupId)
    .maybeSingle()
  return data
}

// ── Step 1 — Cohort Summary ───────────────────────────────────────────────────

export interface GraduationCohortSummary {
  group_id:                    string
  name:                        string
  branch_id:                   string
  branch_name:                 string | null
  course_id:                   string | null
  course_name:                 string | null
  series_id:                   string | null
  series_name:                 string | null
  lead_instructor_name:        string | null
  asst_instructor_name:        string | null
  day_of_week:                 string | null
  time:                        string | null
  student_count:               number
  sessions_completed:          number
  target_sessions:             number | null
  attendance_pct:              number
  certificates_issued:         number
  certificates_missing:        number
  outstanding_balance_total:   number
  outstanding_balance_students: number
  completion_date:             string | null
  already_graduated:           boolean
  graduated_to_group_id:       string | null
}

async function buildCohortSummary(db: DB, groupId: string): Promise<GraduationCohortSummary | null> {
  const group = await loadOldCohort(db, groupId)
  if (!group) return null

  const [branchRes, gcRes, giRes, activeStudentsRes, seriesRes] = await Promise.all([
    db.from('branches').select('name').eq('id', group.branch_id).maybeSingle(),
    db.from('group_courses').select('id, course_id, total_sessions, courses!group_courses_course_id_fkey(title)').eq('group_id', groupId).eq('status', 'active').maybeSingle(),
    db.from('group_instructors').select(`
        role, instructor_id,
        instructors!group_instructors_instructor_id_fkey(users!instructors_user_id_fkey(profiles!profiles_user_id_fkey(first_name, last_name)))
      `).eq('group_id', groupId),
    db.from('group_students').select('student_id').eq('group_id', groupId).eq('status', 'active'),
    group.series_id ? db.from('group_series').select('name').eq('id', group.series_id).maybeSingle() : Promise.resolve({ data: null }),
  ])

  const studentIds = (activeStudentsRes.data ?? []).map((s: { student_id: string }) => s.student_id)
  const courseId = (gcRes.data as { course_id?: string } | null)?.course_id ?? null

  const [certRes, financeRes, attendanceRes] = await Promise.all([
    (studentIds.length && courseId)
      ? db.from('certificates').select('student_id').in('student_id', studentIds).eq('course_id', courseId)
      : Promise.resolve({ data: [] as { student_id: string }[] }),
    db.from('student_financial_accounts').select('id, remaining_amount').eq('group_id', groupId).gt('remaining_amount', 0),
    (async () => {
      const { getGroupMetrics } = await import('@/modules/tl-dashboard/queries')
      return getGroupMetrics([groupId])
    })(),
  ])

  const withCert = new Set((certRes.data ?? []).map((c: { student_id: string }) => c.student_id))
  const missingCert = studentIds.filter(id => !withCert.has(id)).length

  const gis = (giRes.data ?? []) as Array<{ role: string; instructors?: { users?: { profiles?: { first_name?: string; last_name?: string } } } }>
  const lead = gis.find(gi => gi.role === 'lead')
  const asst = gis.find(gi => gi.role === 'assistant')

  const metrics = attendanceRes.get(groupId)
  const financeRows = (financeRes.data ?? []) as Array<{ remaining_amount: number }>

  return {
    group_id:              group.id,
    name:                  group.name,
    branch_id:              group.branch_id,
    branch_name:            (branchRes.data as { name?: string } | null)?.name ?? null,
    course_id:              courseId,
    course_name:            (gcRes.data as { courses?: { title?: string } } | null)?.courses?.title ?? null,
    series_id:              group.series_id ?? null,
    series_name:            (seriesRes.data as { name?: string } | null)?.name ?? null,
    lead_instructor_name:   fullName(lead?.instructors?.users?.profiles),
    asst_instructor_name:   fullName(asst?.instructors?.users?.profiles),
    day_of_week:            group.day_of_week ?? null,
    time:                   group.time ?? null,
    student_count:          studentIds.length,
    sessions_completed:     group.completed_sessions ?? 0,
    target_sessions:        (gcRes.data as { total_sessions?: number } | null)?.total_sessions ?? null,
    attendance_pct:         metrics?.attendance_avg ?? 0,
    certificates_issued:    withCert.size,
    certificates_missing:   missingCert,
    outstanding_balance_total:    financeRows.reduce((s, r) => s + Number(r.remaining_amount ?? 0), 0),
    outstanding_balance_students: financeRows.length,
    completion_date:        group.end_date ?? null,
    already_graduated:      !!group.graduated_at,
    graduated_to_group_id:  group.graduated_to_group_id ?? null,
  }
}

export async function getGraduationCohortSummary(groupId: string): Promise<ActionResult<GraduationCohortSummary>> {
  const user = await requirePermission('graduate_cohort')
  const db   = createServiceClient()

  const group = await loadOldCohort(db, groupId)
  if (!group) return { success: false, error: { code: 'NOT_FOUND', message: 'Cohort not found.' } }
  if (!isBranchAccessible(user, group.branch_id)) {
    return { success: false, error: { code: 'FORBIDDEN', message: 'No access to this branch.' } }
  }

  const summary = await buildCohortSummary(db, groupId)
  if (!summary) return { success: false, error: { code: 'NOT_FOUND', message: 'Cohort not found.' } }
  return { success: true, data: summary }
}

// ── Step 2 — Validation ───────────────────────────────────────────────────────

export interface GraduationValidation {
  blockers: string[]
  warnings: CohortHealthWarning[]
}

export async function validateCohortGraduation(groupId: string): Promise<ActionResult<GraduationValidation>> {
  const user = await requirePermission('graduate_cohort')
  const db   = createServiceClient()

  const group = await loadOldCohort(db, groupId)
  if (!group) return { success: true, data: { blockers: ['Cohort not found.'], warnings: [] } }
  if (!isBranchAccessible(user, group.branch_id)) {
    return { success: false, error: { code: 'FORBIDDEN', message: 'No access to this branch.' } }
  }
  if (group.graduated_at) {
    return { success: true, data: { blockers: ['This cohort has already been graduated.'], warnings: [] } }
  }
  if (group.status !== 'completed') {
    return { success: true, data: { blockers: ['Cohort must be Completed before it can be graduated.'], warnings: [] } }
  }

  const warnings = await computeCohortHealthWarnings(db, groupId)
  return { success: true, data: { blockers: [], warnings } }
}

// ── Step 3 — Student Decisions ────────────────────────────────────────────────

export interface StudentDecisionRow {
  student_id:            string
  student_name:          string
  student_code:          string | null
  group_student_id:      string
  old_enrollment_id:     string | null
  attendance_pct:        number
  has_certificate:       boolean
  outstanding_balance:   number
  recommended_decision:  GraduationDecision
}

export async function listGraduationStudents(groupId: string): Promise<ActionResult<StudentDecisionRow[]>> {
  const user = await requirePermission('graduate_cohort')
  const db   = createServiceClient()

  const group = await loadOldCohort(db, groupId)
  if (!group) return { success: false, error: { code: 'NOT_FOUND', message: 'Cohort not found.' } }
  if (!isBranchAccessible(user, group.branch_id)) {
    return { success: false, error: { code: 'FORBIDDEN', message: 'No access to this branch.' } }
  }

  const { data: roster } = await db
    .from('group_students')
    .select(`
      id, student_id,
      students!group_students_student_id_fkey(
        student_code,
        users!students_user_id_fkey(profiles!profiles_user_id_fkey(first_name, last_name))
      )
    `)
    .eq('group_id', groupId)
    .eq('status', 'active')
    .order('joined_at', { ascending: true })

  const rows = (roster ?? []) as Array<{
    id: string; student_id: string
    students?: { student_code?: string; users?: { profiles?: { first_name?: string; last_name?: string } } }
  }>
  if (!rows.length) return { success: true, data: [] }

  const studentIds = rows.map(r => r.student_id)

  const [gcRes, enrollRes, financeRes, scheduleRes] = await Promise.all([
    db.from('group_courses').select('id, course_id').eq('group_id', groupId).eq('status', 'active'),
    db.from('student_enrollments').select('id, student_id').eq('group_id', groupId).eq('status', 'ACTIVE').in('student_id', studentIds),
    db.from('student_financial_accounts').select('student_id, remaining_amount').eq('group_id', groupId).in('student_id', studentIds),
    db.from('group_courses').select('id').eq('group_id', groupId).eq('status', 'active'),
  ])

  const courseIds = [...new Set((gcRes.data ?? []).map((gc: { course_id: string }) => gc.course_id))]
  const groupCourseIds = (scheduleRes.data ?? []).map((gc: { id: string }) => gc.id)

  const [certRes, attendanceRes] = await Promise.all([
    (studentIds.length && courseIds.length)
      ? db.from('certificates').select('student_id').in('student_id', studentIds).in('course_id', courseIds)
      : Promise.resolve({ data: [] as { student_id: string }[] }),
    groupCourseIds.length
      ? db.from('schedules').select('id').in('group_course_id', groupCourseIds)
      : Promise.resolve({ data: [] as { id: string }[] }),
  ])

  const scheduleIds = (attendanceRes.data ?? []).map((s: { id: string }) => s.id)
  const { data: attendanceRecords } = scheduleIds.length
    ? await db.from('attendance_records').select('student_id, status').in('schedule_id', scheduleIds).in('student_id', studentIds)
    : { data: [] as { student_id: string; status: string }[] }

  const attMap = new Map<string, { present: number; total: number }>()
  for (const a of (attendanceRecords ?? []) as Array<{ student_id: string; status: string }>) {
    const e = attMap.get(a.student_id) ?? { present: 0, total: 0 }
    e.total++
    if (a.status === 'present' || a.status === 'late') e.present++
    attMap.set(a.student_id, e)
  }

  const enrollMap = new Map<string, string>()
  for (const e of (enrollRes.data ?? []) as Array<{ id: string; student_id: string }>) {
    if (!enrollMap.has(e.student_id)) enrollMap.set(e.student_id, e.id)
  }

  const financeMap = new Map<string, number>()
  for (const f of (financeRes.data ?? []) as Array<{ student_id: string; remaining_amount: number }>) {
    financeMap.set(f.student_id, (financeMap.get(f.student_id) ?? 0) + Number(f.remaining_amount ?? 0))
  }

  const withCert = new Set((certRes.data ?? []).map((c: { student_id: string }) => c.student_id))

  return {
    success: true,
    data: rows.map((r): StudentDecisionRow => {
      const att = attMap.get(r.student_id)
      const attendancePct = att && att.total > 0 ? Math.round((att.present / att.total) * 100) : 0
      const hasCert = withCert.has(r.student_id)
      const balance = financeMap.get(r.student_id) ?? 0
      return {
        student_id:            r.student_id,
        student_name:          fullName(r.students?.users?.profiles) ?? '—',
        student_code:          r.students?.student_code ?? null,
        group_student_id:      r.id,
        old_enrollment_id:     enrollMap.get(r.student_id) ?? null,
        attendance_pct:        attendancePct,
        has_certificate:       hasCert,
        outstanding_balance:   balance,
        recommended_decision:  recommendDecision({ has_certificate: hasCert, outstanding_balance: balance, attendance_pct: attendancePct }),
      }
    }),
  }
}

// Eligible transfer targets: other non-archived, non-cancelled cohorts in the
// same branch (excludes the cohort being graduated and the not-yet-created
// next cohort, which doesn't exist until commit).
export async function listTransferTargetGroups(branchId: string, excludeGroupId: string): Promise<ActionResult<Array<{ id: string; name: string }>>> {
  const user = await requirePermission('graduate_cohort', { branchId })
  const db   = createServiceClient()

  const { data, error } = await db
    .from('groups')
    .select('id, name, status')
    .eq('branch_id', branchId)
    .neq('id', excludeGroupId)
    .is('deleted_at', null)
    .not('status', 'in', '(archived,cancelled)')
    .order('name')

  if (error) return { success: false, error: { code: 'DB_ERROR', message: error.message } }
  void user
  return { success: true, data: (data ?? []).map((g: { id: string; name: string }) => ({ id: g.id, name: g.name })) }
}

// ── Step 4 — Next Cohort defaults ─────────────────────────────────────────────

export async function getNextCohortDefaults(groupId: string): Promise<ActionResult<{
  draft: NextCohortDraft
  semesterOptions: Array<{ id: string; name: string }>
}>> {
  const user = await requirePermission('graduate_cohort')
  const db   = createServiceClient()

  const group = await loadOldCohort(db, groupId)
  if (!group) return { success: false, error: { code: 'NOT_FOUND', message: 'Cohort not found.' } }
  if (!isBranchAccessible(user, group.branch_id)) {
    return { success: false, error: { code: 'FORBIDDEN', message: 'No access to this branch.' } }
  }

  const [gcRes, asstRes, seriesRes, semesterRes] = await Promise.all([
    db.from('group_courses').select('course_id, instructor_id, total_sessions, open_ended').eq('group_id', groupId).eq('status', 'active').maybeSingle(),
    db.from('group_instructors').select('instructor_id').eq('group_id', groupId).eq('role', 'assistant').maybeSingle(),
    group.series_id ? db.from('group_series').select('default_room, default_capacity').eq('id', group.series_id).maybeSingle() : Promise.resolve({ data: null }),
    db.from('semesters').select('id, name').in('status', ['planned', 'active']).order('start_date', { ascending: false }).limit(20),
  ])

  // Room lives on schedules, not groups (docs/DOMAIN_RULES.md) — read the
  // most recent non-cancelled session's room as an advisory default only.
  let room: string | null = null
  const { data: gc } = await db.from('group_courses').select('id').eq('group_id', groupId).eq('status', 'active').maybeSingle()
  if (gc) {
    const { data: sched } = await db
      .from('schedules')
      .select('room, session_date')
      .eq('group_course_id', (gc as { id: string }).id)
      .neq('status', 'cancelled')
      .order('session_date', { ascending: false })
      .limit(1)
      .maybeSingle()
    room = (sched as { room?: string } | null)?.room ?? null
  }

  const gcRow = gcRes.data as { course_id?: string; instructor_id?: string; total_sessions?: number; open_ended?: boolean } | null
  const seriesRow = seriesRes.data as { default_room?: string; default_capacity?: number } | null

  const draft: NextCohortDraft = {
    branch_id:               group.branch_id,
    series_id:                group.series_id ?? null,
    semester_id:               group.semester_id ?? null,
    name:                     group.name,
    code:                     null,
    type:                     group.type ?? 'class',
    capacity:                 group.capacity ?? seriesRow?.default_capacity ?? null,
    waitlist_capacity:        group.waitlist_capacity ?? 0,
    day_of_week:              group.day_of_week ?? null,
    time:                     group.time ?? null,
    start_date:               null,
    room:                     room ?? seriesRow?.default_room ?? null,
    course_id:                gcRow?.course_id ?? null,
    instructor_id:             gcRow?.instructor_id ?? null,
    asst_instructor_id:        (asstRes.data as { instructor_id?: string } | null)?.instructor_id ?? null,
    robocode_share_percent:    group.robocode_share_percent ?? 100,
    planned_sessions:          gcRow?.total_sessions ?? null,
    open_ended:               gcRow?.open_ended ?? false,
  }

  return {
    success: true,
    data: {
      draft,
      semesterOptions: (semesterRes.data ?? []) as Array<{ id: string; name: string }>,
    },
  }
}

// ── Step 5 — Enrollment Preview ───────────────────────────────────────────────

export interface GraduationPreview {
  new_cohort:      { name: string; branch_name: string | null; day_of_week: string | null; time: string | null; capacity: number | null }
  historical_cohort: GraduationCohortSummary
  continuing:      StudentDecisionRow[]
  graduating:      StudentDecisionRow[]
  held:            StudentDecisionRow[]
  dropped:         StudentDecisionRow[]
  transferred:     StudentDecisionRow[]
  repeating:       StudentDecisionRow[]
}

export async function previewCohortGraduation(
  groupId: string,
  draft: NextCohortDraft,
  decisions: Record<string, WizardDecision>,
): Promise<ActionResult<GraduationPreview>> {
  const user = await requirePermission('graduate_cohort')
  const db   = createServiceClient()

  const group = await loadOldCohort(db, groupId)
  if (!group) return { success: false, error: { code: 'NOT_FOUND', message: 'Cohort not found.' } }
  if (!isBranchAccessible(user, group.branch_id)) {
    return { success: false, error: { code: 'FORBIDDEN', message: 'No access to this branch.' } }
  }

  const [studentsRes, historical, branchRes] = await Promise.all([
    listGraduationStudents(groupId),
    buildCohortSummary(db, groupId),
    db.from('branches').select('name').eq('id', draft.branch_id).maybeSingle(),
  ])

  if (!studentsRes.success) return studentsRes
  if (!historical) return { success: false, error: { code: 'NOT_FOUND', message: 'Cohort not found.' } }

  const buckets: Record<GraduationDecision, StudentDecisionRow[]> = {
    continue: [], graduate: [], hold: [], drop: [], transfer: [], repeat: [],
  }
  for (const s of studentsRes.data) {
    const d = decisions[s.student_id]
    if (d && d !== 'undecided') buckets[d].push(s)
  }

  return {
    success: true,
    data: {
      new_cohort: {
        name:         draft.name,
        branch_name:  (branchRes.data as { name?: string } | null)?.name ?? null,
        day_of_week:  draft.day_of_week,
        time:         draft.time,
        capacity:     draft.capacity,
      },
      historical_cohort: historical,
      continuing:  buckets.continue,
      graduating:  buckets.graduate,
      held:        buckets.hold,
      dropped:     buckets.drop,
      transferred: buckets.transfer,
      repeating:   buckets.repeat,
    },
  }
}

// ── Draft persistence (round 3 adjustment #1 — one draft per cohort PER USER) ─

export interface GraduationDraft {
  id:              string
  step:            number
  new_group_draft: NextCohortDraft | Record<string, never>
  decisions:       Array<{ student_id: string; decision: WizardDecision; transfer_group_id?: string }>
  request_id:      string | null
  updated_at:      string
}

export interface OtherDraftNotice { updated_by_name: string; updated_at: string }
export interface StaleDraftNotice { graduated_at: string; graduated_to_group_id: string | null; graduated_by_name: string | null }

export async function getGraduationDraft(oldGroupId: string): Promise<ActionResult<{
  own:    GraduationDraft | null
  others: OtherDraftNotice[]
  stale:  StaleDraftNotice | null
}>> {
  const user = await requirePermission('graduate_cohort')
  const db   = createServiceClient()

  const group = await loadOldCohort(db, oldGroupId)
  if (!group) return { success: false, error: { code: 'NOT_FOUND', message: 'Cohort not found.' } }
  if (!isBranchAccessible(user, group.branch_id)) {
    return { success: false, error: { code: 'FORBIDDEN', message: 'No access to this branch.' } }
  }

  const { data: ownRow } = await db
    .from('cohort_graduation_drafts')
    .select('id, step, new_group_draft, decisions, request_id, status, updated_at, updated_by')
    .eq('old_group_id', oldGroupId)
    .eq('created_by', user.id)
    .eq('status', 'in_progress')
    .maybeSingle()

  const { data: othersRaw } = await db
    .from('cohort_graduation_drafts')
    .select(`
      updated_at, updated_by,
      users!cohort_graduation_drafts_updated_by_fkey(profiles!profiles_user_id_fkey(first_name, last_name))
    `)
    .eq('old_group_id', oldGroupId)
    .eq('status', 'in_progress')
    .neq('created_by', user.id)

  const others: OtherDraftNotice[] = ((othersRaw ?? []) as Array<{ updated_at: string; users?: { profiles?: { first_name?: string; last_name?: string } } }>)
    .map(o => ({ updated_by_name: fullName(o.users?.profiles) ?? 'Another user', updated_at: o.updated_at }))

  // Stale detection: this user's own draft exists but the cohort was already
  // graduated by a DIFFERENT commit (a different draft/user won the race).
  if (ownRow && group.graduated_at) {
    await db.from('cohort_graduation_drafts').update({ status: 'stale' }).eq('id', (ownRow as { id: string }).id)
    const { data: grad } = await db
      .from('groups')
      .select(`graduated_at, graduated_to_group_id`)
      .eq('id', oldGroupId)
      .maybeSingle()
    return {
      success: true,
      data: {
        own: null, others,
        stale: {
          graduated_at:          (grad as { graduated_at?: string })?.graduated_at ?? group.graduated_at,
          graduated_to_group_id: (grad as { graduated_to_group_id?: string })?.graduated_to_group_id ?? group.graduated_to_group_id ?? null,
          graduated_by_name:     null,
        },
      },
    }
  }

  if (!ownRow) return { success: true, data: { own: null, others, stale: null } }

  const row = ownRow as { id: string; step: number; new_group_draft: unknown; decisions: unknown; request_id: string | null; updated_at: string }
  return {
    success: true,
    data: {
      own: {
        id:              row.id,
        step:            row.step,
        new_group_draft: (row.new_group_draft ?? {}) as NextCohortDraft,
        decisions:       (row.decisions ?? []) as GraduationDraft['decisions'],
        request_id:      row.request_id,
        updated_at:       row.updated_at,
      },
      others,
      stale: null,
    },
  }
}

export async function saveGraduationDraft(
  oldGroupId: string,
  step:       number,
  draft:      NextCohortDraft | Record<string, never>,
  decisions:  Array<{ student_id: string; decision: WizardDecision; transfer_group_id?: string }>,
  requestId?: string,
): Promise<ActionResult<{ id: string; updated_at: string }>> {
  const user = await requirePermission('graduate_cohort')
  const db   = createServiceClient()

  const group = await loadOldCohort(db, oldGroupId)
  if (!group) return { success: false, error: { code: 'NOT_FOUND', message: 'Cohort not found.' } }
  if (!isBranchAccessible(user, group.branch_id)) {
    return { success: false, error: { code: 'FORBIDDEN', message: 'No access to this branch.' } }
  }

  const { data: existing } = await db
    .from('cohort_graduation_drafts')
    .select('id')
    .eq('old_group_id', oldGroupId)
    .eq('created_by', user.id)
    .eq('status', 'in_progress')
    .maybeSingle()

  const payload = {
    old_group_id: oldGroupId, step, new_group_draft: draft, decisions,
    ...(requestId ? { request_id: requestId } : {}),
    updated_by: user.id,
  }

  if (existing) {
    const { data, error } = await db
      .from('cohort_graduation_drafts')
      .update(payload)
      .eq('id', (existing as { id: string }).id)
      .select('id, updated_at')
      .single()
    if (error) return { success: false, error: { code: 'DB_ERROR', message: error.message } }
    return { success: true, data: data as { id: string; updated_at: string } }
  }

  const { data, error } = await db
    .from('cohort_graduation_drafts')
    .insert({ ...payload, created_by: user.id })
    .select('id, updated_at')
    .single()
  if (error) return { success: false, error: { code: 'DB_ERROR', message: error.message } }
  return { success: true, data: data as { id: string; updated_at: string } }
}

export async function discardGraduationDraft(oldGroupId: string): Promise<ActionResult<void>> {
  const user = await requirePermission('graduate_cohort')
  const db   = createServiceClient()

  const group = await loadOldCohort(db, oldGroupId)
  if (!group) return { success: false, error: { code: 'NOT_FOUND', message: 'Cohort not found.' } }
  if (!isBranchAccessible(user, group.branch_id)) {
    return { success: false, error: { code: 'FORBIDDEN', message: 'No access to this branch.' } }
  }

  await db
    .from('cohort_graduation_drafts')
    .update({ status: 'discarded' })
    .eq('old_group_id', oldGroupId)
    .eq('created_by', user.id)
    .eq('status', 'in_progress')

  return { success: true, data: undefined }
}

// ── Step 7 — Commit ───────────────────────────────────────────────────────────

export async function commitCohortGraduation(input: CommitGraduationInput): Promise<ActionResult<CommitGraduationResult>> {
  const user = await requirePermission('graduate_cohort', { branchId: input.new_group.branch_id })
  const db   = createServiceClient()

  const group = await loadOldCohort(db, input.old_group_id)
  if (!group) return { success: false, error: { code: 'NOT_FOUND', message: 'Cohort not found.' } }
  if (!isBranchAccessible(user, group.branch_id)) {
    return { success: false, error: { code: 'FORBIDDEN', message: 'No access to this branch.' } }
  }

  // Never trust client-only validation — re-run server-side (same pattern
  // archiveCohortAction already established in Phase 1).
  const validation = await validateCohortGraduation(input.old_group_id)
  if (!validation.success) return validation
  if (validation.data.blockers.length) {
    return { success: false, error: { code: 'VALIDATION', message: validation.data.blockers.join(' ') } }
  }

  const { data: activeRoster } = await db
    .from('group_students')
    .select('student_id')
    .eq('group_id', input.old_group_id)
    .eq('status', 'active')
  const activeIds = (activeRoster ?? []).map((r: { student_id: string }) => r.student_id)

  const decisionMap: Record<string, WizardDecision> = {}
  for (const d of input.decisions) decisionMap[d.student_id] = d.decision
  if (!allDecided(decisionMap, activeIds)) {
    return { success: false, error: { code: 'VALIDATION', message: 'Every active student must have an explicit decision before graduation can be committed.' } }
  }

  if (!input.request_id) {
    return { success: false, error: { code: 'VALIDATION', message: 'Missing idempotency key — please retry from the Review & Confirm step.' } }
  }

  const payload = buildGraduationRpcPayload(input)

  const { data, error } = await db.rpc('commit_cohort_graduation', {
    p_payload:      payload,
    p_performed_by: user.id,
    p_request_id:   input.request_id,
    p_draft_id:     input.draft_id ?? null,
  })

  if (error) return { success: false, error: { code: 'DB_ERROR', message: error.message } }
  if (!data) return { success: false, error: { code: 'DB_ERROR', message: 'Graduation commit returned no result.' } }

  const result = data as { new_group_id: string; decision_counts: Partial<Record<GraduationDecision, number>>; replayed: boolean }

  revalidatePath(GROUPS_PATH)

  return {
    success: true,
    data: { new_group_id: result.new_group_id, decision_counts: result.decision_counts, replayed: result.replayed },
  }
}

export { decisionCountsSummary }
