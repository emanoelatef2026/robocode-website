import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { deleteSessionCookie } from '@/lib/lms-session'

export async function POST() {
  try {
    const supabase = await createServerClient()
    await supabase.auth.signOut()
    await deleteSessionCookie()
    return NextResponse.json({ ok: true })
  } catch {
    // Always clear the cookie even if Supabase signOut fails
    await deleteSessionCookie()
    return NextResponse.json({ ok: true })
  }
}
