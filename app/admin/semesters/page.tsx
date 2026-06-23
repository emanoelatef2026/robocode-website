import { listSemesters } from '@/modules/semesters/queries'
import { listAcademicYears } from '@/modules/academic-years/queries'
import { requirePermission } from '@/modules/rbac/guards'
import EmptyState from '@/components/admin/EmptyState'
import Pagination from '@/components/admin/Pagination'
import SearchInput from '@/components/admin/SearchInput'
import FilterSelect from '@/components/admin/FilterSelect'
import Link from 'next/link'
import { TopbarAction } from '@/components/admin/TopbarActionContext'

interface Props {
  searchParams: Promise<{ page?: string; q?: string; status?: string; year?: string }>
}

const STATUS_COLORS: Record<string, string> = {
  planned:   'bg-yellow-50 text-yellow-700 border-yellow-200',
  active:    'bg-green-50 text-green-700 border-green-200',
  completed: 'bg-blue-50 text-blue-700 border-blue-200',
  archived:  'bg-gray-50 text-gray-500 border-gray-200',
}

function SemesterStatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium capitalize ${STATUS_COLORS[status] ?? 'bg-gray-50 text-gray-500 border-gray-200'}`}>
      {status}
    </span>
  )
}

export default async function SemestersPage({ searchParams }: Props) {
  await requirePermission('manage_semesters')
  const params         = await searchParams
  const page           = Number(params.page ?? 1)
  const search         = params.q ?? ''
  const status         = params.status
  const academicYearId = params.year

  const [result, years] = await Promise.all([
    listSemesters({ page, perPage: 20, search, status, academicYearId }),
    listAcademicYears(),
  ])

  return (
    <div>
      <TopbarAction>
        <Link
          href="/admin/semesters/new"
          className="inline-flex h-9 shrink-0 items-center gap-2 rounded-lg bg-[#FF8A1F] px-4 text-[13px] font-semibold text-white transition hover:bg-[#e87c18] active:scale-95"
        >
          <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
            <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" />
          </svg>
          New Semester
        </Link>
      </TopbarAction>
      <div className="mb-6 flex justify-end">
        <Link
          href="/admin/semesters/academic-years"
          className="rounded-lg border border-[#E2E8F0] px-4 py-2 text-sm font-medium text-[#64748B] transition hover:border-[#CBD5E1]"
        >
          Academic Years
        </Link>
      </div>

      <div className="rounded-xl border border-[#E2E8F0] bg-white">
        <div className="flex flex-wrap items-center gap-3 border-b border-[#E2E8F0] px-4 py-3">
          <SearchInput placeholder="Search semesters…" />
          <FilterSelect
            name="status"
            value={status ?? ''}
            placeholder="All statuses"
            options={[
              { value: 'planned',   label: 'Planned' },
              { value: 'active',    label: 'Active' },
              { value: 'completed', label: 'Completed' },
              { value: 'archived',  label: 'Archived' },
            ]}
          />
          <FilterSelect
            name="year"
            value={academicYearId ?? ''}
            placeholder="All years"
            options={years.map((y) => ({ value: y.id, label: y.name }))}
          />
        </div>

        {result.data.length === 0 ? (
          <EmptyState
            title="No semesters found"
            description={search ? 'Try a different search term.' : 'Create the first semester to get started.'}
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                    <th className="px-4 py-3 text-left text-xs font-medium text-[#64748B]">Code</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-[#64748B]">Semester</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-[#64748B]">Academic Year</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-[#64748B]">Dates</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-[#64748B]">Enrolled</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-[#64748B]">Status</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {result.data.map((sem) => (
                    <tr key={sem.id} className="border-b border-[#E2E8F0] last:border-0 hover:bg-[#F8FAFC]">
                      <td className="px-4 py-3">
                        <Link href={`/admin/semesters/${sem.id}`} className="font-mono text-xs font-semibold text-[#0B1F3A] hover:text-[#FF8A1F]">
                          {sem.slug}
                        </Link>
                      </td>
                      <td className="px-4 py-3 font-medium text-[#0B1F3A]">{sem.name}</td>
                      <td className="px-4 py-3 text-[#64748B]">{sem.academic_year_name}</td>
                      <td className="px-4 py-3 text-[#64748B]">
                        {new Date(sem.start_date).toLocaleDateString('en-GB', { month: 'short', day: 'numeric' })}
                        {' – '}
                        {new Date(sem.end_date).toLocaleDateString('en-GB', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </td>
                      <td className="px-4 py-3 text-[#64748B]">
                        {sem.enrolled_count}{sem.max_capacity ? ` / ${sem.max_capacity}` : ''}
                      </td>
                      <td className="px-4 py-3">
                        <SemesterStatusBadge status={sem.status} />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link href={`/admin/semesters/${sem.id}`} className="text-xs font-medium text-[#FF8A1F] hover:underline">View</Link>
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
