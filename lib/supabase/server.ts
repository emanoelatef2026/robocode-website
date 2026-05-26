import 'server-only'
import { createServerClient as createSSRServerClient } from '@supabase/ssr'
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

// ── Cookie-aware server client (reads/writes Supabase Auth cookies) ──────────
// Use this in Server Actions and Route Handlers when you need the user's session.
export async function createServerClient() {
  const cookieStore = await cookies()

  return createSSRServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Called from a Server Component — cookie writes are a no-op here.
          }
        },
      },
    }
  )
}

// ── Service-role admin client (bypasses RLS) ──────────────────────────────────
// NEVER import in client components or proxy.ts.
// EVERY call must be preceded by requirePermission() or requireAuth().
let _serviceClient: SupabaseClient | undefined

export function getSupabaseAdmin(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !key) {
    throw new Error('[supabase] NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing.')
  }

  if (!_serviceClient) {
    _serviceClient = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  }

  return _serviceClient
}

// ── Public client (anon key, subject to RLS) ─────────────────────────────────
// Used for public-facing API routes (e.g. /api/book-session).
let _publicClient: SupabaseClient | undefined
let _publicUrl: string | undefined

export function getSupabasePublic(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !key) {
    throw new Error('[supabase] NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY is missing.')
  }

  if (!_publicClient || _publicUrl !== url) {
    _publicUrl = url
    _publicClient = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  }

  return _publicClient
}
