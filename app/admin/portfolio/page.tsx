import { listStudentPortfolioSummaries } from '@/modules/portfolio/queries'
import { requirePermission } from '@/modules/rbac/guards'
import PageHeader from '@/components/admin/PageHeader'
import EmptyState from '@/components/admin/EmptyState'
import SearchInput from '@/components/admin/SearchInput'
import Link from 'next/link'

interface Props {
  searchParams: Promise<{ q?: string }>
}

export default async function PortfolioListPage({ searchParams }: Props) {
  const user   = await requirePermission('manage_portfolio')
  const params = await searchParams
  const search = params.q ?? ''

  const branchIds = user.globalRole === 'super_admin' ? undefined : user.branchIds
  const summaries = await listStudentPortfolioSummaries(search, branchIds)

  return (
    <div>
      <PageHeader
        title="Student Portfolios"
        description={`${summaries.length} student${summaries.length !== 1 ? 's' : ''}`}
      />

      <div className="rounded-xl border border-[#E2E8F0] bg-white">
        <div className="flex flex-wrap items-center gap-3 border-b border-[#E2E8F0] px-4 py-3">
          <SearchInput placeholder="Search students…" />
        </div>

        {summaries.length === 0 ? (
          <EmptyState
            title="No portfolios found"
            description={search ? 'Try a different search term.' : 'Student portfolios will appear here once created.'}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                  <th className="px-4 py-3 text-left text-xs font-medium text-[#64748B]">Student</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-[#64748B]">Branch</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-[#64748B]">Projects</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-[#64748B]">Featured</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-[#64748B]">Achievements</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-[#64748B]">Badges</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {summaries.map((s) => (
                  <tr key={s.student_id} className="border-b border-[#E2E8F0] last:border-0 hover:bg-[#F8FAFC]">
                    <td className="px-4 py-3">
                      <div className="font-medium text-[#0B1F3A]">{s.student_name}</div>
                      <div className="text-xs text-[#64748B]">{s.student_email}</div>
                    </td>
                    <td className="px-4 py-3 text-[#64748B]">{s.branch_name}</td>
                    <td className="px-4 py-3 text-center text-[#0B1F3A]">{s.project_count}</td>
                    <td className="px-4 py-3 text-center text-[#0B1F3A]">{s.featured_count}</td>
                    <td className="px-4 py-3 text-center text-[#0B1F3A]">{s.achievement_count}</td>
                    <td className="px-4 py-3 text-center text-[#0B1F3A]">{s.badge_count}</td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/admin/portfolio/${s.student_id}`}
                        className="text-xs font-medium text-[#FF8A1F] hover:underline"
                      >
                        Manage
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
