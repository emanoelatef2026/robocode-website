import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser }            from '@/modules/rbac/guards'
import { runAutomationBatch }        from '@/modules/automation-engine'
import { processCollectionPipeline } from '@/modules/collections-pipeline'
import { enqueueJob }                from '@/modules/background-jobs'

// POST /api/automation/run
// Triggers automation engine for all accessible branches.
// Called by cron, background jobs, or manual trigger from admin.
export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!['super_admin', 'admin', 'team_leader'].includes(user.globalRole)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const branchIds = user.globalRole === 'super_admin' ? [] : user.branchIds
  if (!user.globalRole.includes('super_admin') && !branchIds.length) {
    return NextResponse.json({ error: 'No branches assigned' }, { status: 400 })
  }

  // For super_admin with no branch filter, fetch all branch IDs
  let targetBranchIds = branchIds
  if (user.globalRole === 'super_admin' && !branchIds.length) {
    // Use empty array — automation batch handles it
    targetBranchIds = []
  }

  try {
    const [automationResult, collectionsResult] = await Promise.all([
      runAutomationBatch(targetBranchIds),
      processCollectionPipeline(targetBranchIds.length ? targetBranchIds : []),
    ])

    // Enqueue a score recompute job
    await enqueueJob('RECOMPUTE_SCORES', { branch_ids: targetBranchIds }).catch(() => {/* non-fatal */})

    return NextResponse.json({
      ok: true,
      automation: automationResult,
      collections: collectionsResult,
      message: `Processed ${automationResult.enrollments_processed} enrollments, created ${automationResult.tasks_created} tasks, advanced ${collectionsResult.advanced} collection stages.`,
    })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
