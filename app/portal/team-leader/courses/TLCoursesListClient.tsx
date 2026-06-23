'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import CourseModal from '@/app/admin/courses/CourseModal'
import type { CourseListItem } from '@/modules/courses/types'
import { useTopbarAction } from '@/components/admin/TopbarActionContext'

export interface CourseMetric {
  courseId:  string
  active:    number
  revenue:   number
  dropout:   number
  retention: number
}

interface Props {
  courses:    CourseListItem[]
  metrics:    CourseMetric[]
  total:      number
  page:       number
  totalPages: number
  search:     string
}

type LifecycleHealth = 'HEALTHY' | 'WATCH' | 'DECLINING' | 'CRITICAL'

function lifecycleHealth(active: number, dropout: number, retention: number): LifecycleHealth {
  if (dropout >= 30 || (active > 0 && retention < 40)) return 'CRITICAL'
  if (dropout >= 20 || retention < 60)                  return 'DECLINING'
  if (dropout >= 10 || retention < 75)                  return 'WATCH'
  return 'HEALTHY'
}

const LIFECYCLE_CONFIG: Record<LifecycleHealth, { color: string; text: string }> = {
  HEALTHY:   { color: 'bg-emerald-100', text: 'text-emerald-700' },
  WATCH:     { color: 'bg-amber-100',   text: 'text-amber-700'   },
  DECLINING: { color: 'bg-orange-100',  text: 'text-orange-700'  },
  CRITICAL:  { color: 'bg-red-100',     text: 'text-red-700'     },
}

function fmt(n: number) {
  return new Intl.NumberFormat('en-EG', { maximumFractionDigits: 0 }).format(n)
}

export default function TLCoursesListClient({
  courses,
  metrics,
  total,
  page,
  totalPages,
  search,
}: Props) {
  const [editCourseId, setEditCourseId] = useState<string | null>(null)
  const [createOpen,   setCreateOpen]   = useState(false)

  const closeModal = () => { setCreateOpen(false); setEditCourseId(null) }

  const metricsMap = new Map<string, CourseMetric>(metrics.map(m => [m.courseId, m]))

  const { setAction } = useTopbarAction()
  const openCreate = useCallback(() => setCreateOpen(true), [])
  useEffect(() => {
    setAction(
      <button
        type="button"
        onClick={openCreate}
        className="inline-flex h-9 shrink-0 items-center gap-2 rounded-lg bg-[#FF8A1F] px-4 text-[13px] font-semibold text-white transition hover:bg-[#e87c18] active:scale-95"
      >
        <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
          <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" />
        </svg>
        New Course
      </button>
    )
    return () => setAction(null)
  }, [openCreate, setAction])

  return (
    <>

      {/* Table */}
      <div className="rounded-xl border border-[#E2E8F0] bg-white">
        <div className="border-b border-[#E2E8F0] px-3 py-2.5 sm:px-4 sm:py-3">
          <form method="get" className="flex gap-2">
            <input
              name="q"
              defaultValue={search}
              placeholder="Search courses…"
              className="flex-1 min-w-0 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-1.5 text-[13px] text-[#0B1F3A] focus:border-[#FF8A1F] focus:outline-none"
            />
            <button
              type="submit"
              className="shrink-0 rounded-lg bg-[#FF8A1F] px-3 py-1.5 text-[12px] font-medium text-white hover:bg-[#e87c18]"
            >
              Search
            </button>
            {search && (
              <Link
                href="/portal/team-leader/courses"
                className="shrink-0 rounded-lg px-2 py-1.5 text-[12px] text-[#94A3B8] hover:text-[#64748B]"
              >
                Clear
              </Link>
            )}
          </form>
        </div>

        {courses.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <p className="text-sm font-medium text-[#0B1F3A]">No courses found</p>
            <p className="mt-1 text-xs text-[#94A3B8]">
              {search ? 'Try a different search.' : 'Create the first course to get started.'}
            </p>
          </div>
        ) : (
          <>
            {/* Mobile cards */}
            <div className="md:hidden divide-y divide-[#E2E8F0]">
              {courses.map(course => {
                const m      = metricsMap.get(course.id)
                const health = m ? lifecycleHealth(m.active, m.dropout, m.retention) : null
                const hCfg   = health ? LIFECYCLE_CONFIG[health] : null
                return (
                  <div key={course.id} className="px-3 py-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[14px] font-semibold text-[#0B1F3A]">{course.title}</p>
                        <p className="text-[11px] text-[#64748B] capitalize">{course.level ?? '—'}</p>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        {hCfg && health && (
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${hCfg.color} ${hCfg.text}`}>
                            {health}
                          </span>
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
                          <p className={`font-bold ${m.retention < 60 ? 'text-red-600' : 'text-emerald-600'}`}>
                            {m.retention}%
                          </p>
                          <p className="text-[#94A3B8]">Retention</p>
                        </div>
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => setEditCourseId(course.id)}
                      className="mt-2 rounded-lg bg-[#FF8A1F]/10 px-3 py-1 text-[11px] font-semibold text-[#FF8A1F]"
                    >
                      Edit →
                    </button>
                  </div>
                )
              })}
            </div>

            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                    <th className="px-4 py-3 text-left   text-xs font-medium text-[#64748B]">Course</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-[#64748B]">Active</th>
                    <th className="px-4 py-3 text-right  text-xs font-medium text-[#64748B]">Revenue</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-[#64748B]">Dropout %</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-[#64748B]">Retention %</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-[#64748B]">Lifecycle</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-[#64748B]">Status</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {courses.map(course => {
                    const m      = metricsMap.get(course.id)
                    const health = m ? lifecycleHealth(m.active, m.dropout, m.retention) : null
                    const hCfg   = health ? LIFECYCLE_CONFIG[health] : null
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
                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${hCfg.color} ${hCfg.text}`}>
                              {health}
                            </span>
                          ) : <span className="text-[#94A3B8]">—</span>}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${course.is_published ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                            {course.is_published ? 'Published' : 'Draft'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => setEditCourseId(course.id)}
                            className="text-xs font-medium text-[#FF8A1F] hover:underline"
                          >
                            Edit
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-[#E2E8F0] px-4 py-3">
                <p className="text-xs text-[#94A3B8]">Page {page} of {totalPages}</p>
                <div className="flex gap-2">
                  {page > 1 && (
                    <Link
                      href={`/portal/team-leader/courses?page=${page - 1}${search ? `&q=${encodeURIComponent(search)}` : ''}`}
                      className="rounded-lg border border-[#E2E8F0] px-3 py-1.5 text-xs font-medium text-[#64748B] hover:bg-[#F8FAFC]"
                    >
                      Previous
                    </Link>
                  )}
                  {page < totalPages && (
                    <Link
                      href={`/portal/team-leader/courses?page=${page + 1}${search ? `&q=${encodeURIComponent(search)}` : ''}`}
                      className="rounded-lg border border-[#E2E8F0] px-3 py-1.5 text-xs font-medium text-[#64748B] hover:bg-[#F8FAFC]"
                    >
                      Next
                    </Link>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Modals — conditionally mounted to reset state on each open */}
      {createOpen && (
        <CourseModal mode="create" onClose={closeModal} />
      )}
      {editCourseId && (
        <CourseModal mode="edit" courseId={editCourseId} onClose={closeModal} />
      )}
    </>
  )
}
