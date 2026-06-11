'use client'

import { useActionState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createCourse } from '@/modules/courses/actions'
import SubmitButton from '@/components/admin/SubmitButton'
import type { ActionResult } from '@/types/app'

interface Props {
  onClose: () => void
}

const cls =
  'w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2.5 text-sm text-[#0B1F3A] outline-none transition focus:border-[#FF8A1F] focus:ring-2 focus:ring-[#FF8A1F]/15'

export default function CourseCreateModal({ onClose }: Props) {
  const router = useRouter()
  const formRef = useRef<HTMLFormElement>(null)

  const [state, action] = useActionState<ActionResult<{ id: string }> | null, FormData>(
    createCourse,
    null
  )

  // Stay on the list; refresh server data so the new course appears immediately
  useEffect(() => {
    if (state?.success) {
      router.refresh()
      onClose()
    }
  }, [state, router, onClose])

  // Close on Escape key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="course-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.45)' }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl ring-1 ring-black/5">

        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#E2E8F0] px-6 py-4">
          <h2 id="course-modal-title" className="text-base font-semibold text-[#0B1F3A]">
            New Course
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg p-1.5 text-[#94A3B8] transition hover:bg-[#F8FAFC] hover:text-[#0B1F3A]"
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>

        {/* Error banner */}
        {state && !state.success && (
          <div className="mx-6 mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 border border-red-100">
            {state.error.message}
          </div>
        )}

        {/* Form */}
        <form ref={formRef} action={action} className="px-6 py-5 space-y-4">
          <input type="hidden" name="scope" value="global" />

          {/* Course Name */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-[#0B1F3A]">
              Course Name <span className="text-red-500">*</span>
            </label>
            <input
              name="title"
              required
              autoFocus
              placeholder="e.g. Pictoblox Level 1"
              className={cls}
            />
          </div>

          {/* Course Code */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-[#0B1F3A]">
              Code{' '}
              <span className="text-[#94A3B8] font-normal text-xs">(optional)</span>
            </label>
            <input
              name="code"
              placeholder="e.g. PB1, RBC-ADV"
              className={cls}
            />
          </div>

          {/* Description */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-[#0B1F3A]">Description</label>
            <textarea
              name="description"
              rows={3}
              placeholder="What students will learn in this course…"
              className={cls}
            />
          </div>

          {/* Main Content Link */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-[#0B1F3A]">Main Content Link</label>
            <input
              name="resources_url"
              type="url"
              placeholder="https://drive.google.com/… or Notion URL"
              className={cls}
            />
            <p className="mt-1 text-[11px] text-[#94A3B8]">
              Google Drive, Notion, or any course resource URL
            </p>
          </div>

          {/* Thumbnail URL */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-[#0B1F3A]">
              Thumbnail URL{' '}
              <span className="text-[#94A3B8] font-normal text-xs">(optional)</span>
            </label>
            <input
              name="thumbnail_url"
              type="url"
              placeholder="https://…"
              className={cls}
            />
          </div>

          {/* Status */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-[#0B1F3A]">Status</label>
            <select name="is_published" className={cls} defaultValue="">
              <option value="">Draft — not visible to students</option>
              <option value="on">Active — published</option>
            </select>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#E2E8F0]">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-[#E2E8F0] px-4 py-2.5 text-sm font-medium text-[#64748B] transition hover:border-[#CBD5E1]"
            >
              Cancel
            </button>
            <SubmitButton label="Create Course" pendingLabel="Creating…" />
          </div>
        </form>
      </div>
    </div>
  )
}
