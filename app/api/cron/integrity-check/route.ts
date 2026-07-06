import { NextRequest, NextResponse } from 'next/server'
import { Resend }                    from 'resend'
import { createServiceClient }       from '@/lib/supabase/service'
import { isAuthorizedCronRequest }   from '@/lib/cron-auth'

export const dynamic = 'force-dynamic'

// GET /api/cron/integrity-check
// Runs daily (see vercel.json). Read-only — counts known data-integrity
// drift indicators (see docs/LMS_FULL_REVIEW_2026-07-05.md §3 and §8 Phase 6),
// persists the result to integrity_check_runs, and alerts if any threshold
// (all currently 0) is breached.
//
// This route never repairs anything — it only measures. Reconciliation is a
// separate, deliberate operation (see the reconcile_* RPCs).

const THRESHOLD = 0

async function countRows(
  db: ReturnType<typeof createServiceClient>,
  table: string,
  column: string,
  apply?: (q: any) => any,
): Promise<number> {
  let q = db.from(table).select(column, { count: 'exact', head: true })
  if (apply) q = apply(q)
  const { count, error } = await q
  if (error) throw new Error(`[${table}] ${error.message}`)
  return count ?? 0
}

async function countStudentsWithoutFinancialAccount(
  db: ReturnType<typeof createServiceClient>,
): Promise<number> {
  const [{ data: students, error: studentsErr }, { data: accounts, error: accountsErr }] =
    await Promise.all([
      db.from('students').select('id').is('deleted_at', null).limit(5000),
      db.from('student_financial_accounts').select('student_id').limit(5000),
    ])
  if (studentsErr)  throw new Error(`[students] ${studentsErr.message}`)
  if (accountsErr)  throw new Error(`[student_financial_accounts] ${accountsErr.message}`)

  const withAccount = new Set((accounts ?? []).map((r: any) => r.student_id as string))
  return ((students ?? []) as any[]).filter(s => !withAccount.has(s.id)).length
}

export async function GET(req: NextRequest) {
  const startedAt = new Date()
  const startedMs = Date.now()

  if (!isAuthorizedCronRequest(req)) {
    console.warn('[cron:integrity-check] unauthorized request', {
      started_at: startedAt.toISOString(),
      has_x_vercel_cron: req.headers.get('x-vercel-cron') != null,
    })
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const db    = createServiceClient()
  const today = startedAt.toISOString().slice(0, 10)
  const oneYearOut = new Date(startedAt.getTime() + 365 * 86400000).toISOString().slice(0, 10)

  let counts: Record<string, number>
  try {
    const [
      consumptionMissing,
      orphanSessions,
      orphanAttendance,
      contractConsumptionMismatch,
      groupOverDelivered,
      attendanceDrift,
      installmentsPastDuePending,
      studentsWithoutFinancialAccount,
      installmentsDueBeyondOneYear,
    ] = await Promise.all([
      countRows(db, 'v_consumption_integrity', 'attendance_record_id', q => q.eq('ledger_state', 'MISSING')),
      countRows(db, 'v_orphan_sessions', 'id'),
      countRows(db, 'v_orphan_attendance', 'attendance_record_id'),
      countRows(db, 'v_contract_consumption_mismatch', 'enrollment_id'),
      countRows(db, 'v_group_count_drift', 'group_id', q => q.eq('delivery_status', 'OVER_DELIVERED')),
      countRows(db, 'v_attendance_drift', 'enrollment_id'),
      countRows(db, 'finance_installments', 'id', q => q.eq('status', 'PENDING').lt('due_date', today)),
      countStudentsWithoutFinancialAccount(db),
      countRows(db, 'finance_installments', 'id', q => q.gt('due_date', oneYearOut)),
    ])

    counts = {
      consumption_missing_ledger:          consumptionMissing,
      orphan_sessions:                     orphanSessions,
      orphan_attendance:                   orphanAttendance,
      contract_consumption_mismatch:       contractConsumptionMismatch,
      group_over_delivered:                groupOverDelivered,
      attendance_drift:                    attendanceDrift,
      installments_past_due_still_pending: installmentsPastDuePending,
      students_without_financial_account:  studentsWithoutFinancialAccount,
      installments_due_beyond_one_year:    installmentsDueBeyondOneYear,
    }
  } catch (err) {
    console.error('[cron:integrity-check] query failed', err)
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    )
  }

  const breached = Object.entries(counts)
    .filter(([, value]) => value > THRESHOLD)
    .map(([key]) => key)
  const ok = breached.length === 0
  const durationMs = Date.now() - startedMs

  const { error: insertErr } = await db.from('integrity_check_runs').insert({
    run_at:      startedAt.toISOString(),
    ok,
    counts,
    breached,
    duration_ms: durationMs,
  })
  if (insertErr) console.error('[cron:integrity-check] failed to persist run', insertErr.message)

  if (!ok) {
    console.error('[cron:integrity-check] thresholds breached', { breached, counts })
    await sendBreachAlert(breached, counts)
  } else {
    console.log('[cron:integrity-check] all clear', { duration_ms: durationMs })
  }

  return NextResponse.json(
    { ok, counts, breached, duration_ms: durationMs },
    { status: ok ? 200 : 500 }
  )
}

// Optional email alert — only fires if both RESEND_API_KEY and
// INTEGRITY_ALERT_EMAIL are configured. Otherwise the non-200 status above
// is what surfaces the breach (Vercel Cron Monitoring flags failed runs).
async function sendBreachAlert(breached: string[], counts: Record<string, number>): Promise<void> {
  const to = process.env.INTEGRITY_ALERT_EMAIL
  if (!to || !process.env.RESEND_API_KEY) return

  try {
    const resend = new Resend(process.env.RESEND_API_KEY)
    const lines = breached.map(key => `- ${key}: ${counts[key]}`).join('\n')
    await resend.emails.send({
      from:    process.env.RESEND_FROM_EMAIL ?? 'Robocode LMS <onboarding@resend.dev>',
      to,
      subject: `[Robocode LMS] Integrity check failed — ${breached.length} threshold(s) breached`,
      text:    `The daily data-integrity check found the following breaches:\n\n${lines}\n\nSee /admin/system-health for details.`,
    })
  } catch (err) {
    console.error('[cron:integrity-check] alert email failed', err)
  }
}
