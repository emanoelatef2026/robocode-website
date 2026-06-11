'use client'

import { useActionState } from 'react'
import { updateCourse, deleteCourse } from '@/modules/courses/actions'
import SubmitButton from '@/components/admin/SubmitButton'
import type { Course } from '@/modules/courses/types'
import type { ActionResult } from '@/types/app'

interface Props {
  course: Course
}

export default function CourseDetailView({ course }: Props) {
  const [editState, editAction] = useActionState<ActionResult<void> | null, FormData>(updateCourse, null)

  const handleDelete = async () => {
    if (!confirm('Delete this course? This action cannot be undone.')) return
    await deleteCourse(course.id)
    window.location.href = '/admin/courses'
  }

  const cls = 'w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm text-[#0B1F3A] outline-none transition focus:border-[#FF8A1F] focus:ring-2 focus:ring-[#FF8A1F]/15'

  return (
    <div className="space-y-5">
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
            <input name="title" defaultValue={course.title} required className={cls} />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-[#64748B]">Description</label>
            <textarea name="description" defaultValue={course.description ?? ''} rows={2} className={cls} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-[#64748B]">Code</label>
              <input name="code" defaultValue={course.code ?? ''} className={cls} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[#64748B]">Category</label>
              <input name="category" defaultValue={course.category ?? ''} className={cls} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-[#64748B]">Level</label>
              <select name="level" defaultValue={course.level ?? ''} className={cls}>
                <option value="">—</option>
                <option value="beginner">Beginner</option>
                <option value="intermediate">Intermediate</option>
                <option value="advanced">Advanced</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[#64748B]">Est. hours</label>
              <input name="estimated_hours" type="number" min={0} defaultValue={course.estimated_hours ?? ''} className={cls} />
            </div>
          </div>

          <input type="hidden" name="scope" value={course.scope} />

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

          {/* ── Resource Center ─────────────────────────────────────── */}
          <div className="border-t border-[#E2E8F0] pt-4 mt-2">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-[#94A3B8]">Resource Center</p>

            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-[#64748B]">Thumbnail URL</label>
                <input
                  name="thumbnail_url"
                  type="url"
                  defaultValue={course.thumbnail_url ?? ''}
                  placeholder="https://…"
                  className={cls}
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-[#64748B]">Main Content Link</label>
                <input
                  name="resources_url"
                  type="url"
                  defaultValue={course.resources_url ?? ''}
                  placeholder="https://drive.google.com/… or Notion URL"
                  className={cls}
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-[#64748B]">Google Drive Folder URL</label>
                <input
                  name="drive_url"
                  type="url"
                  defaultValue={course.drive_url ?? ''}
                  placeholder="https://drive.google.com/…"
                  className={cls}
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-[#64748B]">Curriculum Folder Link</label>
                <input
                  name="curriculum_folder"
                  type="url"
                  defaultValue={course.curriculum_folder ?? ''}
                  placeholder="Link to curriculum or lesson plan folder"
                  className={cls}
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-[#64748B]">Instructor Notes</label>
                <textarea name="instructor_notes" rows={2} defaultValue={course.instructor_notes ?? ''} placeholder="Teaching notes, tips for instructors…" className={cls} />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-[#64748B]">Session Plans</label>
                <textarea name="session_plans" rows={2} defaultValue={course.session_plans ?? ''} placeholder="How sessions are structured, duration, activities…" className={cls} />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-[#64748B]">Teaching Guide</label>
                <textarea name="teaching_guide" rows={2} defaultValue={course.teaching_guide ?? ''} placeholder="Methodologies, examples, classroom tips…" className={cls} />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-[#64748B]">Prerequisites</label>
                <textarea name="prerequisites" rows={1} defaultValue={course.prerequisites ?? ''} placeholder="What students should know before starting…" className={cls} />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-[#64748B]">Expected Outcomes</label>
                <textarea name="expected_outcomes" rows={2} defaultValue={course.expected_outcomes ?? ''} placeholder="What students will be able to do after completing this course…" className={cls} />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-[#64748B]">Skills Covered</label>
                <input name="skills_covered" defaultValue={course.skills_covered ?? ''} placeholder="e.g. Python, Scratch, robotics, problem solving" className={cls} />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-[#64748B]">Course Roadmap</label>
                <textarea name="course_roadmap" rows={2} defaultValue={course.course_roadmap ?? ''} placeholder="Sequence of topics, milestones, progression path…" className={cls} />
              </div>

              <input type="hidden" name="resource_links" value={JSON.stringify(course.resource_links ?? [])} />
            </div>
          </div>

          <div className="flex justify-end">
            <SubmitButton label="Save Changes" />
          </div>
        </form>
      </div>

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
