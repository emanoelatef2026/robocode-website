'use client'

import { useActionState } from 'react'
import { updateProject, archiveProject } from '@/modules/portfolio/actions'
import SubmitButton from '@/components/admin/SubmitButton'
import Link from 'next/link'
import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { ActionResult } from '@/types/app'
import type { PortfolioProject } from '@/modules/portfolio/types'

interface CourseOption { id: string; title: string }
interface SemesterOption { id: string; name: string }

interface Props {
  project:   PortfolioProject
  studentId: string
  courses:   CourseOption[]
  semesters: SemesterOption[]
}

const inputClass = 'w-full rounded-lg border border-[#E2E8F0] px-3 py-2.5 text-sm text-[#0B1F3A] outline-none transition focus:border-[#FF8A1F] focus:ring-2 focus:ring-[#FF8A1F]/15'

export default function EditProjectForm({ project, studentId, courses, semesters }: Props) {
  const router = useRouter()
  const [archiving, startArchive] = useTransition()

  const [state, formAction] = useActionState<ActionResult<void> | null, FormData>(
    async (_prev, formData) => {
      const input = {
        title:               formData.get('title') as string,
        description:         formData.get('description') as string || undefined,
        thumbnail_url:       formData.get('thumbnail_url') as string || undefined,
        github_url:          formData.get('github_url') as string || undefined,
        drive_url:           formData.get('drive_url') as string || undefined,
        video_url:           formData.get('video_url') as string || undefined,
        project_url:         formData.get('project_url') as string || undefined,
        instructor_feedback: formData.get('instructor_feedback') as string || undefined,
        final_score:         formData.get('final_score') ? Number(formData.get('final_score')) : null,
        semester_id:         formData.get('semester_id') as string || null,
        course_id:           formData.get('course_id') as string || null,
        is_featured:         formData.get('is_featured') === 'true',
        is_public:           formData.get('is_public') === 'true',
      }
      const result = await updateProject(project.id, input)
      if (result.success) router.push(`/admin/portfolio/${studentId}`)
      return result
    },
    null
  )

  function handleArchive() {
    startArchive(async () => {
      await archiveProject(project.id)
      router.push(`/admin/portfolio/${studentId}`)
    })
  }

  return (
    <div className="rounded-xl border border-[#E2E8F0] bg-white p-6">
      {state && !state.success && (
        <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {state.error.message}
        </div>
      )}

      <form action={formAction} className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-[#0B1F3A]">
            Title <span className="text-red-500">*</span>
          </label>
          <input name="title" required defaultValue={project.title} className={inputClass} />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-[#0B1F3A]">Description</label>
          <textarea name="description" rows={3} defaultValue={project.description ?? ''} className={inputClass} />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-[#0B1F3A]">Course</label>
            <select name="course_id" defaultValue={project.course_id ?? ''} className={inputClass}>
              <option value="">— none —</option>
              {courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-[#0B1F3A]">Semester</label>
            <select name="semester_id" defaultValue={project.semester_id ?? ''} className={inputClass}>
              <option value="">— none —</option>
              {semesters.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-[#0B1F3A]">Score</label>
            <input name="final_score" type="number" min="0" max="100" step="0.01"
              defaultValue={project.final_score ?? ''} className={inputClass} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-[#0B1F3A]">Thumbnail URL</label>
            <input name="thumbnail_url" type="url" defaultValue={project.thumbnail_url ?? ''} className={inputClass} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-[#0B1F3A]">GitHub URL</label>
            <input name="github_url" type="url" defaultValue={project.github_url ?? ''} className={inputClass} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-[#0B1F3A]">Project URL</label>
            <input name="project_url" type="url" defaultValue={project.project_url ?? ''} className={inputClass} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-[#0B1F3A]">Video URL</label>
            <input name="video_url" type="url" defaultValue={project.video_url ?? ''} className={inputClass} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-[#0B1F3A]">Drive URL</label>
            <input name="drive_url" type="url" defaultValue={project.drive_url ?? ''} className={inputClass} />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-[#0B1F3A]">Instructor Feedback</label>
          <textarea name="instructor_feedback" rows={3} defaultValue={project.instructor_feedback ?? ''} className={inputClass} />
        </div>

        <div className="flex gap-6">
          <label className="flex items-center gap-2 text-sm text-[#0B1F3A]">
            <input type="checkbox" name="is_featured" value="true"
              defaultChecked={project.is_featured}
              className="h-4 w-4 rounded border-[#E2E8F0]" />
            Featured
          </label>
          <label className="flex items-center gap-2 text-sm text-[#0B1F3A]">
            <input type="checkbox" name="is_public" value="true"
              defaultChecked={project.is_public}
              className="h-4 w-4 rounded border-[#E2E8F0]" />
            Public
          </label>
        </div>

        <div className="flex items-center justify-between border-t border-[#E2E8F0] pt-4">
          <div className="flex gap-3">
            <Link href={`/admin/portfolio/${studentId}`} className="text-sm text-[#64748B] hover:text-[#0B1F3A]">
              Cancel
            </Link>
            {!project.is_archived && (
              <button
                type="button"
                onClick={handleArchive}
                disabled={archiving}
                className="text-sm text-red-500 hover:text-red-700 disabled:opacity-50"
              >
                Archive
              </button>
            )}
          </div>
          <SubmitButton label="Save Changes" pendingLabel="Saving…" />
        </div>
      </form>
    </div>
  )
}
