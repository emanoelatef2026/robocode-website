'use client'

import { useActionState } from 'react'
import {
  updateSemester,
  deleteSemester,
  enrollStudentInSemester,
  dropStudentFromSemester,
  addCourseToSemester,
  removeCourseFromSemester,
} from '@/modules/semesters/actions'
import SubmitButton from '@/components/admin/SubmitButton'
import type { SemesterDashboard as TDashboard, SemesterEnrollment, SemesterCourse, SemesterGroup } from '@/modules/semesters/types'
import { SEMESTER_STATUS_COLORS } from '@/modules/semesters/types'
import type { AcademicYearListItem } from '@/modules/academic-years/types'
import type { StudentListItem } from '@/modules/students/types'
import type { CourseListItem } from '@/modules/courses/types'
import type { ActionResult } from '@/types/app'

interface Props {
  dashboard:    TDashboard
  enrollments:  SemesterEnrollment[]
  semCourses:   SemesterCourse[]
  groups:       SemesterGroup[]
  years:        AcademicYearListItem[]
  allStudents:  StudentListItem[]
  allCourses:   CourseListItem[]
}

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="ds-card p-4">
      <p className="text-xs font-medium text-[#64748B]">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-[#0B1F3A]">{value}</p>
      {sub && <p className="text-xs text-[#94A3B8]">{sub}</p>}
    </div>
  )
}

