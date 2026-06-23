import { listBranches } from '@/modules/branches/queries'
import { requirePermission } from '@/modules/rbac/guards'
import StatusBadge from '@/components/admin/StatusBadge'
import EmptyState from '@/components/admin/EmptyState'
import Pagination from '@/components/admin/Pagination'
import SearchInput from '@/components/admin/SearchInput'
import Link from 'next/link'
import { TopbarAction } from '@/components/admin/TopbarActionContext'

interface Props {
  searchParams: Promise<{ page?: string; q?: string }>
}

export default async function BranchesPage({ searchParams }: Props) {
  await requirePermission('manage_branches')
  const params = await searchParams
  const page   = Number(params.page ?? 1)
  const search = params.q ?? ''

  const result = await listBranches({ page, perPage: 20, search })

  return (
    <div>
      <TopbarAction>
        <Link
          href="/admin/branches/new"
          className="inline-flex h-9 shrink-0 items-center gap-2 rounded-lg bg-[#FF8A1F] px-4 text-[13px] font-semibold text-white transition hover:bg-[#e87c18] active:scale-95"
        >
          <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
            <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" />
          </svg>
          Add Branch
        </Link>
      </TopbarAction>

      <div className="rounded-xl border border-[#E2E8F0] bg-white">
        {/* Toolbar */}
        <div className="flex items-center gap-3 border-b border-[#E2E8F0] px-4 py-3">
          <SearchInput placeholder="Search branches…" />
        </div>

        {result.data.length === 0 ? (
          <EmptyState
            title="No branches found"
            description={search ? 'Try a different search term.' : 'Add the first branch to get started.'}
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                    <th className="px-4 py-3 text-left text-xs font-medium text-[#64748B]">Name</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-[#64748B]">Type</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-[#64748B]">Location</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-[#64748B]">Phone</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-[#64748B]">Status</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {result.data.map((branch) => (
                    <tr key={branch.id} className="border-b border-[#E2E8F0] last:border-0 hover:bg-[#F8FAFC]">
                      <td className="px-4 py-3 font-medium text-[#0B1F3A]">{branch.name}</td>
                      <td className="px-4 py-3"><StatusBadge status={branch.type} /></td>
                      <td className="px-4 py-3 text-[#64748B]">{branch.location ?? '—'}</td>
                      <td className="px-4 py-3 text-[#64748B]">{branch.phone ?? '—'}</td>
                      <td className="px-4 py-3">
                        <StatusBadge status={branch.is_active ? 'active' : 'inactive'} />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          href={`/admin/branches/${branch.id}`}
                          className="text-xs font-medium text-[#FF8A1F] hover:underline"
                        >
                          Edit
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
