'use server'

import { createServiceClient } from '@/lib/supabase/service'
import { getGroupSchedules }   from '../queries'
import { requirePermission, isBranchAccessible } from '@/modules/rbac/guards'
import type { RiskLevel }      from '@/modules/operational-engine'
import type { GroupDetailData, GroupDetailSession, GroupDetailStudent, GroupDetailParentInfo, SessionAttendanceRecord } from './types'

// ── Row shapes (Supabase query return types) ───────────────────────────────────

interface GroupStudentRow {
  student_id: string
  joined_at:  string
  students?: {
    student_code?: string | null
    age?:          number | null
    date_of_birth?: string | null
    users?: {
      phone?: string | null
      profiles?: {
        first_name?: string | null
        last_name?:  string | null
      } | null
    } | null
  } | null
}

interface ProgressRow   { student_id: string; attendance_score?: number | null }
interface EnrollmentRow { id: string; student_id: string; remaining_sessions?: number | null; consumed_sessions?: number | null; enrolled_sessions?: number | null; start_date?: string | null }
interface GuardianRow   { student_id: string; parent_group_id: string; name: string | null; phone1?: string | null; is_primary: boolean }
interface FinanceRow    { id: string; student_id: string; paid_amount?: number | null; remaining_amount?: number | null; status?: string | null }
interface ParentPortalRow {
  student_id: string
  is_primary: boolean
  parents: { user_id: string; users: { email: string | null } | null } | null
}

// ── Action ────────────────────────────────────────────────────────────────────

