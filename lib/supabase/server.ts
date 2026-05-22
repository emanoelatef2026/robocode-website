import { createClient, SupabaseClient } from "@supabase/supabase-js";

// Module-level variable — undefined at build time, populated on first runtime call.
// Using a lazy singleton so warm Vercel function instances reuse the same client.
let _client: SupabaseClient | undefined;

export function getSupabaseAdmin(): SupabaseClient {
  if (!_client) {
    _client = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    );
  }
  return _client;
}
