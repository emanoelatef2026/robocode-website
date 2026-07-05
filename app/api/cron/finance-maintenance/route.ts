import { NextRequest, NextResponse } from 'next/server'
import { timingSafeEqual }           from 'crypto'
import { createServiceClient }       from '@/lib/supabase/service'

export const dynamic = 'force-dynamic'

// GET /api/cron/finance-maintenance
// Runs daily (see vercel.json). Marks overdue installments/accounts and
// broken payment promises.
//
// Auth: Vercel Cron sends `Authorization: Bearer ${CRON_SECRET}` automatically
// when CRON_SECRET is set as an env var on this project — that header is the
// only thing gating this route. Vercel also stamps cron-triggered requests
// with `x-vercel-cron: 1`, which we log for observability but never trust on
// its own since it isn't cryptographically verified.
//
// Note: auto_fulfill_promises is an AFTER INSERT trigger on finance_payments,
// not a standalone maintenance function — it already runs on every payment
// insert and must not be called directly here.
//
// Idempotency: both RPCs are plain `UPDATE ... WHERE status IN (...) AND
// date < CURRENT_DATE` statements with no INSERTs. A row that already
// transitioned (e.g. PENDING -> OVERDUE) no longer matches the WHERE clause,
// so re-running the same day (or any day) only ever affects newly-eligible
// rows — safe to trigger more than once.
function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false

  const provided = req.headers.get('authorization') ?? ''
  const expected = `Bearer ${secret}`

  const a = Buffer.from(provided)
  const b = Buffer.from(expected)
  // Buffers must be equal length for timingSafeEqual; mismatched length
  // already means "not authorized" without leaking timing info either way.
  if (a.length !== b.length) return false

  return timingSafeEqual(a, b)
}

export async function GET(req: NextRequest) {
  const startedAt = new Date()
  const startedMs = Date.now()

  if (!isAuthorized(req)) {
    console.warn('[cron:finance-maintenance] unauthorized request', {
      started_at:             startedAt.toISOString(),
      has_x_vercel_cron:      req.headers.get('x-vercel-cron') != null,
      has_authorization_header: req.headers.get('authorization') != null,
    })
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const db    = createServiceClient()
  const today = startedAt.toISOString().slice(0, 10)

  // Pre-count exactly what each RPC's WHERE clause will touch this run, for
  // logging/observability — both RPCs return `void`, so this is the only way
  // to report processed counts without changing their (working, idempotent)
  // SQL. On a repeat run within the same window these counts should be ~0.
  const [
    { count: installmentsDue, error: countInstErr },
    { count: accountsGoingOverdue, error: countAcctErr },
    { count: promisesGoingBroken, error: countPromErr },
  ] = await Promise.all([
    db.from('finance_installments').select('id', { count: 'exact', head: true })
      .in('status', ['PENDING', 'PARTIAL']).lt('due_date', today),
    db.from('student_financial_accounts').select('id', { count: 'exact', head: true })
      .in('status', ['CURRENT', 'DUE_SOON']).lt('next_due_date', today).gt('remaining_amount', 0),
    db.from('payment_promises').select('id', { count: 'exact', head: true })
      .eq('status', 'ACTIVE').lt('promised_date', today),
  ])

  const [overdue, broken] = await Promise.all([
    db.rpc('mark_overdue_installments' as any),
    db.rpc('mark_broken_promises'      as any),
  ])

  const completedAt = new Date()
  const durationMs  = Date.now() - startedMs

  const errors = [countInstErr, countAcctErr, countPromErr, overdue.error, broken.error].filter(Boolean)

  const summary = {
    started_at:   startedAt.toISOString(),
    completed_at: completedAt.toISOString(),
    duration_ms:  durationMs,
    processed: {
      installments_marked_overdue: installmentsDue        ?? 0,
      accounts_marked_overdue:     accountsGoingOverdue   ?? 0,
      promises_marked_broken:      promisesGoingBroken    ?? 0,
    },
  }

  if (errors.length) {
    console.error('[cron:finance-maintenance] failed', { ...summary, errors: errors.map(e => e!.message) })
    return NextResponse.json({ ok: false, ...summary, errors: errors.map(e => e!.message) }, { status: 500 })
  }

  console.log('[cron:finance-maintenance] completed', summary)
  return NextResponse.json({ ok: true, ...summary })
}
