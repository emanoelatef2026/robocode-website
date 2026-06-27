'use client'

import { useState, useTransition } from 'react'
import { saveNoteAction, deleteNoteAction } from '@/modules/instructors/modal-actions'
import type { InstructorNote } from '@/modules/instructors/types'
import { Empty } from '../Empty'
import { SectionLabel } from '../SectionLabel'
import { NOTE_CATEGORIES } from '../../types'
import { fmtDate } from '../../utils'

function catCls(cat: string): string {
  if (cat === 'strengths')            return 'bg-[#E7F8EE] text-[#15803D]'
  if (cat === 'weaknesses')           return 'bg-[#FEE2E2] text-[#DC2626]'
  if (cat === 'communication')        return 'bg-[#EFF6FF] text-[#1D4ED8]'
  if (cat === 'reliability')          return 'bg-purple-100 text-purple-700'
  if (cat === 'classroom_management') return 'bg-[#FFFBEB] text-[#B45309]'
  return 'bg-[#F1F5F9] text-[#475569]'
}

export function NotesTab({ instructorId, notes, onRefresh }: {
  instructorId: string
  notes:        InstructorNote[]
  onRefresh:    () => void
}) {
  const [content, setContent]        = useState('')
  const [category, setCategory]      = useState('general')
  const [isPending, startTransition] = useTransition()
  const [error, setError]            = useState<string | null>(null)

  function handleAdd() {
    if (!content.trim()) return
    setError(null)
    const fd = new FormData()
    fd.append('instructor_id', instructorId)
    fd.append('content', content.trim())
    fd.append('category', category)
    startTransition(async () => {
      const res = await saveNoteAction(fd)
      if (res.success) { setContent(''); onRefresh() }
      else setError(res.error?.message ?? 'Failed to save.')
    })
  }

  function handleDelete(noteId: string) {
    if (!confirm('Delete this note?')) return
    startTransition(async () => {
      await deleteNoteAction(noteId)
      onRefresh()
    })
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-4 space-y-3">
        <SectionLabel>Add Note</SectionLabel>
        <div className="flex flex-wrap gap-1.5">
          {NOTE_CATEGORIES.map(c => (
            <button
              key={c.key}
              type="button"
              onClick={() => setCategory(c.key)}
              className={`rounded-full px-2.5 py-1 text-[11px] font-medium capitalize transition border ${
                category === c.key
                  ? 'bg-[#FF8A1F] border-[#FF8A1F] text-white'
                  : 'bg-white border-[#E2E8F0] text-[#64748B] hover:border-[#FF8A1F]'
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
        <textarea
          value={content}
          onChange={e => setContent(e.target.value)}
          rows={3}
          placeholder="Write a note…"
          className="w-full ds-card px-3 py-2 text-[12px] outline-none focus:border-[#FF8A1F] resize-none"
        />
        {error && <p className="text-[11px] text-[#EF4444]">{error}</p>}
        <button
          onClick={handleAdd}
          disabled={isPending || !content.trim()}
          className="rounded-lg bg-[#FF8A1F] px-4 py-2 text-[12px] font-semibold text-white hover:bg-[#e87c18] disabled:opacity-50 transition"
        >
          {isPending ? 'Saving…' : 'Add Note'}
        </button>
      </div>

      {notes.length === 0 ? (
        <Empty text="No notes yet" sub="Add the first note above" />
      ) : (
        <div className="space-y-2.5">
          {notes.map(n => (
            <div key={n.id} className="ds-card p-4">
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex items-center gap-2">
                  <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold uppercase ${catCls(n.category)}`}>
                    {NOTE_CATEGORIES.find(c => c.key === n.category)?.label ?? n.category}
                  </span>
                  <span className="text-[10px] text-[#94A3B8]">{n.author_name ?? 'Admin'} · {fmtDate(n.created_at)}</span>
                </div>
                <button
                  onClick={() => handleDelete(n.id)}
                  className="text-[11px] text-[#F87171] hover:text-[#EF4444] shrink-0"
                >
                  Delete
                </button>
              </div>
              <p className="text-[13px] text-[#374151] leading-relaxed whitespace-pre-wrap">{n.content}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
