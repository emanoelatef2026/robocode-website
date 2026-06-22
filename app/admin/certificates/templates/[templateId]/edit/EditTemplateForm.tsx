'use client'

import { useTransition, useState } from 'react'
import { useRouter } from 'next/navigation'
import { updateTemplate } from '@/modules/certificates/actions'
import CertificateImageUpload from '@/components/admin/CertificateImageUpload'
import Link from 'next/link'
import type { CertificateTemplate } from '@/modules/certificates/types'

interface Props {
  template: CertificateTemplate
}

const inputClass = 'w-full rounded-lg border border-[#E2E8F0] px-3 py-2.5 text-sm text-[#0B1F3A] outline-none transition focus:border-[#FF8A1F] focus:ring-2 focus:ring-[#FF8A1F]/15'

const CERT_TYPES = [
  { value: 'semester_completion', label: 'Semester Completion' },
  { value: 'course_completion',   label: 'Course Completion' },
  { value: 'competition_award',   label: 'Competition Award' },
  { value: 'achievement',         label: 'Achievement' },
  { value: 'custom',              label: 'Custom' },
]

export default function EditTemplateForm({ template }: Props) {
  const router             = useRouter()
  const [isPending, start] = useTransition()
  const [error, setError]  = useState<string | null>(null)

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const input = {
      name:             fd.get('name') as string,
      certificate_type: fd.get('certificate_type') as string,
      description:      fd.get('description') as string || undefined,
      background_color: fd.get('background_color') as string,
      accent_color:     fd.get('accent_color') as string,
      logo_url:         fd.get('logo_url') as string || undefined,
      stem_logo_url:    fd.get('stem_logo_url') as string || undefined,
      signature_url:    fd.get('signature_url') as string || undefined,
      signatory_name:   fd.get('signatory_name') as string || undefined,
      signatory_title:  fd.get('signatory_title') as string || undefined,
      is_active:        fd.get('is_active') === 'true',
    }
    start(async () => {
      const result = await updateTemplate(template.id, input)
      if (result.success) {
        router.push('/admin/certificates/templates')
      } else {
        setError(result.error.message)
      }
    })
  }

  return (
    <div className="rounded-xl border border-[#E2E8F0] bg-white p-6">
      {error && (
        <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-[#0B1F3A]">
              Template Name <span className="text-red-500">*</span>
            </label>
            <input name="name" required defaultValue={template.name} className={inputClass} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-[#0B1F3A]">Type</label>
            <select name="certificate_type" defaultValue={template.certificate_type} className={inputClass}>
              {CERT_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-[#0B1F3A]">Description</label>
          <textarea name="description" rows={2} defaultValue={template.description ?? ''} className={inputClass} />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-[#0B1F3A]">Background Color</label>
            <input name="background_color" type="color" defaultValue={template.background_color} className="h-10 w-full rounded-lg border border-[#E2E8F0] px-2 py-1" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-[#0B1F3A]">Accent Color</label>
            <input name="accent_color" type="color" defaultValue={template.accent_color} className="h-10 w-full rounded-lg border border-[#E2E8F0] px-2 py-1" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-[#0B1F3A]">Signatory Name</label>
            <input name="signatory_name" defaultValue={template.signatory_name ?? ''} className={inputClass} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-[#0B1F3A]">Signatory Title</label>
            <input name="signatory_title" defaultValue={template.signatory_title ?? ''} className={inputClass} />
          </div>
        </div>

        {/* ── Image uploads ── */}
        <div className="space-y-4 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#64748B]">Certificate Images</p>

          <CertificateImageUpload
            label="Robocode Logo"
            name="logo_url"
            defaultValue={template.logo_url}
            hint="Transparent PNG required — JPEG will produce a black background. Min width 500 px."
          />

          <CertificateImageUpload
            label="STEM Accreditation Logo"
            name="stem_logo_url"
            defaultValue={template.stem_logo_url}
            hint="Optional — shown in footer centre. Transparent PNG recommended."
          />

          <CertificateImageUpload
            label="Signature Image"
            name="signature_url"
            defaultValue={template.signature_url}
            hint="Transparent PNG required — shown above the signatory line. JPEG will produce a black background."
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-[#0B1F3A]">Status</label>
          <select name="is_active" defaultValue={template.is_active ? 'true' : 'false'} className={inputClass}>
            <option value="true">Active</option>
            <option value="false">Inactive</option>
          </select>
        </div>

        <div className="flex items-center justify-between border-t border-[#E2E8F0] pt-4">
          <Link href="/admin/certificates/templates" className="text-sm text-[#64748B] hover:text-[#0B1F3A]">
            Cancel
          </Link>
          <button
            type="submit"
            disabled={isPending}
            className="inline-flex items-center gap-2 rounded-lg bg-[#FF8A1F] px-5 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-[#e87c18] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isPending && (
              <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            )}
            {isPending ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </form>
    </div>
  )
}
