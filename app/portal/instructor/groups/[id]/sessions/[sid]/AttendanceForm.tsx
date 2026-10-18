'use client'

import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { saveAttendance, saveAndEndSession } from '@/modules/instructor-portal/actions'
import type { SessionAttendanceRow } from '@/modules/instructor-portal/types'
import StudentNoteModal from '@/components/portal/instructor/StudentNoteModal'
import StudentEvaluationModal from '@/components/portal/instructor/StudentEvaluationModal'

export type WorkspaceSection = 'attendance' | 'content' | 'homework' | 'notes'
interface Props {
  sessionId: string
  groupId: string
  rows: SessionAttendanceRow[]
  currentTopic: string | null
  sessionStatus?: string
  activeSection?: WorkspaceSection
  onBusyChange?: (busy: boolean) => void
  onCompleted?: () => void
  onSectionChange?: (section: WorkspaceSection) => void
  externalBusy?: boolean
  children?: ReactNode
}
const STATUSES = ['present', 'absent', 'late', 'excused', 'makeup'] as const
type AttStatus = typeof STATUSES[number]
const label = (status: string) => status.charAt(0).toUpperCase() + status.slice(1)
const selectedColors: Record<AttStatus, string> = {
  present: 'border-(--green-dark) bg-(--green-soft) text-(--green-dark)',
  absent: 'border-(--red-dark) bg-(--red-soft) text-(--red-dark)',
  late: 'border-(--amber-dark) bg-(--amber-soft) text-(--amber-dark)',
  excused: 'border-(--cyan-strong) bg-(--bg-muted) text-(--cyan-strong)',
  makeup: 'border-(--navy) bg-(--bg-muted) text-(--navy)',
}

