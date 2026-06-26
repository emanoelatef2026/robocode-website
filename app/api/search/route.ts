import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser }            from '@/modules/rbac/guards'
import { globalSearch }              from '@/modules/search/globalSearch'

// GET /api/search?q=...&branchIds=id1,id2
export async function GET(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = req.nextUrl
  const q           = searchParams.get('q')?.trim() ?? ''
  const branchParam = searchParams.get('branchIds') ?? ''

  if (q.length < 2) {
    return NextResponse.json({ students: [], parents: [], instructors: [], courses: [], groups: [], total: 0 })
  }

  const requestedIds = branchParam ? branchParam.split(',').map(s => s.trim()).filter(Boolean) : []
  const branchIds    = user.globalRole === 'super_admin'
    ? requestedIds.length ? requestedIds : user.branchIds
    : requestedIds.length
      ? requestedIds.filter(id => user.branchIds.includes(id))
      : user.branchIds

  if (!branchIds.length) {
    return NextResponse.json({ students: [], parents: [], instructors: [], courses: [], groups: [], total: 0 })
  }

  try {
    const results = await globalSearch(q, branchIds)
    return NextResponse.json(results)
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Search failed' }, { status: 500 })
  }
}
