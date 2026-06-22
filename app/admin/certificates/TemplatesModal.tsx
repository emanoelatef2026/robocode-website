'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import StatusBadge from '@/components/admin/StatusBadge'
import TemplateFormModal from '@/components/admin/TemplateFormModal'
import type { CertificateTemplateListItem } from '@/modules/certificates/types'

interface Props {
  templates: CertificateTemplateListItem[]
}

const TYPE_LABELS: Record<string, string> = {
  semester_completion: 'Course Completion',
  course_completion:   'Course Completion',
  competition_award:   'Competition Award',
  achievement:         'Achievement',
  custom:              'Custom',
}

export default function TemplatesModal({ templates }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [formModal, setFormModal] = useState<
    | { mode: 'new' }
    | { mode: 'edit'; templateId: string }
    | null
  >(null)
  const [search, setSearch] = useState('')

  // Lock body scroll when open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
      return () => { document.body.style.overflow = '' }
    }
  }, [open])

  // Close on Escape
  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape' && !formModal) setOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, formModal])

  function handleSuccess() {
    setFormModal(null)
    router.refresh()
  }

  const filtered = search.trim()
    ? templates.filter(t => t.name.toLowerCase().includes(search.toLowerCase()))
    : templates

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-lg border border-[#E2E8F0] bg-white px-4 py-2 text-sm font-medium text-[#0B1F3A] shadow-sm transition hover:bg-[#F8FAFC]"
      >
        Templates
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 px-4 py-8"
          onClick={(e) => { if (e.target === e.currentTarget) setOpen(false) }}
        >
          <div className="relative w-full max-w-3xl rounded-2xl bg-white shadow-2xl my-auto">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-[#E2E8F0] px-6 py-4">
              <div>
                <h2 className="text-base font-bold text-[#0B1F3A]">Certificate Templates</h2>
                <p className="text-xs text-[#94A3B8] mt-0.5">{templates.length} template{templates.length !== 1 ? 's' : ''}</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setFormModal({ mode: 'new' })}
                  className="inline-flex items-center gap-2 rounded-lg bg-[#FF8A1F] px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-[#e87c18]"
                >
                  <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                    <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" />
                  </svg>
                  New Template
                </button>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-[#94A3B8] hover:bg-[#F1F5F9] hover:text-[#0B1F3A]"
                  aria-label="Close"
                >
                  <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Search */}
            <div className="border-b border-[#E2E8F0] px-4 py-3">
              <div className="relative">
                <svg viewBox="0 0 20 20" fill="currentColor" className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#94A3B8]">
                  <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
                </svg>
                <input
                  type="text"
                  placeholder="Search templates…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full rounded-lg border border-[#E2E8F0] py-2 pl-9 pr-3 text-sm text-[#0B1F3A] outline-none focus:border-[#FF8A1F] focus:ring-2 focus:ring-[#FF8A1F]/15"
                />
              </div>
            </div>

            {/* Body */}
            <div className="p-0">
              {filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <p className="text-sm font-medium text-[#0B1F3A]">
                    {search ? 'No templates match your search.' : 'No templates yet.'}
                  </p>
                  {!search && (
                    <p className="text-xs text-[#94A3B8] mt-1">Create your first certificate template.</p>
                  )}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                        <th className="px-4 py-3 text-left text-xs font-medium text-[#64748B]">Name</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-[#64748B]">Type</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-[#64748B]">Branch</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-[#64748B]">Status</th>
                        <th className="px-4 py-3" />
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((t) => (
                        <tr key={t.id} className="border-b border-[#E2E8F0] last:border-0 hover:bg-[#F8FAFC]">
                          <td className="px-4 py-3 font-medium text-[#0B1F3A]">{t.name}</td>
                          <td className="px-4 py-3 text-[#64748B]">{TYPE_LABELS[t.certificate_type] ?? t.certificate_type}</td>
                          <td className="px-4 py-3 text-[#64748B]">{t.branch_name ?? 'Global'}</td>
                          <td className="px-4 py-3">
                            <StatusBadge status={t.is_active ? 'active' : 'inactive'} />
                          </td>
                          <td className="px-4 py-3 text-right">
                            <button
                              type="button"
                              onClick={() => setFormModal({ mode: 'edit', templateId: t.id })}
                              className="text-xs font-medium text-[#FF8A1F] hover:underline"
                            >
                              Edit
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {formModal && (
        <TemplateFormModal
          mode={formModal.mode}
          templateId={formModal.mode === 'edit' ? formModal.templateId : undefined}
          onClose={() => setFormModal(null)}
          onSuccess={handleSuccess}
        />
      )}
    </>
  )
}
