/**
 * Super Admin: Assignment Intelligence Center
 *
 * Super Admin MONITORS assignments — never creates them.
 * Assignment creation belongs to Instructors (instructor portal).
 *
 * Shows: KPIs, alerts, overdue work, missing submissions, full filterable list.
 */

import { createServiceClient }  from '@/lib/supabase/service'
import { requirePermission }    from '@/modules/rbac/guards'
import { listAssignments }      from '@/modules/assignments/queries'
import { listBranches }         from '@/modules/branches/queries'
import AdminFilterSelect        from '@/components/admin/AdminFilterSelect'
import SearchInput              from '@/components/admin/SearchInput'
import Pagination               from '@/components/admin/Pagination'
import Link                     from 'next/link'

// ── KPIs ──────────────────────────────────────────────────────────────────────

async function getAssignmentKPIs(branchIds?: string[]) {
  const db  = createServiceClient()
  const now = new Date().toISOString()

  let aQuery = db.from('assignments').select('id, status, due_at').is('deleted_at', null)

  if (branchIds?.length) {
    const { data: courseRows } = await db.from('courses').select('id')
      .or(`branch_id.in.(${branchIds.join(',')}),branch_id.is.null`).is('deleted_at', null)
    const courseIds = (courseRows ?? []).map((r: any) => r.id as string)
    if (courseIds.length > 0) {
      const { data: modRows } = await db.from('course_modules').select('id').in('course_id', courseIds).is('deleted_at', null)
      const modIds = (modRows ?? []).map((r: any) => r.id as string)
      if (modIds.length > 0) aQuery = aQuery.in('module_id', modIds)
      else return { total: 0, published: 0, draft: 0, overdue: 0, total_submitted: 0 }
    }
  }

  const { data: assignments } = await aQuery
  const total     = (assignments ?? []).length
  const published = (assignments ?? []).filter(a => (a as any).status === 'published').length
  const draft     = (assignments ?? []).filter(a => (a as any).status === 'draft').length
  const overdue   = (assignments ?? []).filter(a =>
    (a as any).status === 'published' && (a as any).due_at && new Date((a as any).due_at) < new Date()
  ).length

  if (total === 0) return { total, published, draft, overdue, total_submitted: 0 }

  const assignmentIds = (assignments ?? []).map((a: any) => a.id as string)
  const { count: submCount } = await db.from('assignment_submissions')
    .select('id', { count: 'exact', head: true }).in('assignment_id', assignmentIds)

  return { total, published, draft, overdue, total_submitted: submCount ?? 0 }
}

// ── Insights ──────────────────────────────────────────────────────────────────

async function getInsights() {
  const db  = createServiceClient()
  const now = new Date().toISOString()

  // Courses with no assignments
  const { data: allCourses } = await db
    .from('courses')
    .select(`id, title, course_modules!course_modules_course_id_fkey(
      assignments!assignments_module_id_fkey(id)
    )`)
    .is('deleted_at', null)
    .eq('is_published', true)
    .limit(60)

  const coursesWithNoAssignments = (allCourses ?? [])
    .filter((c: any) => (c.course_modules ?? []).every((m: any) => (m.assignments ?? []).length === 0))
    .slice(0, 5)
    .map((c: any) => ({ id: c.id, title: c.title }))

  // Students with most missing (graceful — table may not exist)
  let studentsWithMostMissing: Array<{ name: string; email: string; missing: number }> = []
  try {
    const { data: sums } = await db
      .from('student_grade_summaries')
      .select(`student_id, total_assignments, submitted_count,
        students!student_grade_summaries_student_id_fkey(
          users!students_user_id_fkey(email, profiles!profiles_user_id_fkey(first_name, last_name))
        )`)
      .order('submitted_count', { ascending: true })
      .limit(5)

    studentsWithMostMissing = (sums ?? [])
      .map((s: any) => {
        const missing = Math.max(0, (s.total_assignments ?? 0) - (s.submitted_count ?? 0))
        const prof    = s.students?.users?.profiles
        return {
          name:    prof ? [prof.first_name, prof.last_name].filter(Boolean).join(' ') || 'Unknown' : 'Unknown',
          email:   s.students?.users?.email ?? '',
          missing,
        }
      })
      .filter(s => s.missing > 0)
  } catch { /* graceful no-op */ }

  return { coursesWithNoAssignments, studentsWithMostMissing }
}

