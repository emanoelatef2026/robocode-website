import { NextResponse }          from 'next/server'
import { getCurrentUser }         from '@/modules/rbac/guards'
import { runDeploymentChecks }    from '@/modules/deployment/checks'
import { runConsistencyChecks }   from '@/modules/consistency'

// GET /api/system/verify
// Runs full deployment verification. Requires super_admin.
export async function GET() {
  const user = await getCurrentUser()
  if (!user || user.globalRole !== 'super_admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const [deployment] = await Promise.all([
    runDeploymentChecks(),
  ])

  return NextResponse.json({
    deployment,
    checked_at: new Date().toISOString(),
  })
}

// POST /api/system/verify — runs consistency checks (expensive, super_admin only)
export async function POST() {
  const user = await getCurrentUser()
  if (!user || user.globalRole !== 'super_admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const branchIds: string[] = []  // empty = all branches via service client

  const { data: branches } = await (await import('@/lib/supabase/service'))
    .createServiceClient()
    .from('branches')
    .select('id')
    .eq('is_active', true)

  const ids = (branches ?? []).map((b: any) => b.id as string)
  const consistency = await runConsistencyChecks(ids)

  return NextResponse.json({ consistency, checked_at: new Date().toISOString() })
}
