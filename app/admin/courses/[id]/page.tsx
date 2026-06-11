import { redirect } from 'next/navigation'

// Course editing is now modal-based from /admin/courses
export default function CourseDetailRedirect() {
  redirect('/admin/courses')
}
