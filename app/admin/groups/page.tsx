import { createServiceClient }   from '@/lib/supabase/service'
import { listGroups }             from '@/modules/groups/queries'
import { listBranches }           from '@/modules/branches/queries'
import { listInstructors }        from '@/modules/instructors/queries'
import { requirePermission }      from '@/modules/rbac/guards'
import PageHeader                 from '@/components/admin/PageHeader'
import StatusBadge                from '@/components/admin/StatusBadge'
import EmptyState                 from '@/components/admin/EmptyState'
import Pagination                 from '@/components/admin/Pagination'
import SearchInput                from '@/components/admin/SearchInput'
import AdminFilterSelect          from '@/components/admin/AdminFilterSelect'
import Link                       from 'next/link'

interface Props {
  searchParams: Promise<{
    page?: string; q?: string; branch?: string; status?: string; type?: string; instructor?: string
  }>
}

const GROUP_TYPES    = ['class', 'workshop', 'bootcamp', 'trial', 'makeup']
const GROUP_STATUSES = ['forming', 'active', 'completed', 'cancelled']
const DAYS: Record<string, string> = {
  monday: 'Mon', tuesday: 'Tue', wednesday: 'Wed', thursday: 'Thu',
  friday: 'Fri', saturday: 'Sat', sunday: 'Sun',
}

// Lightweight health signals for list view (no heavy computation)
async function getGroupHealthSignals(groupIds: string[]): Promise<Record<string, { score: number; color: string; label: string }>> {
  if (!groupIds.length) return {}
  const db = createServiceClient()

  const [giRes, gcRes] = await Promise.all([
    db.from('group_instructors').select('group_id').in('group_id', groupIds),
    db.from('group_courses').select('group_id').in('group_id', groupIds).eq('status', 'active'),
  ])

  const withInst   = new Set((giRes.data ?? []).map((r: any) => r.group_id as string))
  const withCourse = new Set((gcRes.data ?? []).map((r: any) => r.group_id as string))

  const result: Record<string, { score: number; color: string; label: string }> = {}
  for (const id of groupIds) {
    const hasInst   = withInst.has(id)
    const hasCourse = withCourse.has(id)
    const score     = (hasInst ? 50 : 0) + (hasCourse ? 50 : 0)
    result[id] = {
      score,
      color: score === 100 ? 'bg-emerald-400' : score >= 50 ? 'bg-amber-400' : 'bg-red-400',
      label: score === 100 ? 'Healthy' : score >= 50 ? 'Attention' : 'Critical',
    }
  }
  return result
}

export default async function GroupsPage({ searchParams }: Props) {
  await requirePermission('manage_groups')
  const params       = await searchParams
  const page         = Number(params.page ?? 1)
  const search       = params.q ?? ''
  const branchId     = params.branch
  const status       = params.status
  const type         = params.type
  const instructorId = params.instructor

  const [result, branchesResult, instructorsResult] = await Promise.all([
    listGroups({ page, perPage: 20, search, branchId, status, type, instructorId }),
    listBranches({ perPage: 100 }),
    listInstructors({ perPage: 200 }),
  ])

  const activeGroupIds = result.data.filter(g => g.status === 'active').map(g => g.id)
  const healthSignals  = await getGroupHealthSignals(activeGroupIds)

  return (
    <div>
      <PageHeader
        title="Groups"
        description={`${result.total} group${result.total !== 1 ? 's' : ''}`}
        action={
          <Link
            href="/admin/groups/new"
            className="inline-flex items-center gap-2 rounded-lg bg-[#FF8A1F] px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-[#e87c18]"
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
              <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" />
            </svg>
            Create Group
          </Link>
        }
      />

      <div className="rounded-xl border border-[#E2E8F0] bg-white">
        <div className="flex flex-wrap items-center gap-2 border-b border-[#E2E8F0] px-4 py-3">
          <SearchInput placeholder="Search groups…" />
          <AdminFilterSelect param="branch"     placeholder="All branches"     options={branchesResult.data.map(b => ({ value: b.id, label: b.name }))} />
          <AdminFilterSelect param="type"       placeholder="All types"        options={GROUP_TYPES.map(t    => ({ value: t,    label: t }))} />
          <AdminFilterSelect param="status"     placeholder="All statuses"     options={GROUP_STATUSES.map(s => ({ value: s,    label: s }))} />
          <AdminFilterSelect param="instructor" placeholder="All instructors"  options={instructorsResult.data.map(i => ({
            value: i.id,
            label: i.first_name && i.last_name ? `${i.first_name} ${i.last_name}` : i.user_email,
          }))} />
        </div>

        {result.data.length === 0 ? (
          <EmptyState title="No groups found" description={search ? 'Try a different search term.' : 'Create the first group to get started.'} />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                    <th className="px-4 py-3 text-left text-xs font-medium text-[#64748B]">Code</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-[#64748B]">Name</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-[#64748B]">Branch</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-[#64748B]">Instructor</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-[#64748B]">Day</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-[#64748B]">Time</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-[#64748B]">Students</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-[#64748B]">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-[#64748B]">Health</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {result.data.map((group) => (
                    <tr key={group.id} className="border-b border-[#E2E8F0] last:border-0 hover:bg-[#F8FAFC]">
                      <td className="px-4 py-3">
                        {group.code
                          ? <Link href={`/admin/groups/${group.id}`} className="font-mono text-xs font-semibold text-[#0B1F3A] hover:text-[#FF8A1F]">{group.code}</Link>
                          : <span className="text-xs text-[#94A3B8]">—</span>}
                      </td>
                      <td className="px-4 py-3 font-medium text-[#0B1F3A]">{group.name}</td>
                      <td className="px-4 py-3 text-[#64748B]">{group.branch_name}</td>
                      <td className="px-4 py-3 text-[#64748B]">{group.instructor_name ?? '—'}</td>
                      <td className="px-4 py-3 text-[#64748B]">{group.day_of_week ? DAYS[group.day_of_week] : '—'}</td>
                      <td className="px-4 py-3 text-[#64748B]">{group.time ?? '—'}</td>
                      <td className="px-4 py-3 text-right font-medium text-[#0B1F3A]">{group.student_count}</td>
                      <td className="px-4 py-3"><StatusBadge status={group.status} /></td>
                      <td className="px-4 py-3">
                        {group.status === 'active' && healthSignals[group.id] ? (
                          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium text-white ${healthSignals[group.id].color}`}>
                            <span className="h-1.5 w-1.5 rounded-full bg-white opacity-80" />
                            {healthSignals[group.id].label}
                          </span>
                        ) : <span className="text-xs text-[#94A3B8]">—</span>}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link href={`/admin/groups/${group.id}`} className="text-xs font-medium text-[#FF8A1F] hover:underline">Manage</Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={result.page} totalPages={result.totalPages} total={result.total} perPage={result.perPage} />
          </>
        )}
      </div>
    </div>
  )
}
