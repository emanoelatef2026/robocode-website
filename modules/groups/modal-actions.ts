'use server'

import { revalidatePath }      from 'next/cache'
import { z }                   from 'zod'
import { createServiceClient } from '@/lib/supabase/service'
import { requirePermission, isBranchAccessible } from '@/modules/rbac/guards'
import { syncGroupStatus }     from './lifecycle'
import { getGroupSchedules }   from './queries'
import type { ActionResult }   from '@/types/app'

// ── Schema ─────────────────────────────────────────────────────────────────────

const DAYS = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday'] as const
const GROUP_TYPES = ['class','workshop','bootcamp','trial','makeup'] as const
const GROUP_STATUSES = ['forming','active','completed','cancelled'] as const

const baseFields = {
  branch_id:        z.string().uuid('Select a branch'),
  name:             z.string().min(2, 'Name must be at least 2 characters').max(100),
  type:             z.enum(GROUP_TYPES),
  capacity:         z.coerce.number().int().min(1).max(500).optional().or(z.literal('')).transform(v => v === '' ? undefined : v),
  day_of_week:      z.enum(DAYS).optional().or(z.literal('')).transform(v => v === '' ? undefined : v),
  start_time:       z.string().regex(/^\d{2}:\d{2}$/).optional().or(z.literal('')).transform(v => v === '' ? undefined : v),
  duration_minutes: z.coerce.number().int().min(15).max(480).optional().or(z.literal('')).transform(v => v === '' ? undefined : v),
  start_date:       z.string().optional().or(z.literal('')).transform(v => v === '' ? undefined : v),
  end_date:         z.string().optional().or(z.literal('')).transform(v => v === '' ? undefined : v),
  meeting_link:     z.string().max(500).optional().or(z.literal('')).transform(v => v === '' ? undefined : v),
  notes:            z.string().max(2000).optional().or(z.literal('')).transform(v => v === '' ? undefined : v),
  course_id:        z.string().uuid().optional().or(z.literal('')).transform(v => v === '' ? undefined : v),
  instructor_id:    z.string().uuid().optional().or(z.literal('')).transform(v => v === '' ? undefined : v),
  asst_instructor_id: z.string().uuid().optional().or(z.literal('')).transform(v => v === '' ? undefined : v),
  students_to_add_json:    z.string().optional(),
  students_to_remove_json: z.string().optional(),
}

const createSchema = z.object(baseFields)
const updateSchema = z.object({ id: z.string().uuid(), status: z.enum(GROUP_STATUSES).optional(), ...baseFields })

// ── Helpers ────────────────────────────────────────────────────────────────────

function parseStudentIds(raw: string | undefined): string[] {
  if (!raw) return []
  try {
    const arr = JSON.parse(raw)
    return Array.isArray(arr) ? arr.filter((s): s is string => typeof s === 'string') : []
  } catch { return [] }
}

async function applyStudentChanges(
  db: ReturnType<typeof createServiceClient>,
  userId: string,
  groupId: string,
  branchId: string,
  toAdd: string[],
  toRemove: string[]
) {
  const now = new Date().toISOString()

  // Remove
  for (const studentId of toRemove) {
    await db.from('group_students')
      .update({ status: 'dropped', left_at: now })
      .eq('group_id', groupId)
      .eq('student_id', studentId)
    try {
      await db.from('student_enrollments')
        .update({ status: 'DROPPED', end_date: now.slice(0, 10) })
        .eq('student_id', studentId)
        .eq('group_id', groupId)
        .eq('status', 'ACTIVE')
    } catch { /* non-fatal */ }
  }

  // Add (skip duplicates via upsert conflict)
  const { data: gcRow } = await db
    .from('group_courses')
    .select('id, instructor_id')
    .eq('group_id', groupId)
    .eq('status', 'active')
    .maybeSingle()

  for (const studentId of toAdd) {
    const { data: gsRow, error } = await db.from('group_students').insert({
      group_id:        groupId,
      student_id:      studentId,
      enrollment_type: 'primary',
      status:          'active',
      joined_at:       now,
    }).select('id').single()

    if (!error && gsRow) {
      try {
        await db.from('student_enrollments').insert({
          student_id:      studentId,
          branch_id:       branchId,
          group_id:        groupId,
          group_course_id: (gcRow as any)?.id          ?? null,
          instructor_id:   (gcRow as any)?.instructor_id ?? null,
          group_student_id: (gsRow as any).id,
          start_date:      now.slice(0, 10),
          status:          'ACTIVE',
          enrollment_type: 'primary',
          created_by:      userId,
        })
      } catch { /* non-fatal */ }
    }
  }
}

