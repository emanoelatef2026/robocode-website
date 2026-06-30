import { requirePortalRole } from '@/modules/rbac/guards'
import { createServiceClient } from '@/lib/supabase/service'
import NewSpecialSessionForm from './_components/NewSpecialSessionForm'

export default async function NewSpecialSessionPage() {
  const user = await requirePortalRole('team_leader')
  const db   = createServiceClient()

  const branchIds = user.branchIds ?? []

  // Fetch branches accessible to this TL
  const { data: branches } = await db
    .from('branches')
    .select('id, name')
    .in('id', branchIds.length > 0 ? branchIds : ['__none__'])
    .eq('status', 'active')
    .order('name')

  // Fetch active instructors in those branches
  const { data: instructors } = await db
    .from('instructors')
    .select(
      `id, branch_id,
       users!instructors_user_id_fkey(profiles!profiles_user_id_fkey(first_name, last_name))`
    )
    .eq('status', 'active')
    .is('deleted_at', null)
    .in('branch_id', branchIds.length > 0 ? branchIds : ['__none__'])
    .order('created_at')

  const instructorOptions = (instructors ?? []).map((i: any) => {
    const prof = i.users?.profiles
    return {
      id:        i.id,
      branch_id: i.branch_id,
      name:      prof ? [prof.first_name, prof.last_name].filter(Boolean).join(' ') || 'Unknown' : 'Unknown',
    }
  })

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <h1 className="text-[18px] font-bold text-[#0B1F3A]">New Special Session</h1>
      <NewSpecialSessionForm
        branches={(branches ?? []) as { id: string; name: string }[]}
        instructors={instructorOptions}
      />
    </div>
  )
}
