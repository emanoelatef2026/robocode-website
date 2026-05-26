import { listInstructors } from '@/modules/instructors/queries'
import { requirePermission } from '@/modules/rbac/guards'
import PageHeader from '@/components/admin/PageHeader'
import StatusBadge from '@/components/admin/StatusBadge'
import EmptyState from '@/components/admin/EmptyState'
import Pagination from '@/components/admin/Pagination'
import SearchInput from '@/components/admin/SearchInput'
import Link from 'next/link'

interface Props {
  searchParams: Promise<{ page?: string; q?: string; branch?: string }>
}

export default async function InstructorsPage({ searchParams }: Props) {
  await requirePermission('manage_instructors')
  const params   = await searchParams
  const page     = Number(params.page ?? 1)
  const search   = params.q ?? ''
  const branchId = params.branch

  const result = await listInstructors({ page, perPage: 20, search, branchId })

  return (
    <div>
      <PageHeader
        title="Instructors"
        description={`${result.total} instructor${result.total !== 1 ? 's' : ''}`}
        action={
          <Link
            href="/admin/instructors/new"
            className="inline-flex items-center gap-2 rounded-lg bg-[#FF8A1F] px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-[#e87c18]"
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
              <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" />
            </svg>
            Add Instructor
          </Link>
        }
      />

      <div className="rounded-xl border border-[#E2E8F0] bg-white">
        <div className="flex items-center gap-3 border-b border-[#E2E8F0] px-4 py-3">
          <SearchInput placeholder="Search instructors…" />
        </div>

        {result.data.length === 0 ? (
          <EmptyState title="No instructors found" description={search ? 'Try a different search term.' : 'Add the first instructor to get started.'} />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                    <th className="px-4 py-3 text-left text-xs font-medium text-[#64748B]">Name</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-[#64748B]">Email</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-[#64748B]">Branch</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-[#64748B]">Employee ID</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-[#64748B]">Specializations</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-[#64748B]">Status</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {result.data.map((i) => (
                    <tr key={i.id} className="border-b border-[#E2E8F0] last:border-0 hover:bg-[#F8FAFC]">
                      <td className="px-4 py-3 font-medium text-[#0B1F3A]">
                        {i.first_name && i.last_name ? `${i.first_name} ${i.last_name}` : '—'}
                      </td>
                      <td className="px-4 py-3 text-[#64748B]">{i.user_email}</td>
                      <td className="px-4 py-3 text-[#64748B]">{i.branch_name}</td>
                      <td className="px-4 py-3 text-[#64748B]">{i.employee_id ?? '—'}</td>
                      <td className="px-4 py-3 text-[#64748B] max-w-[200px] truncate">
                        {i.specializations.length > 0 ? i.specializations.join(', ') : '—'}
                      </td>
                      <td className="px-4 py-3"><StatusBadge status={i.status} /></td>
                      <td className="px-4 py-3 text-right">
                        <Link href={`/admin/instructors/${i.id}`} className="text-xs font-medium text-[#FF8A1F] hover:underline">
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
