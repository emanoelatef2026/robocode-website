import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser }            from '@/modules/rbac/guards'
import { listRecentJobs, enqueueJob } from '@/modules/background-jobs'
import type { JobType }               from '@/modules/background-jobs'

// GET /api/jobs — list recent background jobs (admin visibility)
export async function GET(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user || !['super_admin', 'admin'].includes(user.globalRole)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const limit = parseInt(req.nextUrl.searchParams.get('limit') ?? '50')
  const jobs  = await listRecentJobs({ limit })
  return NextResponse.json(jobs)
}

// POST /api/jobs — enqueue a job manually
export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user || user.globalRole !== 'super_admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { type, payload = {}, branch_id } = await req.json()
  if (!type) return NextResponse.json({ error: 'type is required' }, { status: 400 })

  const id = await enqueueJob(type as JobType, payload, { branchId: branch_id })
  return NextResponse.json({ ok: true, id })
}
