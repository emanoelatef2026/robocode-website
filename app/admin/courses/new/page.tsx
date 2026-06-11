import { redirect } from 'next/navigation'

// Course creation is now modal-based from /admin/courses
export default function NewCourseRedirect() {
  redirect('/admin/courses')
}
