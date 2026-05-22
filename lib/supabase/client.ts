import { createClient } from "@supabase/supabase-js";

// Browser-safe client — uses the anon key, respects Row Level Security.
// Safe to import in "use client" components.
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);