export default function AttendanceForm({ sessionId, groupId, rows, currentTopic, sessionStatus = 'ongoing', activeSection = 'attendance', onBusyChange, onCompleted, onSectionChange, externalBusy = false, children }: Props) {
  const router = useRouter()
  const formId = useId()
  const lock = useRef(false)
  const topicInput = useRef<HTMLInputElement>(null)
  const container = useRef<HTMLDivElement>(null)
  const toolbar = useRef<HTMLDivElement>(null)
  const confirmation = useRef<HTMLElement>(null)
  const [toolbarBounds, setToolbarBounds] = useState<{ left: number; width: number } | null>(null)
  const [toolbarHeight, setToolbarHeight] = useState(140)
  const [topic, setTopic] = useState(currentTopic ?? '')
  const [statuses, setStatuses] = useState<Record<string, AttStatus | ''>>(() => Object.fromEntries(rows.map(r => [r.student_id, STATUSES.includes(r.status as AttStatus) ? r.status as AttStatus : ''])))
  const [notes, setNotes] = useState<Record<string, string>>(() => Object.fromEntries(rows.map(r => [r.student_id, r.notes ?? ''])))
  const [feedback, setFeedback] = useState('No unsaved changes')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const busy = pending || externalBusy
  const [expandedNotes, setExpandedNotes] = useState<Record<string, boolean>>({})
  const [completed, setCompleted] = useState(sessionStatus === 'completed')
  const [confirmEnd, setConfirmEnd] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)
  useEffect(() => {
    const measure = () => {
      const rect = container.current?.getBoundingClientRect()
      if (rect?.width) setToolbarBounds({ left: rect.left, width: rect.width })
      if (toolbar.current?.offsetHeight) setToolbarHeight(toolbar.current.offsetHeight + 24)
    }
    measure()
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null
    if (container.current) observer?.observe(container.current)
    if (toolbar.current) observer?.observe(toolbar.current)
    window.addEventListener('resize', measure)
    return () => { observer?.disconnect(); window.removeEventListener('resize', measure) }
  }, [])
  useEffect(() => {
    if (!confirmEnd) return
    confirmation.current?.focus()
    confirmation.current?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' })
  }, [confirmEnd])
  useEffect(() => {
    if (!hasChanges && !pending) return
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = '' }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [hasChanges, pending])
  const editable = ['ongoing', 'completed'].includes(sessionStatus)
  const canEnd = editable && !completed && sessionStatus === 'ongoing'
  const validTopic = !!topic.trim() && topic.trim().toLowerCase() !== 'no topic'
  const marked = rows.filter(r => statuses[r.student_id]).length
  const summary = STATUSES.map(s => `${rows.filter(r => statuses[r.student_id] === s).length} ${s}`).join(' · ')
  const dirty = () => { setHasChanges(true); setFeedback('Unsaved changes'); setError(null); setConfirmEnd(false) }

  async function submit(data: FormData) {
    if (lock.current || externalBusy || !editable) return
    if (!validTopic) {
      setError('Enter a session topic before saving attendance.')
      topicInput.current?.focus()
      topicInput.current?.scrollIntoView?.({ block: 'center', behavior: 'smooth' })
      return
    }
    const ending = data.get('intent') === 'end'
    if (ending && (!canEnd || !confirmEnd)) return
    lock.current = true
    setPending(true)
    onBusyChange?.(true)
    setError(null)
    setFeedback(ending ? 'Saving & ending…' : 'Saving…')
    try {
      const result = await (ending ? saveAndEndSession : saveAttendance)(null, data)
      if (!result.success) {
        setError(result.error.message)
        setFeedback('Error · Changes not saved. Your draft is kept.')
        return
      }
      setConfirmEnd(false)
      setHasChanges(false)
      setFeedback(ending ? 'Session completed · Saved' : 'Saved')
      if (ending) { setCompleted(true); onCompleted?.() }
      router.refresh()
    } catch {
      setError('Unable to save. Please try again. Your draft is kept.')
      setFeedback('Error · Changes not saved')
    } finally {
      lock.current = false
      setPending(false)
      onBusyChange?.(false)
    }
  }

  function reviewEnd() {
    if (busy || lock.current) return
    if (!validTopic) {
      setError('Enter a session topic before completing the session.')
      topicInput.current?.focus()
      topicInput.current?.scrollIntoView?.({ block: 'center', behavior: 'smooth' })
      return
    }
    if (marked < rows.length) {
      setError('Mark attendance for every student before completing the session.')
      onSectionChange?.('attendance')
      requestAnimationFrame(() => {
        const missingStudent = rows.find(row => !statuses[row.student_id])
        const missing = document.getElementById(`${formId}-${missingStudent?.student_id}-present`)
        missing?.focus()
        missing?.scrollIntoView?.({ block: 'center', behavior: 'smooth' })
      })
      return
    }
    setError(null)
    setConfirmEnd(true)
  }

  const buttonClass = 'min-h-11 rounded-lg border border-(--border) px-4 py-2 text-sm font-medium transition hover:bg-(--bg-muted) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--cyan-strong) disabled:opacity-50'
  return (
    <div ref={container} className="space-y-4 text-(--text)" style={{ paddingBottom: editable ? toolbarHeight : 0 }}>
      <form id={formId} action={submit} onSubmit={event => {
        event.preventDefault()
        const submitter = (event.nativeEvent as SubmitEvent).submitter
        void submit(new FormData(event.currentTarget, submitter))
      }}>
        <input type="hidden" name="session_id" value={sessionId} />
        <input type="hidden" name="group_id" value={groupId} />
        {rows.filter(r => statuses[r.student_id]).map(r => <div key={r.student_id}>
          <input type="hidden" name="student_ids[]" value={r.student_id} />
          <input type="hidden" name={`status_${r.student_id}`} value={statuses[r.student_id]} />
          <input type="hidden" name={`notes_${r.student_id}`} value={notes[r.student_id]} />
        </div>)}
        <fieldset disabled={busy || !editable} className="min-w-0 space-y-4">
          <div className="ds-card p-4">
            <label htmlFor={`${formId}-topic`} className="mb-2 block text-sm font-semibold">Session topic</label>
            <input ref={topicInput} id={`${formId}-topic`} name="topic" required value={topic} onChange={e => { setTopic(e.target.value); dirty() }} className="ds-input min-h-11 w-full" placeholder="What are students learning today?" aria-describedby={`${formId}-topic-help`} />
            <p id={`${formId}-topic-help`} className="mt-2 text-sm text-(--muted)">Required to save attendance or complete the session.</p>
          </div>
          <section hidden={activeSection !== 'attendance'} className="ds-card overflow-hidden" aria-label="Attendance">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-(--border-soft) p-4">
              <div><h2 className="text-base font-semibold">Attendance</h2><p className="mt-1 text-sm text-(--muted)">{marked}/{rows.length} marked · {rows.length - marked} unmarked</p></div>
              {rows.length > 0 && <div className="flex flex-wrap gap-2">{(['present', 'absent'] as const).map(s => <button key={s} type="button" className={buttonClass} onClick={() => { setStatuses(Object.fromEntries(rows.map(r => [r.student_id, s]))); dirty() }}>Mark all {s}</button>)}</div>}
            </div>
            <p className="border-b border-(--border-soft) px-4 py-3 text-sm text-(--text-3)">{summary}</p>
            {rows.length === 0 && <p className="p-6 text-sm text-(--muted)">No students enrolled in this group.</p>}
            <div className="divide-y divide-(--border-soft)">{rows.map(r => <div key={r.student_id} className="space-y-3 p-4">
              <div className="flex items-center justify-between gap-3"><Link className="font-medium hover:underline" href={`/portal/instructor/groups/${groupId}/students/${r.student_id}`}>{r.student_name}</Link><span className="text-sm text-(--muted)">{statuses[r.student_id] ? label(statuses[r.student_id]) : 'Unmarked'}</span></div>
              <div className="flex flex-wrap gap-2" role="group" aria-label={`Attendance for ${r.student_name}`}>{STATUSES.map(s => <button key={s} id={`${formId}-${r.student_id}-${s}`} type="button" aria-label={`${r.student_name}: ${label(s)}`} aria-pressed={statuses[r.student_id] === s} onClick={() => { setStatuses(prev => ({ ...prev, [r.student_id]: s })); dirty() }} className={`${buttonClass} ${statuses[r.student_id] === s ? selectedColors[s] : 'bg-(--bg-card) text-(--text-2)'}`}>{label(s)}</button>)}</div>
              <button type="button" aria-expanded={!!expandedNotes[r.student_id]} aria-controls={`${formId}-${r.student_id}-note`} onClick={() => setExpandedNotes(prev => ({ ...prev, [r.student_id]: !prev[r.student_id] }))} className="min-h-11 text-sm font-medium text-(--cyan-strong)">{expandedNotes[r.student_id] ? 'Hide note' : notes[r.student_id] ? 'Edit attendance note' : 'Add attendance note'}</button>
              <label id={`${formId}-${r.student_id}-note`} hidden={!expandedNotes[r.student_id]} className="text-sm text-(--text-3)">Attendance note for {r.student_name}<input value={notes[r.student_id]} onChange={e => { setNotes(prev => ({ ...prev, [r.student_id]: e.target.value })); dirty() }} className="ds-input mt-1 min-h-11 w-full" placeholder="Optional attendance note" /></label>
            </div>)}</div>
          </section>
        </fieldset>
      </form>

      <section hidden={activeSection !== 'notes'} className="ds-card p-4" aria-label="Student notes and evaluations">
        <h2 className="text-base font-semibold">Student notes &amp; evaluations</h2>
        <p className="mt-1 text-sm text-(--muted)">Record individual feedback. These changes save separately from attendance.</p>
        <fieldset disabled={busy} className="mt-3 divide-y divide-(--border-soft)">{rows.map(r => <div key={r.student_id} className="flex flex-wrap items-center justify-between gap-3 py-3"><span className="text-sm font-medium">{r.student_name}</span><div className="flex items-center gap-2"><StudentNoteModal studentId={r.student_id} studentName={r.student_name} groupId={groupId} scheduleId={sessionId} /><StudentEvaluationModal studentId={r.student_id} studentName={r.student_name} groupId={groupId} /></div></div>)}</fieldset>
      </section>
      {children}
      {editable && <div ref={toolbar} style={{ left: toolbarBounds?.left ?? '1rem', width: toolbarBounds?.width ?? 'calc(100% - 2rem)' }} className="fixed bottom-[calc(var(--bottom-nav-height)+var(--safe-bottom))] z-(--z-fab) max-h-[60dvh] overflow-y-auto rounded-xl border border-(--border) bg-(--bg-card) p-4 shadow-lg md:bottom-4">
        {error && <p role="alert" className="mb-3 text-sm text-(--red-dark)">{error}</p>}
        {confirmEnd && canEnd && <section ref={confirmation} tabIndex={-1} role="region" aria-label="Confirm session completion" className="mb-4 space-y-2 border-b border-(--border) pb-4">
          <h2 className="text-sm font-semibold">Complete this session?</h2>
          <p className="text-sm text-(--text-2)">Topic: {topic || 'Missing topic'}</p>
          <p className="text-sm text-(--text-3)">{summary} · {rows.length - marked} unmarked</p>
          <p className="text-sm text-(--muted)">Your current topic and attendance will be saved before completing the session.</p>
          <div className="flex flex-wrap gap-2"><button type="submit" form={formId} name="intent" value="end" disabled={busy} className={`${buttonClass} bg-(--navy) text-white hover:bg-(--navy-light)`}>Confirm save &amp; end</button><button type="button" disabled={busy} onClick={() => setConfirmEnd(false)} className={buttonClass}>Keep editing</button></div>
        </section>}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p role="status" aria-live="polite" className="text-sm text-(--text-3)">{externalBusy ? 'Saving session changes…' : feedback}</p>
          <div className="flex flex-wrap gap-2"><button type="submit" form={formId} name="intent" value="save" disabled={busy || rows.length === 0} className={buttonClass}>Save attendance</button>{canEnd && <button type="submit" form={formId} name="intent" value="end" disabled={busy} onClick={event => { event.preventDefault(); reviewEnd() }} className={`${buttonClass} bg-(--navy) text-white hover:bg-(--navy-light)`}>Save &amp; end session</button>}</div>
        </div>
      </div>}
    </div>
  )
}
