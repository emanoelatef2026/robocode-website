import { createClient, SupabaseClient } from "@supabase/supabase-js";

let _client: SupabaseClient | undefined;
let _clientUrl: string | undefined;

export function getSupabaseAdmin(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      "[supabase] NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not set. " +
      "Add both to your Vercel environment variables."
    );
  }

  // Recreate client if URL changed (e.g. after Turbopack hot-reloads .env.local)
  if (!_client || _clientUrl !== url) {
    _clientUrl = url;
    _client = createClient(url, key, { auth: { persistSession: false } });
  }

  return _client;
}
