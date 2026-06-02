import { requirePortalRole, requirePermission } from '@/modules/rbac/guards'
import { listAssignments }                      from '@/modules/assignments/queries'
import PageHeader                               from '@/components/admin/PageHeader'
import StatusBadge                              from '@/components/admin/StatusBadge'
import EmptyState                               from '@/components/admin/EmptyState'
import Pagination                               from '@/components/admin/Pagination'
import SearchInput                              from '@/components/admin/SearchInput'
import FilterSelect                             from '@/components/admin/FilterSelect'
import Link                                     from 'next/link'

interface Props {
  searchParams: Promise<{ page?: string; q?: string; type?: string; status?: string }>
}

const TYPE_LABELS: Record<string, string> = {
  homework:     'Homework',
  classwork:    'Classwork',
  project:      'Project',
  quiz:         'Quiz',
  exam:         'Exam',
  presentation: 'Presentation',
  challenge:    'Challenge',
  competition:  'Competition',
}

const TYPE_COLORS: Record<string, string> = {
  homework:     'bg-blue-50 text-blue-700',
  classwork:    'bg-sky-50 text-sky-700',
  project:      'bg-violet-50 text-violet-700',
  quiz:         'bg-amber-50 text-amber-700',
  exam:         'bg-red-50 text-red-700',
  presentation: 'bg-pink-50 text-pink-700',
  challenge:    'bg-orange-50 text-orange-700',
  competition:  'bg-teal-50 text-teal-700',
}

export default async function TLAssignmentsPage({ searchParams }: Props) {
  const user   = await requirePortalRole('team_leader')
  await requirePermission('manage_assignments')

  const params = await searchParams
  const page   = Number(params.page ?? 1)
  const search = params.q ?? ''
  const type   = params.type
  const status = params.status

  const result = await listAssignments({ page, perPage: 20, search, type, status, branchIds: user.branchIds })

  return (
    <div>
      <PageHeader
        title="Assignments"
        description={`${result.total} assignment${result.total !== 1 ? 's' : ''}`}
        action={
          <Link
            href="/portal/team-leader/assignments/new"
            className="inline-flex items-center gap-2 rounded-lg bg-[#FF8A1F] px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-[#e87c18]"
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
              <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" />
            </svg>
            New Assignment
          </Link>
        }
      />

      <div className="rounded-xl border border-[#E2E8F0] bg-white">
        <div className="flex flex-wrap items-center gap-3 border-b border-[#E2E8F0] px-4 py-3">
          <SearchInput placeholder="Search assignments…" />
          <FilterSelect
            name="type"
            value={type ?? ''}
            placeholder="All Types"
            options={Object.entries(TYPE_LABELS).map(([value, label]) => ({ value, label }))}
          />
          <FilterSelect
            name="status"
            value={status ?? ''}
            placeholder="All Statuses"
            options={[
              { value: 'draft',     label: 'Draft'     },
              { value: 'published', label: 'Published' },
              { value: 'archived',  label: 'Archived'  },
            ]}
          />
        </div>

        {result.data.length === 0 ? (
          <EmptyState
            title="No assignments found"
            description={search ? 'Try a different search term.' : 'No assignments in your branch yet.'}
          />
        ) : (
          <>
            {/* Mobile cards */}
            <div className="md:hidden divide-y divide-[#E2E8F0]">
              {result.data.map(a => (
                <div key={a.id} className="px-4 py-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <Link href={`/portal/team-leader/assignments/${a.id}`} className="block text-[15px] font-semibold text-[#0B1F3A] leading-tight">
                        {a.title}
                      </Link>
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${TYPE_COLORS[a.type] ?? 'bg-gray-100 text-gray-600'}`}>
                          {TYPE_LABELS[a.type] ?? a.type}
                        </span>
                        <StatusBadge status={a.status} />
                      </div>
                    </div>
                    <Link href={`/portal/team-leader/assignments/${a.id}`} className="shrink-0 rounded-lg bg-[#FF8A1F]/10 px-3 py-1.5 text-[12px] font-semibold text-[#FF8A1F] min-h-9 flex items-center">
                      Manage →
                    </Link>
                  </div>
                  {a.due_at && (
                    <p className="mt-2 text-[12px] text-[#64748B]">
                      Due: {new Date(a.due_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </p>
                  )}
                </div>
              ))}
            </div>

            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                    <th className="px-4 py-3 text-left text-xs font-medium text-[#64748B]">Title</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-[#64748B]">Type</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-[#64748B]">Due Date</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-[#64748B]">Status</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {result.data.map(a => (
                    <tr key={a.id} className="border-b border-[#E2E8F0] last:border-0 hover:bg-[#F8FAFC]">
                      <td className="px-4 py-3 font-medium text-[#0B1F3A]">{a.title}</td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${TYPE_COLORS[a.type] ?? 'bg-gray-100 text-gray-600'}`}>
                          {TYPE_LABELS[a.type] ?? a.type}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[#64748B]">
                        {a.due_at ? new Date(a.due_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                      </td>
                      <td className="px-4 py-3"><StatusBadge status={a.status} /></td>
                      <td className="px-4 py-3 text-right">
                        <Link href={`/portal/team-leader/assignments/${a.id}`} className="text-xs font-medium text-[#FF8A1F] hover:underline">Manage</Link>
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
