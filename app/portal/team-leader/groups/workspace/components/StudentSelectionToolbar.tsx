'use client'

import { useState } from 'react'
import type { GroupDetailStudent } from '@/modules/groups/modal-actions'
import { buildWhatsAppUrl, buildTelUrl } from '@/lib/phone'

export function StudentSelectionToolbar({
  students, selectedIds, isTL, onRemove, onAddPayment, onMoveGroup, onView, onClear,
}: {
  students:     GroupDetailStudent[]
  selectedIds:  Set<string>
  isTL:         boolean
  onRemove:     (ids: string[]) => void
  onAddPayment: (student: GroupDetailStudent) => void
  onMoveGroup:  () => void
  onView:       (student: GroupDetailStudent) => void
  onClear:      () => void
}) {
  const [removeConfirm, setRemoveConfirm] = useState(false)

  const selected  = students.filter(s => selectedIds.has(s.student_id))
  const single    = selected.length === 1 ? selected[0] : null
  const firstWa   = selected.find(s => s.parent_phone ?? s.phone)
  const waUrl     = firstWa ? buildWhatsAppUrl(firstWa.parent_phone, firstWa.phone) : null
  const callUrl   = single  ? buildTelUrl(single.parent_phone, single.phone) : null

  return (
    <div className="flex items-center gap-1 rounded-lg border border-[#FF8A1F]/40 bg-[#FFF7ED] px-2.5 py-1.5 flex-wrap">
      <span className="text-[11px] font-bold text-[#FF8A1F] mr-1">
        {selectedIds.size} selected
      </span>
      <div className="h-3.5 w-px bg-[#FF8A1F]/30 mr-0.5" />

      {waUrl && (
        <a
          href={waUrl}
          target="_blank"
          rel="noopener noreferrer"
          title={selected.length > 1 ? `WhatsApp first (${selected.length} selected)` : 'WhatsApp'}
          className="flex items-center gap-1 rounded px-2 py-1 text-[11px] font-medium text-[#15803D] hover:bg-[#E7F8EE] transition"
        >
          <svg viewBox="0 0 24 24" fill="currentColor" className="h-3.5 w-3.5 shrink-0">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347zm-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884zm8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
          </svg>
          WhatsApp
        </a>
      )}

      {callUrl && (
        <a
          href={callUrl}
          className="flex items-center gap-1 rounded px-2 py-1 text-[11px] font-medium text-[#64748B] hover:bg-white transition"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-3.5 w-3.5 shrink-0">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
          </svg>
          Call
        </a>
      )}

      {single && (
        <button
          onClick={() => onView(single)}
          className="flex items-center gap-1 rounded px-2 py-1 text-[11px] font-medium text-[#64748B] hover:bg-white transition"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-3.5 w-3.5 shrink-0">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
          </svg>
          View
        </button>
      )}

      {single && isTL && (
        <button
          onClick={() => onAddPayment(single)}
          className="flex items-center gap-1 rounded px-2 py-1 text-[11px] font-medium text-[#FF8A1F] hover:bg-white transition"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-3.5 w-3.5 shrink-0">
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2z" />
          </svg>
          Payment
        </button>
      )}

      {isTL && (
        <button
          onClick={onMoveGroup}
          className="flex items-center gap-1 rounded px-2 py-1 text-[11px] font-medium text-[#64748B] hover:bg-white transition"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-3.5 w-3.5 shrink-0">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
          </svg>
          Move Group
        </button>
      )}

      {isTL && (
        removeConfirm ? (
          <span className="flex items-center gap-1 ml-1">
            <button
              onClick={() => { setRemoveConfirm(false); onRemove(Array.from(selectedIds)) }}
              className="rounded px-2 py-1 text-[11px] font-semibold text-white bg-[#EF4444] hover:bg-[#DC2626] transition"
            >
              Confirm Remove ({selectedIds.size})
            </button>
            <button
              onClick={() => setRemoveConfirm(false)}
              className="rounded p-1 text-[#94A3B8] hover:text-[#374151] hover:bg-white transition"
            >
              <svg viewBox="0 0 20 20" fill="currentColor" className="h-3 w-3">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          </span>
        ) : (
          <button
            onClick={() => setRemoveConfirm(true)}
            className="flex items-center gap-1 rounded px-2 py-1 text-[11px] font-medium text-[#EF4444] hover:bg-[#FEE2E2] hover:text-[#DC2626] transition"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-3.5 w-3.5 shrink-0">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 7a4 4 0 11-8 0 4 4 0 018 0zM9 14a6 6 0 00-6 6h7m5-5l4 4m0 0l4-4m-4 4V7" />
            </svg>
            Remove
          </button>
        )
      )}

      <div className="h-3.5 w-px bg-[#FF8A1F]/30 ml-0.5" />

      <button
        onClick={() => { setRemoveConfirm(false); onClear() }}
        title="Clear selection"
        className="rounded p-1 text-[#94A3B8] hover:text-[#374151] hover:bg-white transition"
      >
        <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
          <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
        </svg>
      </button>
    </div>
  )
}
