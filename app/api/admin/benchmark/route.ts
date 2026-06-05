import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser }            from '@/modules/rbac/guards'
import { runBenchmarks }             from '@/modules/benchmarks'

// POST /api/admin/benchmark
// Runs the query benchmark suite for accessible branches.
export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user || !['super_admin', 'admin'].includes(user.globalRole)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const branchIds: string[] = user.globalRole === 'super_admin'
    ? [] // will be resolved by the benchmarks module
    : user.branchIds

  // For super_admin with no branch, use all active branches
  let targetBranchIds = branchIds
  if (!targetBranchIds.length) {
    const { createServiceClient } = await import('@/lib/supabase/service')
    const db = createServiceClient()
    const { data } = await db.from('branches').select('id').eq('is_active', true).limit(5)
    targetBranchIds = (data ?? []).map((b: any) => b.id as string)
  }

  const results = await runBenchmarks(targetBranchIds)
  return NextResponse.json(results)
}
