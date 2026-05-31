'use client'

import { useState, useTransition } from 'react'
import { updateMessageStatus }     from '@/modules/parent-messages/actions'
import type { MessageStatus }      from '@/modules/parent-messages/constants'

interface Props {
  messageId:     string
  currentStatus: MessageStatus
  currentNote:   string | null
}

const STATUS_OPTIONS: { value: MessageStatus; label: string }[] = [
  { value: 'submitted',    label: 'Submitted'    },
  { value: 'under_review', label: 'Under Review' },
  { value: 'resolved',     label: 'Resolved'     },
]

export default function MessageActions({ messageId, currentStatus, currentNote }: Props) {
  const [pending, startTransition] = useTransition()
  const [status, setStatus]        = useState<MessageStatus>(currentStatus)
  const [note,   setNote]          = useState(currentNote ?? '')
  const [saved,  setSaved]         = useState(false)
  const [error,  setError]         = useState<string | null>(null)

  function handleSave() {
    setError(null)
    setSaved(false)
    startTransition(async () => {
      const result = await updateMessageStatus(messageId, status, note)
      if (result.success) setSaved(true)
      else setError(result.error ?? 'Failed to save.')
    })
  }

  return (
    <div className="mt-3 space-y-2 border-t border-[#F1F5F9] pt-3">
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={status}
          onChange={e => { setStatus(e.target.value as MessageStatus); setSaved(false) }}
          className="rounded-lg border border-[#E2E8F0] bg-white px-3 py-1.5 text-[13px] text-[#0B1F3A] focus:border-[#FF8A1F] focus:outline-none"
        >
          {STATUS_OPTIONS.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <button
          onClick={handleSave}
          disabled={pending}
          className="rounded-lg bg-[#0B1F3A] px-3 py-1.5 text-[12px] font-medium text-white hover:bg-[#1a3460] disabled:opacity-50 transition"
        >
          {pending ? 'Saving…' : 'Update Status'}
        </button>
        {saved  && <span className="text-[12px] text-green-600">✓ Saved</span>}
        {error  && <span className="text-[12px] text-red-500">{error}</span>}
      </div>
      <textarea
        value={note}
        onChange={e => { setNote(e.target.value); setSaved(false) }}
        rows={2}
        placeholder="Internal note (optional, not visible to parent)…"
        className="w-full resize-none rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2 text-[13px] text-[#0B1F3A] placeholder:text-[#CBD5E1] focus:border-[#FF8A1F] focus:outline-none"
      />
    </div>
  )
}
