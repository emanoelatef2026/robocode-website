import { redirect } from 'next/navigation'

// Sessions Monitor is now at /admin/attendance
export default function SessionsRedirect() {
  redirect('/admin/attendance')
}
