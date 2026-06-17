'use client'

import { useActionState } from 'react'
import { useRouter } from 'next/navigation'
import { createTemplate } from '@/modules/certificates/actions'
import SubmitButton from '@/components/admin/SubmitButton'
import Link from 'next/link'
import type { ActionResult } from '@/types/app'

const inputClass = 'w-full rounded-lg border border-[#E2E8F0] px-3 py-2.5 text-sm text-[#0B1F3A] outline-none transition focus:border-[#FF8A1F] focus:ring-2 focus:ring-[#FF8A1F]/15'

const CERT_TYPES = [
  { value: 'semester_completion', label: 'Course Completion' },
  { value: 'course_completion',   label: 'Course Completion' },
  { value: 'competition_award',   label: 'Competition Award' },
  { value: 'achievement',         label: 'Achievement' },
  { value: 'custom',              label: 'Custom' },
]

export default function NewTemplateForm() {
  const router = useRouter()
  const [state, action] = useActionState<ActionResult<{ id: string }> | null, FormData>(
    async (prev, formData) => {
      const result = await createTemplate(prev, formData)
      if (result.success) router.push('/admin/certificates/templates')
      return result
    },
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
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-[#0B1F3A]">
              Template Name <span className="text-red-500">*</span>
            </label>
            <input name="name" required className={inputClass} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-[#0B1F3A]">
              Type <span className="text-red-500">*</span>
            </label>
            <select name="certificate_type" required className={inputClass}>
              {CERT_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-[#0B1F3A]">Description</label>
          <textarea name="description" rows={2} className={inputClass} />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-[#0B1F3A]">Background Color</label>
            <input name="background_color" type="color" defaultValue="#FFFFFF" className="h-10 w-full rounded-lg border border-[#E2E8F0] px-2 py-1" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-[#0B1F3A]">Accent Color</label>
            <input name="accent_color" type="color" defaultValue="#FF8A1F" className="h-10 w-full rounded-lg border border-[#E2E8F0] px-2 py-1" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-[#0B1F3A]">Signatory Name</label>
            <input name="signatory_name" placeholder="e.g. John Doe" className={inputClass} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-[#0B1F3A]">Signatory Title</label>
            <input name="signatory_title" placeholder="e.g. Program Director" className={inputClass} />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-[#0B1F3A]">Robocode Logo URL</label>
          <input name="logo_url" type="url" placeholder="https://…" className={inputClass} />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-[#0B1F3A]">STEM Logo URL</label>
          <input name="stem_logo_url" type="url" placeholder="https://… (optional second logo)" className={inputClass} />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-[#0B1F3A]">Signature Image URL</label>
          <input name="signature_url" type="url" placeholder="https://… (displayed above signatory line)" className={inputClass} />
        </div>

        <div className="flex items-center justify-between border-t border-[#E2E8F0] pt-4">
          <Link href="/admin/certificates/templates" className="text-sm text-[#64748B] hover:text-[#0B1F3A]">
            Cancel
          </Link>
          <SubmitButton label="Create Template" pendingLabel="Creating…" />
        </div>
      </form>
    </div>
  )
}
