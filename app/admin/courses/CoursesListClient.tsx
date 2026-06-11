'use client'

import { useState } from 'react'
import Link from 'next/link'
import CourseModal from './CourseModal'
import type { CourseListItem } from '@/modules/courses/types'

interface Props {
  courses:    CourseListItem[]
  total:      number
  page:       number
  totalPages: number
  perPage:    number
  search:     string
}

const LEVEL_LABELS: Record<string, string> = {
  beginner:     'Beginner',
  intermediate: 'Intermediate',
  advanced:     'Advanced',
}

export default function CoursesListClient({ courses, total, page, totalPages, search }: Props) {
  const [editCourseId, setEditCourseId] = useState<string | null>(null)
  const [createOpen,   setCreateOpen]   = useState(false)

  const openCreate = () => setCreateOpen(true)
  const openEdit   = (id: string) => setEditCourseId(id)
  const closeModal = () => { setCreateOpen(false); setEditCourseId(null) }

  const buildUrl = (p: number, q?: string) => {
    const s = q !== undefined ? q : search
    const params = new URLSearchParams()
    if (s)    params.set('q', s)
    if (p > 1) params.set('page', String(p))
    return `/admin/courses?${params.toString()}`
  }

  return (
    <>
      {/* Header */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-[#0B1F3A]">Courses</h1>
          <p className="mt-0.5 text-sm text-[#64748B]">
            {total} course{total !== 1 ? 's' : ''} · global academy assets
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center gap-2 rounded-lg bg-[#FF8A1F] px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-[#e87c18]"
        >
          <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
            <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" />
          </svg>
          New Course
        </button>
      </div>

      {/* Table card */}
      <div className="rounded-xl border border-[#E2E8F0] bg-white">
        {/* Search bar */}
        <div className="flex flex-wrap items-center gap-3 border-b border-[#E2E8F0] px-4 py-3">
          <form method="get" action="/admin/courses" className="flex gap-2">
            <input
              name="q"
              defaultValue={search}
              placeholder="Search by title…"
              className="min-w-56 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2 text-sm text-[#0B1F3A] outline-none transition focus:border-[#FF8A1F] focus:ring-2 focus:ring-[#FF8A1F]/10"
            />
            <button
              type="submit"
              className="rounded-lg bg-[#F1F5F9] px-4 py-2 text-sm font-medium text-[#64748B] transition hover:bg-[#E2E8F0]"
            >
              Search
            </button>
            {search && (
              <Link
                href="/admin/courses"
                className="rounded-lg px-3 py-2 text-sm text-[#94A3B8] transition hover:text-[#64748B]"
              >
                Clear
              </Link>
            )}
          </form>
        </div>

        {courses.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[#F1F5F9]">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-6 w-6 text-[#94A3B8]">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
              </svg>
            </div>
            <p className="text-sm font-medium text-[#0B1F3A]">No courses found</p>
            <p className="mt-1 text-xs text-[#94A3B8]">
              {search ? 'Try a different search term.' : 'Create the first course to get started.'}
            </p>
            {!search && (
              <button
                type="button"
                onClick={openCreate}
                className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-[#FF8A1F] px-4 py-2 text-sm font-medium text-white hover:bg-[#e87c18]"
              >
                <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                  <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" />
                </svg>
                Create Course
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                    <th className="px-4 py-3 text-left text-xs font-medium text-[#64748B]">Course</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-[#64748B]">Level</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-[#64748B]">Category</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-[#64748B]">Status</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {courses.map((course) => (
                    <tr
                      key={course.id}
                      className="border-b border-[#E2E8F0] last:border-0 transition hover:bg-[#FAFCFF]"
                    >
                      <td className="px-4 py-3">
                        <p className="font-medium text-[#0B1F3A]">{course.title}</p>
                        {course.code && (
                          <span className="mt-0.5 font-mono text-xs text-[#94A3B8]">{course.code}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-[#64748B]">
                        {course.level ? LEVEL_LABELS[course.level] : <span className="text-[#CBD5E1]">—</span>}
                      </td>
                      <td className="px-4 py-3 text-[#64748B]">
                        {course.category ?? <span className="text-[#CBD5E1]">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                            course.is_published
                              ? 'bg-emerald-100 text-emerald-700'
                              : 'bg-slate-100 text-slate-500'
                          }`}
                        >
                          {course.is_published ? 'Published' : 'Draft'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => openEdit(course.id)}
                          className="text-xs font-medium text-[#FF8A1F] hover:underline"
                        >
                          Edit
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-[#E2E8F0] px-4 py-3">
                <p className="text-xs text-[#94A3B8]">
                  Page {page} of {totalPages}
                </p>
                <div className="flex gap-2">
                  {page > 1 && (
                    <Link
                      href={buildUrl(page - 1)}
                      className="rounded-lg border border-[#E2E8F0] px-3 py-1.5 text-xs font-medium text-[#64748B] hover:bg-[#F8FAFC]"
                    >
                      Previous
                    </Link>
                  )}
                  {page < totalPages && (
                    <Link
                      href={buildUrl(page + 1)}
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
