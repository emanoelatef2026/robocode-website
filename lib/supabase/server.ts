import { createClient, SupabaseClient } from "@supabase/supabase-js";

// ── Admin client (service_role key — bypasses RLS, used in /api/admin/* routes) ──
let _adminClient: SupabaseClient | undefined;
let _adminUrl: string | undefined;

export function getSupabaseAdmin(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      "[supabase] NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not set."
    );
  }

  if (!_adminClient || _adminUrl !== url) {
    _adminUrl = url;
    _adminClient = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }

  return _adminClient;
}

// ── Public client (anon key — subject to RLS, used in /api/book-session) ──
let _publicClient: SupabaseClient | undefined;
let _publicUrl: string | undefined;

export function getSupabasePublic(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error(
      "[supabase] NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY is not set."
    );
  }

  if (!_publicClient || _publicUrl !== url) {
    _publicUrl = url;
    _publicClient = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }

  return _publicClient;
}