async function assignCourseAndInstructor(
  db: ReturnType<typeof createServiceClient>,
  groupId: string,
  courseId: string | undefined,
  instructorId: string | undefined,
  asstInstructorId: string | undefined
) {
  if (courseId) {
    await db.from('group_courses')
      .update({ status: 'cancelled' })
      .eq('group_id', groupId)
      .eq('status', 'active')
      .neq('course_id', courseId)

    const { error: gcErr } = await db.from('group_courses').upsert(
      { group_id: groupId, course_id: courseId, instructor_id: instructorId || null, total_sessions: 24, status: 'active' },
      { onConflict: 'group_id,course_id' }
    )
    if (gcErr) {
      await db.from('group_courses').upsert(
        { group_id: groupId, course_id: courseId, instructor_id: instructorId || null, status: 'active' },
        { onConflict: 'group_id,course_id' }
      )
    }
    await db.from('group_courses')
      .update({ instructor_id: instructorId || null })
      .eq('group_id', groupId)
      .eq('status', 'active')
  } else {
    await db.from('group_courses')
      .update({ status: 'cancelled' })
      .eq('group_id', groupId)
      .eq('status', 'active')
  }

  if (instructorId) {
    await db.from('group_instructors').upsert(
      { group_id: groupId, instructor_id: instructorId, role: 'lead' },
      { onConflict: 'group_id,instructor_id' }
    )
  }

  if (asstInstructorId) {
    await db.from('group_instructors').upsert(
      { group_id: groupId, instructor_id: asstInstructorId, role: 'additional' },
      { onConflict: 'group_id,instructor_id' }
    )
  }

  await syncGroupStatus(groupId, db)
}

function buildGroupInsert(data: any) {
  const base: Record<string, any> = {
    branch_id:   data.branch_id,
    name:        data.name,
    type:        data.type,
    capacity:    data.capacity     ?? null,
    status:      'forming',
    day_of_week: data.day_of_week  ?? null,
    time:        data.start_time   ?? null,
    start_date:  data.start_date   ?? null,
    notes:       data.notes        ?? null,
  }
  if (data.duration_minutes !== undefined) base.duration_minutes = data.duration_minutes
  if (data.end_date)                        base.end_date         = data.end_date
  if (data.meeting_link)                    base.meeting_link     = data.meeting_link
  return base
}

function buildGroupUpdate(data: any) {
  const upd: Record<string, any> = {
    name:        data.name,
    type:        data.type,
    capacity:    data.capacity    !== undefined ? (data.capacity ?? null) : undefined,
    day_of_week: data.day_of_week ?? null,
    time:        data.start_time  ?? null,
    start_date:  data.start_date  ?? null,
    notes:       data.notes       ?? null,
  }
  if (data.status)                          upd.status          = data.status
  if (data.duration_minutes !== undefined)  upd.duration_minutes = data.duration_minutes
  upd.end_date     = data.end_date     ?? null
  upd.meeting_link = data.meeting_link ?? null
  return upd
}

// ── Create ─────────────────────────────────────────────────────────────────────

