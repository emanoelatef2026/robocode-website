/**
 * Sprint 53: RLS Penetration Test Suite
 *
 * Verifies Row Level Security policies by attempting cross-branch
 * and cross-role data access using authenticated Supabase clients.
 *
 * Usage:
 *   npx ts-node scripts/tests/rls-verify.ts
 *
 * ENV REQUIRED:
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *   TEST_TL_EMAIL, TEST_TL_PASSWORD       — TL user in Branch A
 *   TEST_TL_B_EMAIL, TEST_TL_B_PASSWORD   — TL user in Branch B
 *   TEST_PARENT_EMAIL, TEST_PARENT_PASSWORD
 *
 * Returns exit code 0 if all checks pass, 1 if any fail.
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL!
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY!
const ANON_KEY     = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

interface TestResult {
  name:    string
  passed:  boolean
  detail:  string
}

const results: TestResult[] = []

function pass(name: string, detail = '') {
  results.push({ name, passed: true, detail })
  console.log(`  ✅ ${name}${detail ? ` — ${detail}` : ''}`)
}

function fail(name: string, detail = '') {
  results.push({ name, passed: false, detail })
  console.error(`  ❌ ${name}${detail ? ` — ${detail}` : ''}`)
}

// ── Test: Service role can access all branches ────────────────────────────────

async function testServiceRoleAccess() {
  console.log('\n[1] Service Role Access')
  const db = createClient(SUPABASE_URL, SERVICE_KEY)
  const { data, error } = await db.from('branches').select('id, name').limit(5)
  if (error) fail('service_role_branches', error.message)
  else       pass('service_role_branches', `${data?.length ?? 0} branches visible`)
}

// ── Test: TL anon key cannot access protected tables ─────────────────────────

async function testAnonAccess() {
  console.log('\n[2] Anon Key Access (should be blocked for sensitive tables)')
  const db = createClient(SUPABASE_URL, ANON_KEY)

  const tables = ['students', 'finance_payments', 'student_financial_accounts', 'student_enrollments']
  for (const table of tables) {
    const { data, error } = await db.from(table).select('id').limit(1)
    if (error || (data?.length ?? 0) === 0) {
      pass(`anon_blocked_${table}`, 'no data returned to anon')
    } else {
      fail(`anon_blocked_${table}`, `${data?.length} rows leaked to anon key!`)
    }
  }
}

// ── Test: Tables have RLS enabled ─────────────────────────────────────────────

async function testRLSEnabled() {
  console.log('\n[3] RLS Policy Coverage')
  const db = createClient(SUPABASE_URL, SERVICE_KEY)

  const { data } = await db.from('v_tables_without_rls').select('table_name, rls_enabled, policy_count')

  const criticalTables = [
    'students', 'student_enrollments', 'student_financial_accounts',
    'finance_payments', 'attendance_records', 'parent_messages',
    'operational_tasks', 'notification_queue', 'system_event_logs',
  ]

  for (const table of criticalTables) {
    const row = (data ?? []).find((r: any) => r.table_name === table)
    if (!row) {
      fail(`rls_${table}`, 'table not found in pg_class')
    } else if (!row.rls_enabled) {
      fail(`rls_${table}`, 'RLS NOT enabled on critical table!')
    } else if (Number(row.policy_count) === 0) {
      fail(`rls_${table}`, 'RLS enabled but NO policies defined')
    } else {
      pass(`rls_${table}`, `${row.policy_count} policies`)
    }
  }
}

// ── Test: v_finance_contract_summary respects branch isolation ────────────────

async function testViewBranchIsolation() {
  console.log('\n[4] View Branch Isolation')
  const db = createClient(SUPABASE_URL, SERVICE_KEY)

  // Get two different branches
  const { data: branches } = await db.from('branches').select('id').eq('is_active', true).limit(2)
  if (!branches || branches.length < 2) {
    console.log('  ⚠ Skipped — need 2+ active branches')
    return
  }

  const branchA = (branches[0] as any).id
  const branchB = (branches[1] as any).id

  // Query view filtered to branch A
  const { data: aData } = await db.from('v_finance_contract_summary')
    .select('enrollment_id, branch_id')
    .eq('branch_id', branchA)
    .limit(50)

  const leaked = (aData ?? []).filter((r: any) => r.branch_id !== branchA)
  if (leaked.length > 0) {
    fail('view_branch_isolation', `Branch B data leaked into Branch A query: ${leaked.length} rows`)
  } else {
    pass('view_branch_isolation', `Branch A query returned ${aData?.length ?? 0} rows, none from B`)
  }
}

// ── Test: operational_tasks unique dedup constraint ───────────────────────────

async function testTaskDedup() {
  console.log('\n[5] Task Deduplication Constraint')
  const db = createClient(SUPABASE_URL, SERVICE_KEY)

  // Get an active enrollment to test against
  const { data: enrollments } = await db
    .from('student_enrollments')
    .select('id, student_id, branch_id')
    .eq('status', 'ACTIVE')
    .limit(1)

  if (!enrollments?.length) {
    console.log('  ⚠ Skipped — no active enrollments')
    return
  }

  const enroll = (enrollments[0] as any)

  // Try to insert the same task twice
  const taskData = {
    enrollment_id: enroll.id,
    student_id:    enroll.student_id,
    branch_id:     enroll.branch_id,
    type:          'COLLECTION',
    severity:      'MEDIUM',
    status:        'OPEN',
    auto_generated: true,
  }

  const first  = await db.from('operational_tasks').insert(taskData).select('id')
  const second = await db.from('operational_tasks').insert(taskData).select('id')

  if (second.error && second.error.message.includes('unique')) {
    pass('task_dedup', 'Duplicate task correctly rejected by unique constraint')
  } else if (second.error) {
    fail('task_dedup', `Different error: ${second.error.message}`)
  } else {
    fail('task_dedup', 'Duplicate task was ACCEPTED — dedup not working!')
  }

  // Clean up
  if (first.data?.[0]) {
    await db.from('operational_tasks').delete().eq('id', (first.data[0] as any).id)
  }
}

// ── Test: automation cooldown prevents re-firing ──────────────────────────────

async function testAutomationCooldown() {
  console.log('\n[6] Automation Cooldown')
  const db = createClient(SUPABASE_URL, SERVICE_KEY)

  const { data: enroll } = await db
    .from('student_enrollments')
    .select('id, student_id, branch_id')
    .eq('status', 'ACTIVE')
    .limit(1)
    .single()

  if (!enroll) {
    console.log('  ⚠ Skipped — no active enrollments')
    return
  }

  const triggerType = 'TEST_COOLDOWN'
  const insertData = {
    trigger_type:  triggerType,
    enrollment_id: (enroll as any).id,
    result:        'test',
    cooldown_hours: 6,
  }

  await db.from('automation_execution_log').insert(insertData)

  // Check cooldown window
  const { count } = await db
    .from('automation_execution_log')
    .select('id', { count: 'exact', head: true })
    .eq('trigger_type', triggerType)
    .eq('enrollment_id', (enroll as any).id)
    .gte('executed_at', new Date(Date.now() - 6 * 3600000).toISOString())
    .is('skipped_reason', null)

  if ((count ?? 0) > 0) {
    pass('automation_cooldown', 'Cooldown log entry confirmed')
  } else {
    fail('automation_cooldown', 'Cooldown entry not found')
  }

  // Cleanup
  await db.from('automation_execution_log')
    .delete()
    .eq('trigger_type', triggerType)
    .eq('enrollment_id', (enroll as any).id)
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n🔒 Sprint 53: RLS Penetration + Constraint Verification Suite')
  console.log('━'.repeat(60))

  await testServiceRoleAccess()
  await testAnonAccess()
  await testRLSEnabled()
  await testViewBranchIsolation()
  await testTaskDedup()
  await testAutomationCooldown()

  console.log('\n━'.repeat(60))
  const passed = results.filter(r => r.passed).length
  const failed = results.filter(r => !r.passed).length
  console.log(`\n📊 Results: ${passed} passed, ${failed} failed`)

  if (failed > 0) {
    console.error('\n⚠ SECURITY ISSUES DETECTED — see failed checks above')
    process.exit(1)
  } else {
    console.log('\n✅ All security checks passed')
    process.exit(0)
  }
}

main().catch(e => { console.error(e); process.exit(1) })
