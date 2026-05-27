'use server'

import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import { deleteSessionCookie } from '@/lib/lms-session'

export async function signOut(): Promise<void> {
  const supabase = await createServerClient()
  await supabase.auth.signOut()
  await deleteSessionCookie()
  redirect('/login')
}
