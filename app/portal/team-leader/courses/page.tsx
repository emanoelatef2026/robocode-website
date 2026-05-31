import { requirePortalRole, requirePermission } from '@/modules/rbac/guards'
import { listCourses }                          from '@/modules/courses/queries'
import PageHeader                               from '@/components/admin/PageHeader'
import EmptyState                               from '@/components/admin/EmptyState'
import Pagination                               from '@/components/admin/Pagination'
import SearchInput                              from '@/components/admin/SearchInput'
import Link                                     from 'next/link'

interface Props {
  searchParams: Promise<{ page?: string; q?: string }>
}

export default async function TLCoursesPage({ searchParams }: Props) {
  await requirePortalRole('team_leader')
  await requirePermission('manage_courses')

  const params = await searchParams
  const page   = Number(params.page ?? 1)
  const search = params.q ?? ''

  const result = await listCourses({ page, perPage: 20, search })

  return (
    <div>
      <PageHeader
        title="Courses"
        description={`${result.total} course${result.total !== 1 ? 's' : ''}`}
        action={
          <Link
            href="/portal/team-leader/courses/new"
            className="inline-flex items-center gap-2 rounded-lg bg-[#FF8A1F] px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-[#e87c18]"
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
              <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" />
            </svg>
            New Course
          </Link>
        }
      />

      <div className="rounded-xl border border-[#E2E8F0] bg-white">
        <div className="flex flex-wrap items-center gap-3 border-b border-[#E2E8F0] px-4 py-3">
          <SearchInput placeholder="Search courses…" />
        </div>

        {result.data.length === 0 ? (
          <EmptyState
            title="No courses found"
            description={search ? 'Try a different search term.' : 'No courses available yet.'}
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                    <th className="px-4 py-3 text-left text-xs font-medium text-[#64748B]">Title</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-[#64748B]">Level</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-[#64748B]">Scope</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-[#64748B]">Published</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {result.data.map(course => (
                    <tr key={course.id} className="border-b border-[#E2E8F0] last:border-0 hover:bg-[#F8FAFC]">
                      <td className="px-4 py-3 font-medium text-[#0B1F3A]">{course.title}</td>
                      <td className="px-4 py-3 capitalize text-[#64748B]">{course.level ?? '—'}</td>
                      <td className="px-4 py-3 capitalize text-[#64748B]">{course.scope ?? '—'}</td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${course.is_published ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                          {course.is_published ? 'Published' : 'Draft'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link href={`/portal/team-leader/courses/${course.id}`} className="text-xs font-medium text-[#FF8A1F] hover:underline">
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
