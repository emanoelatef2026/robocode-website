import { listGroups } from '@/modules/groups/queries'
import { requirePortalRole } from '@/modules/rbac/guards'
import PageHeader from '@/components/admin/PageHeader'
import StatusBadge from '@/components/admin/StatusBadge'
import EmptyState from '@/components/admin/EmptyState'
import Pagination from '@/components/admin/Pagination'
import SearchInput from '@/components/admin/SearchInput'
import Link from 'next/link'

interface Props {
  searchParams: Promise<{ page?: string; q?: string; status?: string }>
}

export default async function TLGroupsPage({ searchParams }: Props) {
  const user = await requirePortalRole('team_leader')

  const params = await searchParams
  const page   = Number(params.page ?? 1)
  const search = params.q ?? ''
  const status = params.status

  const result = await listGroups({ page, perPage: 20, search, branchId: user.branchIds, status })

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
        </div>

        {result.data.length === 0 ? (
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
                    <th className="px-4 py-3 text-left text-xs font-medium text-[#64748B]">Code</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-[#64748B]">Type</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-[#64748B]">Capacity</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-[#64748B]">Status</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {result.data.map((group) => (
                    <tr key={group.id} className="border-b border-[#E2E8F0] last:border-0 hover:bg-[#F8FAFC]">
                      <td className="px-4 py-3 font-medium text-[#0B1F3A]">{group.name}</td>
                      <td className="px-4 py-3 text-[#64748B]">{group.code ?? '—'}</td>
                      <td className="px-4 py-3 text-[#64748B] capitalize">{group.type}</td>
                      <td className="px-4 py-3 text-[#64748B]">{group.capacity ?? '—'}</td>
                      <td className="px-4 py-3"><StatusBadge status={group.status} /></td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          href={`/portal/team-leader/groups/${group.id}`}
                          className="text-xs font-medium text-[#FF8A1F] hover:underline"
                        >
                          View
                        </Link>
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
