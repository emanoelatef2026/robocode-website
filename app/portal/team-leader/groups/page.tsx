import { listGroups }                           from '@/modules/groups/queries'
import { requirePortalRole, requirePermission }  from '@/modules/rbac/guards'
import { getGroupMetrics }                        from '@/modules/tl-dashboard/queries'
import PageHeader                                from '@/components/admin/PageHeader'
import StatusBadge                               from '@/components/admin/StatusBadge'
import EmptyState                                from '@/components/admin/EmptyState'
import Pagination                                from '@/components/admin/Pagination'
import SearchInput                               from '@/components/admin/SearchInput'
import Link                                      from 'next/link'

interface Props {
  searchParams: Promise<{ page?: string; q?: string; status?: string; sort?: string }>
}

const DAYS: Record<string, string> = {
  monday: 'Mon', tuesday: 'Tue', wednesday: 'Wed', thursday: 'Thu',
  friday: 'Fri', saturday: 'Sat', sunday: 'Sun',
}

function PctCell({ value }: { value: number | null }) {
  if (value == null) return <span className="text-xs text-[#94A3B8]">—</span>
  const color = value >= 75 ? 'text-green-600' : value >= 60 ? 'text-yellow-600' : 'text-red-600'
  return <span className={`text-xs font-semibold ${color}`}>{value}%</span>
}

function HealthBadge({ score }: { score: number | null }) {
  if (score == null) return <span className="text-xs text-[#94A3B8]">—</span>
  const cls =
    score >= 90 ? 'bg-green-100 text-green-700'   :
    score >= 75 ? 'bg-blue-100  text-blue-700'    :
    score >= 60 ? 'bg-yellow-100 text-yellow-700' :
                  'bg-red-100   text-red-700'
  const label = score >= 90 ? 'Excellent' : score >= 75 ? 'Good' : score >= 60 ? 'Attention' : 'At Risk'
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${cls}`}>
      {label} ({score})
    </span>
  )
}

type SortKey = 'default' | 'att_asc' | 'health_asc' | 'health_desc'

export default async function TLGroupsPage({ searchParams }: Props) {
  const user = await requirePortalRole('team_leader')
  await requirePermission('manage_groups')

  const params = await searchParams
  const page   = Number(params.page ?? 1)
  const search = params.q ?? ''
  const status = params.status
  const sort   = (params.sort ?? 'default') as SortKey

  const result = await listGroups({ page, perPage: 20, search, branchId: user.branchIds, status })

  const groupIds   = result.data.map(g => g.id)
  const metricsMap = await getGroupMetrics(groupIds)

  let sorted = [...result.data]
  if (sort === 'att_asc') {
    sorted.sort((a, b) => (metricsMap.get(a.id)?.attendance_avg ?? 100) - (metricsMap.get(b.id)?.attendance_avg ?? 100))
  } else if (sort === 'health_asc') {
    sorted.sort((a, b) => (metricsMap.get(a.id)?.health_score ?? 100) - (metricsMap.get(b.id)?.health_score ?? 100))
  } else if (sort === 'health_desc') {
    sorted.sort((a, b) => (metricsMap.get(b.id)?.health_score ?? 0) - (metricsMap.get(a.id)?.health_score ?? 0))
  }

  const sortHref = (key: SortKey) => {
    const base = new URLSearchParams({ ...(search ? { q: search } : {}), ...(status ? { status } : {}) })
    if (key !== 'default') base.set('sort', key)
    const qs = base.toString()
    return `/portal/team-leader/groups${qs ? `?${qs}` : ''}`
  }

  return (
    <div>
      <PageHeader
        title="Groups"
        description={`${result.total} group${result.total !== 1 ? 's' : ''}`}
        action={
          <Link
            href="/portal/team-leader/groups/new"
            className="inline-flex items-center gap-2 rounded-lg bg-[#FF8A1F] px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-[#e87c18]"
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
              <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" />
            </svg>
            New Group
          </Link>
        }
      />

      <div className="rounded-xl border border-[#E2E8F0] bg-white">
        <div className="flex flex-wrap items-center gap-3 border-b border-[#E2E8F0] px-4 py-3">
          <SearchInput placeholder="Search groups…" />
          <div className="ml-auto flex flex-wrap gap-2">
            {([
              { key: 'default',     label: 'Default'            },
              { key: 'att_asc',     label: '↑ Low Attendance'   },
              { key: 'health_asc',  label: '↑ Low Health'       },
              { key: 'health_desc', label: '↓ High Performance' },
            ] as { key: SortKey; label: string }[]).map(({ key, label }) => (
              <Link
                key={key}
                href={sortHref(key)}
                className={[
                  'rounded-full border px-3 py-1 text-[12px] font-medium transition',
                  sort === key
                    ? 'border-[#FF8A1F] bg-[#FF8A1F]/10 text-[#FF8A1F]'
                    : 'border-[#E2E8F0] text-[#64748B] hover:border-[#CBD5E1]',
                ].join(' ')}
              >
                {label}
              </Link>
            ))}
          </div>
        </div>

        {sorted.length === 0 ? (
          <EmptyState
            title="No groups found"
            description={search ? 'Try a different search term.' : 'Create the first group to get started.'}
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                    <th className="px-4 py-3 text-left text-xs font-medium text-[#64748B]">Name</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-[#64748B]">Instructor</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-[#64748B]">Day / Time</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-[#64748B]">Students</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-[#64748B]">Attendance</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-[#64748B]">Homework</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-[#64748B]">Portfolio</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-[#64748B]">Health</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-[#64748B]">Status</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((group) => {
                    const m = metricsMap.get(group.id) ?? null
                    return (
                      <tr key={group.id} className="border-b border-[#E2E8F0] last:border-0 hover:bg-[#F8FAFC]">
                        <td className="px-4 py-3">
                          <p className="font-medium text-[#0B1F3A]">{group.name}</p>
                          {group.code && <p className="font-mono text-[10px] text-[#94A3B8]">{group.code}</p>}
                        </td>
                        <td className="px-4 py-3 text-[#64748B]">{group.instructor_name ?? '—'}</td>
                        <td className="px-4 py-3 text-[#64748B]">
                          {group.day_of_week ? DAYS[group.day_of_week] : '—'}
                          {group.time ? ` · ${group.time}` : ''}
                        </td>
                        <td className="px-4 py-3 text-right font-medium text-[#0B1F3A]">{group.student_count}</td>
                        <td className="px-4 py-3 text-center"><PctCell value={m?.attendance_avg ?? null} /></td>
                        <td className="px-4 py-3 text-center"><PctCell value={m?.assignment_avg ?? null} /></td>
                        <td className="px-4 py-3 text-center"><PctCell value={m?.portfolio_avg  ?? null} /></td>
                        <td className="px-4 py-3"><HealthBadge score={m?.health_score ?? null} /></td>
                        <td className="px-4 py-3"><StatusBadge status={group.status} /></td>
                        <td className="px-4 py-3 text-right">
                          <Link href={`/portal/team-leader/groups/${group.id}`} className="text-xs font-medium text-[#FF8A1F] hover:underline">View</Link>
                        </td>
                      </tr>
                    )
                  })}
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
