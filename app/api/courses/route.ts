import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient }       from '@/lib/supabase/service'
import { getCurrentUser }            from '@/modules/rbac/guards'

// GET /api/courses — list all non-deleted courses (used by enrollment wizard)
// Sprint 50.1: No is_published filter — show ALL courses so wizards never appear empty.
export async function GET(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = createServiceClient()
  const { data, error } = await db
    .from('courses')
    .select('id, title, level, description')
    .is('deleted_at', null)
    .order('title')
    .limit(300)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}
