// Service role Supabase client — bypasses RLS entirely.
// RULES:
//   1. NEVER import in client components
//   2. NEVER import in proxy.ts
//   3. ONLY import in Server Actions and Route Handlers
//   4. EVERY usage must be preceded by requirePermission() or requireAuth()

import 'server-only'
import { createClient, SupabaseClient } from '@supabase/supabase-js'

let _client: SupabaseClient | undefined

export function createServiceClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !key) {
    throw new Error(
      '[supabase/service] Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.'
    )
  }

  if (!_client) {
    _client = createClient(url, key, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
  }

  return _client
}
