import { redirect } from 'next/navigation'

interface Props { params: Promise<{ id: string }> }

export default async function TLGroupEditPage({ params }: Props) {
  const { id } = await params
  redirect(`/portal/team-leader/groups?edit=${id}`)
}
