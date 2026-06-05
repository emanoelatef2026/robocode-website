import { redirect } from 'next/navigation'

// Create is now modal-based — redirect to student list where modal opens
export default function TLNewStudentPage() {
  redirect('/portal/team-leader/students')
}
