import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl
  const code = searchParams.get('code')
  const type = searchParams.get('type')
  const errorCode = searchParams.get('error_code')

  // Supabase redirects here with error params when the link is expired or invalid
  if (!code) {
    if (errorCode === 'otp_expired' || errorCode === 'access_denied') {
      return NextResponse.redirect(new URL('/forgot-password?error=link_expired', origin))
    }
    return NextResponse.redirect(new URL('/login?error=missing_code', origin))
  }

  try {
    const supabase = await createServerClient()

    // Exchange the PKCE code for a Supabase session (sets auth cookies on response)
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)
    if (error || !data.user) {
      console.error('[auth/callback] code exchange failed:', error?.message)
      return NextResponse.redirect(new URL('/login?error=auth_failed', origin))
    }

    if (type === 'recovery') {
      // Password recovery flow — do NOT set lms_session, just redirect to reset page.
      // The Supabase auth cookies from exchangeCodeForSession give the reset page its session.
      return NextResponse.redirect(new URL('/reset-password', origin))
    }

    // Any other code exchange (e.g. stale magic-link click) — redirect to login
    return NextResponse.redirect(new URL('/login', origin))
  } catch (err) {
    console.error('[auth/callback] unexpected error:', err)
    return NextResponse.redirect(new URL('/login?error=server_error', origin))
  }
}
