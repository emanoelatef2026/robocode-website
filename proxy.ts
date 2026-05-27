// Proxy (Next.js 16 equivalent of Middleware) — route-level auth guard.
//
// Security model:
//   - CMS (/studio): ADMIN_SECRET session token — constant-time compare, no DB query
//   - LMS portals: lms_session JWT — decrypted with HS256, no DB query (optimistic check)
//   - All definitive auth happens inside Server Actions / Server Components via RBAC guards
//
// This file MUST NOT import from lib/supabase/server.ts (no async cookie access).
// The proxy runs before rendering; keep it fast.

import { NextRequest, NextResponse } from 'next/server'
import { jwtVerify } from 'jose'
import type { RoleName } from '@/types/enums'
import { ROLE_PORTAL_MAP } from '@/types/enums'

// ─── Constants ────────────────────────────────────────────────────────────────

const STUDIO_LOGIN  = '/studio/login'
const LMS_LOGIN     = '/login'
const LMS_COOKIE    = 'lms_session'
const STUDIO_COOKIE = 'studio_session'

// ─── Route helpers ────────────────────────────────────────────────────────────

const isStudio = (p: string) =>
  p.startsWith('/studio') && p !== STUDIO_LOGIN && !p.startsWith('/studio/login')

const isApiStudio = (p: string) => p.startsWith('/api/studio')

// Portal prefix → required role (super_admin may bypass to any portal)
const LMS_PORTALS: { prefix: string; role: RoleName }[] = [
  { prefix: '/admin',              role: 'super_admin' },
  { prefix: '/portal/team-leader', role: 'team_leader' },
  { prefix: '/portal/instructor',  role: 'instructor'  },
  { prefix: '/portal/student',     role: 'student'     },
  { prefix: '/portal/parent',      role: 'parent'      },
]

function getLmsPortal(pathname: string) {
  return LMS_PORTALS.find(p => pathname.startsWith(p.prefix)) ?? null
}

// ─── Studio session verification ──────────────────────────────────────────────
// Compares the studio_session cookie value against ADMIN_SECRET (not ADMIN_PASSWORD).
// The session stores the secret token, not the raw password.
function verifyStudioSession(token: string | undefined): boolean {
  if (!token) return false
  const expected = process.env.ADMIN_SECRET
  if (!expected) return false
  // Constant-time comparison to prevent timing side-channels
  if (token.length !== expected.length) return false
  let diff = 0
  for (let i = 0; i < token.length; i++) {
    diff |= token.charCodeAt(i) ^ expected.charCodeAt(i)
  }
  return diff === 0
}

// ─── JWT helpers (sync-safe for proxy) ────────────────────────────────────────

function getSecretKey(): Uint8Array {
  const secret = process.env.LMS_SESSION_SECRET ?? ''
  return new TextEncoder().encode(secret)
}

interface LmsTokenPayload {
  sub: string
  role: RoleName
  permissions: string[]
  branchIds: string[]
}

async function verifyLmsToken(token: string): Promise<LmsTokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey(), { algorithms: ['HS256'] })
    return payload as unknown as LmsTokenPayload
  } catch {
    return null
  }
}

// ─── Main proxy function ──────────────────────────────────────────────────────

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // ── Studio CMS: session token check ──
  if (isStudio(pathname) || isApiStudio(pathname)) {
    const token = request.cookies.get(STUDIO_COOKIE)?.value
    const valid  = verifyStudioSession(token)

    if (!valid) {
      // API studio routes return 401 JSON instead of redirecting
      if (isApiStudio(pathname)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
      const url = new URL(STUDIO_LOGIN, request.url)
      url.searchParams.set('next', pathname)
      return NextResponse.redirect(url)
    }

    return NextResponse.next()
  }

  // ── LMS portal routes: JWT optimistic check ──
  const portal = getLmsPortal(pathname)
  if (!portal) return NextResponse.next()

  const token = request.cookies.get(LMS_COOKIE)?.value

  if (!token) {
    const url = new URL(LMS_LOGIN, request.url)
    url.searchParams.set('next', pathname)
    return NextResponse.redirect(url)
  }

  const claims = await verifyLmsToken(token)

  if (!claims) {
    // Expired or tampered — clear cookie and redirect to login
    const url = new URL(LMS_LOGIN, request.url)
    url.searchParams.set('error', 'session_expired')
    const res = NextResponse.redirect(url)
    res.cookies.delete(LMS_COOKIE)
    return res
  }

  // Super admin can access any portal
  if (claims.role === 'super_admin') return NextResponse.next()

  // Correct portal
  if (claims.role === portal.role) return NextResponse.next()

  // Wrong portal — redirect to their correct portal
  return NextResponse.redirect(new URL(ROLE_PORTAL_MAP[claims.role], request.url))
}

// ─── Matcher ─────────────────────────────────────────────────────────────────

export const config = {
  matcher: [
    '/studio(.*)',
    '/api/studio(.*)',
    '/admin(.*)',
    '/portal/(.*)',
  ],
}
