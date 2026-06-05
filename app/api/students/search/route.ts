import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient }       from '@/lib/supabase/service'
import { getCurrentUser }            from '@/modules/rbac/guards'

// GET /api/students/search?q=...&branchIds=id1,id2
//
// Operations-first student lookup for the enrollment wizard.
// Search vectors: student name (multi-word), code, student phone,
//                 parent phone (phone1/phone2), parent name.
//
// Returns per-student: full identity + operational enrollment context
// (active group, financial status, session counts, active course IDs for
// duplicate-enrollment detection, age from DOB for identity disambiguation).

export async function GET(req: NextRequest) {
  const searchStart = Date.now()

  const user = await getCurrentUser()
  if (!user || !user.permissions.includes('manage_groups')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = req.nextUrl
  const q           = searchParams.get('q')?.trim() ?? ''
  const branchParam = searchParams.get('branchIds') ?? ''

  if (q.length < 2) return NextResponse.json([])

  // Scope to user's accessible branches
  const requestedIds = branchParam ? branchParam.split(',').map(s => s.trim()).filter(Boolean) : []
  const branchIds    = user.globalRole === 'super_admin'
    ? requestedIds
    : requestedIds.length > 0
      ? requestedIds.filter(id => user.branchIds.includes(id))
      : user.branchIds

  if (!branchIds.length) return NextResponse.json([])

  const db  = createServiceClient()
  const pct = `%${q}%`

  // Multi-word name support: "Mina Atef" → each word searched across first+last name
  const words = q.split(/\s+/).filter(Boolean)
  const nameCondition = words
    .flatMap(w => [`first_name.ilike.%${w}%`, `last_name.ilike.%${w}%`])
    .join(',')

  // ── Phase 1: parallel ID-resolution across 5 vectors ───────────────────────
  const [profileRes, phoneRes, codeRes] = await Promise.all([
    db.from('profiles')
      .select('user_id')
      .or(nameCondition)
      .limit(50),

    db.from('users')
      .select('id')
      .ilike('phone', pct)
      .limit(50),

    db.from('students')
      .select('id')
      .ilike('student_code', pct)
      .in('branch_id', branchIds)
      .is('deleted_at', null)
      .limit(50),
  ])

  const profileUserIds = (profileRes.data ?? []).map((r: any) => r.user_id as string)
  const phoneUserIds   = (phoneRes.data  ?? []).map((r: any) => r.id as string)

  // ── Phase 2: user-id resolution + guardian table + legacy JSONB scan ─────────
  const [fromProfiles, fromPhone, fromGuardians, fromParentContact] = await Promise.all([
    profileUserIds.length > 0
      ? db.from('students')
          .select('id')
          .in('user_id', profileUserIds)
          .in('branch_id', branchIds)
          .is('deleted_at', null)
      : Promise.resolve({ data: [] }),

    phoneUserIds.length > 0
      ? db.from('students')
          .select('id')
          .in('user_id', phoneUserIds)
          .in('branch_id', branchIds)
          .is('deleted_at', null)
      : Promise.resolve({ data: [] }),

    // Search student_guardians table (preferred over JSONB)
    db.from('student_guardians')
      .select('student_id')
      .or(`phone1.ilike.${pct},phone2.ilike.${pct},name.ilike.${pct}`)
      .limit(30),

    // Fallback: legacy emergency_contact JSONB scan for unmigrated rows
    db.from('students')
      .select('id')
      .in('branch_id', branchIds)
      .is('deleted_at', null)
      .or(
        `emergency_contact->phone1.ilike.${pct},` +
        `emergency_contact->phone2.ilike.${pct},` +
        `emergency_contact->name.ilike.${pct}`
      )
      .limit(30),
  ])

  const allStudentIds = [...new Set([
    ...(codeRes.data ?? []).map((r: any) => r.id as string),
    ...(fromProfiles.data ?? []).map((r: any) => r.id as string),
    ...(fromPhone.data ?? []).map((r: any) => r.id as string),
    ...(fromGuardians.data ?? []).map((r: any) => r.student_id as string),
    ...(fromParentContact.data ?? []).map((r: any) => r.id as string),
  ])].slice(0, 30)

  if (!allStudentIds.length) {
    if (process.env.NODE_ENV === 'development') {
      console.debug(`[student-search] q="${q}" → 0 results (no IDs matched) in ${Date.now() - searchStart}ms`)
    }
    return NextResponse.json([])
  }

  // ── Phase 3: student details + active enrollments in parallel ───────────────
  const [studentsRes, enrollmentsRes] = await Promise.all([
    db.from('students')
      .select(`
        id, student_code, branch_id,
        users!students_user_id_fkey(
          email, phone,
          profiles!profiles_user_id_fkey(first_name, last_name, date_of_birth)
        ),
        branches!students_branch_id_fkey(name),
        emergency_contact
      `)
      .in('id', allStudentIds)
      .eq('status', 'active')
      .is('deleted_at', null)
      .limit(20),

    // All active enrollments for matched students — course conflict detection + display
    db.from('student_enrollments')
      .select(`
        student_id, course_id, financial_status,
        enrolled_sessions, remaining_sessions,
        course_name_snapshot,
        groups!student_enrollments_group_id_fkey(name)
      `)
      .in('student_id', allStudentIds)
      .eq('status', 'ACTIVE')
      .limit(60),
  ])

  // Group enrollments by student
  const enrollsByStudent = new Map<string, any[]>()
  for (const e of (enrollmentsRes.data ?? []) as any[]) {
    if (!enrollsByStudent.has(e.student_id)) enrollsByStudent.set(e.student_id, [])
    enrollsByStudent.get(e.student_id)!.push(e)
  }

  const now = Date.now()

  const results = ((studentsRes.data ?? []) as any[]).map(s => {
    const u   = s.users    ?? {}
    const p   = u.profiles ?? {}
    const ec  = (s.emergency_contact ?? {}) as Record<string, string>

    // Age from DOB (profiles.date_of_birth)
    const dob = p.date_of_birth ? new Date(p.date_of_birth) : null
    const age = dob ? Math.floor((now - dob.getTime()) / (365.25 * 24 * 3600000)) : null

    const enrollments   = enrollsByStudent.get(s.id) ?? []
    const primaryEnroll = enrollments[0] ?? null

    // All active course IDs (for same-course conflict detection in wizard)
    const activeCourseIds: string[] = enrollments
      .map((e: any) => e.course_id)
      .filter((id: any): id is string => !!id)

    // Compact summaries for Step 2 display
    const activeSummaries = enrollments.map((e: any) => ({
      course_name:        e.course_name_snapshot ?? null,
      group_name:         (e.groups as any)?.name ?? null,
      remaining_sessions: Number(e.remaining_sessions ?? 0),
      financial_status:   e.financial_status ?? null,
    }))

    return {
      id:                      s.id,
      name:                    [p.first_name, p.last_name].filter(Boolean).join(' ') || u.email || 'Unknown',
      code:                    s.student_code  ?? null,
      email:                   u.email         ?? null,
      phone:                   u.phone         ?? null,
      age,
      branch_id:               s.branch_id,
      branch_name:             (s.branches as any)?.name ?? '',
      parent_name:             ec.name   ?? null,
      parent_phone:            ec.phone1 ?? null,
      // Operational enrollment context
      active_enrollments_count: enrollments.length,
      active_course_ids:       activeCourseIds,
      active_group_name:       primaryEnroll ? ((primaryEnroll.groups as any)?.name ?? null) : null,
      financial_status:        primaryEnroll?.financial_status  ?? null,
      enrolled_sessions:       primaryEnroll != null ? Number(primaryEnroll.enrolled_sessions  ?? 0) : null,
      remaining_sessions:      primaryEnroll != null ? Number(primaryEnroll.remaining_sessions ?? 0) : null,
      active_summaries:        activeSummaries,
    }
  })

  if (process.env.NODE_ENV === 'development') {
    const dur = Date.now() - searchStart
    console.debug(
      `[student-search] q="${q}" → ${results.length} result${results.length !== 1 ? 's' : ''} in ${dur}ms` +
      (results.length === 0 ? ' [EMPTY — check branch scope or student status]' : '')
    )
  }

  return NextResponse.json(results)
}
