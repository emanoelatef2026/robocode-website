import 'server-only'
import { createServiceClient } from '@/lib/supabase/service'

// ── Centralized instructor filter loader ──────────────────────────────────────
// Includes instructors who:
//   (a) are assigned to any visible group (group_instructors),
//   (b) have no instructor_branches record at all (legacy — visible everywhere), OR
//   (c) have an instructor_branches row matching one of branchIds.
// This is the ONLY function all modules should use for instructor filter dropdowns.

export async function getInstructorFilterOptions(branchIds: string[]): Promise<{ id: string; name: string }[]> {
  if (!branchIds.length) return []
  const db = createServiceClient()

  // Step 1 (parallel): all non-deleted instructors + all instructor_branches + visible group IDs
  const [instrRes, instrBranchRes, groupRes] = await Promise.all([
    db.from('instructors')
      .select(`id, users!instructors_user_id_fkey(profiles!profiles_user_id_fkey(first_name, last_name))`)
      .is('deleted_at', null),
    db.from('instructor_branches').select('instructor_id, branch_id'),
    db.from('groups').select('id').in('branch_id', branchIds).is('deleted_at', null),
  ])

  // Step 2 (sequential): group_instructors for visible groups (belt-and-suspenders)
  const groupIds = (groupRes.data ?? []).map((g: any) => g.id as string)
  const groupLinkedIds = new Set<string>()
  if (groupIds.length) {
    const { data: giRows } = await db
      .from('group_instructors')
      .select('instructor_id')
      .in('group_id', groupIds)
    for (const gi of (giRows ?? []) as any[]) {
      if (gi.instructor_id) groupLinkedIds.add(gi.instructor_id as string)
    }
  }

  // Build instructor → assigned branches map
  const instrBranchMap = new Map<string, string[]>()
  for (const ib of (instrBranchRes.data ?? []) as any[]) {
    if (!ib.instructor_id || !ib.branch_id) continue
    const arr = instrBranchMap.get(ib.instructor_id as string) ?? []
    arr.push(ib.branch_id as string)
    instrBranchMap.set(ib.instructor_id as string, arr)
  }

  return ((instrRes.data ?? []) as any[])
    .filter(i => {
      if (groupLinkedIds.has(i.id as string)) return true
      const iBranches = instrBranchMap.get(i.id as string) ?? []
      // Legacy: no instructor_branches record → visible in every branch
      if (!iBranches.length) return true
      return iBranches.some((bid: string) => branchIds.includes(bid))
    })
    .map(i => {
      const prof = (i.users as any)?.profiles ?? {}
      return {
        id:   i.id as string,
        name: [prof.first_name, prof.last_name].filter(Boolean).join(' ') || 'Unknown',
      }
    })
    .sort((a, b) => a.name.localeCompare(b.name))
}
