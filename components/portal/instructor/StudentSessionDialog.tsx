'use client'

import { useEffect, useId, useRef } from 'react'
import { createPortal } from 'react-dom'

/** Portalled outside the roster form: neither HTML forms nor submit events nest. */
export default function StudentSessionDialog({ title, studentName, onClose, children, wide = false }: {
  title: string
  studentName: string
  onClose: () => void
  children: React.ReactNode
  wide?: boolean
}) {
  const titleId = useId()
  const panelRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef(onClose)
  useEffect(() => { closeRef.current = onClose }, [onClose])
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    panelRef.current?.focus()
    return () => { previous?.focus() }
  }, [])

  return createPortal(
    <div className="ds-modal-backdrop fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto p-4"
      onSubmit={event => event.stopPropagation()}
      onMouseDown={event => { if (event.target === event.currentTarget) closeRef.current() }}>
      <div ref={panelRef} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}
        className={`lms-shell ds-modal-panel max-h-[calc(100dvh-2rem)] w-full ${wide ? 'max-w-xl' : 'max-w-md'} overflow-y-auto p-5 outline-none`}
        onKeyDown={event => {
          if (event.key === 'Escape') { event.stopPropagation(); closeRef.current(); return }
          if (event.key !== 'Tab') return
          const controls = panelRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not([type="hidden"]):not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href]')
          if (!controls?.length) { event.preventDefault(); return }
          const first = controls[0], last = controls[controls.length - 1]
          if (event.shiftKey && (document.activeElement === first || document.activeElement === panelRef.current)) {
            event.preventDefault(); last.focus()
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault(); first.focus()
          }
        }}>
        <div className="mb-5 flex items-start justify-between gap-3">
          <div><h3 id={titleId} className="text-lg font-bold text-[#0B1F3A]">{title}</h3>
            <p className="mt-1 text-sm font-medium text-[#475569]">{studentName}</p></div>
          <button type="button" aria-label="Close" onClick={onClose}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[#E2E8F0] text-xl text-[#475569] hover:bg-[#F1F5F9]">×</button>
        </div>
        {children}
      </div>
    </div>, document.body,
  )
}
