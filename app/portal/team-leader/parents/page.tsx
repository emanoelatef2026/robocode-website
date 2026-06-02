import { requirePortalRole }     from '@/modules/rbac/guards'
import { listParentsByBranch }   from '@/modules/tl-dashboard/queries'
import PageHeader                from '@/components/admin/PageHeader'
import EmptyState                from '@/components/admin/EmptyState'
import Pagination                from '@/components/admin/Pagination'
import SearchInput               from '@/components/admin/SearchInput'
import Link                      from 'next/link'

interface Props {
  searchParams: Promise<{ page?: string; q?: string }>
}

export default async function TLParentsPage({ searchParams }: Props) {
  const user   = await requirePortalRole('team_leader')
  const params = await searchParams
  const page   = Number(params.page ?? 1)
  const search = params.q ?? ''

  const result = await listParentsByBranch(user.branchIds, { page, perPage: 20, search })

  return (
    <div>
      <PageHeader
        title="Parents"
        description={`${result.total} parent${result.total !== 1 ? 's' : ''} in your branch`}
        action={
          <Link
            href="/portal/team-leader/parents/new"
            className="inline-flex items-center gap-2 rounded-lg bg-[#FF8A1F] px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-[#e87c18]"
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
              <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" />
            </svg>
            Add Parent
          </Link>
        }
      />

      <div className="rounded-xl border border-[#E2E8F0] bg-white">
        <div className="flex flex-wrap items-center gap-3 border-b border-[#E2E8F0] px-4 py-3">
          <SearchInput placeholder="Search parents by name or email…" />
        </div>

        {result.data.length === 0 ? (
          <EmptyState
            title="No parents found"
            description={search ? 'Try a different search term.' : 'No parents are linked to students in your branch yet.'}
          />
        ) : (
          <>
            {/* Mobile cards */}
            <div className="md:hidden divide-y divide-[#E2E8F0]">
              {result.data.map(parent => {
                const name = [parent.first_name, parent.last_name].filter(Boolean).join(' ') || '—'
                return (
                  <div key={parent.id} className="px-4 py-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <Link href={`/portal/team-leader/parents/${parent.id}`} className="block text-[15px] font-semibold text-[#0B1F3A] leading-tight">
                          {name}
                        </Link>
                        {parent.email && <p className="mt-0.5 text-[12px] text-[#64748B] truncate">{parent.email}</p>}
                      </div>
                      <span className="shrink-0 rounded-full bg-[#F1F5F9] px-2.5 py-1 text-[12px] font-semibold text-[#64748B]">
                        {parent.student_count} child{parent.student_count !== 1 ? 'ren' : ''}
                      </span>
                    </div>
                    <div className="mt-2 flex items-center justify-between gap-2">
                      {parent.phone
                        ? <a href={`tel:${parent.phone}`} className="text-[13px] font-medium text-[#0B1F3A]">{parent.phone}</a>
                        : <span className="text-[12px] text-[#94A3B8]">No phone</span>
                      }
                      <Link href={`/portal/team-leader/parents/${parent.id}`} className="rounded-lg bg-[#FF8A1F]/10 px-3 py-1.5 text-[12px] font-semibold text-[#FF8A1F] min-h-9 flex items-center">
                        View →
                      </Link>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                    <th className="px-4 py-3 text-left text-xs font-medium text-[#64748B]">Name</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-[#64748B]">Email</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-[#64748B]">Phone</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-[#64748B]">Children</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {result.data.map(parent => (
                    <tr key={parent.id} className="border-b border-[#E2E8F0] last:border-0 hover:bg-[#F8FAFC]">
                      <td className="px-4 py-3 font-medium text-[#0B1F3A]">
                        {[parent.first_name, parent.last_name].filter(Boolean).join(' ') || '—'}
                      </td>
                      <td className="px-4 py-3 text-[#64748B]">{parent.email ?? '—'}</td>
                      <td className="px-4 py-3 text-[#64748B]">{parent.phone ?? '—'}</td>
                      <td className="px-4 py-3 text-right font-medium text-[#0B1F3A]">{parent.student_count}</td>
                      <td className="px-4 py-3 text-right">
                        <Link href={`/portal/team-leader/parents/${parent.id}`} className="text-xs font-medium text-[#FF8A1F] hover:underline">View</Link>
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
