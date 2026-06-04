import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient }       from '@/lib/supabase/service'
import { getCurrentUser }            from '@/modules/rbac/guards'

// GET /api/groups/by-branch?branchId=...
// Returns active groups for a branch, with course + instructor info.
// Used by the EnrollmentWizard.

export async function GET(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user || !user.permissions.includes('manage_groups')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const branchId = req.nextUrl.searchParams.get('branchId')
  if (!branchId) return NextResponse.json([])

  if (user.globalRole !== 'super_admin' && !user.branchIds.includes(branchId)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const db = createServiceClient()

  const { data } = await db
    .from('groups')
    .select(`
      id, name, capacity, type, start_date,
      group_courses!group_courses_group_id_fkey(
        id, instructor_id,
        courses!group_courses_course_id_fkey(id, title),
        instructors!group_courses_instructor_id_fkey(
          id,
          users!instructors_user_id_fkey(
            profiles!profiles_user_id_fkey(first_name, last_name)
          )
        )
      )
    `)
    .eq('branch_id', branchId)
    .eq('status', 'active')
    .is('deleted_at', null)
    .order('name')
    .limit(100)

  const groups = ((data ?? []) as any[]).map(g => {
    const activeGc = Array.isArray(g.group_courses)
      ? (g.group_courses as any[]).find(() => true)  // take first active gc
      : null
    const instrProf = activeGc?.instructors?.users?.profiles
    return {
      id:             g.id,
      name:           g.name,
      capacity:       g.capacity ?? null,
      type:           g.type,
      start_date:     g.start_date ?? null,
      group_course_id: activeGc?.id ?? null,
      course_id:      activeGc?.courses?.id ?? null,
      course_title:   activeGc?.courses?.title ?? null,
      instructor_id:  activeGc?.instructor_id ?? null,
      instructor_name: instrProf
        ? [instrProf.first_name, instrProf.last_name].filter(Boolean).join(' ') || null
        : null,
    }
  })

  return NextResponse.json(groups)
}
