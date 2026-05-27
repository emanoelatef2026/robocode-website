'use client'

import { useActionState } from 'react'
import { createProject } from '@/modules/portfolio/actions'
import SubmitButton from '@/components/admin/SubmitButton'
import Link from 'next/link'
import type { ActionResult } from '@/types/app'

interface CourseOption { id: string; title: string }
interface SemesterOption { id: string; name: string }

interface Props {
  studentId:   string
  portfolioId: string
  courses:     CourseOption[]
  semesters:   SemesterOption[]
}

const inputClass = 'w-full rounded-lg border border-[#E2E8F0] px-3 py-2.5 text-sm text-[#0B1F3A] outline-none transition focus:border-[#FF8A1F] focus:ring-2 focus:ring-[#FF8A1F]/15'

export default function NewProjectForm({ studentId, portfolioId, courses, semesters }: Props) {
  const [state, action] = useActionState<ActionResult<{ id: string }> | null, FormData>(
    createProject,
    null
  )

  return (
    <div className="rounded-xl border border-[#E2E8F0] bg-white p-6">
      {state && !state.success && (
        <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {state.error.message}
        </div>
      )}

      <form action={action} className="space-y-4">
        <input type="hidden" name="portfolio_id" value={portfolioId} />
        <input type="hidden" name="student_id"   value={studentId} />

        <div>
          <label className="mb-1 block text-sm font-medium text-[#0B1F3A]">
            Title <span className="text-red-500">*</span>
          </label>
          <input name="title" required className={inputClass} />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-[#0B1F3A]">Description</label>
          <textarea name="description" rows={3} className={inputClass} />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-[#0B1F3A]">Course</label>
            <select name="course_id" className={inputClass}>
              <option value="">— none —</option>
              {courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-[#0B1F3A]">Semester</label>
            <select name="semester_id" className={inputClass}>
              <option value="">— none —</option>
              {semesters.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-[#0B1F3A]">Score</label>
            <input name="final_score" type="number" min="0" max="100" step="0.01" className={inputClass} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-[#0B1F3A]">Thumbnail URL</label>
            <input name="thumbnail_url" type="url" placeholder="https://…" className={inputClass} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-[#0B1F3A]">GitHub URL</label>
            <input name="github_url" type="url" placeholder="https://github.com/…" className={inputClass} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-[#0B1F3A]">Project URL</label>
            <input name="project_url" type="url" placeholder="https://…" className={inputClass} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-[#0B1F3A]">Video URL</label>
            <input name="video_url" type="url" placeholder="https://youtube.com/…" className={inputClass} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-[#0B1F3A]">Drive URL</label>
            <input name="drive_url" type="url" placeholder="https://drive.google.com/…" className={inputClass} />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-[#0B1F3A]">Instructor Feedback</label>
          <textarea name="instructor_feedback" rows={3} className={inputClass} />
        </div>

        <div className="flex gap-6">
          <label className="flex items-center gap-2 text-sm text-[#0B1F3A]">
            <input type="checkbox" name="is_featured" value="true" className="h-4 w-4 rounded border-[#E2E8F0] text-[#FF8A1F]" />
            Featured
          </label>
          <label className="flex items-center gap-2 text-sm text-[#0B1F3A]">
            <input type="checkbox" name="is_public" value="true" className="h-4 w-4 rounded border-[#E2E8F0] text-[#FF8A1F]" />
            Public
          </label>
        </div>

        <div className="flex items-center justify-between border-t border-[#E2E8F0] pt-4">
          <Link href={`/admin/portfolio/${studentId}`} className="text-sm text-[#64748B] hover:text-[#0B1F3A]">
            Cancel
          </Link>
          <SubmitButton label="Create Project" pendingLabel="Creating…" />
        </div>
      </form>
    </div>
  )
}
