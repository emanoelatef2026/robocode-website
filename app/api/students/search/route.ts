import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient }       from '@/lib/supabase/service'
import { getCurrentUser }            from '@/modules/rbac/guards'

// GET /api/students/search?q=...&branchIds=id1,id2
//
// Search vectors: student name (multi-word), code, student phone,
//                 parent phone (phone1/phone2), parent name,
//                 group name, instructor name.
//
// Egyptian phone normalization: 010/011/012/015 → strip leading 0 for digit comparison.
// Returns per-student: full identity + operational enrollment context.

// ── Egyptian phone normalisation ─────────────────────────────────────────────
// Strips country code (+20/0020) or leading 0 so local formats compare correctly.

function normaliseEgPhone(raw: string): string {
  const digits = raw.replace(/\D/g, '')
  if (digits.startsWith('20') && digits.length >= 12) return digits.slice(2)
  if (digits.startsWith('0'))  return digits.slice(1)
  return digits
}

// Build ilike patterns that match both raw and normalised Egyptian formats.
// e.g. "01012345678" produces patterns for both "01012345678" and "1012345678".

function egPhonePatterns(q: string): string[] {
  const patterns: string[] = [`%${q}%`]
  const norm = normaliseEgPhone(q)
  if (norm !== q && norm.length >= 5) patterns.push(`%${norm}%`)
  // Also try with leading 0 in case DB stores without it
  if (!q.startsWith('0') && q.length >= 8) patterns.push(`%0${q}%`)
  return [...new Set(patterns)]
}

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

  // Egyptian phone patterns (handle 01x / +201x / without leading 0)
  const phonePatterns  = egPhonePatterns(q)
  const phonePct       = phonePatterns[0] // primary pattern for users.phone ilike
  const phoneNormPct   = phonePatterns[1] ?? phonePct

  // ── Phase 1: parallel ID-resolution across 7 vectors ───────────────────────
  const [profileRes, phoneRes, codeRes, groupRes, instrRes] = await Promise.all([
    // 1. Student name
    db.from('profiles')
      .select('user_id')
      .or(nameCondition)
      .limit(50),

    // 2. Student phone (with EG normalisation)
    db.from('users')
      .select('id')
      .or(phonePatterns.map(p => `phone.ilike.${p}`).join(','))
      .limit(50),

    // 3. Student code
    db.from('students')
      .select('id')
      .ilike('student_code', pct)
      .in('branch_id', branchIds)
      .is('deleted_at', null)
      .limit(50),

    // 4. Group name — resolve via active enrollments
    db.from('groups')
      .select('id')
      .ilike('name', pct)
      .in('branch_id', branchIds)
      .is('deleted_at', null)
      .limit(20),

    // 5. Instructor name — resolve via profiles → instructors → enrollments
    db.from('profiles')
      .select('user_id')
      .or(words.flatMap(w => [`first_name.ilike.%${w}%`, `last_name.ilike.%${w}%`]).join(','))
      .limit(30),
  ])

  const profileUserIds  = (profileRes.data ?? []).map((r: any) => r.user_id as string)
  const phoneUserIds    = (phoneRes.data  ?? []).map((r: any) => r.id as string)
  const matchedGroupIds = (groupRes.data  ?? []).map((r: any) => r.id as string)

  // Instructor user_ids → instructor records
  const instrUserIds = (instrRes.data ?? []).map((r: any) => r.user_id as string)

  // ── Phase 2: resolve each vector to student IDs ─────────────────────────────
  const [
    fromProfiles, fromPhone, fromGuardians, fromParentContact,
    fromGroups, fromInstructors,
  ] = await Promise.all([
    // From student name
    profileUserIds.length > 0
      ? db.from('students').select('id').in('user_id', profileUserIds).in('branch_id', branchIds).is('deleted_at', null)
      : Promise.resolve({ data: [] }),

    // From student phone
    phoneUserIds.length > 0
      ? db.from('students').select('id').in('user_id', phoneUserIds).in('branch_id', branchIds).is('deleted_at', null)
      : Promise.resolve({ data: [] }),

    // From parent phone/name — student_guardians table
    db.from('student_guardians')
      .select('student_id')
      .or([
        ...phonePatterns.map(p => `phone1.ilike.${p}`),
        ...phonePatterns.map(p => `phone2.ilike.${p}`),
        `name.ilike.${pct}`,
      ].join(','))
      .limit(30),

    // Fallback: legacy emergency_contact JSONB
    db.from('students')
      .select('id')
      .in('branch_id', branchIds)
      .is('deleted_at', null)
      .or(
        phonePatterns.flatMap(p => [
          `emergency_contact->phone1.ilike.${p}`,
          `emergency_contact->phone2.ilike.${p}`,
        ]).concat([`emergency_contact->name.ilike.${pct}`])
        .join(',')
      )
      .limit(30),

    // From group name
    matchedGroupIds.length > 0
      ? db.from('student_enrollments').select('student_id')
          .in('group_id', matchedGroupIds)
          .in('branch_id', branchIds)
          .eq('status', 'ACTIVE')
          .limit(50)
      : Promise.resolve({ data: [] }),

    // From instructor name
    instrUserIds.length > 0
      ? db.from('instructors').select('id').in('user_id', instrUserIds).then(async (instrData: any) => {
          const instrIds = (instrData.data ?? []).map((r: any) => r.id as string)
          if (!instrIds.length) return { data: [] }
          return db.from('student_enrollments').select('student_id')
            .in('instructor_id', instrIds)
            .in('branch_id', branchIds)
            .eq('status', 'ACTIVE')
            .limit(50)
        })
      : Promise.resolve({ data: [] }),
  ])

  const allStudentIds = [...new Set([
    ...(codeRes.data         ?? []).map((r: any) => r.id          as string),
    ...(fromProfiles.data    ?? []).map((r: any) => r.id          as string),
    ...(fromPhone.data       ?? []).map((r: any) => r.id          as string),
    ...(fromGuardians.data   ?? []).map((r: any) => r.student_id  as string),
    ...(fromParentContact.data ?? []).map((r: any) => r.id        as string),
    ...(fromGroups.data      ?? []).map((r: any) => r.student_id  as string),
    ...((fromInstructors as any).data ?? []).map((r: any) => r.student_id as string),
  ])].slice(0, 40)

  if (!allStudentIds.length) {
    if (process.env.NODE_ENV === 'development') {
      console.debug(`[student-search] q="${q}" → 0 results in ${Date.now() - searchStart}ms`)
    }
    return NextResponse.json([])
  }

  // ── Phase 3: student details + active enrollments in parallel ───────────────
  const [studentsRes, enrollmentsRes, guardiansRes] = await Promise.all([
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
      .limit(30),

    db.from('student_enrollments')
      .select(`
        student_id, course_id, financial_status,
        enrolled_sessions, remaining_sessions,
        course_name_snapshot,
        groups!student_enrollments_group_id_fkey(name)
      `)
      .in('student_id', allStudentIds)
      .eq('status', 'ACTIVE')
      .limit(80),

    // Prefer student_guardians over JSONB emergency_contact
    db.from('student_guardians')
      .select('student_id, name, phone1, phone2')
      .in('student_id', allStudentIds)
      .limit(60),
  ])

  // Map guardians by student_id (first guardian wins)
  const guardianByStudent = new Map<string, { name: string | null; phone: string | null }>()
  for (const g of (guardiansRes.data ?? []) as any[]) {
    if (!guardianByStudent.has(g.student_id)) {
      guardianByStudent.set(g.student_id, { name: g.name ?? null, phone: g.phone1 ?? null })
    }
  }

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

    // Age from DOB
    const dob = p.date_of_birth ? new Date(p.date_of_birth) : null
    const age  = dob ? Math.floor((now - dob.getTime()) / (365.25 * 24 * 3600000)) : null

    // Parent info: prefer student_guardians, fallback to emergency_contact
    const guardian  = guardianByStudent.get(s.id)
    const parentName  = guardian?.name  ?? ec.name   ?? null
    const parentPhone = guardian?.phone ?? ec.phone1 ?? null

    const enrollments    = enrollsByStudent.get(s.id) ?? []
    const primaryEnroll  = enrollments[0] ?? null
    const activeCourseIds: string[] = enrollments.map((e: any) => e.course_id).filter((id: any): id is string => !!id)

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
      parent_name:             parentName,
      parent_phone:            parentPhone,
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
    console.debug(`[student-search] q="${q}" → ${results.length} result${results.length !== 1 ? 's' : ''} in ${Date.now() - searchStart}ms`)
  }

  return NextResponse.json(results)
}
