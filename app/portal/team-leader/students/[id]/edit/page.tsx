import { redirect } from 'next/navigation'

// Edit is now modal-based — redirect to student list where modal can be triggered
interface Props { params: Promise<{ id: string }> }
export default async function TLStudentEditPage({ params }: Props) {
  const { id } = await params
  redirect(`/portal/team-leader/students/${id}`)
}
