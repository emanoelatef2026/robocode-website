import { redirect } from 'next/navigation'

// Create is now modal-based — redirect to parents list where modal opens
export default function TLNewParentPage() {
  redirect('/portal/team-leader/parents')
}
