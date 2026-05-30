'use client'

import { useActionState } from 'react'
import { updateCourse, deleteCourse } from '@/modules/courses/actions'
import SubmitButton from '@/components/admin/SubmitButton'
import type { Course } from '@/modules/courses/types'
import type { BranchListItem } from '@/modules/branches/types'
import type { ActionResult } from '@/types/app'

interface Props {
  course: Course
  branches: BranchListItem[]
}

export default function CourseDetailView({ course, branches }: Props) {
  const [editState, editAction] = useActionState<ActionResult<void> | null, FormData>(updateCourse, null)

  const handleDelete = async () => {
    if (!confirm('Delete this course? This action cannot be undone.')) return
    await deleteCourse(course.id)
    window.location.href = '/admin/courses'
  }

  return (
    <div className="space-y-5">
      {/* Course edit form */}
      <div className="rounded-xl border border-[#E2E8F0] bg-white p-5">
        <h2 className="mb-4 text-sm font-medium text-[#0B1F3A]">Course Settings</h2>

        {editState && !editState.success && (
          <div className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {editState.error.message}
          </div>
        )}
        {editState?.success && (
          <div className="mb-3 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">
            Changes saved.
          </div>
        )}

        <form action={editAction} className="space-y-3">
          <input type="hidden" name="id" value={course.id} />

          <div>
            <label className="mb-1 block text-xs font-medium text-[#64748B]">Title</label>
            <input
              name="title"
              defaultValue={course.title}
              required
              className="w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm text-[#0B1F3A] outline-none transition focus:border-[#FF8A1F] focus:ring-2 focus:ring-[#FF8A1F]/15"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-[#64748B]">Description</label>
            <textarea
              name="description"
              defaultValue={course.description ?? ''}
              rows={2}
              className="w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm text-[#0B1F3A] outline-none transition focus:border-[#FF8A1F] focus:ring-2 focus:ring-[#FF8A1F]/15"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-[#64748B]">Code</label>
              <input
                name="code"
                defaultValue={course.code ?? ''}
                className="w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm text-[#0B1F3A] outline-none transition focus:border-[#FF8A1F] focus:ring-2 focus:ring-[#FF8A1F]/15"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[#64748B]">Category</label>
              <input
                name="category"
                defaultValue={course.category ?? ''}
                className="w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm text-[#0B1F3A] outline-none transition focus:border-[#FF8A1F] focus:ring-2 focus:ring-[#FF8A1F]/15"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-[#64748B]">Level</label>
              <select
                name="level"
                defaultValue={course.level ?? ''}
                className="w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm text-[#0B1F3A] outline-none transition focus:border-[#FF8A1F] focus:ring-2 focus:ring-[#FF8A1F]/15"
              >
                <option value="">—</option>
                <option value="beginner">Beginner</option>
                <option value="intermediate">Intermediate</option>
                <option value="advanced">Advanced</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[#64748B]">Scope</label>
              <select
                name="scope"
                defaultValue={course.scope}
                className="w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm text-[#0B1F3A] outline-none transition focus:border-[#FF8A1F] focus:ring-2 focus:ring-[#FF8A1F]/15"
              >
                <option value="branch">Branch</option>
                <option value="template">Template</option>
                <option value="global">Global</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[#64748B]">Est. hours</label>
              <input
                name="estimated_hours"
                type="number"
                min={0}
                defaultValue={course.estimated_hours ?? ''}
                className="w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm text-[#0B1F3A] outline-none transition focus:border-[#FF8A1F] focus:ring-2 focus:ring-[#FF8A1F]/15"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-[#64748B]">Branch</label>
            <select
              name="branch_id"
              defaultValue={course.branch_id ?? ''}
              className="w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm text-[#0B1F3A] outline-none transition focus:border-[#FF8A1F] focus:ring-2 focus:ring-[#FF8A1F]/15"
            >
              <option value="">No branch</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <input
              id="is_published_edit"
              name="is_published"
              type="checkbox"
              value="on"
              defaultChecked={course.is_published}
              className="h-4 w-4 rounded border-[#E2E8F0] accent-[#FF8A1F]"
            />
            <label htmlFor="is_published_edit" className="text-sm font-medium text-[#0B1F3A]">
              Published
            </label>
          </div>

          <div className="flex justify-end">
            <SubmitButton label="Save Changes" />
          </div>
        </form>
      </div>

      {/* Danger zone */}
      <div className="rounded-xl border border-red-100 bg-red-50 p-5">
        <h2 className="mb-1 text-sm font-medium text-red-700">Danger zone</h2>
        <p className="mb-3 text-xs text-red-600">Soft-deletes the course and hides it from all views.</p>
        <button
          onClick={handleDelete}
          className="rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50"
        >
          Delete course
        </button>
      </div>
    </div>
  )
}
