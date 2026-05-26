// LMS session cookie — encrypted with jose (HS256).
// Stored as "lms_session" HttpOnly cookie.
// Contains: userId, email, role, permissions, branchIds.
// The proxy reads this for fast route protection — no DB queries.
// Server Actions verify via requirePermission() which also validates Supabase session.

import 'server-only'
import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'
import type { RoleName } from '@/types/enums'
import type { AppUser } from '@/types/app'

const COOKIE_NAME = 'lms_session'
const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000 // 7 days

function getSecretKey(): Uint8Array {
  const secret = process.env.LMS_SESSION_SECRET
  if (!secret) throw new Error('[lms-session] LMS_SESSION_SECRET env var is not set.')
  return new TextEncoder().encode(secret)
}

export interface LmsSessionPayload {
  sub: string        // Supabase user UUID
  email: string
  role: RoleName
  permissions: string[]
  branchIds: string[]
  exp: number
  iat: number
}

export async function encryptSession(payload: Omit<LmsSessionPayload, 'iat' | 'exp'>): Promise<string> {
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS)
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(expiresAt)
    .sign(getSecretKey())
}

export async function decryptSession(token: string): Promise<LmsSessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey(), { algorithms: ['HS256'] })
    return payload as unknown as LmsSessionPayload
  } catch {
    return null
  }
}

// ── Cookie helpers ────────────────────────────────────────────────────────────

export async function setSessionCookie(user: AppUser): Promise<void> {
  const token = await encryptSession({
    sub:         user.id,
    email:       user.email,
    role:        user.globalRole,
    permissions: user.permissions,
    branchIds:   user.branchIds,
  })

  const cookieStore = await cookies()
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure:   process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path:     '/',
    maxAge:   SESSION_DURATION_MS / 1000,
  })
}

export async function getSessionCookie(): Promise<LmsSessionPayload | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get(COOKIE_NAME)?.value
  if (!token) return null
  return decryptSession(token)
}

export async function deleteSessionCookie(): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.delete(COOKIE_NAME)
}

// Refresh the session expiry without changing claims.
// Call this in portal layouts to keep the session alive.
export async function refreshSessionCookie(): Promise<void> {
  const session = await getSessionCookie()
  if (!session) return

  const { sub, email, role, permissions, branchIds } = session
  const token = await encryptSession({ sub, email, role, permissions, branchIds })

  const cookieStore = await cookies()
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure:   process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path:     '/',
    maxAge:   SESSION_DURATION_MS / 1000,
  })
}
