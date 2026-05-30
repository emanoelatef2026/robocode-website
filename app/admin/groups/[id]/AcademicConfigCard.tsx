'use client'

import { useActionState, useState, useTransition } from 'react'
import { saveGroupAcademicConfig, promoteGroupSemester } from '@/modules/groups/actions'
import SubmitButton from '@/components/admin/SubmitButton'
import type { GroupAcademicConfig } from '@/modules/groups/types'
import type { ActionResult } from '@/types/app'

interface CourseOption     { id: string; title: string; code: string | null }
interface SemesterOption   { id: string; title: string }          // course semester (course_modules)
interface AcademicPeriod   { id: string; name: string; status: string }  // academic semesters table
interface InstructorOption { id: string; name: string; branch_name: string }

interface Props {
  groupId:          string
  config:           GroupAcademicConfig
  courses:          CourseOption[]
  // modulesByCourse: map from course_id → list of course semesters (course_modules)
  modulesByCourse:  Record<string, SemesterOption[]>
  academicPeriods:  AcademicPeriod[]
  instructors:      InstructorOption[]
}

export default function AcademicConfigCard({
  groupId, config, courses, modulesByCourse, academicPeriods, instructors,
}: Props) {
  const [state, action] = useActionState<ActionResult<void> | null, FormData>(
    saveGroupAcademicConfig, null
  )

  const [selectedCourseId, setSelectedCourseId] = useState(config.course_id ?? '')

  // Semester promotion
  const [isPendingPromote, startPromoteTransition] = useTransition()
  const [promoteResult, setPromoteResult] = useState<{ success: boolean; message: string } | null>(null)

  const handlePromote = () => {
    if (!confirm(`Promote this group from "${config.course_module_title}" to the next semester? Students and instructor are preserved.`)) return
    setPromoteResult(null)
    startPromoteTransition(async () => {
      const res = await promoteGroupSemester(groupId)
      if (res.success) {
        setPromoteResult({ success: true, message: `Promoted to ${res.data.newSemesterTitle} (Semester ${res.data.newSemesterOrder}).` })
      } else {
        setPromoteResult({ success: false, message: res.error.message })
      }
    })
  }

  const courseSemesters = selectedCourseId ? (modulesByCourse[selectedCourseId] ?? []) : []

  const hasCourse         = !!config.course_id
  const hasCourseSemester = !!config.course_module_id
  const hasAcademicPeriod = !!config.semester_id
  const hasInstructor     = !!config.instructor_id
  const isActive          = hasCourse && hasCourseSemester && hasAcademicPeriod && hasInstructor

  const missing: string[] = []
  if (!hasCourse)         missing.push('Course not assigned')
  if (!hasCourseSemester) missing.push('Course semester not assigned')
  if (!hasAcademicPeriod) missing.push('Academic period not assigned')
  if (!hasInstructor)     missing.push('No instructor assigned')

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
              { label: 'Course',             met: hasCourse },
              { label: 'Course Semester',    met: hasCourseSemester },
              { label: 'Academic Period',    met: hasAcademicPeriod },
              { label: 'Lead Instructor',    met: hasInstructor },
            ].map(({ label, met }) => (
              <li key={label} className="flex items-center gap-1.5 text-xs">
                <span className={met ? 'text-emerald-500' : 'text-amber-500'}>{met ? '✓' : '✗'}</span>
                <span className={met ? 'text-emerald-700' : 'text-amber-700'}>
                  {label}{met ? ' assigned' : ' not assigned'}
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
          <select
            name="course_id"
            defaultValue={config.course_id ?? ''}
            onChange={(e) => setSelectedCourseId(e.target.value)}
            className={cls}
          >
            <option value="">— No course assigned —</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}{c.code ? ` (${c.code})` : ''}
              </option>
            ))}
          </select>
        </div>

        {/* Course Semester — filtered by selected course */}
        <div>
          <label className="mb-1 block text-xs font-medium text-[#64748B]">
            Course Semester
            <span className="ml-1 font-normal text-[#94A3B8]">(select course first)</span>
          </label>
          <select
            name="course_module_id"
            defaultValue={config.course_module_id ?? ''}
            className={cls}
            disabled={courseSemesters.length === 0 && !selectedCourseId}
          >
            <option value="">— No semester assigned —</option>
            {courseSemesters.map((s) => (
              <option key={s.id} value={s.id}>{s.title}</option>
            ))}
          </select>
          {selectedCourseId && courseSemesters.length === 0 && (
            <p className="mt-0.5 text-xs text-[#94A3B8]">
              No semesters defined for this course — add them in the course editor.
            </p>
          )}
        </div>

        {/* Academic Period (existing semesters table) */}
        <div>
          <label className="mb-1 block text-xs font-medium text-[#64748B]">Academic Period</label>
          <select name="semester_id" defaultValue={config.semester_id ?? ''} className={cls}>
            <option value="">— No academic period assigned —</option>
            {academicPeriods.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}{s.status !== 'active' ? ` (${s.status})` : ''}
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
              <option key={i.id} value={i.id}>{i.name}</option>
            ))}
          </select>
        </div>

        <div className="flex justify-end pt-1">
          <SubmitButton label="Save Configuration" />
        </div>
      </form>

      {/* Semester Promotion */}
      {config.course_module_id && (
        <div className="mt-5 border-t border-[#E2E8F0] pt-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold text-[#0B1F3A]">Promote Group</p>
              <p className="mt-0.5 text-xs text-[#64748B]">
                Current: <span className="font-medium">{config.course_module_title}</span>
                {' '}→ advance to next semester. Students and instructor are preserved.
              </p>
            </div>
            <button
              type="button"
              onClick={handlePromote}
              disabled={isPendingPromote}
              className="shrink-0 rounded-lg border border-[#E2E8F0] px-4 py-2 text-sm font-medium text-[#0B1F3A] hover:border-[#FF8A1F] hover:text-[#FF8A1F] disabled:opacity-50 transition"
            >
              {isPendingPromote ? 'Promoting…' : 'Promote →'}
            </button>
          </div>
          {promoteResult && (
            <p className={`mt-2 text-xs ${promoteResult.success ? 'text-emerald-600' : 'text-red-600'}`}>
              {promoteResult.message}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
