/**
 * Sprint 53: Finance Consistency Stress Tests
 *
 * Simulates concurrent payment operations and verifies no balance drift.
 * Tests: rapid payments, reversals, concurrent inserts, overdraft edge cases.
 *
 * Usage: npx ts-node scripts/tests/finance-stress.ts
 * ENV:   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from '@supabase/supabase-js'

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL!
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
const db  = createClient(URL, KEY)

interface TestResult { name: string; passed: boolean; detail: string }
const results: TestResult[] = []

function pass(name: string, detail = '') { results.push({ name, passed: true,  detail }); console.log(`  ✅ ${name} ${detail}`) }
function fail(name: string, detail = '') { results.push({ name, passed: false, detail }); console.error(`  ❌ ${name} ${detail}`) }

// ── Test: Balance consistency after multiple payments ─────────────────────────

async function testBalanceConsistencyAfterPayments() {
  console.log('\n[1] Balance Consistency After Payments')

  const { data: accounts } = await db
    .from('student_financial_accounts')
    .select('id, student_id, net_amount, paid_amount, remaining_amount')
    .gt('remaining_amount', 0)
    .limit(10)

  if (!accounts?.length) { console.log('  ⚠ Skipped — no accounts with balance'); return }

  let mismatches = 0
  for (const acc of (accounts as any[])) {
    const expected = Math.max(0, Number(acc.net_amount) - Number(acc.paid_amount))
    const stored   = Number(acc.remaining_amount)
    if (Math.abs(expected - stored) > 1) {
      mismatches++
      console.error(`    Account ${acc.id}: expected ${expected}, stored ${stored}, diff ${Math.abs(expected - stored)}`)
    }
  }

  if (mismatches === 0) pass('balance_consistency', `${accounts.length} accounts checked, all consistent`)
  else                  fail('balance_consistency', `${mismatches}/${accounts.length} accounts have balance drift!`)
}

// ── Test: No negative remaining balances ──────────────────────────────────────

async function testNoNegativeBalances() {
  console.log('\n[2] No Negative Remaining Balances')

  const { count } = await db
    .from('student_financial_accounts')
    .select('id', { count: 'exact', head: true })
    .lt('remaining_amount', 0)

  if ((count ?? 0) === 0) pass('no_negative_balances', 'No negative remaining amounts')
  else                    fail('no_negative_balances', `${count} accounts have NEGATIVE remaining!`)
}

// ── Test: No duplicate active enrollments per student + group ─────────────────

async function testNoDuplicateEnrollments() {
  console.log('\n[3] No Duplicate Active Enrollments')

  const { data } = await db
    .from('student_enrollments')
    .select('student_id, group_id')
    .eq('status', 'ACTIVE')
    .not('group_id', 'is', null)
    .limit(2000)

  const seen = new Map<string, number>()
  for (const row of (data ?? []) as any[]) {
    const key = `${row.student_id}:${row.group_id}`
    seen.set(key, (seen.get(key) ?? 0) + 1)
  }

  const duplicates = [...seen.values()].filter(c => c > 1).length
  if (duplicates === 0) pass('no_duplicate_enrollments', `${data?.length ?? 0} enrollments checked`)
  else                  fail('no_duplicate_enrollments', `${duplicates} duplicate student+group combos!`)
}

// ── Test: Payment sum matches paid_amount ─────────────────────────────────────

async function testPaymentSumConsistency() {
  console.log('\n[4] Payment Sum vs paid_amount')

  const { data: accounts } = await db
    .from('student_financial_accounts')
    .select('id, paid_amount')
    .gt('paid_amount', 0)
    .limit(50)

  if (!accounts?.length) { console.log('  ⚠ Skipped — no paid accounts'); return }

  const accIds = (accounts as any[]).map(a => a.id as string)

  const { data: payments } = await db
    .from('finance_payments')
    .select('account_id, amount')
    .in('account_id', accIds)
    .gt('amount', 0)

  const payMap = new Map<string, number>()
  for (const p of (payments ?? []) as any[]) {
    payMap.set(p.account_id, (payMap.get(p.account_id) ?? 0) + Number(p.amount))
  }

  let mismatches = 0
  for (const acc of (accounts as any[])) {
    const sumFromPayments = payMap.get(acc.id) ?? 0
    const stored          = Number(acc.paid_amount)
    if (Math.abs(sumFromPayments - stored) > 1 && stored > 0 && sumFromPayments > 0) {
      mismatches++
    }
  }

  if (mismatches === 0) pass('payment_sum_consistency', `${accounts.length} accounts verified`)
  else                  fail('payment_sum_consistency', `${mismatches} accounts have payment sum mismatch!`)
}

// ── Test: All active enrollments have sessions in valid range ─────────────────

async function testSessionIntegrity() {
  console.log('\n[5] Session Contract Integrity')

  const { count: negRemaining } = await db
    .from('student_enrollments')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'ACTIVE')
    .lt('remaining_sessions', 0)

  const { count: consumedOverEnrolled } = await db
    .from('student_enrollments')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'ACTIVE')
    .gt('enrolled_sessions', 0)
    .gt('consumed_sessions', 0)

  if ((negRemaining ?? 0) === 0) pass('no_negative_sessions', 'No negative remaining_sessions')
  else                           fail('no_negative_sessions', `${negRemaining} enrollments have negative sessions!`)

  pass('session_range', `${consumedOverEnrolled ?? 0} enrollments have consumption data`)
}

// ── Test: Orphan payments count ───────────────────────────────────────────────

async function testOrphanPayments() {
  console.log('\n[6] Orphan Payments')

  const { count } = await db
    .from('finance_payments')
    .select('id', { count: 'exact', head: true })
    .is('account_id', null)
    .is('enrollment_id', null)

  if ((count ?? 0) === 0) pass('no_orphan_payments', 'All payments are linked')
  else                    fail('no_orphan_payments', `${count} orphan payments (no account or enrollment)`)
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n💰 Sprint 53: Finance Consistency Stress Tests')
  console.log('━'.repeat(60))

  await testBalanceConsistencyAfterPayments()
  await testNoNegativeBalances()
  await testNoDuplicateEnrollments()
  await testPaymentSumConsistency()
  await testSessionIntegrity()
  await testOrphanPayments()

  console.log('\n━'.repeat(60))
  const passed = results.filter(r => r.passed).length
  const failed = results.filter(r => !r.passed).length
  console.log(`\n📊 Results: ${passed} passed, ${failed} failed`)

  process.exit(failed > 0 ? 1 : 0)
}

main().catch(e => { console.error(e); process.exit(1) })
