import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient }       from '@/lib/supabase/service'
import { getCurrentUser }            from '@/modules/rbac/guards'

// GET /api/courses — list active courses (used by enrollment wizard)
export async function GET(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = createServiceClient()
  const { data } = await db
    .from('courses')
    .select('id, title, level, course_type, description')
    .is('deleted_at', null)
    .order('title')
    .limit(200)

  return NextResponse.json(data ?? [])
}
