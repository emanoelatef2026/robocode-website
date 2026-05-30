import { redirect } from 'next/navigation'

interface Props { params: Promise<{ id: string }> }

export default async function NewSessionRedirect({ params }: Props) {
  const { id } = await params
  redirect(`/portal/instructor/groups/${id}`)
}