export async function createGroupModal(
  _prev: unknown,
  formData: FormData
): Promise<ActionResult<{ id: string }>> {
  const raw = Object.fromEntries(
    ['branch_id','name','type','capacity','day_of_week','start_time','duration_minutes',
     'start_date','end_date','meeting_link','notes','course_id','instructor_id',
     'asst_instructor_id','students_to_add_json'].map(k => [k, formData.get(k) ?? ''])
  )

  const parsed = createSchema.safeParse(raw)
  if (!parsed.success) {
    return { success: false, error: { code: 'VALIDATION', message: parsed.error.issues[0].message } }
  }

  const { course_id, instructor_id, asst_instructor_id, students_to_add_json, ...rest } = parsed.data

  if (instructor_id && asst_instructor_id && instructor_id === asst_instructor_id) {
    return { success: false, error: { code: 'VALIDATION', message: 'Lead and assistant instructor must be different.' } }
  }

  const user = await requirePermission('manage_groups', { branchId: parsed.data.branch_id })
  const db   = createServiceClient()

  const insertPayload = buildGroupInsert(rest)
  const { data: group, error } = await db.from('groups').insert(insertPayload).select('id').single()

  if (error) {
    // Retry without new columns (if migration not run yet)
    const { data: group2, error: e2 } = await db.from('groups').insert({
      branch_id:   rest.branch_id,
      name:        rest.name,
      type:        rest.type,
      capacity:    rest.capacity    ?? null,
      status:      'forming',
      day_of_week: rest.day_of_week ?? null,
      time:        rest.start_time  ?? null,
      start_date:  rest.start_date  ?? null,
      notes:       rest.notes       ?? null,
    }).select('id').single()
    if (e2) return { success: false, error: { code: 'DB_ERROR', message: e2.message } }
    const gid2 = (group2 as any).id
    await assignCourseAndInstructor(db, gid2, course_id, instructor_id, asst_instructor_id)
    const toAdd = parseStudentIds(students_to_add_json as string | undefined)
    if (toAdd.length) await applyStudentChanges(db, user.id, gid2, rest.branch_id, toAdd, [])
    await db.rpc('write_audit_log', { p_performed_by: user.id, p_action: 'create', p_entity_type: 'group', p_entity_id: gid2, p_new_values: { name: rest.name, type: rest.type }, p_branch_id: rest.branch_id })
    revalidatePath('/portal/team-leader/groups')
    return { success: true, data: { id: gid2 } }
  }

  const gid = (group as any).id
  await assignCourseAndInstructor(db, gid, course_id, instructor_id, asst_instructor_id)
  const toAdd = parseStudentIds(students_to_add_json as string | undefined)
  if (toAdd.length) await applyStudentChanges(db, user.id, gid, rest.branch_id, toAdd, [])
  await db.rpc('write_audit_log', { p_performed_by: user.id, p_action: 'create', p_entity_type: 'group', p_entity_id: gid, p_new_values: { name: rest.name, type: rest.type }, p_branch_id: rest.branch_id })
  revalidatePath('/portal/team-leader/groups')
  return { success: true, data: { id: gid } }
}

// ── Update ─────────────────────────────────────────────────────────────────────

export async function updateGroupModal(
  _prev: unknown,
  formData: FormData
): Promise<ActionResult<{ id: string }>> {
  const raw = Object.fromEntries(
    ['id','branch_id','name','type','status','capacity','day_of_week','start_time',
     'duration_minutes','start_date','end_date','meeting_link','notes','course_id',
     'instructor_id','asst_instructor_id','students_to_add_json','students_to_remove_json']
      .map(k => [k, formData.get(k) ?? ''])
  )

  const parsed = updateSchema.safeParse(raw)
  if (!parsed.success) {
    return { success: false, error: { code: 'VALIDATION', message: parsed.error.issues[0].message } }
  }

  const { id, course_id, instructor_id, asst_instructor_id, students_to_add_json, students_to_remove_json, ...rest } = parsed.data

  if (instructor_id && asst_instructor_id && instructor_id === asst_instructor_id) {
    return { success: false, error: { code: 'VALIDATION', message: 'Lead and assistant instructor must be different.' } }
  }

  const user = await requirePermission('manage_groups')
  const db   = createServiceClient()

  const { data: existing } = await db.from('groups').select('branch_id').eq('id', id).single()
  if (!existing) return { success: false, error: { code: 'NOT_FOUND', message: 'Group not found.' } }
  if (!isBranchAccessible(user, existing.branch_id)) {
    return { success: false, error: { code: 'FORBIDDEN', message: 'No access to this branch.' } }
  }

  const updates = buildGroupUpdate(rest)
  const cleanUpdates: Record<string, any> = {}
  for (const [k, v] of Object.entries(updates)) {
    if (v !== undefined) cleanUpdates[k] = v
  }

  const { error } = await db.from('groups').update(cleanUpdates).eq('id', id)
  if (error) {
    // Retry without new columns
    const { duration_minutes: _dm, end_date: _ed, meeting_link: _ml, ...safeUpdates } = cleanUpdates
    const { error: e2 } = await db.from('groups').update(safeUpdates).eq('id', id)
    if (e2) return { success: false, error: { code: 'DB_ERROR', message: e2.message } }
  }

  await assignCourseAndInstructor(db, id, course_id, instructor_id, asst_instructor_id)

  const toAdd    = parseStudentIds(students_to_add_json as string | undefined)
  const toRemove = parseStudentIds(students_to_remove_json as string | undefined)
  if (toAdd.length || toRemove.length) {
    await applyStudentChanges(db, user.id, id, existing.branch_id, toAdd, toRemove)
  }

  await db.rpc('write_audit_log', { p_performed_by: user.id, p_action: 'update', p_entity_type: 'group', p_entity_id: id, p_new_values: cleanUpdates })
  revalidatePath('/portal/team-leader/groups')
  return { success: true, data: { id } }
}

