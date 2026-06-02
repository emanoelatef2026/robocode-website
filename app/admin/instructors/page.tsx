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
            {/* Mobile cards */}
            <div className="md:hidden divide-y divide-[#E2E8F0]">
              {result.data.map((i) => {
                const name = i.first_name && i.last_name ? `${i.first_name} ${i.last_name}` : i.user_email
                return (
                  <div key={i.id} className="px-4 py-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <Link href={`/admin/instructors/${i.id}`} className="block text-[15px] font-semibold text-[#0B1F3A] leading-tight">{name}</Link>
                        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-[#64748B]">
                          {i.instructor_code && <span className="font-mono">{i.instructor_code}</span>}
                          {i.branch_name && <span>{i.branch_name}</span>}
                          <span>{i.group_count} group{i.group_count !== 1 ? 's' : ''}</span>
                        </div>
                      </div>
                      <StatusBadge status={i.status} />
                    </div>
                    <div className="mt-2 flex items-center justify-between gap-2">
                      {i.phone
                        ? <a href={`tel:${i.phone}`} className="text-[13px] font-medium text-[#0B1F3A]">{i.phone}</a>
                        : <span />
                      }
                      <Link href={`/admin/instructors/${i.id}`} className="rounded-lg bg-[#FF8A1F]/10 px-3 py-1.5 text-[12px] font-semibold text-[#FF8A1F] min-h-9 flex items-center">
                        Edit →
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
                    <th className="px-4 py-3 text-left text-xs font-medium text-[#64748B]">Code</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-[#64748B]">Name</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-[#64748B]">Branch</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-[#64748B]">Phone</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-[#64748B]">Groups</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-[#64748B]">Status</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {result.data.map((i) => (
                    <tr key={i.id} className="border-b border-[#E2E8F0] last:border-0 hover:bg-[#F8FAFC]">
                      <td className="px-4 py-3">
                        {i.instructor_code
                          ? <Link href={`/admin/instructors/${i.id}`} className="font-mono text-xs font-semibold text-[#0B1F3A] hover:text-[#FF8A1F]">{i.instructor_code}</Link>
                          : <span className="text-xs text-[#94A3B8]">—</span>}
                      </td>
                      <td className="px-4 py-3 font-medium text-[#0B1F3A]">
                        {i.first_name && i.last_name ? `${i.first_name} ${i.last_name}` : i.user_email}
                      </td>
                      <td className="px-4 py-3 text-[#64748B]">{i.branch_name}</td>
                      <td className="px-4 py-3 text-[#64748B]">{i.phone ?? '—'}</td>
                      <td className="px-4 py-3 text-right font-medium text-[#0B1F3A]">{i.group_count}</td>
                      <td className="px-4 py-3"><StatusBadge status={i.status} /></td>
                      <td className="px-4 py-3 text-right">
                        <Link href={`/admin/instructors/${i.id}`} className="text-xs font-medium text-[#FF8A1F] hover:underline">Edit</Link>
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
