'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import StatusBadge from '@/components/admin/StatusBadge'
import TemplateFormModal from '@/components/admin/TemplateFormModal'
import type { CertificateTemplateListItem } from '@/modules/certificates/types'
import { useTopbarAction } from '@/components/shared/layout/TopbarActionContext'

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

export default function TemplatesClient({ templates }: Props) {
  const router = useRouter()
  const [modal, setModal] = useState<
    | { mode: 'new' }
    | { mode: 'edit'; templateId: string }
    | null
  >(null)

  function handleSuccess() {
    setModal(null)
    router.refresh()
  }

  const { setAction } = useTopbarAction()
  const openNew = useCallback(() => setModal({ mode: 'new' }), [])
  useEffect(() => {
    setAction(
      <button
        type="button"
        onClick={openNew}
        className="inline-flex h-9 shrink-0 items-center gap-2 rounded-lg bg-[#FF8A1F] px-4 text-[13px] font-semibold text-white transition hover:bg-[#e87c18] active:scale-95"
      >
        <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
          <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" />
        </svg>
        New Template
      </button>
    )
    return () => setAction(null)
  }, [openNew, setAction])

  return (
    <>

      {/* Table */}
      <div className="ds-card mt-4">
        {templates.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <p className="text-sm font-medium text-[#0B1F3A]">No templates yet</p>
            <p className="text-xs text-[#94A3B8] mt-1">Create your first certificate template.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="ds-table-head">
                <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                  <th className="px-4 py-3 text-left text-xs font-medium text-[#64748B]">Name</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-[#64748B]">Type</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-[#64748B]">Branch</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-[#64748B]">Status</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {templates.map((t) => (
                  <tr key={t.id} className="ds-table-row">
                    <td className="px-4 py-3 font-medium text-[#0B1F3A]">{t.name}</td>
                    <td className="px-4 py-3 text-[#64748B]">{TYPE_LABELS[t.certificate_type] ?? t.certificate_type}</td>
                    <td className="px-4 py-3 text-[#64748B]">{t.branch_name ?? 'Global'}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={t.is_active ? 'active' : 'inactive'} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => setModal({ mode: 'edit', templateId: t.id })}
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

      {/* Modal */}
      {modal && (
        <TemplateFormModal
          mode={modal.mode}
          templateId={modal.mode === 'edit' ? modal.templateId : undefined}
          onClose={() => setModal(null)}
          onSuccess={handleSuccess}
        />
      )}
    </>
  )
}
