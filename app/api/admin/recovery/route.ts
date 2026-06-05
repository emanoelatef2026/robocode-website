import { NextRequest, NextResponse }        from 'next/server'
import { getCurrentUser }                    from '@/modules/rbac/guards'
import {
  repairFinanceBalances,
  rebuildMissingContractCodes,
  cleanupOrphanTasks,
  repairOrphanPayments,
  recomputeSessionConsumption,
  regenerateTasksForBranch,
  resetAutomationCooldowns,
  runFullRecoverySuite,
  getRecoverySummary,
} from '@/modules/recovery'

// GET /api/admin/recovery?action=summary
// Returns current recovery needs (no modifications)
export async function GET(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user || user.globalRole !== 'super_admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const action = req.nextUrl.searchParams.get('action')

  if (action === 'summary') {
    const summary = await getRecoverySummary()
    return NextResponse.json({ summary })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}

// POST /api/admin/recovery
// Executes a recovery operation
export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user || user.globalRole !== 'super_admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json().catch(() => ({}))
  const { operation, branch_ids, enrollment_id } = body

  switch (operation) {
    case 'repair_balances':
      return NextResponse.json(await repairFinanceBalances(branch_ids))

    case 'rebuild_codes':
      return NextResponse.json(await rebuildMissingContractCodes())

    case 'cleanup_tasks':
      return NextResponse.json(await cleanupOrphanTasks())

    case 'repair_payments':
      return NextResponse.json(await repairOrphanPayments())

    case 'recompute_sessions':
      return NextResponse.json(await recomputeSessionConsumption(enrollment_id))

    case 'regenerate_tasks':
      return NextResponse.json(await regenerateTasksForBranch(branch_ids ?? []))

    case 'reset_cooldowns':
      return NextResponse.json(await resetAutomationCooldowns(enrollment_id))

    case 'full_suite':
      return NextResponse.json(await runFullRecoverySuite(branch_ids))

    default:
      return NextResponse.json({ error: `Unknown operation: ${operation}` }, { status: 400 })
  }
}
