// Environment validation for both server (Node.js) and browser (webpack bundle).
//
// IMPORTANT: Do NOT use dynamic process.env[variableName] access here.
// Webpack can only inline NEXT_PUBLIC_* vars when the property name is statically
// known at build time (e.g. process.env.NEXT_PUBLIC_FOO or process.env['NEXT_PUBLIC_FOO']
// with a string literal). Dynamic access like process.env[runtimeVariable] always
// returns undefined in the browser bundle.

type ServerEnv = {
  NEXT_PUBLIC_SUPABASE_URL: string
  NEXT_PUBLIC_SUPABASE_ANON_KEY: string
  SUPABASE_SERVICE_ROLE_KEY: string
}

type PublicEnv = {
  NEXT_PUBLIC_SUPABASE_URL: string
  NEXT_PUBLIC_SUPABASE_ANON_KEY: string
}

/**
 * Returns all server-side required env vars.
 * Only call this in Server Components, Server Actions, or API Route Handlers.
 * SUPABASE_SERVICE_ROLE_KEY is never available in the browser.
 */
export function getServerEnv(): ServerEnv {
  const url      = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey  = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const svcKey   = process.env.SUPABASE_SERVICE_ROLE_KEY

  const missing: string[] = []
  if (!url)     missing.push('NEXT_PUBLIC_SUPABASE_URL')
  if (!anonKey) missing.push('NEXT_PUBLIC_SUPABASE_ANON_KEY')
  if (!svcKey)  missing.push('SUPABASE_SERVICE_ROLE_KEY')

  if (missing.length > 0) {
    const msg = `[env] Missing server-side environment variables: ${missing.join(', ')}. Check your .env.local file.`
    console.error(msg)
    throw new Error(msg)
  }

  return {
    NEXT_PUBLIC_SUPABASE_URL: url!,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: anonKey!,
    SUPABASE_SERVICE_ROLE_KEY: svcKey!,
  }
}

/**
 * Returns the two public (NEXT_PUBLIC_) env vars.
 * Safe to call in Client Components — uses static property access so webpack
 * can inline the values at build time.
 */
export function getPublicEnv(): PublicEnv {
  const url     = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  const missing: string[] = []
  if (!url)     missing.push('NEXT_PUBLIC_SUPABASE_URL')
  if (!anonKey) missing.push('NEXT_PUBLIC_SUPABASE_ANON_KEY')

  if (missing.length > 0) {
    const msg = `[env] Missing client-side environment variables: ${missing.join(', ')}. Check your .env.local file.`
    console.error(msg)
    throw new Error(msg)
  }

  return {
    NEXT_PUBLIC_SUPABASE_URL: url!,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: anonKey!,
  }
}