// ── Archive ────────────────────────────────────────────────────────────────────

export async function archiveGroupAction(groupId: string): Promise<ActionResult<void>> {
  const user = await requirePermission('manage_groups')
  const db   = createServiceClient()

  const { data: existing } = await db.from('groups').select('branch_id').eq('id', groupId).single()
  if (!existing) return { success: false, error: { code: 'NOT_FOUND', message: 'Group not found.' } }
  if (!isBranchAccessible(user, existing.branch_id)) {
    return { success: false, error: { code: 'FORBIDDEN', message: 'No access to this branch.' } }
  }

  await db.from('groups').update({ status: 'cancelled', deleted_at: new Date().toISOString() }).eq('id', groupId)
  await db.rpc('write_audit_log', { p_performed_by: user.id, p_action: 'archive', p_entity_type: 'group', p_entity_id: groupId })
  revalidatePath('/portal/team-leader/groups')
  return { success: true, data: undefined }
}

// ── Delete ─────────────────────────────────────────────────────────────────────

export async function deleteGroupAction(groupId: string): Promise<ActionResult<void>> {
  const user = await requirePermission('manage_groups')
  const db   = createServiceClient()

  const { data: existing } = await db.from('groups').select('branch_id').eq('id', groupId).single()
  if (!existing) return { success: false, error: { code: 'NOT_FOUND', message: 'Group not found.' } }
  if (!isBranchAccessible(user, existing.branch_id)) {
    return { success: false, error: { code: 'FORBIDDEN', message: 'No access to this branch.' } }
  }

  const now = new Date().toISOString()
  await db.from('group_students')
    .update({ status: 'dropped', left_at: now })
    .eq('group_id', groupId)
    .eq('status', 'active')
  await db.from('groups')
    .update({ status: 'cancelled', deleted_at: now })
    .eq('id', groupId)
  await db.rpc('write_audit_log', {
    p_performed_by: user.id, p_action: 'delete', p_entity_type: 'group',
    p_entity_id: groupId, p_branch_id: existing.branch_id,
  })
  revalidatePath('/portal/team-leader/groups')
  return { success: true, data: undefined }
}

// ── Remove student from group ────────────────────────────────────────────────

export async function removeStudentFromGroupAction(
  groupId: string,
  studentId: string,
): Promise<ActionResult<void>> {
  const user = await requirePermission('manage_groups')
  const db   = createServiceClient()

  const { data: existing } = await db.from('groups').select('branch_id').eq('id', groupId).single()
  if (!existing) return { success: false, error: { code: 'NOT_FOUND', message: 'Group not found.' } }
  if (!isBranchAccessible(user, existing.branch_id)) {
    return { success: false, error: { code: 'FORBIDDEN', message: 'No access to this branch.' } }
  }

  await applyStudentChanges(db, user.id, groupId, existing.branch_id, [], [studentId])
  revalidatePath('/portal/team-leader/groups')
  return { success: true, data: undefined }
}

