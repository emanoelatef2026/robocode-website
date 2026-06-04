import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient }       from '@/lib/supabase/service'
import { getCurrentUser }            from '@/modules/rbac/guards'

// GET /api/instructors?branchIds=id1,id2 — list instructors for branch(es)
export async function GET(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const branchParam = req.nextUrl.searchParams.get('branchIds') ?? ''
  const requestedIds = branchParam ? branchParam.split(',').map(s => s.trim()).filter(Boolean) : []
  const branchIds    = user.globalRole === 'super_admin'
    ? requestedIds.length ? requestedIds : user.branchIds
    : requestedIds.length
      ? requestedIds.filter(id => user.branchIds.includes(id))
      : user.branchIds

  const db = createServiceClient()

  let q = db
    .from('instructors')
    .select(`
      id,
      users!instructors_user_id_fkey(
        email, phone,
        profiles!profiles_user_id_fkey(first_name, last_name)
      )
    `)
    .is('deleted_at', null)
    .order('created_at')
    .limit(200)

  // Filter by branches via user_roles
  if (branchIds.length) {
    const { data: roleRows } = await db
      .from('user_roles')
      .select('user_id')
      .in('branch_id', branchIds)
      .eq('role', 'instructor')
    const instrUserIds = (roleRows ?? []).map((r: any) => r.user_id as string)
    if (instrUserIds.length) {
      q = q.in('user_id', instrUserIds) as any
    }
  }

  const { data } = await q

  const results = ((data ?? []) as any[]).map(i => {
    const p = i.users?.profiles ?? {}
    return {
      id:   i.id,
      name: [p.first_name, p.last_name].filter(Boolean).join(' ') || i.users?.email || 'Unknown',
      email: i.users?.email ?? null,
    }
  })

  return NextResponse.json(results)
}
