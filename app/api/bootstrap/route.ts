// Bootstrap endpoint — creates the first Super Admin.
// SECURITY:
//   1. x-bootstrap-secret header must match BOOTSTRAP_SECRET env var
//   2. Aborts with 409 if ANY super_admin role assignment already exists in the DB
// After the first super_admin exists, this endpoint is permanently disabled.

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

export const dynamic = 'force-dynamic'
export const runtime  = 'nodejs'

export async function POST(request: NextRequest) {
  try {
    // ── Auth check ──
    const secret = request.headers.get('x-bootstrap-secret')
    if (!secret || secret !== process.env.BOOTSTRAP_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // ── Build service client (throws if env vars missing) ──
    let db: ReturnType<typeof createServiceClient>
    try {
      db = createServiceClient()
    } catch (err) {
      console.error('[bootstrap] createServiceClient threw:', err)
      return NextResponse.json(
        { error: 'Service client init failed', detail: String(err) },
        { status: 500 }
      )
    }

    // ── Ensure migrations have been applied ──
    console.log('[bootstrap] Looking up super_admin role…')
    const { data: superAdminRole, error: roleError } = await db
      .from('roles')
      .select('id')
      .eq('name', 'super_admin')
      .single()

    if (roleError || !superAdminRole) {
      console.error('[bootstrap] roles lookup failed:', roleError)
      return NextResponse.json(
        { error: 'super_admin role not found. Apply migrations and seed data first.', detail: roleError?.message },
        { status: 500 }
      )
    }
    console.log('[bootstrap] super_admin role id:', superAdminRole.id)

    // ── One-time guard: abort if a super_admin already exists ──
    console.log('[bootstrap] Checking for existing super_admin assignment…')
    const { count: existingCount, error: existingError } = await db
      .from('user_roles')
      .select('id', { count: 'exact', head: true })
      .eq('role_id', superAdminRole.id)

    if (existingError) {
      console.error('[bootstrap] user_roles count failed:', existingError)
      return NextResponse.json(
        { error: 'DB error checking existing admins', detail: existingError.message },
        { status: 500 }
      )
    }
    console.log('[bootstrap] existing super_admin count:', existingCount)

    if ((existingCount ?? 0) > 0) {
      return NextResponse.json(
        { error: 'A super admin already exists. Bootstrap is permanently disabled.' },
        { status: 409 }
      )
    }

    // ── Parse and validate email ──
    let body: { email?: string; password?: string }
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const email = body.email?.trim().toLowerCase()
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'Invalid or missing email address' }, { status: 400 })
    }

    const password = body.password?.trim()
    if (!password || password.length < 6) {
      return NextResponse.json({ error: 'password is required (minimum 6 characters)' }, { status: 400 })
    }
    console.log('[bootstrap] target email:', email)

    // ── Locate or create the auth user ──
    // listUsers() returns page 1 (up to 1000). For fresh projects this is enough.
    // If the user already exists beyond page 1, createUser will return an error we handle below.
    console.log('[bootstrap] Listing auth users…')
    const { data: listData, error: listError } = await db.auth.admin.listUsers({ perPage: 1000 })
    if (listError) {
      console.error('[bootstrap] auth.admin.listUsers failed:', listError)
      return NextResponse.json(
        { error: 'Could not list auth users', detail: listError.message },
        { status: 500 }
      )
    }
    console.log('[bootstrap] auth user count:', listData.users.length)

    let authUser = listData.users.find(u => u.email?.toLowerCase() === email)
    console.log('[bootstrap] existing auth user found:', !!authUser)

    if (!authUser) {
      console.log('[bootstrap] Creating auth user…')
      const { data: created, error: createError } = await db.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      })
      if (createError || !created?.user) {
        console.error('[bootstrap] auth.admin.createUser failed:', createError)
        return NextResponse.json(
          { error: 'Failed to create auth user', detail: createError?.message ?? 'no user returned' },
          { status: 500 }
        )
      }
      authUser = created.user
      console.log('[bootstrap] auth user created:', authUser.id)
    }

    // ── Verify public.users row exists (trigger must have fired) ──
    console.log('[bootstrap] Verifying public.users row…')
    const { data: publicUser, error: publicUserError } = await db
      .from('users')
      .select('id')
      .eq('id', authUser.id)
      .single()

    if (publicUserError || !publicUser) {
      console.error('[bootstrap] public.users row missing after auth user creation:', publicUserError)
      // Trigger may have failed — insert manually
      console.log('[bootstrap] Inserting public.users row manually…')
      const { error: manualInsertError } = await db
        .from('users')
        .insert({ id: authUser.id, email })
      if (manualInsertError) {
        console.error('[bootstrap] Manual public.users insert failed:', manualInsertError)
        return NextResponse.json(
          { error: 'Failed to create public.users row', detail: manualInsertError.message },
          { status: 500 }
        )
      }
      console.log('[bootstrap] public.users row inserted manually')
    } else {
      console.log('[bootstrap] public.users row confirmed:', publicUser.id)
    }

    // ── Assign super_admin role globally (branch_id = null) ──
    console.log('[bootstrap] Inserting user_roles assignment…')
    const { error: assignError } = await db
      .from('user_roles')
      .insert({ user_id: authUser.id, role_id: superAdminRole.id, branch_id: null })

    if (assignError) {
      console.error('[bootstrap] user_roles insert failed:', assignError)
      return NextResponse.json(
        { error: 'Failed to assign role', detail: assignError.message },
        { status: 500 }
      )
    }
    console.log('[bootstrap] super_admin role assigned successfully')

    return NextResponse.json({
      success: true,
      message: `Super admin bootstrapped for ${email}. Sign in at /login with the email and password provided.`,
      userId:  authUser.id,
    })

  } catch (err) {
    // Catches any unhandled throw — surface the real message instead of a blank 500
    console.error('[bootstrap] Unhandled exception:', err)
    return NextResponse.json(
      { error: 'Unhandled server error', detail: String(err) },
      { status: 500 }
    )
  }
}
