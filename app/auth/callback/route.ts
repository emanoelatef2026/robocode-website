import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { resolveUserPermissions } from '@/modules/rbac/resolver'
import { setSessionCookie } from '@/lib/lms-session'
import { ROLE_PORTAL_MAP } from '@/types/enums'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl
  const code = searchParams.get('code')
  const next  = searchParams.get('next') ?? '/'

  if (!code) {
    return NextResponse.redirect(new URL('/login?error=missing_code', origin))
  }

  try {
    const supabase = await createServerClient()

    // Log which cookies are present (for PKCE debug — no values, just names)
    const allCookies = request.cookies.getAll().map(c => c.name)
    const hasCodeVerifier = allCookies.some(n => n.includes('code-verifier'))
    console.log('[auth/callback] cookies present:', JSON.stringify(allCookies))
    console.log('[auth/callback] has code-verifier cookie:', hasCodeVerifier)
    console.log('[auth/callback] code param length:', code.length)

    // Exchange the Supabase PKCE code for a session
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)
    if (error || !data.user) {
      console.error('[auth/callback] code exchange failed:', JSON.stringify({
        message: error?.message,
        status:  (error as any)?.status,
        code:    (error as any)?.code,
        name:    error?.name,
        __isAuthError: (error as any)?.__isAuthError,
      }))
      return NextResponse.redirect(new URL('/login?error=auth_failed', origin))
    }

    // Resolve permissions from the DB
    const resolved = await resolveUserPermissions(data.user.id)

    // Write the encrypted lms_session cookie
    await setSessionCookie({
      id:          data.user.id,
      email:       data.user.email ?? '',
      globalRole:  resolved.globalRole,
      branchIds:   resolved.branchIds,
      permissions: Array.from(resolved.permissions),
    })

    // Redirect to the requested page or the user's home portal
    const destination = next !== '/'
      ? next
      : ROLE_PORTAL_MAP[resolved.globalRole]

    return NextResponse.redirect(new URL(destination, origin))
  } catch (err) {
    console.error('[auth/callback] unexpected error:', err)
    return NextResponse.redirect(new URL('/login?error=server_error', origin))
  }
}
