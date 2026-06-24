'use client'

import { useRef, useState, useTransition } from 'react'
import { submitParentMessage }              from '@/modules/parent-messages/actions'
import type { MessageCategory }            from '@/modules/parent-messages/constants'
import { CATEGORY_LABELS }                 from '@/modules/parent-messages/constants'

interface Props {
  studentId:   string
  studentName: string
}

const CATEGORIES = Object.entries(CATEGORY_LABELS) as [MessageCategory, string][]

export default function ContactForm({ studentId, studentName }: Props) {
  const [pending, startTransition] = useTransition()
  const [category, setCategory]    = useState<MessageCategory>('general_comment')
  const [message,  setMessage]     = useState('')
  const [fileName, setFileName]    = useState<string | null>(null)
  const [done,     setDone]        = useState(false)
  const [error,    setError]       = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const canSubmit = message.trim().length >= 10 && !pending

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null
    setFileName(f ? f.name : null)
  }

  function handleSubmit() {
    if (!canSubmit) return
    setError(null)

    const fd = new FormData()
    fd.append('category',   category)
    fd.append('message',    message.trim())
    fd.append('student_id', studentId)
    const file = fileRef.current?.files?.[0]
    if (file) fd.append('image', file)

    startTransition(async () => {
      const result = await submitParentMessage(fd)
      if (result.success) {
        setDone(true)
        setMessage('')
        setFileName(null)
        if (fileRef.current) fileRef.current.value = ''
      } else {
        setError(result.error ?? 'Submission failed.')
      }
    })
  }

  if (done) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-[#A7F3D0] bg-[#E7F8EE] px-6 py-10 text-center">
        <span className="text-3xl">✓</span>
        <p className="font-semibold text-[#15803D]">Message sent successfully!</p>
        <p className="text-[13px] text-[#10B981]">The team leader will review your message and get back to you.</p>
        <button
          onClick={() => setDone(false)}
          className="mt-1 text-[13px] text-[#FF8A1F] hover:underline"
        >
          Send another message
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-4">

      {/* Category */}
      <div>
        <label className="mb-1.5 block text-sm font-medium text-[#0B1F3A]">
          Category <span className="text-[#EF4444]">*</span>
        </label>
        <select
          value={category}
          onChange={e => setCategory(e.target.value as MessageCategory)}
          className="w-full ds-card px-3 py-2 text-sm text-[#0B1F3A] focus:border-[#FF8A1F] focus:outline-none focus:ring-1 focus:ring-[#FF8A1F]/30"
        >
          {CATEGORIES.map(([key, label]) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </select>
      </div>

      {/* Message */}
      <div>
        <label className="mb-1.5 block text-sm font-medium text-[#0B1F3A]">
          Message <span className="text-[#EF4444]">*</span>
        </label>
        <textarea
          value={message}
          onChange={e => setMessage(e.target.value)}
          rows={4}
          placeholder="Write your message here… (minimum 10 characters)"
          className="w-full resize-none rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2 text-sm text-[#0B1F3A] placeholder:text-[#CBD5E1] focus:border-[#FF8A1F] focus:outline-none focus:ring-1 focus:ring-[#FF8A1F]/30"
        />
        <p className={`mt-1 text-right text-[11px] ${message.length < 10 && message.length > 0 ? 'text-[#EF4444]' : 'text-[#94A3B8]'}`}>
          {message.trim().length} / min 10
        </p>
      </div>

      {/* Optional image */}
      <div>
        <label className="mb-1.5 block text-sm font-medium text-[#0B1F3A]">
          Image <span className="text-[12px] font-normal text-[#94A3B8]">(optional, max 5 MB)</span>
        </label>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="ds-card px-3 py-2 text-[13px] text-[#64748B] hover:bg-[#F8FAFC] transition"
          >
            Choose File
          </button>
          <span className="text-[13px] text-[#94A3B8]">
            {fileName ?? 'No file chosen'}
          </span>
          {fileName && (
            <button
              type="button"
              onClick={() => {
                setFileName(null)
                if (fileRef.current) fileRef.current.value = ''
              }}
              className="text-[12px] text-[#EF4444] hover:underline"
            >
              Remove
            </button>
          )}
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/jpg,image/png,image/webp"
          className="hidden"
          onChange={handleFileChange}
        />
      </div>

      {error && (
        <p className="rounded-lg border border-[#FECACA] bg-[#FEE2E2] px-4 py-2.5 text-sm text-[#EF4444]">{error}</p>
      )}

      <button
        onClick={handleSubmit}
        disabled={!canSubmit}
        className="w-full rounded-xl bg-[#FF8A1F] py-3 text-sm font-semibold text-white transition hover:bg-[#e87c18] disabled:cursor-not-allowed disabled:opacity-40"
      >
        {pending ? 'Sending…' : 'Send Message'}
      </button>

      <p className="text-center text-[11px] text-[#94A3B8]">
        Regarding {studentName} · Team leader will respond as soon as possible.
      </p>
    </div>
  )
}
