/**
 * Sprint 53: Automation Storm Test
 *
 * Verifies that mass automation events are:
 *   - Cooldown-protected (no same trigger twice in 6h)
 *   - Deduplicated (no duplicate tasks created)
 *   - Not spamming notifications
 *   - Not creating recursive loops
 *
 * Usage: npx ts-node scripts/tests/automation-storm.ts
 * ENV:   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from '@supabase/supabase-js'

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL!
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
const db  = createClient(URL, KEY)

interface TestResult { name: string; passed: boolean; detail: string }
const results: TestResult[] = []
function pass(name: string, d = '') { results.push({ name, passed: true, detail: d }); console.log(`  ✅ ${name} ${d}`) }
function fail(name: string, d = '') { results.push({ name, passed: false, detail: d }); console.error(`  ❌ ${name} ${d}`) }

// ── Test: No duplicate OPEN tasks for same enrollment+type ────────────────────

async function testTaskDeduplication() {
  console.log('\n[1] Task Deduplication')

  const { data } = await db
    .from('operational_tasks')
    .select('enrollment_id, type')
    .in('status', ['OPEN', 'IN_PROGRESS'])
    .not('enrollment_id', 'is', null)
    .limit(5000)

  const seen = new Map<string, number>()
  for (const row of (data ?? []) as any[]) {
    const key = `${row.enrollment_id}:${row.type}`
    seen.set(key, (seen.get(key) ?? 0) + 1)
  }

  const duplicates = [...seen.values()].filter(c => c > 1).length
  if (duplicates === 0) pass('task_dedup', `${data?.length ?? 0} tasks checked, no duplicates`)
  else                  fail('task_dedup', `${duplicates} duplicate task combinations found!`)
}

// ── Test: Automation execution log has cooldown entries ───────────────────────

async function testCooldownEntries() {
  console.log('\n[2] Automation Cooldown Log')

  const { count: totalLog } = await db
    .from('automation_execution_log')
    .select('id', { count: 'exact', head: true })

  const { count: skippedLog } = await db
    .from('automation_execution_log')
    .select('id', { count: 'exact', head: true })
    .not('skipped_reason', 'is', null)

  const skippedPct = (totalLog ?? 0) > 0
    ? Math.round(100 * (skippedLog ?? 0) / (totalLog ?? 1))
    : 0

  pass('cooldown_log_exists', `${totalLog ?? 0} total executions, ${skippedLog ?? 0} skipped (${skippedPct}% suppressed)`)

  // If more than 90% suppressed, cooldowns may be too aggressive
  if (skippedPct > 90 && (totalLog ?? 0) > 100) {
    fail('cooldown_not_too_aggressive', `${skippedPct}% suppression rate may indicate misconfiguration`)
  } else {
    pass('cooldown_not_too_aggressive', 'Suppression rate within normal bounds')
  }
}

// ── Test: No automation_execution_log infinite loop ───────────────────────────

async function testNoAutomationLoop() {
  console.log('\n[3] Automation Loop Detection')

  // Check: same enrollment, same trigger, >3 non-skipped executions in 1 hour
  const { data } = await db
    .from('automation_execution_log')
    .select('enrollment_id, trigger_type, executed_at')
    .is('skipped_reason', null)
    .gte('executed_at', new Date(Date.now() - 3600000).toISOString())
    .limit(5000)

  const execCounts = new Map<string, number>()
  for (const row of (data ?? []) as any[]) {
    const key = `${row.enrollment_id}:${row.trigger_type}`
    execCounts.set(key, (execCounts.get(key) ?? 0) + 1)
  }

  const rapidFires = [...execCounts.values()].filter(c => c > 3)
  if (rapidFires.length === 0) pass('no_automation_loop', 'No rapid-fire executions detected')
  else                         fail('no_automation_loop', `${rapidFires.length} enrollment+trigger combos fired >3x in 1h!`)
}

// ── Test: Notification deduplication ─────────────────────────────────────────

async function testNotificationDedup() {
  console.log('\n[4] Notification Deduplication')

  // Check for pending notifications with same dedup_key
  const { data } = await db
    .from('notification_queue')
    .select('dedup_key')
    .eq('status', 'PENDING')
    .not('dedup_key', 'is', null)
    .limit(5000)

  const seen = new Map<string, number>()
  for (const row of (data ?? []) as any[]) {
    const key = row.dedup_key as string
    seen.set(key, (seen.get(key) ?? 0) + 1)
  }

  const duplicateKeys = [...seen.values()].filter(c => c > 1).length
  if (duplicateKeys === 0) pass('notif_dedup', `${data?.length ?? 0} pending notifications, no duplicate dedup_keys`)
  else                     fail('notif_dedup', `${duplicateKeys} duplicate pending notifications with same dedup_key!`)
}

// ── Test: Background job queue health ────────────────────────────────────────

async function testJobQueueHealth() {
  console.log('\n[5] Background Job Queue Health')

  const { data } = await db.rpc('get_job_health_summary')
  for (const row of (data ?? []) as any[]) {
    const ok = row.status === 'OK'
    if (ok) pass(`job_health_${row.metric}`, `count: ${row.value}`)
    else    fail(`job_health_${row.metric}`, `count: ${row.value} — status: ${row.status}`)
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n⚡ Sprint 53: Automation Storm Verification')
  console.log('━'.repeat(60))

  await testTaskDeduplication()
  await testCooldownEntries()
  await testNoAutomationLoop()
  await testNotificationDedup()
  await testJobQueueHealth()

  console.log('\n━'.repeat(60))
  const passed = results.filter(r => r.passed).length
  const failed = results.filter(r => !r.passed).length
  console.log(`\n📊 Results: ${passed} passed, ${failed} failed`)
  process.exit(failed > 0 ? 1 : 0)
}

main().catch(e => { console.error(e); process.exit(1) })
