'use client'

import { useState, useTransition, useEffect, useRef } from 'react'
import { createTemplate, updateTemplate, getTemplateForEdit } from '@/modules/certificates/actions'
import CertificateImageUpload from './CertificateImageUpload'
import type { CertificateTemplate } from '@/modules/certificates/types'

interface Props {
  mode:        'new' | 'edit'
  templateId?: string
  onClose:     () => void
  onSuccess:   () => void
}

const inputClass =
  'w-full rounded-lg border border-[#E2E8F0] px-3 py-2.5 text-sm text-[#0B1F3A] outline-none transition focus:border-[#FF8A1F] focus:ring-2 focus:ring-[#FF8A1F]/15'

const CERT_TYPES = [
  { value: 'semester_completion', label: 'Semester Completion' },
  { value: 'course_completion',   label: 'Course Completion' },
  { value: 'competition_award',   label: 'Competition Award' },
  { value: 'achievement',         label: 'Achievement' },
  { value: 'custom',              label: 'Custom' },
]

export default function TemplateFormModal({ mode, templateId, onClose, onSuccess }: Props) {
  const [isPending, start]          = useTransition()
  const [error, setError]           = useState<string | null>(null)
  const [template, setTemplate]     = useState<CertificateTemplate | null>(null)
  const [loadError, setLoadError]   = useState<string | null>(null)
  const [loading, setLoading]       = useState(mode === 'edit')
  const formRef                     = useRef<HTMLFormElement>(null)

  // Load full template data for edit mode
  useEffect(() => {
    if (mode === 'edit' && templateId) {
      getTemplateForEdit(templateId).then(result => {
        if (result.success) setTemplate(result.data)
        else setLoadError(result.error.message)
        setLoading(false)
      })
    }
  }, [mode, templateId])

  // Lock body scroll
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const fd = new FormData(e.currentTarget)

    start(async () => {
      if (mode === 'new') {
        const result = await createTemplate(null, fd)
        if (result.success) onSuccess()
        else setError(result.error.message)
      } else {
        const input = {
          name:             fd.get('name') as string,
          certificate_type: fd.get('certificate_type') as string,
          description:      (fd.get('description') as string) || undefined,
          background_color: fd.get('background_color') as string,
          accent_color:     fd.get('accent_color') as string,
          logo_url:         (fd.get('logo_url') as string) || undefined,
          stem_logo_url:    (fd.get('stem_logo_url') as string) || undefined,
          stamp_url:        (fd.get('stamp_url') as string) || undefined,
          signature_url:    (fd.get('signature_url') as string) || undefined,
          signatory_name:   (fd.get('signatory_name') as string) || undefined,
          signatory_title:  (fd.get('signatory_title') as string) || undefined,
          is_active:        fd.get('is_active') === 'true',
        }
        const result = await updateTemplate(templateId!, input)
        if (result.success) onSuccess()
        else setError(result.error.message)
      }
    })
  }

  const title = mode === 'new' ? 'New Template' : 'Edit Template'

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 px-4 py-8"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="relative w-full max-w-2xl rounded-2xl bg-white shadow-2xl my-auto">

        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#E2E8F0] px-6 py-4">
          <h2 className="text-base font-bold text-[#0B1F3A]">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-[#94A3B8] hover:bg-[#F1F5F9] hover:text-[#0B1F3A]"
            aria-label="Close"
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="p-6">
          {loading && (
            <div className="flex items-center justify-center py-12 text-sm text-[#94A3B8]">
              Loading…
            </div>
          )}

          {loadError && (
            <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{loadError}</div>
          )}

          {!loading && !loadError && (
            <>
              {error && (
                <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
              )}

              <form ref={formRef} onSubmit={handleSubmit} className="space-y-5">

                {/* Name + Type */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-[#0B1F3A]">
                      Template Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      name="name"
                      required
                      defaultValue={template?.name ?? ''}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-[#0B1F3A]">
                      Type <span className="text-red-500">*</span>
                    </label>
                    <select
                      name="certificate_type"
                      required
                      defaultValue={template?.certificate_type ?? 'semester_completion'}
                      className={inputClass}
                    >
                      {CERT_TYPES.map((t) => (
                        <option key={t.value} value={t.value}>{t.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Description */}
                <div>
                  <label className="mb-1 block text-sm font-medium text-[#0B1F3A]">Description</label>
                  <textarea
                    name="description"
                    rows={2}
                    defaultValue={template?.description ?? ''}
                    className={inputClass}
                  />
                </div>

                {/* Colors */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-[#0B1F3A]">Background Color</label>
                    <input
                      name="background_color"
                      type="color"
                      defaultValue={template?.background_color ?? '#FFFFFF'}
                      className="h-10 w-full rounded-lg border border-[#E2E8F0] px-2 py-1"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-[#0B1F3A]">Accent Color</label>
                    <input
                      name="accent_color"
                      type="color"
                      defaultValue={template?.accent_color ?? '#FF8A1F'}
                      className="h-10 w-full rounded-lg border border-[#E2E8F0] px-2 py-1"
                    />
                  </div>
                </div>

                {/* Signatory */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-[#0B1F3A]">Signatory Name</label>
                    <input
                      name="signatory_name"
                      defaultValue={template?.signatory_name ?? ''}
                      placeholder="e.g. Emanoel Atef"
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-[#0B1F3A]">Signatory Title</label>
                    <input
                      name="signatory_title"
                      defaultValue={template?.signatory_title ?? ''}
                      placeholder="e.g. CEO, Robocode School"
                      className={inputClass}
                    />
                  </div>
                </div>

                {/* Images */}
                <div className="space-y-4 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-[#64748B]">Certificate Images</p>

                  <CertificateImageUpload
                    label="Robocode Logo"
                    name="logo_url"
                    defaultValue={template?.logo_url}
                    hint="Transparent PNG required — JPEG will produce a black background. Min width 500 px."
                  />

                  <CertificateImageUpload
                    label="STEM Accreditation Logo"
                    name="stem_logo_url"
                    defaultValue={template?.stem_logo_url}
                    hint="Optional — small icon shown in footer centre. Transparent PNG recommended."
                  />

                  <CertificateImageUpload
                    label="Academy Stamp"
                    name="stamp_url"
                    defaultValue={template?.stamp_url}
                    hint="ختم الأكاديمية — هيظهر كبير على جسم الشهادة. الخلفية بتترشح تلقائياً."
                    removeBackground
                  />

                  <CertificateImageUpload
                    label="Signature Image"
                    name="signature_url"
                    defaultValue={template?.signature_url}
                    hint="Transparent PNG required — shown above the signatory line."
                  />
                </div>

                {/* Status (edit only) */}
                {mode === 'edit' && (
                  <div>
                    <label className="mb-1 block text-sm font-medium text-[#0B1F3A]">Status</label>
                    <select
                      name="is_active"
                      defaultValue={template?.is_active ? 'true' : 'false'}
                      className={inputClass}
                    >
                      <option value="true">Active</option>
                      <option value="false">Inactive</option>
                    </select>
                  </div>
                )}

                {/* Footer */}
                <div className="flex items-center justify-end gap-3 border-t border-[#E2E8F0] pt-4">
                  <button
                    type="button"
                    onClick={onClose}
                    className="rounded-lg border border-[#E2E8F0] px-4 py-2 text-sm font-medium text-[#64748B] hover:bg-[#F8FAFC]"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isPending}
                    className="inline-flex items-center gap-2 rounded-lg bg-[#FF8A1F] px-5 py-2 text-sm font-medium text-white shadow-sm hover:bg-[#e87c18] disabled:opacity-60"
                  >
                    {isPending ? (
                      <>
                        <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        Saving…
                      </>
                    ) : mode === 'new' ? 'Create Template' : 'Save Changes'}
                  </button>
                </div>

              </form>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
