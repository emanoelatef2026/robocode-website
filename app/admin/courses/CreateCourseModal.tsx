'use client'

import { useActionState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createCourseModal } from '@/modules/courses/actions'
import type { ActionResult } from '@/types/app'

interface Props {
  isOpen:   boolean
  onClose:  () => void
}

const cls = 'w-full rounded-lg border border-[#E2E8F0] px-3 py-2.5 text-sm text-[#0B1F3A] outline-none transition focus:border-[#FF8A1F] focus:ring-2 focus:ring-[#FF8A1F]/15 bg-white'

export default function CreateCourseModal({ isOpen, onClose }: Props) {
  const router  = useRouter()
  const formRef = useRef<HTMLFormElement>(null)

  const [state, action, pending] = useActionState<ActionResult<{ id: string }> | null, FormData>(
    createCourseModal,
    null
  )

  // On success: stay on the list, refresh server data so the new course appears
  useEffect(() => {
    if (state?.success) {
      router.refresh()
      onClose()
    }
  }, [state, router, onClose])

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [isOpen, onClose])

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) formRef.current?.reset()
  }, [isOpen])

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div className="relative z-10 w-full max-w-lg rounded-2xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#E2E8F0] px-6 py-4">
          <div>
            <h2 id="modal-title" className="text-base font-semibold text-[#0B1F3A]">New Course</h2>
            <p className="mt-0.5 text-xs text-[#94A3B8]">Courses are global assets shared across all branches.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-[#94A3B8] transition hover:bg-[#F1F5F9] hover:text-[#0B1F3A]"
            aria-label="Close"
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <form ref={formRef} action={action} className="px-6 py-5 space-y-4">
          <input type="hidden" name="scope" value="global" />

          {state && !state.success && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {state.error.message}
            </div>
          )}

          {/* Course Name */}
          <div>
            <label htmlFor="mc-title" className="mb-1.5 block text-sm font-medium text-[#0B1F3A]">
              Course Name <span className="text-red-500">*</span>
            </label>
            <input
              id="mc-title"
              name="title"
              required
              autoFocus
              placeholder="e.g. Pictoblox Level 1"
              className={cls}
            />
          </div>

          {/* Course Code */}
          <div>
            <label htmlFor="mc-code" className="mb-1.5 block text-sm font-medium text-[#0B1F3A]">
              Code <span className="text-[#94A3B8] font-normal text-xs">(optional)</span>
            </label>
            <input
              id="mc-code"
              name="code"
              placeholder="e.g. PB1, RBC-ADV"
              className={cls}
            />
          </div>

          {/* Description */}
          <div>
            <label htmlFor="mc-description" className="mb-1.5 block text-sm font-medium text-[#0B1F3A]">
              Description
            </label>
            <textarea
              id="mc-description"
              name="description"
              rows={3}
              placeholder="Brief overview of what students will learn…"
              className={cls}
            />
          </div>

          {/* Main Content Link */}
          <div>
            <label htmlFor="mc-resources-url" className="mb-1.5 block text-sm font-medium text-[#0B1F3A]">
              Main Content Link
            </label>
            <input
              id="mc-resources-url"
              name="resources_url"
              type="url"
              placeholder="https://drive.google.com/…"
              className={cls}
            />
            <p className="mt-1 text-xs text-[#94A3B8]">Google Drive folder, course site, or any primary resource URL.</p>
          </div>

          {/* Thumbnail URL */}
          <div>
            <label htmlFor="mc-thumbnail-url" className="mb-1.5 block text-sm font-medium text-[#0B1F3A]">
              Thumbnail URL
            </label>
            <input
              id="mc-thumbnail-url"
              name="thumbnail_url"
              type="url"
              placeholder="https://…/cover.jpg"
              className={cls}
            />
          </div>

          {/* Status */}
          <div className="flex items-center gap-2.5 pt-1">
            <input
              id="mc-is-published"
              name="is_published"
              type="checkbox"
              value="on"
              className="h-4 w-4 rounded border-[#CBD5E1] accent-[#FF8A1F]"
            />
            <label htmlFor="mc-is-published" className="text-sm font-medium text-[#0B1F3A]">
              Publish immediately
            </label>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 border-t border-[#F1F5F9] pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={pending}
              className="rounded-lg border border-[#E2E8F0] px-4 py-2.5 text-sm font-medium text-[#64748B] transition hover:border-[#CBD5E1] disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={pending}
              className="inline-flex items-center gap-2 rounded-lg bg-[#FF8A1F] px-5 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-[#e87c18] disabled:opacity-60"
            >
              {pending ? (
                <>
                  <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                  </svg>
                  Creating…
                </>
              ) : 'Create Course'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
