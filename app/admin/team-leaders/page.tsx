import { listTeamLeaders } from '@/modules/team-leaders/queries'
import { requirePermission } from '@/modules/rbac/guards'
import PageHeader from '@/components/admin/PageHeader'
import StatusBadge from '@/components/admin/StatusBadge'
import EmptyState from '@/components/admin/EmptyState'
import Pagination from '@/components/admin/Pagination'
import SearchInput from '@/components/admin/SearchInput'
import Link from 'next/link'

interface Props {
  searchParams: Promise<{ page?: string; q?: string; status?: string }>
}

export default async function TeamLeadersPage({ searchParams }: Props) {
  await requirePermission('manage_system')
  const params = await searchParams
  const page   = Number(params.page ?? 1)
  const search = params.q ?? ''
  const status = params.status as 'active' | 'inactive' | undefined

  const result = await listTeamLeaders({ page, perPage: 20, search, status })

  return (
    <div>
      <PageHeader
        title="Team Leaders"
        description={`${result.total} team leader${result.total !== 1 ? 's' : ''}`}
        action={
          <Link
            href="/admin/team-leaders/new"
            className="inline-flex items-center gap-2 rounded-lg bg-[#FF8A1F] px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-[#e87c18]"
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
              <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" />
            </svg>
            Add Team Leader
          </Link>
        }
      />

      <div className="rounded-xl border border-[#E2E8F0] bg-white">
        <div className="flex flex-wrap items-center gap-3 border-b border-[#E2E8F0] px-4 py-3">
          <SearchInput placeholder="Search team leaders…" />
        </div>

        {result.data.length === 0 ? (
          <EmptyState
            title="No team leaders found"
            description={search ? 'Try a different search term.' : 'Add the first team leader to get started.'}
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                    <th className="px-4 py-3 text-left text-xs font-medium text-[#64748B]">Name</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-[#64748B]">Code</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-[#64748B]">Email</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-[#64748B]">Branch</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-[#64748B]">Phone</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-[#64748B]">Status</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-[#64748B]">Groups</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-[#64748B]">Students</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {result.data.map((tl) => (
                    <tr key={tl.user_role_id} className="border-b border-[#E2E8F0] last:border-0 hover:bg-[#F8FAFC]">
                      <td className="px-4 py-3 font-medium text-[#0B1F3A]">
                        {tl.first_name && tl.last_name
                          ? `${tl.first_name} ${tl.last_name}`
                          : '—'}
                      </td>
                      <td className="px-4 py-3 text-[#64748B] font-mono text-xs">{tl.tl_code ?? '—'}</td>
                      <td className="px-4 py-3 text-[#64748B]">{tl.email}</td>
                      <td className="px-4 py-3 text-[#64748B]">{tl.branch_name}</td>
                      <td className="px-4 py-3 text-[#64748B]">{tl.phone ?? '—'}</td>
                      <td className="px-4 py-3"><StatusBadge status={tl.status} /></td>
                      <td className="px-4 py-3 text-right font-medium text-[#0B1F3A]">{tl.active_groups}</td>
                      <td className="px-4 py-3 text-right font-medium text-[#0B1F3A]">{tl.active_students}</td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          href={`/admin/team-leaders/${tl.user_id}`}
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
            <Pagination
              page={result.page}
              totalPages={result.totalPages}
              total={result.total}
              perPage={result.perPage}
            />
          </>
        )}
      </div>
    </div>
  )
}
