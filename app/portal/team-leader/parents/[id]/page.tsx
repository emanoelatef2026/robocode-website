import { redirect } from 'next/navigation'

// Detail view is now drawer-based — redirect to parents list
export default function TLParentDetailPage() {
  redirect('/portal/team-leader/parents')
}
