import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient }       from '@/lib/supabase/service'

// GET /api/cron/finance-maintenance
// Runs daily (see vercel.json). Marks overdue installments and broken payment
// promises. Auth: Vercel Cron sends `Authorization: Bearer ${CRON_SECRET}`.
// Note: auto_fulfill_promises is an AFTER INSERT trigger on finance_payments,
// not a standalone maintenance function — it already runs on every payment
// insert and must not be called directly here.
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  const auth   = req.headers.get('authorization')
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const db = createServiceClient()

  const [overdue, broken] = await Promise.all([
    db.rpc('mark_overdue_installments' as any),
    db.rpc('mark_broken_promises'      as any),
  ])

  const errors = [overdue.error, broken.error].filter(Boolean)
  if (errors.length) {
    return NextResponse.json({ ok: false, errors: errors.map(e => e!.message) }, { status: 500 })
  }

  return NextResponse.json({
    ok: true,
    ran_at:               new Date().toISOString(),
    overdue_installments: overdue.data,
    promises_broken:      broken.data,
  })
}
