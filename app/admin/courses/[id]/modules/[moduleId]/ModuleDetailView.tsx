'use client'

import { useActionState } from 'react'
import { updateModule } from '@/modules/courses/modules/actions'
import { createLesson, deleteLesson, updateLesson } from '@/modules/courses/lessons/actions'
import SubmitButton from '@/components/admin/SubmitButton'
import StatusBadge from '@/components/admin/StatusBadge'
import type { CourseModule } from '@/modules/courses/modules/types'
import type { LessonListItem } from '@/modules/courses/lessons/types'
import type { ActionResult } from '@/types/app'

interface Props {
  courseId: string
  mod: CourseModule
  lessons: LessonListItem[]
}

const LESSON_TYPES = ['text', 'video', 'live', 'quiz', 'mixed'] as const

export default function ModuleDetailView({ courseId, mod, lessons }: Props) {
  const [editState, editAction]       = useActionState<ActionResult<void> | null, FormData>(updateModule, null)
  const [addLsnState, addLsnAction]   = useActionState<ActionResult<{ id: string }> | null, FormData>(createLesson, null)

  const handleDeleteLesson = async (lessonId: string) => {
    if (!confirm('Delete this lesson?')) return
    await deleteLesson(lessonId)
    window.location.reload()
  }

  const handleTogglePublish = async (lesson: LessonListItem) => {
    const fd = new FormData()
    fd.set('id', lesson.id)
    fd.set('title', lesson.title)
    fd.set('type', lesson.type)
    if (lesson.duration_minutes) fd.set('duration_minutes', String(lesson.duration_minutes))
    if (lesson.video_url) fd.set('video_url', lesson.video_url)
    if (!lesson.is_published) fd.set('is_published', 'on')
    await updateLesson(null, fd)
    window.location.reload()
  }

  return (
    <div className="space-y-5">
      {/* Module edit */}
      <div className="rounded-xl border border-[#E2E8F0] bg-white p-5">
        <h2 className="mb-4 text-sm font-medium text-[#0B1F3A]">Module Settings</h2>

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
          <input type="hidden" name="id" value={mod.id} />

          <div>
            <label className="mb-1 block text-xs font-medium text-[#64748B]">Title</label>
            <input
              name="title"
              defaultValue={mod.title}
              required
              className="w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm text-[#0B1F3A] outline-none transition focus:border-[#FF8A1F] focus:ring-2 focus:ring-[#FF8A1F]/15"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-[#64748B]">Description</label>
            <textarea
              name="description"
              defaultValue={mod.description ?? ''}
              rows={2}
              className="w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm text-[#0B1F3A] outline-none transition focus:border-[#FF8A1F] focus:ring-2 focus:ring-[#FF8A1F]/15"
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              id="mod_published"
              name="is_published"
              type="checkbox"
              value="on"
              defaultChecked={mod.is_published}
              className="h-4 w-4 rounded border-[#E2E8F0] accent-[#FF8A1F]"
            />
            <label htmlFor="mod_published" className="text-sm font-medium text-[#0B1F3A]">
              Published
            </label>
          </div>

          <div className="flex justify-end">
            <SubmitButton label="Save Changes" />
          </div>
        </form>
      </div>

      {/* Lessons */}
      <div className="rounded-xl border border-[#E2E8F0] bg-white p-5">
        <h2 className="mb-4 text-sm font-medium text-[#0B1F3A]">
          Lessons ({lessons.length})
        </h2>

        {addLsnState && !addLsnState.success && (
          <div className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {addLsnState.error.message}
          </div>
        )}

        <form action={addLsnAction} className="mb-4 flex gap-2">
          <input type="hidden" name="module_id" value={mod.id} />
          <input
            name="title"
            required
            placeholder="New lesson title…"
            className="flex-1 rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm text-[#0B1F3A] outline-none transition focus:border-[#FF8A1F] focus:ring-2 focus:ring-[#FF8A1F]/15"
          />
          <select
            name="type"
            defaultValue="text"
            className="rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm text-[#0B1F3A] outline-none transition focus:border-[#FF8A1F]"
          >
            {LESSON_TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          <SubmitButton label="Add Lesson" pendingLabel="…" />
        </form>

        {lessons.length === 0 ? (
          <p className="text-sm text-[#94A3B8]">No lessons yet. Add the first one above.</p>
        ) : (
          <ul className="space-y-2">
            {lessons.map((lesson) => (
              <li
                key={lesson.id}
                className="flex items-center justify-between rounded-lg border border-[#E2E8F0] px-3 py-2.5"
              >
                <div className="flex items-center gap-3">
                  <span className="flex h-6 w-6 items-center justify-center rounded bg-[#F8FAFC] text-xs font-medium text-[#64748B]">
                    {lesson.order_index}
                  </span>
                  <div>
                    <p className="text-sm font-medium text-[#0B1F3A]">{lesson.title}</p>
                    <p className="text-xs text-[#64748B] capitalize">
                      {lesson.type}
                      {lesson.duration_minutes ? ` · ${lesson.duration_minutes} min` : ''}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <StatusBadge status={lesson.is_published ? 'published' : 'draft'} />
                  <button
                    type="button"
                    onClick={() => handleTogglePublish(lesson)}
                    className="text-xs text-[#64748B] hover:text-[#0B1F3A]"
                  >
                    {lesson.is_published ? 'Unpublish' : 'Publish'}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteLesson(lesson.id)}
                    className="text-xs text-red-400 hover:text-red-600"
                  >
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
