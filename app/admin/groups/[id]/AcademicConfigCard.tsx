'use client'

import { useActionState } from 'react'
import { saveGroupAcademicConfig } from '@/modules/groups/actions'
import SubmitButton from '@/components/admin/SubmitButton'
import type { GroupAcademicConfig } from '@/modules/groups/types'
import type { ActionResult } from '@/types/app'

interface CourseOption     { id: string; title: string; code: string | null }
interface SemesterOption   { id: string; name: string; status: string }
interface InstructorOption { id: string; name: string; branch_name: string }

interface Props {
  groupId:      string
  config:       GroupAcademicConfig
  courses:      CourseOption[]
  semesters:    SemesterOption[]
  instructors:  InstructorOption[]
}

const READINESS_LABELS: Record<string, string> = {
  hasCourse:     'Course',
  hasSemester:   'Semester',
  hasInstructor: 'Instructor',
}

export default function AcademicConfigCard({
  groupId, config, courses, semesters, instructors,
}: Props) {
  const [state, action] = useActionState<ActionResult<void> | null, FormData>(
    saveGroupAcademicConfig, null
  )

  const hasCourse     = !!config.course_id
  const hasSemester   = !!config.semester_id
  const hasInstructor = !!config.instructor_id
  const isActive      = hasCourse && hasSemester && hasInstructor

  const cls = 'w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm text-[#0B1F3A] outline-none transition focus:border-[#FF8A1F] focus:ring-2 focus:ring-[#FF8A1F]/15 bg-white'

  return (
    <div className="rounded-xl border border-[#E2E8F0] bg-white p-5">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-[#0B1F3A]">Academic Configuration</h2>
        <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
          isActive
            ? 'bg-emerald-100 text-emerald-700'
            : 'bg-amber-100 text-amber-700'
        }`}>
          {isActive ? 'Active' : 'Forming'}
        </span>
      </div>

      {/* Readiness checklist */}
      {!isActive && (
        <div className="mb-4 rounded-lg border border-amber-100 bg-amber-50 px-3 py-2.5">
          <p className="mb-1.5 text-xs font-medium text-amber-800">
            Missing before group can activate:
          </p>
          <ul className="space-y-1">
            {[
              { key: 'hasCourse',     met: hasCourse },
              { key: 'hasSemester',   met: hasSemester },
              { key: 'hasInstructor', met: hasInstructor },
            ].map(({ key, met }) => (
              <li key={key} className="flex items-center gap-1.5 text-xs">
                <span className={met ? 'text-emerald-500' : 'text-amber-500'}>
                  {met ? '✓' : '✗'}
                </span>
                <span className={met ? 'text-emerald-700' : 'text-amber-700'}>
                  {READINESS_LABELS[key]}
                  {met ? ' assigned' : ' not assigned'}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Success / error */}
      {state?.success && (
        <div className="mb-3 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">
          Academic configuration saved.{' '}
          {isActive
            ? 'Group is now Active — sessions can be started.'
            : 'Group remains Forming until all requirements are met.'}
        </div>
      )}
      {state && !state.success && (
        <div className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error.message}
        </div>
      )}

      <form action={action} className="space-y-3">
        <input type="hidden" name="group_id" value={groupId} />

        {/* Course */}
        <div>
          <label className="mb-1 block text-xs font-medium text-[#64748B]">Course</label>
          <select name="course_id" defaultValue={config.course_id ?? ''} className={cls}>
            <option value="">— No course assigned —</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}{c.code ? ` (${c.code})` : ''}
              </option>
            ))}
          </select>
        </div>

        {/* Semester */}
        <div>
          <label className="mb-1 block text-xs font-medium text-[#64748B]">Semester</label>
          <select name="semester_id" defaultValue={config.semester_id ?? ''} className={cls}>
            <option value="">— No semester assigned —</option>
            {semesters.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
                {s.status !== 'active' ? ` (${s.status})` : ''}
              </option>
            ))}
          </select>
        </div>

        {/* Instructor */}
        <div>
          <label className="mb-1 block text-xs font-medium text-[#64748B]">Lead Instructor</label>
          <select name="instructor_id" defaultValue={config.instructor_id ?? ''} className={cls}>
            <option value="">— No instructor assigned —</option>
            {instructors.map((i) => (
              <option key={i.id} value={i.id}>
                {i.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex justify-end pt-1">
          <SubmitButton label="Save Configuration" />
        </div>
      </form>
    </div>
  )
}
