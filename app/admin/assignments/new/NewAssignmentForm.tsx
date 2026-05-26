'use client'

import { useActionState, useState } from 'react'
import { createAssignment } from '@/modules/assignments/actions'
import SubmitButton from '@/components/admin/SubmitButton'
import type { CourseListItem } from '@/modules/courses/types'
import type { ModuleForSelect } from '@/modules/assignments/types'
import type { ActionResult } from '@/types/app'

const TYPES = [
  'homework', 'classwork', 'project', 'quiz', 'exam', 'presentation', 'challenge', 'competition',
] as const

const SUBMISSION_TYPES = [
  { value: 'text',        label: 'Text (written answer)' },
  { value: 'file',        label: 'File upload' },
  { value: 'image',       label: 'Image upload' },
  { value: 'video_link',  label: 'Video link' },
  { value: 'drive_link',  label: 'Google Drive link' },
  { value: 'github_link', label: 'GitHub repository' },
  { value: 'url',         label: 'URL / website' },
  { value: 'multiple',    label: 'Multiple formats' },
]

interface Props {
  modules: ModuleForSelect[]
  courses: CourseListItem[]
}

export default function NewAssignmentForm({ modules, courses }: Props) {
  const [state, action] = useActionState<ActionResult<{ id: string }> | null, FormData>(
    createAssignment,
    null
  )
  const [selectedCourse, setSelectedCourse] = useState('')

  const filteredModules = selectedCourse
    ? modules.filter((m) => m.course_id === selectedCourse)
    : modules

  return (
    <div className="rounded-xl border border-[#E2E8F0] bg-white p-6">
      {state && !state.success && (
        <div className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error.message}
        </div>
      )}

      <form action={action} className="space-y-4">
        {/* Parent selection */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-[#64748B]">Course</label>
            <select
              value={selectedCourse}
              onChange={(e) => setSelectedCourse(e.target.value)}
              className="w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm text-[#0B1F3A] outline-none transition focus:border-[#FF8A1F] focus:ring-2 focus:ring-[#FF8A1F]/15"
            >
              <option value="">Select course…</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>{c.title}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[#64748B]">Module *</label>
            <select
              name="module_id"
              required
              className="w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm text-[#0B1F3A] outline-none transition focus:border-[#FF8A1F] focus:ring-2 focus:ring-[#FF8A1F]/15"
            >
              <option value="">Select module…</option>
              {filteredModules.map((m) => (
                <option key={m.id} value={m.id}>
                  {selectedCourse ? m.title : `${m.course_title} › ${m.title}`}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Title */}
        <div>
          <label className="mb-1 block text-xs font-medium text-[#64748B]">Title *</label>
          <input
            name="title"
            required
            placeholder="e.g. Build a Calculator App"
            className="w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm text-[#0B1F3A] outline-none transition focus:border-[#FF8A1F] focus:ring-2 focus:ring-[#FF8A1F]/15"
          />
        </div>

        {/* Type + Submission type */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-[#64748B]">Assignment type *</label>
            <select
              name="type"
              required
              className="w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm text-[#0B1F3A] outline-none transition focus:border-[#FF8A1F] focus:ring-2 focus:ring-[#FF8A1F]/15"
            >
              {TYPES.map((t) => (
                <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[#64748B]">Submission type *</label>
            <select
              name="submission_type"
              className="w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm text-[#0B1F3A] outline-none transition focus:border-[#FF8A1F] focus:ring-2 focus:ring-[#FF8A1F]/15"
            >
              {SUBMISSION_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Max score + Due date */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-[#64748B]">Max score</label>
            <input
              name="max_score"
              type="number"
              min="0"
              defaultValue="100"
              className="w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm text-[#0B1F3A] outline-none transition focus:border-[#FF8A1F] focus:ring-2 focus:ring-[#FF8A1F]/15"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[#64748B]">Due date</label>
            <input
              name="due_at"
              type="datetime-local"
              className="w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm text-[#0B1F3A] outline-none transition focus:border-[#FF8A1F] focus:ring-2 focus:ring-[#FF8A1F]/15"
            />
          </div>
        </div>

        {/* Description */}
        <div>
          <label className="mb-1 block text-xs font-medium text-[#64748B]">Description</label>
          <textarea
            name="description"
            rows={2}
            placeholder="Brief overview of the assignment…"
            className="w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm text-[#0B1F3A] outline-none transition focus:border-[#FF8A1F] focus:ring-2 focus:ring-[#FF8A1F]/15"
          />
        </div>

        {/* Instructions */}
        <div>
          <label className="mb-1 block text-xs font-medium text-[#64748B]">Instructions</label>
          <textarea
            name="instructions"
            rows={4}
            placeholder="Detailed step-by-step instructions for students…"
            className="w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm text-[#0B1F3A] outline-none transition focus:border-[#FF8A1F] focus:ring-2 focus:ring-[#FF8A1F]/15"
          />
        </div>

        {/* Checkboxes */}
        <div className="flex flex-wrap gap-6">
          <label className="flex items-center gap-2 text-sm text-[#0B1F3A]">
            <input name="allow_late" type="checkbox" value="on" className="h-4 w-4 rounded border-[#E2E8F0] accent-[#FF8A1F]" />
            Allow late submissions
          </label>
          <label className="flex items-center gap-2 text-sm text-[#0B1F3A]">
            <input name="resubmission_allowed" type="checkbox" value="on" className="h-4 w-4 rounded border-[#E2E8F0] accent-[#FF8A1F]" />
            Allow resubmission
          </label>
          <label className="flex items-center gap-2 text-sm text-[#0B1F3A]">
            <input name="portfolio_eligible" type="checkbox" value="on" className="h-4 w-4 rounded border-[#E2E8F0] accent-[#FF8A1F]" />
            Portfolio eligible
          </label>
        </div>

        {/* Status + submit */}
        <div className="flex items-center justify-between pt-2">
          <select
            name="status"
            className="rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm text-[#0B1F3A] outline-none transition focus:border-[#FF8A1F]"
          >
            <option value="draft">Save as Draft</option>
            <option value="published">Publish immediately</option>
          </select>
          <SubmitButton label="Create Assignment" pendingLabel="Creating…" />
        </div>
      </form>
    </div>
  )
}
