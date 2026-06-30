import { redirect } from 'next/navigation'

// Makeup session creation is restricted to Team Leaders and Super Admins.
// Instructors are redirected to their session list.
export default function InstructorNewMakeupRedirect() {
  redirect('/portal/instructor/special-sessions')
}
