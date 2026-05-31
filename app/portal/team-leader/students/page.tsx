import { listStudents }                       from '@/modules/students/queries'
import { requirePortalRole, requirePermission } from '@/modules/rbac/guards'
import { createServiceClient }                  from '@/lib/supabase/service'
import { computeHealthScore }                   from '@/modules/tl-dashboard/health-score'
import PageHeader                               from '@/components/admin/PageHeader'
import StatusBadge                              from '@/components/admin/StatusBadge'
import EmptyState                               from '@/components/admin/EmptyState'
import Pagination                               from '@/components/admin/Pagination'
import SearchInput                              from '@/components/admin/SearchInput'
import Link                                     from 'next/link'

interface Props {
  searchParams: Promise<{ page?: string; q?: string; status?: string }>
}

export default async function TLStudentsPage({ searchParams }: Props) {
  const user = await requirePortalRole('team_leader')
  await requirePermission('manage_students')

  const params = await searchParams
  const page   = Number(params.page ?? 1)
  const search = params.q ?? ''
  const status = params.status

  const result = await listStudents({ page, perPage: 20, search, branchId: user.branchIds, status })

  // Batch-load health score data for current page
  const studentIds = result.data.map(s => s.id)
  const healthMap  = new Map<string, ReturnType<typeof computeHealthScore>>()

  if (studentIds.length > 0) {
    const db = createServiceClient()
    const { data: progRows } = await db
      .from('student_course_progress')
      .select('student_id, attendance_score, assignment_score, portfolio_score')
      .in('student_id', studentIds)
      .eq('status', 'active')
      .order('last_calculated_at', { ascending: false })

    // Per student: use most recent active progress row
    const seen = new Set<string>()
    for (const row of (progRows ?? []) as any[]) {
      if (!seen.has(row.student_id)) {
        seen.add(row.student_id)
        healthMap.set(row.student_id, computeHealthScore(
          row.attendance_score ?? 0,
          row.assignment_score ?? 0,
          row.portfolio_score  ?? 0,
        ))
      }
    }
  }

  return (
    <div>
      <PageHeader
        title="Students"
        description={`${result.total} student${result.total !== 1 ? 's' : ''}`}
        action={
          <Link
            href="/portal/team-leader/students/new"
            className="inline-flex items-center gap-2 rounded-lg bg-[#FF8A1F] px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-[#e87c18]"
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
              <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" />
            </svg>
            Add Student
          </Link>
        }
      />

      <div className="rounded-xl border border-[#E2E8F0] bg-white">
        <div className="flex flex-wrap items-center gap-3 border-b border-[#E2E8F0] px-4 py-3">
          <SearchInput placeholder="Search students…" />
        </div>

        {result.data.length === 0 ? (
          <EmptyState
            title="No students found"
            description={search ? 'Try a different search term.' : 'Enroll the first student to get started.'}
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                    <th className="px-4 py-3 text-left text-xs font-medium text-[#64748B]">Code</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-[#64748B]">Name</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-[#64748B]">Group</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-[#64748B]">Health Score</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-[#64748B]">Phone</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-[#64748B]">Parent 1</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-[#64748B]">Grade</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-[#64748B]">Status</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {result.data.map((student) => {
                    const health = healthMap.get(student.id) ?? null
                    return (
                      <tr key={student.id} className="border-b border-[#E2E8F0] last:border-0 hover:bg-[#F8FAFC]">
                        <td className="px-4 py-3">
                          {student.student_code
                            ? <Link href={`/portal/team-leader/students/${student.id}`} className="font-mono text-xs font-semibold text-[#0B1F3A] hover:text-[#FF8A1F]">{student.student_code}</Link>
                            : <span className="text-xs text-[#94A3B8]">—</span>}
                        </td>
                        <td className="px-4 py-3 font-medium text-[#0B1F3A]">
                          {student.first_name && student.last_name
                            ? `${student.first_name} ${student.last_name}`
                            : student.user_email}
                        </td>
                        <td className="px-4 py-3 text-[#64748B]">{student.group_name ?? '—'}</td>
                        <td className="px-4 py-3">
                          {health ? (
                            <div className="flex items-center gap-2">
                              <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${health.cls}`}>
                                {health.label}
                              </span>
                              <span className="text-xs text-[#94A3B8]">{health.score}</span>
                            </div>
                          ) : (
                            <span className="text-xs text-[#94A3B8]">No data</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-[#64748B]">{student.phone ?? '—'}</td>
                        <td className="px-4 py-3 text-[#64748B]">{student.parent_phone_1 ?? '—'}</td>
                        <td className="px-4 py-3 text-[#64748B]">{student.school_grade ?? '—'}</td>
                        <td className="px-4 py-3"><StatusBadge status={student.status} /></td>
                        <td className="px-4 py-3 text-right">
                          <Link href={`/portal/team-leader/students/${student.id}`} className="text-xs font-medium text-[#FF8A1F] hover:underline">View</Link>
                        </td>
                      </tr>
                    )
                  })}
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
