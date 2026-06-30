import { requirePortalRole } from '@/modules/rbac/guards'
import { createServiceClient } from '@/lib/supabase/service'
import NewSpecialSessionForm from './_components/NewSpecialSessionForm'

interface Props {
  searchParams: Promise<{ type?: string }>
}

export default async function NewSpecialSessionPage({ searchParams }: Props) {
  const user = await requirePortalRole('team_leader')
  const db   = createServiceClient()
  const sp   = await searchParams
  const defaultType: 'trial' | 'makeup' = sp.type === 'makeup' ? 'makeup' : 'trial'

  const isSuperAdmin = user.globalRole === 'super_admin'
  const branchIds    = user.branchIds ?? []

  // Branches: all active for super_admin, or TL's assigned branches
  let branchesQuery = db.from('branches').select('id, name').eq('is_active', true).is('deleted_at', null).order('name')
  if (!isSuperAdmin) {
    if (branchIds.length > 0) {
      branchesQuery = (branchesQuery as any).in('id', branchIds)
    } else {
      branchesQuery = (branchesQuery as any).in('id', ['__none__'])
    }
  }
  const { data: branches } = await branchesQuery

  const activeBranchIds = (branches ?? []).map((b: any) => b.id as string)

  // Resolve instructor IDs from both home branch + instructor_branches pivot
  const instructorIdSet = new Set<string>()
  if (activeBranchIds.length > 0) {
    const [homeRes, pivotRes] = await Promise.all([
      db.from('instructors')
        .select('id')
        .eq('status', 'active')
        .is('deleted_at', null)
        .in('branch_id', activeBranchIds),
      db.from('instructor_branches')
        .select('instructor_id')
        .in('branch_id', activeBranchIds),
    ])
    for (const r of (homeRes.data ?? []) as any[]) instructorIdSet.add(r.id)
    for (const r of (pivotRes.data ?? []) as any[]) instructorIdSet.add(r.instructor_id)
  }

  const instructorIds = [...instructorIdSet]

  // Fetch instructor details + their branch assignments
  let instructorOptions: { id: string; branch_ids: string[]; name: string }[] = []
  if (instructorIds.length > 0) {
    const [instrRes, pivotRes] = await Promise.all([
      db.from('instructors')
        .select('id, branch_id, users!instructors_user_id_fkey(profiles!profiles_user_id_fkey(first_name, last_name))')
        .eq('status', 'active')
        .is('deleted_at', null)
        .in('id', instructorIds)
        .order('created_at'),
      db.from('instructor_branches')
        .select('instructor_id, branch_id')
        .in('instructor_id', instructorIds),
    ])

    // Build branch_ids per instructor (home + pivot)
    const pivotMap: Record<string, Set<string>> = {}
    for (const r of (pivotRes.data ?? []) as any[]) {
      if (!pivotMap[r.instructor_id]) pivotMap[r.instructor_id] = new Set()
      pivotMap[r.instructor_id].add(r.branch_id)
    }

    instructorOptions = (instrRes.data ?? []).map((i: any) => {
      const prof      = i.users?.profiles
      const name      = prof ? [prof.first_name, prof.last_name].filter(Boolean).join(' ') || 'Unknown' : 'Unknown'
      const branchSet = pivotMap[i.id] ?? new Set<string>()
      if (i.branch_id) branchSet.add(i.branch_id)
      // Only include branches visible to this page
      const branch_ids = [...branchSet].filter(bid => activeBranchIds.includes(bid))
      return { id: i.id, branch_ids, name }
    })
  }

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <h1 className="text-[18px] font-bold text-[#0B1F3A]">New Special Session</h1>
      <NewSpecialSessionForm
        branches={(branches ?? []) as { id: string; name: string }[]}
        instructors={instructorOptions}
        defaultType={defaultType}
      />
    </div>
  )
}
