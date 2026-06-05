import { NextResponse }    from 'next/server'
import { pingDatabase }    from '@/modules/deployment/checks'

// GET /api/system/health
// Fast health check for load balancers and uptime monitors.
// No auth required — returns minimal status.
export async function GET() {
  const { ok, latency_ms } = await pingDatabase()

  if (!ok) {
    return NextResponse.json(
      { status: 'unhealthy', db: 'error', latency_ms },
      { status: 503 }
    )
  }

  return NextResponse.json(
    {
      status:     'healthy',
      db:         'ok',
      latency_ms,
      version:    'sprint52',
      timestamp:  new Date().toISOString(),
    },
    { status: 200 }
  )
}
