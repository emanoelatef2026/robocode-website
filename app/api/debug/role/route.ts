import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// One-time diagnostic route — DELETE after use.
// Protected by BOOTSTRAP_SECRET so it cannot be enumerated.
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token')
  if (!token || token !== process.env.BOOTSTRAP_SECRET) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const email = request.nextUrl.searchParams.get('email')
  if (!email) {
    return NextResponse.json({ error: 'email param required' }, { status: 400 })
  }

  const db = createServiceClient()

  // Find auth user
  const { data: authData } = await db.auth.admin.listUsers()
  const authUser = authData?.users?.find(u => u.email === email)

  if (!authUser) {
    return NextResponse.json({ found: false, email }, { status: 200 })
  }

  // Find user_roles
  const { data: roles, error: rolesError } = await db
    .from('user_roles')
    .select('branch_id, roles(name)')
    .eq('user_id', authUser.id)

  return NextResponse.json({
    found:       true,
    id:          authUser.id,
    email:       authUser.email,
    created_at:  authUser.created_at,
    user_roles:  roles ?? [],
    roles_error: rolesError?.message ?? null,
  })
}
