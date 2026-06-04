import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient }       from '@/lib/supabase/service'
import { getCurrentUser }            from '@/modules/rbac/guards'

// GET /api/students/search?q=...&branchIds=id1,id2
// Fast student lookup for the enrollment wizard autocomplete.
// Searches by: student name, student code, student phone, parent phone.

export async function GET(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user || !user.permissions.includes('manage_groups')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = req.nextUrl
  const q           = searchParams.get('q')?.trim() ?? ''
  const branchParam = searchParams.get('branchIds') ?? ''

  if (q.length < 2) return NextResponse.json([])

  // Scope to the user's accessible branches
  const requestedIds = branchParam ? branchParam.split(',').map(s => s.trim()).filter(Boolean) : []
  const branchIds    = user.globalRole === 'super_admin'
    ? requestedIds
    : requestedIds.length > 0
      ? requestedIds.filter(id => user.branchIds.includes(id))
      : user.branchIds

  if (!branchIds.length) return NextResponse.json([])

  const db  = createServiceClient()
  const pct = `%${q}%`

  // ── Search profiles by name ──────────────────────────────────────────────
  const [profileRes, phoneRes, codeRes] = await Promise.all([
    db.from('profiles')
      .select('user_id')
      .or(`first_name.ilike.${pct},last_name.ilike.${pct}`)
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

  // Resolve user IDs → student IDs, also search emergency_contact JSONB for parent phone
  const [fromProfiles, fromPhone, fromParentPhone] = await Promise.all([
    profileUserIds.length > 0
      ? db.from('students').select('id').in('user_id', profileUserIds).in('branch_id', branchIds).is('deleted_at', null)
      : Promise.resolve({ data: [] }),

    phoneUserIds.length > 0
      ? db.from('students').select('id').in('user_id', phoneUserIds).in('branch_id', branchIds).is('deleted_at', null)
      : Promise.resolve({ data: [] }),

    // Parent phone search via JSONB containment (matches phone1 or phone2)
    db.from('students')
      .select('id')
      .in('branch_id', branchIds)
      .is('deleted_at', null)
      .or(`emergency_contact->phone1.ilike.${pct},emergency_contact->phone2.ilike.${pct}`)
      .limit(30),
  ])

  const codeStudentIds   = (codeRes.data ?? []).map((r: any) => r.id as string)
  const profileStudentIds = (fromProfiles.data ?? []).map((r: any) => r.id as string)
  const phoneStudentIds   = (fromPhone.data ?? []).map((r: any) => r.id as string)
  const parentStudentIds  = (fromParentPhone.data ?? []).map((r: any) => r.id as string)

  const allStudentIds = [...new Set([
    ...codeStudentIds, ...profileStudentIds, ...phoneStudentIds, ...parentStudentIds
  ])].slice(0, 30)

  if (!allStudentIds.length) return NextResponse.json([])

  // ── Fetch full student detail for matched IDs ────────────────────────────
  const { data: students } = await db
    .from('students')
    .select(`
      id, student_code, branch_id,
      users!students_user_id_fkey(
        email, phone,
        profiles!profiles_user_id_fkey(first_name, last_name)
      ),
      branches!students_branch_id_fkey(name),
      emergency_contact
    `)
    .in('id', allStudentIds)
    .eq('status', 'active')
    .is('deleted_at', null)
    .limit(20)

  const results = ((students ?? []) as any[]).map(s => {
    const u   = s.users    ?? {}
    const p   = u.profiles ?? {}
    const ec  = (s.emergency_contact ?? {}) as Record<string, string>
    return {
      id:           s.id,
      name:         [p.first_name, p.last_name].filter(Boolean).join(' ') || u.email || 'Unknown',
      code:         s.student_code ?? null,
      email:        u.email ?? null,
      phone:        u.phone ?? null,
      branch_id:    s.branch_id,
      branch_name:  (s.branches as any)?.name ?? '',
      parent_name:  ec.name   ?? null,
      parent_phone: ec.phone1 ?? null,
    }
  })

  return NextResponse.json(results)
}
