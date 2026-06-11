// Next.js instrumentation hook — runs once when the server process starts.
// Logs environment variable presence (never values) to confirm .env.local is loaded.
export function register() {
  const check = {
    'NEXT_PUBLIC_SUPABASE_URL':    !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    'NEXT_PUBLIC_SUPABASE_ANON_KEY': !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    'SUPABASE_SERVICE_ROLE_KEY':   !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    'LMS_SESSION_SECRET':          !!process.env.LMS_SESSION_SECRET,
  }

  const missing = Object.entries(check)
    .filter(([, present]) => !present)
    .map(([key]) => key)

  if (missing.length > 0) {
    console.error('[startup] ❌ Missing environment variables:', missing)
    console.error('[startup] Ensure .env.local exists at the project root and contains these keys.')
  } else {
    console.log('[startup] ✓ All required environment variables are present.')
  }

  console.log('[startup] Env check:', check)
}