export async function getGroupDetailDataAction(groupId: string): Promise<GroupDetailData> {
  const user = await requirePermission('manage_groups')
  const db = createServiceClient()

  const { data: groupRow } = await db.from('groups').select('branch_id').eq('id', groupId).single()
  if (!groupRow || !isBranchAccessible(user, (groupRow as { branch_id: string | null }).branch_id)) {
    return { sessions: [], students: [] }
  }

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

  // Fetch attendance counts per session and course names per group_course
  const sessionIds = schedules.map(s => s.id)
  const gcIds      = [...new Set(schedules.map(s => s.group_course_id))]

  const [attCountRes, gcCourseRes] = await Promise.all([
    sessionIds.length
      ? db.from('attendance_records')
          .select('id, schedule_id, student_id, status')
          .in('schedule_id', sessionIds)
          .is('invalidated_at', null)
      : Promise.resolve({ data: [] as { id: string; schedule_id: string; student_id: string; status: string }[] }),
    gcIds.length
      ? db.from('group_courses')
          .select('id, courses(title)')
          .in('id', gcIds)
      : Promise.resolve({ data: [] as { id: string; courses: { title: string } | null }[] }),
  ])

  const attBySession = new Map<string, { present: number; absent: number; records: SessionAttendanceRecord[] }>()
  for (const r of (attCountRes.data ?? []) as { id: string; schedule_id: string; student_id: string; status: string }[]) {
    const s = attBySession.get(r.schedule_id) ?? { present: 0, absent: 0, records: [] }
    if (['present', 'late', 'makeup'].includes(r.status)) s.present++
    else if (r.status === 'absent') s.absent++
    s.records.push({ id: r.id, student_id: r.student_id, status: r.status })
    attBySession.set(r.schedule_id, s)
  }

  const courseByGc = new Map<string, string>()
  for (const gc of (gcCourseRes.data ?? []) as any[]) {
    if (gc.courses?.title) courseByGc.set(gc.id as string, gc.courses.title as string)
  }

  const gsRows   = (gsRes.data ?? []) as GroupStudentRow[]
  const studentIds = gsRows.map(r => r.student_id)

  const none = Promise.resolve({ data: [] as never[] })

  const [progRes, enrollRes, guardianRes, financeRes, parentPortalRes] = await Promise.all([
    studentIds.length
      ? db.from('student_course_progress')
          .select('student_id, attendance_score')
          .in('student_id', studentIds)
          .eq('group_id', groupId)
          .eq('status', 'active')
      : none,
    studentIds.length
      ? db.from('student_enrollments')
          .select('id, student_id, remaining_sessions, consumed_sessions, enrolled_sessions, start_date')
          .in('student_id', studentIds)
          .eq('status', 'ACTIVE')
          .order('start_date', { ascending: true, nullsFirst: false })
          .order('created_at', { ascending: true })
      : none,
    studentIds.length
      ? db.from('student_parent_contacts')
          .select('student_id, parent_group_id, name, phone1, is_primary')
          .in('student_id', studentIds)
          .eq('status', 'active')
          .order('is_primary', { ascending: false })
      : none,
    studentIds.length
      ? db.from('student_financial_accounts')
          .select('id, student_id, paid_amount, remaining_amount, status')
          .in('student_id', studentIds)
      : none,
    // Parent portal accounts — separate legacy system (parents/users), not linked to
    // student_parent_contacts. Only populated when a portal login was created via the
    // student modal (modules/students/modal-actions.ts syncParentContacts).
    studentIds.length
      ? db.from('parent_students')
          .select('student_id, is_primary, parents!parent_students_parent_id_fkey(user_id, users!parents_user_id_fkey(email))')
          .in('student_id', studentIds)
          .order('is_primary', { ascending: false })
      : none,
  ])

  // Build lookup maps — O(n) pass over each result set
  const progMap     = new Map<string, number>()
  const sessMap     = new Map<string, { remaining: number; used: number | null; total: number | null; enrollment_id: string | null; start_date: string | null }>()
  const guardianMap = new Map<string, string>()
  const parentMap   = new Map<string, GroupDetailParentInfo>()
  const financeMap  = new Map<string, { paid: number; balance: number; status: string | null; account_id: string | null }>()

  for (const p of (progRes.data ?? []) as ProgressRow[]) {
    progMap.set(p.student_id, p.attendance_score ?? 0)
  }
  // FIFO: take the oldest active enrollment per student (first in ordered results)
  for (const e of (enrollRes.data ?? []) as EnrollmentRow[]) {
    if (!sessMap.has(e.student_id)) {
      sessMap.set(e.student_id, {
        remaining:     e.remaining_sessions  ?? 0,
        used:          e.consumed_sessions  != null ? Number(e.consumed_sessions)  : null,
        total:         e.enrolled_sessions  != null ? Number(e.enrolled_sessions)  : null,
        enrollment_id: e.id ?? null,
        start_date:    e.start_date ?? null,
      })
    }
  }
  for (const g of (guardianRes.data ?? []) as GuardianRow[]) {
    if (!guardianMap.has(g.student_id) && g.phone1) {
      guardianMap.set(g.student_id, g.phone1)
    }
    // First row per student is the primary contact (query ordered by is_primary desc)
    if (!parentMap.has(g.student_id)) {
      parentMap.set(g.student_id, {
        id:           g.parent_group_id,
        full_name:    g.name ?? null,
        email:        null,
        portal_email: null,
        phone:        g.phone1 ?? null,
      })
    }
  }
  for (const pp of (parentPortalRes.data ?? []) as unknown as ParentPortalRow[]) {
    const email = pp.parents?.users?.email ?? null
    if (!email) continue
    const existing = parentMap.get(pp.student_id)
    if (existing) {
      if (!existing.portal_email) existing.portal_email = email
    } else {
      // Portal account exists but no structured contact row for this student
      parentMap.set(pp.student_id, {
        id:           pp.student_id,
        full_name:    null,
        email:        null,
        portal_email: email,
        phone:        null,
      })
    }
  }
  for (const f of (financeRes.data ?? []) as FinanceRow[]) {
    if (!financeMap.has(f.student_id)) {
      financeMap.set(f.student_id, {
        paid:       Number(f.paid_amount      ?? 0),
        balance:    Number(f.remaining_amount ?? 0),
        status:     f.status ?? null,
        account_id: f.id ?? null,
      })
    }
  }

  const students: GroupDetailStudent[] = gsRows.map(r => {
    const s    = r.students ?? {}
    const prof = s.users?.profiles ?? {}
    const name = [prof.first_name, prof.last_name].filter(Boolean).join(' ') || '—'
    const att  = progMap.get(r.student_id) ?? 0
    const age  = s.age != null
      ? s.age
      : s.date_of_birth
        ? Math.floor((Date.now() - new Date(s.date_of_birth).getTime()) / (365.25 * 24 * 60 * 60 * 1000))
        : null

    const sessInfo  = sessMap.get(r.student_id)
    const finInfo   = financeMap.get(r.student_id)
    const sessLeft  = sessInfo?.remaining ?? null

    // Canonical risk thresholds from operational-engine:
    // att < 60 → HIGH, att < 80 → MEDIUM (aligns with attendance_critical / attendance_low flags)
    const isExhausted = sessLeft != null && sessLeft <= 0
    const isOverdue   = finInfo?.status === 'OVERDUE'
    const isBlocked   = finInfo?.status === 'BLOCKED'
    const risk_level: RiskLevel =
      (att < 60 || isExhausted || isOverdue || isBlocked) ? 'HIGH' :
      (att < 80 || (sessLeft != null && sessLeft <= 2))   ? 'MEDIUM' : 'LOW'

    return {
      student_id:          r.student_id,
      student_name:        name,
      student_code:        s.student_code ?? null,
      age,
      phone:               s.users?.phone ?? null,
      parent_phone:        guardianMap.get(r.student_id) ?? null,
      parent:              parentMap.get(r.student_id) ?? null,
      joined_at:           r.joined_at,
      attendance_pct:      att,
      sessions_remaining:  sessLeft,
      risk_level,
      paid_amount:         finInfo?.paid    ?? 0,
      remaining_balance:   finInfo?.balance ?? 0,
      payment_status:      finInfo?.status  ?? null,
      sessions_used:       sessInfo?.used   ?? null,
      sessions_total:      sessInfo?.total  ?? null,
      subscription_amount: ((finInfo?.paid ?? 0) + (finInfo?.balance ?? 0)) || null,
      account_id:            finInfo?.account_id    ?? null,
      enrollment_id:         sessInfo?.enrollment_id ?? null,
      enrollment_start_date: sessInfo?.start_date    ?? null,
    }
  })

  const sessions: GroupDetailSession[] = schedules.map(s => ({
    id:                 s.id,
    scheduled_at:       s.scheduled_at,
    duration_minutes:   s.duration_minutes,
    type:               s.type,
    status:             s.status,
    topic:              s.topic,
    meeting_url:        s.meeting_url,
    session_number:     s.session_number ?? null,
    present_count:      attBySession.get(s.id)?.present ?? 0,
    absent_count:       attBySession.get(s.id)?.absent  ?? 0,
    course_name:        courseByGc.get(s.group_course_id) ?? null,
    delivery:           s.delivery ?? null,
    student_attendance: attBySession.get(s.id)?.records ?? [],
  }))

  return { sessions, students }
}
