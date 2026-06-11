'use client'

import { useActionState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createCourse } from '@/modules/courses/actions'
import SubmitButton from '@/components/admin/SubmitButton'
import Link from 'next/link'
import type { ActionResult } from '@/types/app'

export default function NewCourseForm() {
  const router = useRouter()

  const [state, action] = useActionState<ActionResult<{ id: string }> | null, FormData>(
    createCourse,
    null
  )

  // Navigate to the new course detail on success
  useEffect(() => {
    if (state?.success && state.data?.id) {
      router.push(`/admin/courses/${state.data.id}`)
    }
  }, [state, router])

  return (
    <div className="rounded-xl border border-[#E2E8F0] bg-white p-6">
      {state && !state.success && (
        <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {state.error.message}
        </div>
      )}

      <form action={action} className="space-y-4">
        <input type="hidden" name="scope" value="global" />

        <div>
          <label className="mb-1 block text-sm font-medium text-[#0B1F3A]">
            Title <span className="text-red-500">*</span>
          </label>
          <input
            name="title"
            required
            className="w-full rounded-lg border border-[#E2E8F0] px-3 py-2.5 text-sm text-[#0B1F3A] outline-none transition focus:border-[#FF8A1F] focus:ring-2 focus:ring-[#FF8A1F]/15"
            placeholder="e.g. Pictoblox 1"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-[#0B1F3A]">Description</label>
          <textarea
            name="description"
            rows={3}
            className="w-full rounded-lg border border-[#E2E8F0] px-3 py-2.5 text-sm text-[#0B1F3A] outline-none transition focus:border-[#FF8A1F] focus:ring-2 focus:ring-[#FF8A1F]/15"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-[#0B1F3A]">Main Content Link</label>
          <input
            name="resources_url"
            type="url"
            placeholder="https://drive.google.com/… or Notion URL"
            className="w-full rounded-lg border border-[#E2E8F0] px-3 py-2.5 text-sm text-[#0B1F3A] outline-none transition focus:border-[#FF8A1F] focus:ring-2 focus:ring-[#FF8A1F]/15"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-[#0B1F3A]">Category</label>
          <input
            name="category"
            className="w-full rounded-lg border border-[#E2E8F0] px-3 py-2.5 text-sm text-[#0B1F3A] outline-none transition focus:border-[#FF8A1F] focus:ring-2 focus:ring-[#FF8A1F]/15"
            placeholder="e.g. Programming, Robotics, AI"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-[#0B1F3A]">Level</label>
            <select
              name="level"
              className="w-full rounded-lg border border-[#E2E8F0] px-3 py-2.5 text-sm text-[#0B1F3A] outline-none transition focus:border-[#FF8A1F] focus:ring-2 focus:ring-[#FF8A1F]/15"
            >
              <option value="">— select —</option>
              <option value="beginner">Beginner</option>
              <option value="intermediate">Intermediate</option>
              <option value="advanced">Advanced</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-[#0B1F3A]">Est. hours</label>
            <input
              name="estimated_hours"
              type="number"
              min={0}
              className="w-full rounded-lg border border-[#E2E8F0] px-3 py-2.5 text-sm text-[#0B1F3A] outline-none transition focus:border-[#FF8A1F] focus:ring-2 focus:ring-[#FF8A1F]/15"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <input
            id="is_published"
            name="is_published"
            type="checkbox"
            value="on"
            className="h-4 w-4 rounded border-[#E2E8F0] accent-[#FF8A1F]"
          />
          <label htmlFor="is_published" className="text-sm font-medium text-[#0B1F3A]">
            Publish immediately
          </label>
        </div>

        <div className="flex items-center justify-end gap-3 pt-2">
          <Link
            href="/admin/courses"
            className="rounded-lg border border-[#E2E8F0] px-4 py-2.5 text-sm font-medium text-[#64748B] transition hover:border-[#CBD5E1]"
          >
            Cancel
          </Link>
          <SubmitButton label="Create Course" pendingLabel="Creating…" />
        </div>
      </form>
    </div>
  )
}