// ── Add students to group ────────────────────────────────────────────────────

export async function addStudentsToGroupAction(
  groupId: string,
  studentIds: string[],
): Promise<ActionResult<void>> {
  if (!studentIds.length) return { success: true, data: undefined }

  const user = await requirePermission('manage_groups')
  const db   = createServiceClient()

  const { data: existing } = await db
    .from('groups')
    .select('branch_id, capacity')
    .eq('id', groupId)
    .single()
  if (!existing) return { success: false, error: { code: 'NOT_FOUND', message: 'Group not found.' } }
  if (!isBranchAccessible(user, existing.branch_id)) {
    return { success: false, error: { code: 'FORBIDDEN', message: 'No access to this branch.' } }
  }

  const cap = (existing as any).capacity as number | null
  if (cap) {
    const { count } = await db
      .from('group_students')
      .select('*', { count: 'exact', head: true })
      .eq('group_id', groupId)
      .eq('status', 'active')
    if ((count ?? 0) + studentIds.length > cap) {
      return {
        success: false,
        error: { code: 'CAPACITY', message: `Adding ${studentIds.length} student(s) would exceed capacity of ${cap}.` },
      }
    }
  }

  await applyStudentChanges(db, user.id, groupId, existing.branch_id, studentIds, [])
  revalidatePath('/portal/team-leader/groups')
  return { success: true, data: undefined }
}

// ── Detail data (called from drawer) ──────────────────────────────────────────

export interface GroupDetailData {
  sessions:  GroupDetailSession[]
  students:  GroupDetailStudent[]
}

export interface GroupDetailSession {
  id:               string
  scheduled_at:     string
  duration_minutes: number
  type:             string
  status:           string
  topic:            string | null
  meeting_url:      string | null
}

export interface GroupDetailStudent {
  student_id:          string
  student_name:        string
  student_code:        string | null
  age:                 number | null
  phone:               string | null
  parent_phone:        string | null
  joined_at:           string
  attendance_pct:      number
  sessions_remaining:  number | null
  risk_level:          'HIGH' | 'MEDIUM' | 'LOW'
  // Finance fields (Sprint 57 workspace)
  paid_amount:         number
  remaining_balance:   number
  payment_status:      string | null
  sessions_used:       number | null
  sessions_total:      number | null
  subscription_amount: number | null
  // Finance gateway — presence means student has an existing contract
  account_id:          string | null
  enrollment_id:       string | null
}

