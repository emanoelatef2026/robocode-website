import { requirePermission }          from '@/modules/rbac/guards'
import { listAssignments }            from '@/modules/assignments/queries'
import { getTLAssignmentOverview }    from '@/modules/tl-analytics/queries'
import { listBranches }               from '@/modules/branches/queries'
import SearchInput                    from '@/components/admin/SearchInput'
import Pagination                     from '@/components/admin/Pagination'
import StatusBadge                    from '@/components/admin/StatusBadge'
import EmptyState                     from '@/components/admin/EmptyState'
import Link                           from 'next/link'
import { TopbarAction }               from '@/components/shared/layout/TopbarActionContext'

interface Props {
  searchParams: Promise<{ page?: string; q?: string; type?: string; status?: string; view?: string; branch?: string }>
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
  homework:     'bg-[#EFF6FF] text-[#1D4ED8]',
  classwork:    'bg-sky-50 text-sky-700',
  project:      'bg-violet-50 text-violet-700',
  quiz:         'bg-[#FFFBEB] text-[#B45309]',
  exam:         'bg-[#FEE2E2] text-[#DC2626]',
  presentation: 'bg-pink-50 text-pink-700',
  challenge:    'bg-orange-50 text-orange-700',
  competition:  'bg-teal-50 text-teal-700',
}

function pctBar(pct: number) {
  const color = pct >= 70 ? 'bg-[#10B981]' : pct >= 40 ? 'bg-[#F59E0B]' : 'bg-[#EF4444]'
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-16 rounded-full bg-[#F1F5F9]">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.min(100, pct)}%` }} />
      </div>
      <span className={`text-xs font-medium ${pct >= 70 ? 'text-[#10B981]' : pct >= 40 ? 'text-[#F59E0B]' : 'text-[#EF4444]'}`}>{pct}%</span>
    </div>
  )
}