// ── Page ──────────────────────────────────────────────────────────────────────

const ASSIGNMENT_TYPES   = ['homework','classwork','project','quiz','exam','presentation','challenge','competition']
const ASSIGNMENT_STATUSES = ['draft', 'published', 'closed']
const TYPE_COLORS: Record<string, string> = {
  homework: 'bg-blue-50 text-blue-700', classwork: 'bg-sky-50 text-sky-700',
  project: 'bg-violet-50 text-violet-700', quiz: 'bg-amber-50 text-amber-700',
  exam: 'bg-red-50 text-red-700', presentation: 'bg-pink-50 text-pink-700',
  challenge: 'bg-orange-50 text-orange-700', competition: 'bg-teal-50 text-teal-700',
}

interface Props {
  searchParams: Promise<{ page?: string; q?: string; type?: string; status?: string; branch?: string }>
}

export default async function AssignmentIntelligencePage({ searchParams }: Props) {
  const user   = await requirePermission('manage_assignments')
  const params = await searchParams

  const isSuperAdmin = user.globalRole === 'super_admin'
  const branchScope  = isSuperAdmin ? undefined : (user.branchIds.length > 0 ? user.branchIds : undefined)
  const branchFilter = params.branch ? [params.branch] : branchScope

  const page   = Number(params.page ?? 1)
  const search = params.q ?? ''
  const type   = params.type
  const status = params.status

  const [result, kpis, insights, branchesRes] = await Promise.all([
    listAssignments({ page, perPage: 20, search, type, status, branchIds: branchFilter }),
    getAssignmentKPIs(branchFilter),
    getInsights(),
    listBranches({ perPage: 100 }),
  ])

  return (
    <div>
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-[#0B1F3A]">Assignment Intelligence</h1>
          <p className="mt-0.5 text-sm text-[#64748B]">Submission rates, overdue work, and completion visibility</p>
        </div>
        <span className="flex items-center gap-2 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2 text-xs text-[#64748B]">
          <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5 text-[#94A3B8]">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
          </svg>
          Instructors create assignments via their portal
        </span>
      </div>

      {/* ── Alerts ─────────────────────────────────────────────────────── */}
      {(kpis.overdue > 0 || insights.coursesWithNoAssignments.length > 0) && (
        <div className="mb-5 space-y-2">
          {kpis.overdue > 0 && (
            <div className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
              <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 shrink-0"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" /></svg>
              {kpis.overdue} published assignment{kpis.overdue !== 1 ? 's' : ''} past their due date
            </div>
          )}
          {insights.coursesWithNoAssignments.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
              <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 shrink-0"><path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" /></svg>
              <span className="font-semibold">Courses with no assignments:</span>
              {insights.coursesWithNoAssignments.map((c, i) => (
                <span key={c.id}>
                  <Link href={`/admin/courses/${c.id}`} className="underline">{c.title}</Link>
                  {i < insights.coursesWithNoAssignments.length - 1 && ', '}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── KPIs ───────────────────────────────────────────────────────── */}
      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {[
          { label: 'Total Assignments', value: kpis.total,         color: 'bg-slate-300' },
          { label: 'Published',         value: kpis.published,     color: 'bg-emerald-400' },
          { label: 'Draft',             value: kpis.draft,         color: 'bg-amber-400' },
          { label: 'Submissions',       value: kpis.total_submitted, color: 'bg-blue-400' },
          { label: 'Overdue',           value: kpis.overdue,       color: 'bg-red-400', alert: true },
        ].map(({ label, value, color, alert }) => (
          <div key={label} className={`rounded-xl border p-4 bg-white ${alert && value > 0 ? 'border-red-200' : 'border-[#E2E8F0]'}`}>
            <div className={`mb-2 h-1.5 w-7 rounded-full ${color} opacity-80`} />
            <p className={`text-2xl font-bold ${alert && value > 0 ? 'text-red-600' : 'text-[#0B1F3A]'}`}>{value}</p>
            <p className="mt-0.5 text-xs text-[#64748B]">{label}</p>
          </div>
        ))}
      </div>

      {/* ── Students with most missing work ────────────────────────────── */}
      {insights.studentsWithMostMissing.length > 0 && (
        <div className="mb-5 rounded-xl border border-[#E2E8F0] bg-white p-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-[#94A3B8]">Most Missing Work</p>
          <div className="space-y-2">
            {insights.studentsWithMostMissing.map(s => (
              <div key={s.email} className="flex items-center justify-between rounded-lg bg-[#F8FAFC] px-3 py-2">
                <div>
                  <p className="text-xs font-medium text-[#0B1F3A]">{s.name}</p>
                  <p className="text-[11px] text-[#94A3B8]">{s.email}</p>
                </div>
                <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">
                  {s.missing} missing
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Assignment table ────────────────────────────────────────────── */}
      <div className="rounded-xl border border-[#E2E8F0] bg-white">
        <div className="flex flex-wrap items-center gap-2 border-b border-[#E2E8F0] px-4 py-3">
          <SearchInput placeholder="Search assignments…" />
          {isSuperAdmin && (
            <AdminFilterSelect param="branch" placeholder="All branches"
              options={branchesRes.data.map(b => ({ value: b.id, label: b.name }))} />
          )}
          <AdminFilterSelect param="type" placeholder="All types"
            options={ASSIGNMENT_TYPES.map(t => ({ value: t, label: t.charAt(0).toUpperCase() + t.slice(1) }))} />
          <AdminFilterSelect param="status" placeholder="All statuses"
            options={ASSIGNMENT_STATUSES.map(s => ({ value: s, label: s.charAt(0).toUpperCase() + s.slice(1) }))} />
        </div>

        {result.data.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
            <p className="text-sm font-medium text-[#0B1F3A]">No assignments found</p>
            <p className="mt-1 text-xs text-[#94A3B8]">
              {search ? 'Try a different search term.' : 'Assignments created by instructors will appear here.'}
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                    <th className="px-4 py-3 text-left text-xs font-medium text-[#64748B]">Assignment</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-[#64748B]">Type</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-[#64748B]">Course</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-[#64748B]">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-[#64748B]">Due</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-[#64748B]">Submissions</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {result.data.map(a => {
                    const isOverdue = a.due_at && new Date(a.due_at) < new Date() && a.status === 'published'
                    const statusCls = a.status === 'published' ? 'bg-emerald-100 text-emerald-700'
                      : a.status === 'closed' ? 'bg-slate-100 text-slate-600'
                      : 'bg-amber-100 text-amber-700'
                    return (
                      <tr key={a.id} className="border-b border-[#E2E8F0] last:border-0 hover:bg-[#F8FAFC]">
                        <td className="px-4 py-3">
                          <p className="font-medium text-[#0B1F3A]">{a.title}</p>
                          {a.module_title && <p className="text-[11px] text-[#94A3B8]">{a.module_title}</p>}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-medium capitalize ${TYPE_COLORS[a.type] ?? 'bg-slate-100 text-slate-600'}`}>
                            {a.type}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-[#64748B] text-xs">{a.course_title ?? '—'}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ${statusCls}`}>
                            {a.status}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {a.due_at ? (
                            <span className={`text-xs ${isOverdue ? 'font-semibold text-red-600' : 'text-[#64748B]'}`}>
                              {new Date(a.due_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                              {isOverdue && ' ⚠'}
                            </span>
                          ) : <span className="text-xs text-[#94A3B8]">—</span>}
                        </td>
                        <td className="px-4 py-3 text-right font-medium text-[#0B1F3A]">{a.submission_count}</td>
                        <td className="px-4 py-3 text-right">
                          <Link href={`/admin/assignments/${a.id}`} className="text-xs font-medium text-[#FF8A1F] hover:underline">View</Link>
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
