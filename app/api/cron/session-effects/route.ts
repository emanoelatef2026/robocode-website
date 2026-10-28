import { NextRequest, NextResponse } from 'next/server'
import { isAuthorizedCronRequest } from '@/lib/cron-auth'
import { processSessionEffects } from '@/modules/instructor-portal/session-effects'
import { createServiceClient } from '@/lib/supabase/service'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET(request: NextRequest) {
  if (!isAuthorizedCronRequest(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    await createServiceClient().rpc('refresh_admin_activity',{p_actor:null})
    return NextResponse.json({ processed: await processSessionEffects(null, 50) })
  } catch (error) {
    console.error('[session-effects] cron failed', error)
    return NextResponse.json({ error: 'Session effects worker failed' }, { status: 500 })
  }
}
