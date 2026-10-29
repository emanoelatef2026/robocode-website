'use client'

import { useEffect, useId, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import SessionIcon from '@/app/portal/instructor/groups/[id]/sessions/[sid]/SessionIcon'

/** Native modal supplies focus containment and makes the underlying workspace inert. */
export default function WorkflowConfirm({ title, children, confirmLabel, onConfirm, onCancel, busy = false, danger = false }: { title: string; children: ReactNode; confirmLabel: string; onConfirm: () => void; onCancel: () => void; busy?: boolean; danger?: boolean }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const cancel = useRef<HTMLButtonElement>(null)
  const titleId = useId()
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    const modal = dialog.current
    modal?.showModal()
    cancel.current?.focus()
    return () => { modal?.close(); previous?.focus() }
  }, [])
  return createPortal(<dialog ref={dialog} aria-labelledby={titleId} onCancel={event => { event.preventDefault(); if (!busy) onCancel() }} className="m-auto max-h-[85dvh] w-[calc(100%_-_2rem)] max-w-lg overflow-y-auto rounded-2xl border border-(--border) bg-(--bg-card) p-5 text-(--text) shadow-2xl backdrop:bg-black/45">
    <h2 id={titleId} className="flex items-center gap-2 text-lg font-bold text-(--navy)"><SessionIcon name={danger ? 'warning' : 'attendance'} />{title}</h2>
    <div className="my-4 space-y-3 text-sm leading-relaxed text-(--text-2)">{children}</div>
    <div className="flex flex-wrap justify-end gap-2">
      <button ref={cancel} type="button" disabled={busy} onClick={onCancel} className="ds-btn-outline min-h-11">Keep editing</button>
      <button type="button" disabled={busy} onClick={onConfirm} className={`min-h-11 rounded-xl px-4 py-2 font-semibold text-white disabled:opacity-60 ${danger ? 'bg-(--red-dark)' : 'bg-(--navy)'}`}>{busy ? 'Saving…' : confirmLabel}</button>
    </div>
  </dialog>, document.body)
}
