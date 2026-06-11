import { redirect } from 'next/navigation'

// Course creation is now modal-based from /portal/team-leader/courses
export default function TLNewCourseRedirect() {
  redirect('/portal/team-leader/courses')
}
