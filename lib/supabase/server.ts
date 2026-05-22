import { createClient } from "@supabase/supabase-js";

// Server-only admin client — uses the service_role key, bypasses RLS.
// ONLY import this inside app/api/ routes or server components.
// NEVER import in "use client" files.
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);
