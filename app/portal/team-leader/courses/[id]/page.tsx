import { redirect } from 'next/navigation'

// Course editing is now modal-based from /portal/team-leader/courses
export default function TLCourseDetailRedirect() {
  redirect('/portal/team-leader/courses')
}