export default function SemesterDashboard({
  dashboard, enrollments, semCourses, groups, years, allStudents, allCourses,
}: Props) {
  const { semester, enrolled_count, dropped_count, completed_count, group_count, course_count, capacity_pct } = dashboard

  const [editState, editAction]       = useActionState<ActionResult<void> | null, FormData>(updateSemester, null)
  const [enrollState, enrollAction]   = useActionState<ActionResult<void> | null, FormData>(enrollStudentInSemester, null)
  const [courseState, courseAction]   = useActionState<ActionResult<void> | null, FormData>(addCourseToSemester, null)

  const enrolledIds  = new Set(enrollments.filter((e) => e.status === 'enrolled').map((e) => e.student_id))
  const assignedCIds = new Set(semCourses.map((c) => c.course_id))
  const availStudents = allStudents.filter((s) => !enrolledIds.has(s.id) && s.status === 'active')
  const availCourses  = allCourses.filter((c) => !assignedCIds.has(c.id))

  const handleDelete = async () => {
    if (!confirm('Delete this semester? This cannot be undone if there are no enrollments.')) return
    const result = await deleteSemester(semester.id)
    if (result.success) window.location.href = '/admin/semesters'
    else alert(result.error.message)
  }

  const handleDrop = async (studentId: string) => {
    if (!confirm('Drop this student from the semester?')) return
    await dropStudentFromSemester(semester.id, studentId)
    window.location.reload()
  }

  const handleRemoveCourse = async (courseId: string) => {
    if (!confirm('Remove this course from the semester?')) return
    await removeCourseFromSemester(semester.id, courseId)
    window.location.reload()
  }

  return (
    <div className="space-y-5">
      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Enrolled" value={enrolled_count} sub={semester.max_capacity ? `/ ${semester.max_capacity} capacity` : 'No cap'} />
        <StatCard label="Completed" value={completed_count} />
        <StatCard label="Dropped" value={dropped_count} />
        <StatCard label="Groups" value={group_count} sub={`${course_count} course${course_count !== 1 ? 's' : ''}`} />
      </div>

      {/* Capacity bar */}
      {semester.max_capacity && capacity_pct !== null && (
        <div className="ds-card p-4">
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-xs font-medium text-[#64748B]">Capacity</span>
            <span className="text-xs font-semibold text-[#0B1F3A]">{capacity_pct}%</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-[#F1F5F9]">
            <div
              className={`h-full rounded-full transition-all ${capacity_pct >= 90 ? 'bg-[#EF4444]' : capacity_pct >= 70 ? 'bg-yellow-400' : 'bg-[#10B981]'}`}
              style={{ width: `${Math.min(capacity_pct, 100)}%` }}
            />
          </div>
        </div>
      )}

      {/* Settings */}
      <div className="ds-card p-5">
        <h2 className="mb-4 text-sm font-medium text-[#0B1F3A]">Semester Settings</h2>

        {editState && !editState.success && (
          <div className="mb-3 rounded-lg bg-[#FEE2E2] px-3 py-2 text-sm text-[#DC2626]">{editState.error.message}</div>
        )}
        {editState?.success && (
          <div className="mb-3 rounded-lg bg-[#E7F8EE] px-3 py-2 text-sm text-[#15803D]">Changes saved.</div>
        )}

        <form action={editAction} className="space-y-3">
          <input type="hidden" name="id" value={semester.id} />

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-[#64748B]">Name</label>
              <input name="name" defaultValue={semester.name} required
                className="w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm text-[#0B1F3A] outline-none transition focus:border-[#FF8A1F] focus:ring-2 focus:ring-[#FF8A1F]/15" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[#64748B]">Slug</label>
              <input name="slug" defaultValue={semester.slug} required
                className="w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm text-[#0B1F3A] outline-none transition focus:border-[#FF8A1F] focus:ring-2 focus:ring-[#FF8A1F]/15" />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-[#64748B]">Status</label>
              <select name="status" defaultValue={semester.status}
                className="w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm text-[#0B1F3A] outline-none transition focus:border-[#FF8A1F] focus:ring-2 focus:ring-[#FF8A1F]/15">
                <option value="planned">Planned</option>
                <option value="active">Active</option>
                <option value="completed">Completed</option>
                <option value="archived">Archived</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[#64748B]">Start date</label>
              <input name="start_date" type="date" defaultValue={semester.start_date} required
                className="w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm text-[#0B1F3A] outline-none transition focus:border-[#FF8A1F] focus:ring-2 focus:ring-[#FF8A1F]/15" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[#64748B]">End date</label>
              <input name="end_date" type="date" defaultValue={semester.end_date} required
                className="w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm text-[#0B1F3A] outline-none transition focus:border-[#FF8A1F] focus:ring-2 focus:ring-[#FF8A1F]/15" />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-[#64748B]">Enrollment opens</label>
              <input name="enrollment_open_at" type="datetime-local"
                defaultValue={semester.enrollment_open_at ? semester.enrollment_open_at.slice(0, 16) : ''}
                className="w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm text-[#0B1F3A] outline-none transition focus:border-[#FF8A1F] focus:ring-2 focus:ring-[#FF8A1F]/15" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[#64748B]">Enrollment closes</label>
              <input name="enrollment_close_at" type="datetime-local"
                defaultValue={semester.enrollment_close_at ? semester.enrollment_close_at.slice(0, 16) : ''}
                className="w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm text-[#0B1F3A] outline-none transition focus:border-[#FF8A1F] focus:ring-2 focus:ring-[#FF8A1F]/15" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[#64748B]">Max capacity</label>
              <input name="max_capacity" type="number" min={1} defaultValue={semester.max_capacity ?? ''}
                placeholder="Unlimited"
                className="w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm text-[#0B1F3A] outline-none transition focus:border-[#FF8A1F] focus:ring-2 focus:ring-[#FF8A1F]/15" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-[#64748B]">Billing cycle</label>
              <select name="billing_cycle" defaultValue={semester.billing_cycle ?? ''}
                className="w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm text-[#0B1F3A] outline-none transition focus:border-[#FF8A1F] focus:ring-2 focus:ring-[#FF8A1F]/15">
                <option value="">None</option>
                <option value="per_semester">Per semester</option>
                <option value="monthly">Monthly</option>
                <option value="annual">Annual</option>
                <option value="custom">Custom</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[#64748B]">Notes</label>
              <input name="notes" defaultValue={semester.notes ?? ''}
                className="w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm text-[#0B1F3A] outline-none transition focus:border-[#FF8A1F] focus:ring-2 focus:ring-[#FF8A1F]/15" />
            </div>
          </div>

          <div className="flex justify-end">
            <SubmitButton label="Save Changes" />
          </div>
        </form>
      </div>

      {/* Enrollments */}
      <div className="ds-card p-5">
        <h2 className="mb-4 text-sm font-medium text-[#0B1F3A]">
          Student Enrollments ({enrolled_count})
        </h2>

        {enrollState && !enrollState.success && (
          <div className="mb-3 rounded-lg bg-[#FEE2E2] px-3 py-2 text-sm text-[#DC2626]">{enrollState.error.message}</div>
        )}

        {availStudents.length > 0 && (
          <form action={enrollAction} className="mb-4 flex gap-2">
            <input type="hidden" name="semester_id" value={semester.id} />
            <select name="student_id" required
              className="flex-1 rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm text-[#0B1F3A] outline-none transition focus:border-[#FF8A1F] focus:ring-2 focus:ring-[#FF8A1F]/15">
              <option value="">Enroll a student…</option>
              {availStudents.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.first_name && s.last_name ? `${s.first_name} ${s.last_name}` : s.user_email}
                </option>
              ))}
            </select>
            <SubmitButton label="Enroll" pendingLabel="…" />
          </form>
        )}

        {enrollments.filter((e) => e.status === 'enrolled').length === 0 ? (
          <p className="text-sm text-[#94A3B8]">No students enrolled yet.</p>
        ) : (
          <ul className="space-y-1.5">
            {enrollments
              .filter((e) => e.status === 'enrolled')
              .map((e) => (
                <li key={e.id} className="flex items-center justify-between rounded-lg border border-[#E2E8F0] px-3 py-2.5">
                  <div>
                    <p className="text-sm font-medium text-[#0B1F3A]">
                      {e.first_name && e.last_name ? `${e.first_name} ${e.last_name}` : e.student_email}
                    </p>
                    <p className="text-xs text-[#64748B]">
                      {e.branch_name} · Enrolled {new Date(e.enrolled_at).toLocaleDateString('en-GB')}
                      {e.payment_status !== 'pending' && (
                        <span className="ml-2 capitalize">{e.payment_status}</span>
                      )}
                    </p>
                  </div>
                  <button type="button" onClick={() => handleDrop(e.student_id)}
                    className="text-xs text-[#F87171] hover:text-[#EF4444]">
                    Drop
                  </button>
                </li>
              ))}
          </ul>
        )}

        {enrollments.filter((e) => e.status !== 'enrolled').length > 0 && (
          <details className="mt-3">
            <summary className="cursor-pointer text-xs text-[#64748B] hover:text-[#0B1F3A]">
              Show dropped / completed ({enrollments.filter((e) => e.status !== 'enrolled').length})
            </summary>
            <ul className="mt-2 space-y-1.5">
              {enrollments
                .filter((e) => e.status !== 'enrolled')
                .map((e) => (
                  <li key={e.id} className="flex items-center justify-between rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2">
                    <p className="text-sm text-[#64748B]">
                      {e.first_name && e.last_name ? `${e.first_name} ${e.last_name}` : e.student_email}
                    </p>
                    <span className={`rounded-md border px-2 py-0.5 text-xs capitalize ${SEMESTER_STATUS_COLORS[e.status as keyof typeof SEMESTER_STATUS_COLORS] ?? ''}`}>
                      {e.status}
                    </span>
                  </li>
                ))}
            </ul>
          </details>
        )}
      </div>

      {/* Courses */}
      <div className="ds-card p-5">
        <h2 className="mb-4 text-sm font-medium text-[#0B1F3A]">
          Courses ({course_count})
        </h2>

        {courseState && !courseState.success && (
          <div className="mb-3 rounded-lg bg-[#FEE2E2] px-3 py-2 text-sm text-[#DC2626]">{courseState.error.message}</div>
        )}

        {availCourses.length > 0 && (
          <form action={courseAction} className="mb-4 flex gap-2">
            <input type="hidden" name="semester_id" value={semester.id} />
            <select name="course_id" required
              className="flex-1 rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm text-[#0B1F3A] outline-none transition focus:border-[#FF8A1F] focus:ring-2 focus:ring-[#FF8A1F]/15">
              <option value="">Add a course…</option>
              {availCourses.map((c) => (
                <option key={c.id} value={c.id}>{c.title}{c.code ? ` (${c.code})` : ''}</option>
              ))}
            </select>
            <SubmitButton label="Add" pendingLabel="…" />
          </form>
        )}

        {semCourses.length === 0 ? (
          <p className="text-sm text-[#94A3B8]">No courses assigned to this semester yet.</p>
        ) : (
          <ul className="space-y-1.5">
            {semCourses.map((c) => (
              <li key={c.id} className="flex items-center justify-between rounded-lg border border-[#E2E8F0] px-3 py-2.5">
                <div>
                  <p className="text-sm font-medium text-[#0B1F3A]">{c.course_title}</p>
                  <p className="text-xs text-[#64748B] capitalize">
                    {c.course_code ? `${c.course_code} · ` : ''}{c.course_level ?? 'No level'} · {c.course_scope}
                  </p>
                </div>
                <button type="button" onClick={() => handleRemoveCourse(c.course_id)}
                  className="text-xs text-[#F87171] hover:text-[#EF4444]">
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Groups */}
      {groups.length > 0 && (
        <div className="ds-card p-5">
          <h2 className="mb-4 text-sm font-medium text-[#0B1F3A]">Groups ({group_count})</h2>
          <p className="mb-3 text-xs text-[#94A3B8]">
            Groups are assigned to semesters from the Groups admin page.
          </p>
          <ul className="space-y-1.5">
            {groups.map((g) => (
              <li key={g.id} className="flex items-center justify-between rounded-lg border border-[#E2E8F0] px-3 py-2.5">
                <div>
                  <p className="text-sm font-medium text-[#0B1F3A]">{g.name}</p>
                  <p className="text-xs text-[#64748B] capitalize">{g.branch_name} · {g.type} · {g.status}</p>
                </div>
                {g.capacity && (
                  <span className="text-xs text-[#94A3B8]">Cap: {g.capacity}</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Danger zone */}
      <div className="rounded-xl border border-[#FEE2E2] bg-[#FEE2E2] p-5">
        <h2 className="mb-1 text-sm font-medium text-[#DC2626]">Danger zone</h2>
        <p className="mb-3 text-xs text-[#EF4444]">
          Delete is blocked if students are enrolled — archive the semester instead.
        </p>
        <button onClick={handleDelete}
          className="rounded-lg border border-[#FECACA] bg-white px-4 py-2 text-sm font-medium text-[#EF4444] transition hover:bg-[#FEE2E2]">
          Delete semester
        </button>
      </div>
    </div>
  )
}
