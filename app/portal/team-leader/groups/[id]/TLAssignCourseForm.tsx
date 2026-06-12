'use client'

import { useState } from 'react'
import { assignGroupCourse } from '@/modules/groups/actions'
import type { CourseListItem } from '@/modules/courses/types'
import type { InstructorListItem } from '@/modules/instructors/types'

interface Props {
  groupId:             string
  courses:             CourseListItem[]
  instructors:         InstructorListItem[]
  currentCourseId:     string | null
  currentInstructorId: string | null
  currentStartedAt:    string | null
}

function assignmentAge(startedAt: string | null): string | null {
  if (!startedAt) return null
  const days = Math.floor((Date.now() - new Date(startedAt).getTime()) / 86_400_000)
  if (days === 0) return 'Assigned today'
  if (days === 1) return 'Assigned 1 day ago'
  return `Assigned ${days} days ago`
}

export default function TLAssignCourseForm({
  groupId,
  courses,
  instructors,
  currentCourseId,
  currentInstructorId,
  currentStartedAt,
}: Props) {
  const [courseId,     setCourseId]     = useState(currentCourseId     ?? '')
  const [instructorId, setInstructorId] = useState(currentInstructorId ?? '')
  const [pending,      setPending]      = useState(false)
  const [error,        setError]        = useState<string | null>(null)
  const [success,      setSuccess]      = useState(false)

  const hasExisting = !!currentCourseId
  const isDirty     = courseId !== (currentCourseId ?? '') ||
                      instructorId !== (currentInstructorId ?? '')
  const isDisabled  = pending || (hasExisting && !isDirty)

  const buttonLabel = pending
    ? 'Saving…'
    : hasExisting && isDirty
      ? 'Update Assignment'
      : hasExisting
        ? 'Saved'
        : 'Assign Course'

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!courseId) { setError('Select a course.'); return }

    setPending(true)
    setError(null)
    const result = await assignGroupCourse(groupId, courseId, instructorId || null)
    setPending(false)
    if (!result.success) {
      setError(result.error.message)
    } else {
      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
    }
  }

  const age = assignmentAge(hasExisting ? currentStartedAt : null)

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {error   && <p className="text-sm text-red-600">{error}</p>}
      {success && <p className="text-sm text-emerald-600">Assignment saved.</p>}

      <div>
        <div className="mb-1 flex items-center justify-between">
          <label className="text-xs font-medium text-[#64748B]">Course</label>
          {age && !isDirty && (
            <span className="text-[10px] text-[#94A3B8]">{age}</span>
          )}
        </div>
        <select
          name="course_id"
          value={courseId}
          onChange={e => setCourseId(e.target.value)}
          className="w-full rounded-lg border border-[#E2E8F0] px-3 py-2.5 text-sm text-[#0B1F3A] outline-none transition focus:border-[#FF8A1F] focus:ring-2 focus:ring-[#FF8A1F]/15"
        >
          <option value="">No course assigned</option>
          {courses.map((c) => (
            <option key={c.id} value={c.id}>{c.title}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-[#64748B]">Lead instructor</label>
        <select
          name="instructor_id"
          value={instructorId}
          onChange={e => setInstructorId(e.target.value)}
          className="w-full rounded-lg border border-[#E2E8F0] px-3 py-2.5 text-sm text-[#0B1F3A] outline-none transition focus:border-[#FF8A1F] focus:ring-2 focus:ring-[#FF8A1F]/15"
        >
          <option value="">No instructor assigned</option>
          {instructors.map((i) => (
            <option key={i.id} value={i.id}>
              {i.first_name && i.last_name
                ? `${i.first_name} ${i.last_name}`
                : i.user_email}
            </option>
          ))}
        </select>
      </div>

      <button
        type="submit"
        disabled={isDisabled}
        className="rounded-lg bg-[#0B1F3A] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#162d50] disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {buttonLabel}
      </button>
    </form>
  )
}
