import { requirePortalRole, requirePermission } from '@/modules/rbac/guards'
import { listCourses }                          from '@/modules/courses/queries'
import { createServiceClient }                  from '@/lib/supabase/service'
import Link                                     from 'next/link'

function fmt(n: number) {
  return new Intl.NumberFormat('en-EG', { maximumFractionDigits: 0 }).format(n)
}

type LifecycleHealth = 'HEALTHY' | 'WATCH' | 'DECLINING' | 'CRITICAL'

function lifecycleHealth(activeEnrollments: number, dropoutPct: number, retentionPct: number): LifecycleHealth {
  if (dropoutPct >= 30 || (activeEnrollments > 0 && retentionPct < 40)) return 'CRITICAL'
  if (dropoutPct >= 20 || retentionPct < 60)                             return 'DECLINING'
  if (dropoutPct >= 10 || retentionPct < 75)                             return 'WATCH'
  return 'HEALTHY'
}

const LIFECYCLE_CONFIG: Record<LifecycleHealth, { color: string; text: string }> = {
  HEALTHY:  { color: 'bg-emerald-100', text: 'text-emerald-700' },
  WATCH:    { color: 'bg-amber-100',   text: 'text-amber-700'   },
  DECLINING:{ color: 'bg-orange-100',  text: 'text-orange-700'  },
  CRITICAL: { color: 'bg-red-100',     text: 'text-red-700'     },
}

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

  // Load business metrics for each course from v_course_metrics (or fallback direct query)
  const db = createServiceClient()
  const courseIds = result.data.map(c => c.id)

  let metricsMap = new Map<string, { active: number; revenue: number; dropout: number; retention: number }>()

  if (courseIds.length > 0) {
    // Try v_course_metrics view first (available after migration 0050)
    const { data: metricsData, error: metricsErr } = await db
      .from('v_course_metrics' as any)
      .select('course_id, active_enrollments, total_revenue, dropout_pct, retention_pct')
      .in('course_id', courseIds)

    if (!metricsErr && metricsData) {
      for (const r of (metricsData ?? []) as any[]) {
        metricsMap.set(r.course_id, {
          active:    Number(r.active_enrollments ?? 0),
          revenue:   Number(r.total_revenue      ?? 0),
          dropout:   Number(r.dropout_pct        ?? 0),
          retention: Number(r.retention_pct      ?? 0),
        })
      }
    }
    // If view not yet applied (migration pending), metricsMap stays empty — columns show '—'
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-[#0B1F3A]">Courses</h1>
          <p className="mt-0.5 text-sm text-[#64748B]">{result.total} course{result.total !== 1 ? 's' : ''} — business performance view</p>
        </div>
        <Link
          href="/portal/team-leader/courses/new"
          className="inline-flex items-center gap-2 rounded-lg bg-[#FF8A1F] px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-[#e87c18]"
        >
          <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
            <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" />
          </svg>
          New Course
        </Link>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-[#E2E8F0] bg-white">
        <div className="flex flex-wrap items-center gap-3 border-b border-[#E2E8F0] px-4 py-3">
          <form method="get" className="flex gap-2">
            <input
              name="q"
              defaultValue={search}
              placeholder="Search courses…"
              className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2 text-sm text-[#0B1F3A] focus:border-[#FF8A1F] focus:outline-none min-w-48"
            />
            <button type="submit" className="rounded-xl bg-[#FF8A1F] px-4 py-2 text-sm font-medium text-white hover:bg-[#e87c18]">Search</button>
          </form>
        </div>

        {result.data.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <p className="text-sm font-medium text-[#0B1F3A]">No courses found</p>
            <p className="mt-1 text-xs text-[#94A3B8]">{search ? 'Try a different search.' : 'Create the first course to get started.'}</p>
          </div>
        ) : (
          <>
            {/* Mobile */}
            <div className="md:hidden divide-y divide-[#E2E8F0]">
              {result.data.map(course => {
                const m = metricsMap.get(course.id)
                const health = m ? lifecycleHealth(m.active, m.dropout, m.retention) : null
                const hCfg  = health ? LIFECYCLE_CONFIG[health] : null
                return (
                  <div key={course.id} className="px-4 py-4">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <Link href={`/portal/team-leader/courses/${course.id}`} className="text-[15px] font-semibold text-[#0B1F3A]">{course.title}</Link>
                        <p className="text-[12px] text-[#64748B] capitalize">{course.level ?? '—'}</p>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        {hCfg && health && (
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${hCfg.color} ${hCfg.text}`}>{health}</span>
                        )}
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${course.is_published ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                          {course.is_published ? 'Published' : 'Draft'}
                        </span>
                      </div>
                    </div>
                    {m && (
                      <div className="mt-2 grid grid-cols-3 gap-1.5 text-[11px]">
                        <div className="rounded-lg bg-[#F8FAFC] px-2 py-1.5 text-center">
                          <p className="font-bold text-[#0B1F3A]">{m.active}</p>
                          <p className="text-[#94A3B8]">Active</p>
                        </div>
                        <div className="rounded-lg bg-[#F8FAFC] px-2 py-1.5 text-center">
                          <p className="font-bold text-[#0B1F3A]">EGP {fmt(m.revenue)}</p>
                          <p className="text-[#94A3B8]">Revenue</p>
                        </div>
                        <div className="rounded-lg bg-[#F8FAFC] px-2 py-1.5 text-center">
                          <p className={`font-bold ${m.retention < 60 ? 'text-red-600' : 'text-emerald-600'}`}>{m.retention}%</p>
                          <p className="text-[#94A3B8]">Retention</p>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Desktop */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                    <th className="px-4 py-3 text-left text-xs font-medium text-[#64748B]">Course</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-[#64748B]">Active Enrollments</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-[#64748B]">Revenue</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-[#64748B]">Dropout %</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-[#64748B]">Retention %</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-[#64748B]">Lifecycle</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-[#64748B]">Status</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {result.data.map(course => {
                    const m = metricsMap.get(course.id)
                    const health = m ? lifecycleHealth(m.active, m.dropout, m.retention) : null
                    const hCfg  = health ? LIFECYCLE_CONFIG[health] : null
                    return (
                      <tr key={course.id} className="border-b border-[#E2E8F0] last:border-0 hover:bg-[#F8FAFC]">
                        <td className="px-4 py-3">
                          <p className="font-medium text-[#0B1F3A]">{course.title}</p>
                          <p className="text-[11px] text-[#94A3B8] capitalize">{course.level ?? '—'} · {course.scope}</p>
                        </td>
                        <td className="px-4 py-3 text-center font-semibold text-[#0B1F3A]">
                          {m ? m.active : <span className="text-[#94A3B8]">—</span>}
                        </td>
                        <td className="px-4 py-3 text-right font-medium text-[#0B1F3A]">
                          {m ? `EGP ${fmt(m.revenue)}` : <span className="text-[#94A3B8]">—</span>}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {m ? (
                            <span className={m.dropout >= 20 ? 'font-semibold text-red-600' : 'text-[#64748B]'}>
                              {m.dropout}%
                            </span>
                          ) : <span className="text-[#94A3B8]">—</span>}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {m ? (
                            <span className={m.retention < 60 ? 'font-semibold text-red-600' : m.retention < 75 ? 'text-amber-600' : 'text-emerald-600'}>
                              {m.retention}%
                            </span>
                          ) : <span className="text-[#94A3B8]">—</span>}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {hCfg && health ? (
                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${hCfg.color} ${hCfg.text}`}>{health}</span>
                          ) : <span className="text-[#94A3B8]">—</span>}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${course.is_published ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                            {course.is_published ? 'Published' : 'Draft'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Link href={`/portal/team-leader/courses/${course.id}`} className="text-xs font-medium text-[#FF8A1F] hover:underline">View</Link>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
