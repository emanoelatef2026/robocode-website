import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import StudioShell from "@/components/studio/StudioShell";

async function verifyStudioSession(): Promise<boolean> {
  const cookieStore = await cookies()
  const token = cookieStore.get('studio_session')?.value
  if (!token) return false
  const expected = process.env.ADMIN_SECRET
  if (!expected) return false
  return token === expected
}

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const authenticated = await verifyStudioSession()
  if (!authenticated) redirect('/studio/login')
  return <StudioShell>{children}</StudioShell>;
}
