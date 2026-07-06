import { NextRequest } from 'next/server'
import { timingSafeEqual } from 'crypto'

// Auth: Vercel Cron sends `Authorization: Bearer ${CRON_SECRET}` automatically
// when CRON_SECRET is set as an env var on this project — that header is the
// only thing gating cron routes. Vercel also stamps cron-triggered requests
// with `x-vercel-cron: 1`, which callers may log for observability but must
// never trust on its own since it isn't cryptographically verified.
export function isAuthorizedCronRequest(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false

  const provided = req.headers.get('authorization') ?? ''
  const expected = `Bearer ${secret}`

  const a = Buffer.from(provided)
  const b = Buffer.from(expected)
  // Buffers must be equal length for timingSafeEqual; mismatched length
  // already means "not authorized" without leaking timing info either way.
  if (a.length !== b.length) return false

  return timingSafeEqual(a, b)
}
