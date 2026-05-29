// Proxy (Next.js 16 equivalent of Middleware) — route-level auth guard.
//
// Security model:
//   - CMS (/studio) and LMS portals: lms_session JWT — verified with HS256, no DB query
//   - Studio additionally checks role ∈ {super_admin, team_leader}
//   - All definitive auth happens inside Server Actions / Server Components via RBAC guards
//
// This file MUST NOT import from lib/supabase/server.ts (no async cookie access).
// The proxy runs before rendering; keep it fast.

import { NextRequest, NextResponse } from 'next/server'
import { jwtVerify } from 'jose'
import type { RoleName } from '@/types/enums'
import { ROLE_PORTAL_MAP } from '@/types/enums'

// ─── Constants ────────────────────────────────────────────────────────────────

const STUDIO_LOGIN = '/studio/login'
const LMS_LOGIN    = '/login'
const LMS_COOKIE   = 'lms_session'

const STUDIO_ROLES = new Set<RoleName>(['super_admin', 'team_leader'])

// ─── Route helpers ────────────────────────────────────────────────────────────

const isStudio = (p: string) =>
  p.startsWith('/studio') && p !== STUDIO_LOGIN && !p.startsWith('/studio/login')

const isApiStudio = (p: string) => p.startsWith('/api/studio')

// Portal prefix → allowed roles (super_admin still bypasses everything below)
const LMS_PORTALS: { prefix: string; roles: Set<RoleName> }[] = [
  { prefix: '/admin',              roles: new Set<RoleName>(['super_admin', 'team_leader', 'instructor']) },
  { prefix: '/portal/team-leader', roles: new Set<RoleName>(['team_leader']) },
  { prefix: '/portal/instructor',  roles: new Set<RoleName>(['instructor']) },
  { prefix: '/portal/student',     roles: new Set<RoleName>(['student']) },
  { prefix: '/portal/parent',      roles: new Set<RoleName>(['parent']) },
]

function getLmsPortal(pathname: string) {
  return LMS_PORTALS.find(p => pathname.startsWith(p.prefix)) ?? null
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

  // ── Studio CMS: lms_session JWT with role check ──
  if (isStudio(pathname) || isApiStudio(pathname)) {
    const token = request.cookies.get(LMS_COOKIE)?.value

    if (!token) {
      if (isApiStudio(pathname)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
      const url = new URL(STUDIO_LOGIN, request.url)
      url.searchParams.set('next', pathname)
      return NextResponse.redirect(url)
    }

    const claims = await verifyLmsToken(token)

    if (!claims) {
      if (isApiStudio(pathname)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
      const url = new URL(STUDIO_LOGIN, request.url)
      url.searchParams.set('error', 'session_expired')
      const res = NextResponse.redirect(url)
      res.cookies.delete(LMS_COOKIE)
      return res
    }

    if (!STUDIO_ROLES.has(claims.role)) {
      return NextResponse.redirect(new URL(ROLE_PORTAL_MAP[claims.role], request.url))
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

  // Check if the user's role is allowed on this portal prefix
  if (portal.roles.has(claims.role)) return NextResponse.next()

  // Wrong portal — redirect to their home portal
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