export default async function AdminAssignmentsPage({ searchParams }: Props) {
  const user   = await requirePermission('manage_assignments')
  const params = await searchParams

  const page        = Number(params.page ?? 1)
  const search      = params.q       ?? ''
  const type        = params.type
  const status      = params.status
  const view        = params.view    ?? 'list'
  const branchParam = params.branch  ?? ''

  const isSuperAdmin = user.globalRole === 'super_admin'

  // Load all branches for scope resolution
  const branchesRes  = await listBranches({ perPage: 200 })
  const allBranchIds = branchesRes.data.map(b => b.id)

  const effectiveBranchIds = branchParam
    ? [branchParam]
    : (isSuperAdmin ? allBranchIds : (user.branchIds.length > 0 ? user.branchIds : allBranchIds))

  // Load list and analytics in parallel
  const [result, analytics] = await Promise.all([
    listAssignments({ page, perPage: 20, search, type, status, branchIds: effectiveBranchIds }),
    getTLAssignmentOverview(effectiveBranchIds),
  ])

  const { kpis, by_group, by_instructor } = analytics

  function buildUrl(overrides: Record<string, string | undefined>) {
    const p: Record<string, string> = {}
    if (search)      p.q      = search
    if (type)        p.type   = type
    if (status)      p.status = status
    if (view !== 'list') p.view = view
    if (branchParam) p.branch = branchParam
    Object.assign(p, overrides)
    Object.keys(p).forEach(k => (p as any)[k] === undefined && delete (p as any)[k])
    return '/admin/assignments?' + new URLSearchParams(p).toString()
  }

  return (
    <div className="space-y-5">

      <TopbarAction>
        <Link
          href="/admin/assignments/new"
          className="inline-flex h-9 shrink-0 items-center gap-2 rounded-lg bg-[#FF8A1F] px-4 text-[13px] font-semibold text-white transition hover:bg-[#e87c18] active:scale-95"
        >
          <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
            <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" />
          </svg>
          New Assignment
        </Link>
      </TopbarAction>

      {/* Branch filter for super admin */}
      {isSuperAdmin && (
        <div className="flex justify-end">
          <form method="get">
            {search      && <input type="hidden" name="q"      value={search} />}
            {type        && <input type="hidden" name="type"   value={type} />}
            {status      && <input type="hidden" name="status" value={status} />}
            {view !== 'list' && <input type="hidden" name="view" value={view} />}
            <select
              name="branch"
              defaultValue={branchParam}
              className="ds-card px-3 py-2 text-sm text-[#0B1F3A] focus:border-[#FF8A1F] focus:outline-none"
            >
              <option value="">All Branches</option>
              {branchesRes.data.map(b => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
            <noscript><button type="submit">Apply</button></noscript>
          </form>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {[
          { label: 'Published',        value: kpis.total_published,      color: 'bg-[#38BDF8]' },
          { label: 'Overdue',          value: kpis.overdue_count,         color: kpis.overdue_count > 0 ? 'bg-[#F59E0B]' : 'bg-[#CBD5E1]' },
          { label: 'Avg Completion',   value: `${kpis.avg_completion_pct}%`, color: kpis.avg_completion_pct >= 70 ? 'bg-[#10B981]' : 'bg-[#EF4444]' },
          { label: 'Pending Review',   value: kpis.pending_review_count, color: kpis.pending_review_count > 0 ? 'bg-[#F59E0B]' : 'bg-[#CBD5E1]' },
          { label: 'Grading Delayed',  value: kpis.grading_delay_count,  color: kpis.grading_delay_count > 0 ? 'bg-[#EF4444]' : 'bg-[#CBD5E1]' },
        ].map(k => (
          <div key={k.label} className="ds-card p-3">
            <div className={`mb-1.5 h-1 w-6 rounded-full ${k.color} opacity-80`} />
            <p className="text-xl font-bold text-[#0B1F3A]">{k.value}</p>
            <p className="text-[11px] text-[#64748B]">{k.label}</p>
          </div>
        ))}
      </div>

      {/* Grading delays alert */}
      {kpis.grading_delay_count > 0 && (
        <div className="rounded-xl border border-[#FECACA] bg-[#FEE2E2] px-4 py-3 flex items-start gap-3">
          <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5 shrink-0 text-[#EF4444] mt-0.5">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" />
          </svg>
          <div>
            <p className="text-sm font-medium text-[#DC2626]">{kpis.grading_delay_count} submissions waiting for review for 3+ days</p>
            <p className="text-xs text-[#EF4444] mt-0.5">Contact instructors to complete pending grading.</p>
          </div>
        </div>
      )}

      {/* View tabs */}
      <div className="flex gap-1 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-1 w-fit">
        {[
          { key: 'list',        label: 'Assignments' },
          { key: 'groups',      label: 'By Group' },
          { key: 'instructors', label: 'By Instructor' },
        ].map(t => (
          <Link
            key={t.key}
            href={buildUrl({ view: t.key, page: '1' })}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              view === t.key ? 'bg-white text-[#0B1F3A] shadow-sm' : 'text-[#64748B] hover:text-[#0B1F3A]'
            }`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {/* ── LIST VIEW ─────────────────────────────────────────────────────────── */}
      {view === 'list' && (
        <div className="ds-card">
          <div className="flex flex-wrap items-center gap-2 border-b border-[#E2E8F0] px-4 py-3">
            <SearchInput placeholder="Search assignments…" />
            <select
              name="type"
              defaultValue={type ?? ''}
              className="rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm text-[#64748B] focus:outline-none"
            >
              <option value="">All Types</option>
              {Object.entries(TYPE_LABELS).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
            <select
              name="status"
              defaultValue={status ?? ''}
              className="rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm text-[#64748B] focus:outline-none"
            >
              <option value="">All Statuses</option>
              <option value="draft">Draft</option>
              <option value="published">Published</option>
              <option value="archived">Archived</option>
            </select>
          </div>

          {result.data.length === 0 ? (
            <EmptyState
              title="No assignments found"
              description={search ? 'Try a different search term.' : 'No assignments in this scope yet.'}
            />
          ) : (
            <>
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="ds-table-head">
                    <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                      <th className="px-4 py-3 text-left text-xs font-medium text-[#64748B]">Title</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-[#64748B]">Type</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-[#64748B]">Course</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-[#64748B]">Due Date</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-[#64748B]">Submissions</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-[#64748B]">Status</th>
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody>
                    {result.data.map(a => {
                      const isOverdue = a.due_at && a.due_at < new Date().toISOString() && a.status === 'published'
                      return (
                        <tr key={a.id} className="ds-table-row">
                          <td className="px-4 py-3">
                            <Link href={`/admin/assignments/${a.id}`} className="font-medium text-[#0B1F3A] hover:text-[#FF8A1F]">{a.title}</Link>
                            {isOverdue && <span className="ml-2 inline-block rounded-full bg-[#FEE2E2] px-1.5 py-0.5 text-[10px] font-medium text-[#EF4444]">Overdue</span>}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${TYPE_COLORS[a.type] ?? 'bg-[#F3F4F6] text-[#4B5563]'}`}>
                              {TYPE_LABELS[a.type] ?? a.type}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-xs text-[#64748B]">{a.course_title ?? '—'}</td>
                          <td className="px-4 py-3 text-xs text-[#64748B]">
                            {a.due_at ? new Date(a.due_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                          </td>
                          <td className="px-4 py-3 text-right text-[#64748B]">{a.submission_count}</td>
                          <td className="px-4 py-3"><StatusBadge status={a.status} /></td>
                          <td className="px-4 py-3 text-right">
                            <Link href={`/admin/assignments/${a.id}`} className="text-xs font-medium text-[#FF8A1F] hover:underline">Manage</Link>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile cards */}
              <div className="md:hidden divide-y divide-[#E2E8F0]">
                {result.data.map(a => (
                  <div key={a.id} className="px-4 py-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <Link href={`/admin/assignments/${a.id}`} className="block text-[15px] font-semibold text-[#0B1F3A] leading-tight">{a.title}</Link>
                        <div className="mt-1 flex flex-wrap items-center gap-1.5">
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${TYPE_COLORS[a.type] ?? 'bg-[#F3F4F6] text-[#4B5563]'}`}>{TYPE_LABELS[a.type] ?? a.type}</span>
                          <StatusBadge status={a.status} />
                        </div>
                      </div>
                      <Link href={`/admin/assignments/${a.id}`} className="shrink-0 rounded-lg bg-[#FF8A1F]/10 px-3 py-1.5 text-[12px] font-semibold text-[#FF8A1F] min-h-9 flex items-center">
                        Manage →
                      </Link>
                    </div>
                  </div>
                ))}
              </div>

              <Pagination page={result.page} totalPages={result.totalPages} total={result.total} perPage={result.perPage} />
            </>
          )}
        </div>
      )}

      {/* ── BY GROUP VIEW ─────────────────────────────────────────────────────── */}
      {view === 'groups' && (
        <div className="space-y-3">
          {by_group.length === 0 ? (
            <div className="ds-card px-6 py-10 text-center">
              <p className="text-sm text-[#94A3B8]">No assignment data for groups yet.</p>
            </div>
          ) : (
            <div className="ds-card overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="ds-table-head">
                  <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                    <th className="px-4 py-3 text-left text-xs font-medium text-[#64748B]">Group</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-[#64748B]">Branch</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-[#64748B]">Assignments</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-[#64748B]">Submissions</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-[#64748B]">Graded</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-[#64748B]">Completion</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-[#64748B]">Overdue</th>
                  </tr>
                </thead>
                <tbody>
                  {by_group.map(g => (
                    <tr key={g.group_id} className="ds-table-row">
                      <td className="px-4 py-3 font-medium text-[#0B1F3A]">
                        <Link href={`/admin/groups/${g.group_id}`} className="hover:text-[#FF8A1F]">{g.group_name}</Link>
                      </td>
                      <td className="px-4 py-3 text-xs text-[#64748B]">{g.branch_name ?? '—'}</td>
                      <td className="px-4 py-3 text-right text-[#64748B]">{g.assignment_count}</td>
                      <td className="px-4 py-3 text-right text-[#64748B]">{g.submission_count}</td>
                      <td className="px-4 py-3 text-right text-[#64748B]">{g.graded_count}</td>
                      <td className="px-4 py-3">{pctBar(g.completion_pct)}</td>
                      <td className="px-4 py-3 text-right">
                        {g.overdue_count > 0
                          ? <span className="inline-block rounded-full bg-[#FFFBEB] px-2 py-0.5 text-xs font-medium text-[#B45309]">{g.overdue_count}</span>
                          : <span className="text-xs text-[#94A3B8]">0</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── BY INSTRUCTOR VIEW ─────────────────────────────────────────────────── */}
      {view === 'instructors' && (
        <div className="space-y-3">
          {by_instructor.length === 0 ? (
            <div className="ds-card px-6 py-10 text-center">
              <p className="text-sm text-[#94A3B8]">No instructor assignment data yet.</p>
            </div>
          ) : (
            <div className="ds-card overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="ds-table-head">
                  <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                    <th className="px-4 py-3 text-left text-xs font-medium text-[#64748B]">Instructor</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-[#64748B]">Assignments</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-[#64748B]">Avg Completion</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-[#64748B]">Pending Review</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-[#64748B]">Delayed (3d+)</th>
                  </tr>
                </thead>
                <tbody>
                  {by_instructor.map(i => (
                    <tr key={i.instructor_id} className="ds-table-row">
                      <td className="px-4 py-3 font-medium text-[#0B1F3A]">
                        <Link href={`/admin/instructors/${i.instructor_id}`} className="hover:text-[#FF8A1F]">{i.instructor_name}</Link>
                      </td>
                      <td className="px-4 py-3 text-right text-[#64748B]">{i.assignment_count}</td>
                      <td className="px-4 py-3">{pctBar(i.avg_completion_pct)}</td>
                      <td className="px-4 py-3 text-right">
                        {i.pending_review > 0
                          ? <span className="inline-block rounded-full bg-[#FFFBEB] px-2 py-0.5 text-xs font-medium text-[#B45309]">{i.pending_review}</span>
                          : <span className="text-xs text-[#94A3B8]">0</span>}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {i.grading_delay > 0
                          ? <span className="inline-block rounded-full bg-[#FEE2E2] px-2 py-0.5 text-xs font-medium text-[#EF4444]">{i.grading_delay}</span>
                          : <span className="text-xs text-[#94A3B8]">0</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
