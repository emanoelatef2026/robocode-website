'use client'

import { useState } from 'react'
import { assignGroupCourse } from '@/modules/groups/actions'
import type { CourseListItem } from '@/modules/courses/types'
import type { InstructorListItem } from '@/modules/instructors/types'

interface Props {
  groupId:     string
  courses:     CourseListItem[]
  instructors: InstructorListItem[]
  currentCourseId:     string | null
  currentInstructorId: string | null
}

export default function TLAssignCourseForm({ groupId, courses, instructors, currentCourseId, currentInstructorId }: Props) {
  const [pending, setPending] = useState(false)
  const [error,   setError]   = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const fd           = new FormData(e.currentTarget)
    const courseId     = fd.get('course_id') as string
    const instructorId = (fd.get('instructor_id') as string) || null

    if (!courseId) { setError('Select a course.'); return }

    setPending(true)
    setError(null)
    const result = await assignGroupCourse(groupId, courseId, instructorId)
    setPending(false)
    if (!result.success) {
      setError(result.error.message)
    } else {
      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {error   && <p className="text-sm text-red-600">{error}</p>}
      {success && <p className="text-sm text-green-600">Saved.</p>}

      <div>
        <label className="mb-1 block text-xs font-medium text-[#64748B]">Course</label>
        <select
          name="course_id"
          defaultValue={currentCourseId ?? ''}
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
          defaultValue={currentInstructorId ?? ''}
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
        disabled={pending}
        className="rounded-lg bg-[#0B1F3A] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#162d50] disabled:opacity-50"
      >
        {pending ? 'Saving…' : 'Save Assignment'}
      </button>
    </form>
  )
}