export async function getGroupDetailDataAction(groupId: string): Promise<GroupDetailData> {
  const db = createServiceClient()

  const [schedules, gsRes] = await Promise.all([
    getGroupSchedules(groupId),
    db.from('group_students')
      .select(`
        student_id, joined_at,
        students!group_students_student_id_fkey(
          student_code, age, date_of_birth,
          users!students_user_id_fkey(
            phone,
            profiles!profiles_user_id_fkey(first_name, last_name)
          )
        )
      `)
      .eq('group_id', groupId)
      .eq('status', 'active')
      .order('joined_at'),
  ])

  const gsRows = (gsRes.data ?? []) as any[]
  const studentIds = gsRows.map((r: any) => r.student_id as string)

  const [progRes, enrollRes, guardianRes, financeRes] = await Promise.all([
    studentIds.length
      ? db.from('student_course_progress')
          .select('student_id, attendance_score')
          .in('student_id', studentIds)
          .eq('group_id', groupId)
          .eq('status', 'active')
      : Promise.resolve({ data: [] }),
    studentIds.length
      ? db.from('student_enrollments')
          .select('id, student_id, remaining_sessions, consumed_sessions, enrolled_sessions')
          .in('student_id', studentIds)
          .eq('group_id', groupId)
          .eq('status', 'ACTIVE')
      : Promise.resolve({ data: [] }),
    studentIds.length
      ? db.from('student_guardians')
          .select('student_id, phone1')
          .in('student_id', studentIds)
          .not('phone1', 'is', null)
      : Promise.resolve({ data: [] }),
    studentIds.length
      ? db.from('student_financial_accounts')
          .select('id, student_id, paid_amount, remaining_amount, status')
          .in('student_id', studentIds)
      : Promise.resolve({ data: [] }),
  ])

  const progMap     = new Map<string, number>()
  const sessMap     = new Map<string, { remaining: number; used: number | null; total: number | null; enrollment_id: string | null }>()
  const guardianMap = new Map<string, string>()
  const financeMap  = new Map<string, { paid: number; balance: number; status: string | null; account_id: string | null }>()

  for (const p of (progRes.data ?? []) as any[])    progMap.set(p.student_id, p.attendance_score ?? 0)
  for (const e of (enrollRes.data ?? []) as any[]) {
    sessMap.set(e.student_id as string, {
      remaining:     e.remaining_sessions ?? 0,
      used:          e.consumed_sessions  != null ? Number(e.consumed_sessions)  : null,
      total:         e.enrolled_sessions  != null ? Number(e.enrolled_sessions)  : null,
      enrollment_id: (e.id as string) ?? null,
    })
  }
  for (const g of (guardianRes.data ?? []) as any[]) {
    if (!guardianMap.has(g.student_id) && g.phone1) guardianMap.set(g.student_id as string, g.phone1 as string)
  }
  // Keep one finance record per student (prefer the most relevant account)
  for (const f of (financeRes.data ?? []) as any[]) {
    if (!financeMap.has(f.student_id)) {
      financeMap.set(f.student_id as string, {
        paid:       Number(f.paid_amount    ?? 0),
        balance:    Number(f.remaining_amount ?? 0),
        status:     f.status ?? null,
        account_id: (f.id as string) ?? null,
      })
    }
  }

  const students: GroupDetailStudent[] = gsRows.map((r: any) => {
    const s       = r.students ?? {}
    const prof    = s.users?.profiles ?? {}
    const name    = [prof.first_name, prof.last_name].filter(Boolean).join(' ') || '—'
    const att     = progMap.get(r.student_id) ?? 0
    const age     = s.age != null
      ? s.age as number
      : s.date_of_birth
        ? Math.floor((Date.now() - new Date(s.date_of_birth as string).getTime()) / (365.25 * 24 * 60 * 60 * 1000))
        : null
    const sessInfo  = sessMap.get(r.student_id as string)
    const finInfo   = financeMap.get(r.student_id as string)
    const sessLeft  = sessInfo?.remaining ?? null
    const isExhausted = sessLeft != null && sessLeft <= 0
    const isOverdue   = finInfo?.status === 'OVERDUE'
    const risk: 'HIGH' | 'MEDIUM' | 'LOW' =
      (att < 50 || isExhausted || isOverdue) ? 'HIGH' :
      (att < 70 || (sessLeft != null && sessLeft <= 2)) ? 'MEDIUM' : 'LOW'
    return {
      student_id:         r.student_id,
      student_name:       name,
      student_code:       s.student_code ?? null,
      age,
      phone:              s.users?.phone ?? null,
      parent_phone:       guardianMap.get(r.student_id) ?? null,
      joined_at:          r.joined_at,
      attendance_pct:     att,
      sessions_remaining: sessInfo?.remaining ?? null,
      risk_level:         risk,
      paid_amount:         finInfo?.paid    ?? 0,
      remaining_balance:   finInfo?.balance ?? 0,
      payment_status:      finInfo?.status  ?? null,
      sessions_used:       sessInfo?.used   ?? null,
      sessions_total:      sessInfo?.total  ?? null,
      subscription_amount: ((finInfo?.paid ?? 0) + (finInfo?.balance ?? 0)) || null,
      account_id:          finInfo?.account_id    ?? null,
      enrollment_id:       sessInfo?.enrollment_id ?? null,
    }
  })

  const sessions: GroupDetailSession[] = schedules.slice(0, 30).map(s => ({
    id:               s.id,
    scheduled_at:     s.scheduled_at,
    duration_minutes: s.duration_minutes,
    type:             s.type,
    status:           s.status,
    topic:            s.topic,
    meeting_url:      s.meeting_url,
  }))

  return { sessions, students }
}
