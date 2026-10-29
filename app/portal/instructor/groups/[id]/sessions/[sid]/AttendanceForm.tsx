'use client'

import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { saveAttendance, saveAndEndSession } from '@/modules/instructor-portal/actions'
import type { SessionAttendanceRow } from '@/modules/instructor-portal/types'
import StudentNoteModal from '@/components/portal/instructor/StudentNoteModal'
import StudentEvaluationModal from '@/components/portal/instructor/StudentEvaluationModal'
import styles from './SessionWorkspace.module.css'
import SessionIcon from './SessionIcon'
import WorkflowNotice from '@/components/portal/instructor/WorkflowNotice'
import WorkflowConfirm from '@/components/portal/instructor/WorkflowConfirm'
import { instructorError, needsAttendanceReload } from '@/modules/instructor-portal/ux'

export type WorkspaceSection = 'attendance' | 'content' | 'homework' | 'notes'
interface Props {
  sessionId: string
  groupId: string
  rows: SessionAttendanceRow[]
  currentTopic: string | null
  sessionStatus?: string
  attendanceRevision?: number
  activeSection?: WorkspaceSection
  onBusyChange?: (busy: boolean) => void
  onCompleted?: () => void
  onSectionChange?: (section: WorkspaceSection) => void
  externalBusy?: boolean
  children?: ReactNode
  navigation?: ReactNode
  isLead?: boolean
  canPropose?: boolean
}
const STATUSES = ['present', 'absent', 'late', 'excused', 'makeup'] as const
type AttStatus = typeof STATUSES[number]
const label = (status: string) => status.charAt(0).toUpperCase() + status.slice(1)
const selectedColors: Record<AttStatus, string> = {
  present: styles.present,
  absent: styles.absent,
  late: styles.late,
  excused: styles.excused,
  makeup: styles.makeup,
}

export default function AttendanceForm({ sessionId, groupId, rows, currentTopic, sessionStatus = 'ongoing', attendanceRevision = 0, activeSection = 'attendance', onBusyChange, onCompleted, onSectionChange, externalBusy = false, children, navigation, isLead = true, canPropose = false }: Props) {
  const reviewMode = !isLead && canPropose
  const router = useRouter()
  const formId = useId()
  const lock = useRef(false)
  const topicInput = useRef<HTMLInputElement>(null)
  const container = useRef<HTMLDivElement>(null)
  const toolbar = useRef<HTMLDivElement>(null)
  const form = useRef<HTMLFormElement>(null)
  const [toolbarBounds, setToolbarBounds] = useState<{ left: number; width: number } | null>(null)
  const [toolbarHeight, setToolbarHeight] = useState(140)
  const [topic, setTopic] = useState(currentTopic ?? '')
  const [statuses, setStatuses] = useState<Record<string, AttStatus | ''>>(() => Object.fromEntries(rows.map(r => [r.student_id, STATUSES.includes(r.status as AttStatus) ? r.status as AttStatus : ''])))
  const [notes, setNotes] = useState<Record<string, string>>(() => Object.fromEntries(rows.map(r => [r.student_id, r.notes ?? ''])))
  const [feedback, setFeedback] = useState('No unsaved changes')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [revision, setRevision] = useState(attendanceRevision)
  const busy = pending || externalBusy
  const [expandedNotes, setExpandedNotes] = useState<Record<string, boolean>>({})
  const [completed, setCompleted] = useState(sessionStatus === 'completed' && !reviewMode)
  const [confirmEnd, setConfirmEnd] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)
  const [bulkAbsent, setBulkAbsent] = useState(false)
  const [reloadConfirm, setReloadConfirm] = useState(false)
  const [saved, setSaved] = useState(false)
  const [topicError, setTopicError] = useState(false)
  const [finishedElsewhere, setFinishedElsewhere] = useState(false)
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
    if (!hasChanges && !pending) return
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = '' }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [hasChanges, pending])
  const editable = (sessionStatus === 'ongoing' || reviewMode && sessionStatus === 'completed') && !completed && (isLead || canPropose)
  const canEnd = isLead && editable && !completed && sessionStatus === 'ongoing'
  const validTopic = !!topic.trim() && topic.trim().toLowerCase() !== 'no topic'
  const marked = rows.filter(r => statuses[r.student_id]).length
  const summary = STATUSES.map(s => `${rows.filter(r => statuses[r.student_id] === s).length} ${s}`).join(' · ')
  const dirty = () => { setHasChanges(true); setSaved(false); setFeedback('Unsaved changes'); setError(null); setTopicError(false); setConfirmEnd(false) }
  function focusTopic() {
    topicInput.current?.focus()
    topicInput.current?.scrollIntoView?.({ block: 'center', behavior: 'smooth' })
  }
  function focusUnmarked() {
    onSectionChange?.('attendance')
    requestAnimationFrame(() => {
      const missingStudent = rows.find(row => !statuses[row.student_id])
      const missing = document.getElementById(`${formId}-${missingStudent?.student_id}-present`)
      missing?.focus()
      missing?.scrollIntoView?.({ block: 'center', behavior: 'smooth' })
    })
  }

  async function submit(data: FormData) {
    if (lock.current || externalBusy || !editable) return
    if (!validTopic) {
      setError('Enter a session topic before saving attendance.')
      setTopicError(true)
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
        setError(instructorError(result.error, ending ? 'end this class' : 'save attendance'))
        setConfirmEnd(false)
        setFeedback('Save not confirmed · Review the message above')
        return
      }
      setConfirmEnd(false)
      if (ending && result.data?.alreadyCompleted) {
        setHasChanges(false)
        setFinishedElsewhere(true)
        router.refresh()
        return
      }
      if (result.data) setRevision(result.data.attendanceRevision)
      setHasChanges(false)
      setSaved(true)
      setFeedback(ending ? result.data?.alreadyCompleted ? 'This class was already completed. Your entries were not applied.' : 'Session completed · Attendance saved' : reviewMode ? 'Submitted for lead review · Not published' : `Saved · Attendance for ${marked} of ${rows.length} students`)
      if (ending) { setCompleted(true); onCompleted?.() }
      router.refresh()
    } catch {
      setError(instructorError(null, ending ? 'end this class' : 'save attendance'))
      setConfirmEnd(false)
      setFeedback('Save not confirmed')
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
      setTopicError(true)
      topicInput.current?.focus()
      topicInput.current?.scrollIntoView?.({ block: 'center', behavior: 'smooth' })
      return
    }
    if (marked < rows.length) {
      setError(`Choose an attendance status for the remaining ${rows.length - marked} student${rows.length - marked === 1 ? '' : 's'} before ending the class.`)
      focusUnmarked()
      return
    }
    setError(null)
    setConfirmEnd(true)
  }

  const buttonClass = 'min-h-11 rounded-lg border border-(--border) px-4 py-2 text-sm font-medium transition hover:bg-(--bg-muted) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--cyan-strong) disabled:opacity-50'
  if (finishedElsewhere) return <WorkflowNotice tone="warning" action={<button type="button" className="min-h-11 font-semibold underline" onClick={() => window.location.reload()}>Load completed record</button>}>This class was already completed. Your latest entries were not applied. Load the completed record to see the saved attendance.</WorkflowNotice>
  return (
    <div ref={container} className="space-y-4 text-(--text)" style={{ paddingBottom: editable ? toolbarHeight : 0 }}>
      {reviewMode && <WorkflowNotice tone="info">You are assisting this class. Submit changes for the lead to review; the lead ends the class. Your participation request is handled separately by administration.</WorkflowNotice>}
      {completed && <WorkflowNotice tone="success">Class completed. Attendance is read-only. Contact your administrator if a correction is needed.</WorkflowNotice>}
      {editable && <nav className={styles.steps} aria-label="Class checklist">
        <button type="button" disabled={busy} onClick={focusTopic}><SessionIcon name={validTopic ? 'present' : 'notes'} /><span>Topic<small>{validTopic ? hasChanges ? 'Entered · save with attendance' : 'Entered' : 'Required'}</small></span></button>
        <button type="button" disabled={busy} onClick={() => { onSectionChange?.('attendance'); if (marked < rows.length) focusUnmarked() }}><SessionIcon name="attendance" /><span>Attendance<small>{marked}/{rows.length} selected · {hasChanges ? 'Unsaved' : saved ? reviewMode ? 'Sent for review' : 'Saved' : 'Loaded record'}</small></span></button>
        <button type="button" disabled={busy} onClick={() => onSectionChange?.('content')}><SessionIcon name="content" /><span>Content &amp; homework<small>Optional · saved separately</small></span></button>
        {canEnd && <button type="button" disabled={busy} onClick={reviewEnd}><SessionIcon name="present" /><span>Finish<small>{validTopic && marked === rows.length ? 'Ready to review' : 'Complete topic & attendance'}</small></span></button>}
      </nav>}
      <form ref={form} id={formId} action={submit} onSubmit={event => {
        event.preventDefault()
        const submitter = (event.nativeEvent as SubmitEvent).submitter
        void submit(new FormData(event.currentTarget, submitter))
      }}>
        <input type="hidden" name="session_id" value={sessionId} />
        <input type="hidden" name="group_id" value={groupId} />
        <input type="hidden" name="attendance_revision" value={revision} />
        {rows.filter(r => statuses[r.student_id]).map(r => <div key={r.student_id}>
          <input type="hidden" name="student_ids[]" value={r.student_id} />
          <input type="hidden" name={`status_${r.student_id}`} value={statuses[r.student_id]} />
          <input type="hidden" name={`notes_${r.student_id}`} value={notes[r.student_id]} />
        </div>)}
        <fieldset disabled={busy || !editable} className={styles.topic}>
          <label htmlFor={`${formId}-topic`}>Session topic</label>
          <input ref={topicInput} id={`${formId}-topic`} name="topic" required onInvalid={() => setTopicError(true)} aria-invalid={topicError} aria-describedby={topicError ? `${formId}-topic-error` : undefined} value={topic} onChange={e => { setTopic(e.target.value); dirty() }} className="ds-input min-h-11 w-full" placeholder="For example: loops and a simple game" />
          {topicError && <p id={`${formId}-topic-error`} className="text-sm font-semibold text-(--red-dark)">Enter a session topic before saving.</p>}
        </fieldset>
        {navigation}
        <fieldset disabled={busy || !editable} className="min-w-0">
          <section hidden={activeSection !== 'attendance'} className={`ds-card overflow-hidden ${styles.attendanceCard}`} aria-label="Attendance">
            <div className={styles.attendanceHeader}>
              <div className={styles.summary}>
                <h2><SessionIcon name="attendance" />Attendance <span>{marked}/{rows.length} marked</span></h2>
                <div className={styles.counts}>
                  {STATUSES.filter(status => rows.some(row => statuses[row.student_id] === status)).map(status => <span key={status} className={selectedColors[status]}>{rows.filter(row => statuses[row.student_id] === status).length} {status}</span>)}
                  <span>{rows.length - marked} unmarked{hasChanges ? ' · Not saved yet' : ''}</span>
                </div>
              </div>
              <div className={styles.headerActions}>
                {rows.length > 0 && <>
                  <button type="button" className={styles.markAll} onClick={() => { setStatuses(Object.fromEntries(rows.map(row => [row.student_id, 'present']))); dirty() }}><SessionIcon name="present" />Mark all present</button>
                  <button type="button" className={styles.markAllAbsent} onClick={() => setBulkAbsent(true)}><SessionIcon name="absent" />Mark all absent</button>
                </>}
              </div>
            </div>
            {rows.length === 0 && <p className="p-6 text-sm text-(--muted)">No students enrolled in this group.</p>}
            <div>{rows.map((r, index) => <div key={r.student_id} className={styles.studentRow}>
              <div className={styles.studentInfo}>
                <span className={styles.studentIdentity}><span className={styles.studentNumber} aria-hidden="true">{index + 1}</span><Link className={styles.studentName} href={`/portal/instructor/groups/${groupId}/students/${r.student_id}`}>{r.student_name}</Link></span>
                <span className={`${styles.state} ${statuses[r.student_id] ? selectedColors[statuses[r.student_id] as AttStatus] : styles.unmarked}`}>{statuses[r.student_id] ? `✓ ${label(statuses[r.student_id])}` : 'Unmarked'}</span>
              </div>
              <div className={styles.rowActions}>
                <div className={styles.statusOptions} role="group" aria-label={`Attendance for ${r.student_name}`}>
                  {STATUSES.map(s => <button key={s} id={`${formId}-${r.student_id}-${s}`} type="button" aria-label={`${r.student_name}: ${label(s)}`} aria-pressed={statuses[r.student_id] === s} data-attendance-status={s} onClick={() => { setStatuses(prev => ({ ...prev, [r.student_id]: s })); dirty() }} className={`${styles.statusButton} ${statuses[r.student_id] === s ? selectedColors[s] : ''}`}><SessionIcon name={s} />{label(s)}</button>)}
                </div>
                <button type="button" aria-label={`${expandedNotes[r.student_id] ? 'Hide' : notes[r.student_id] ? 'Edit' : 'Add'} attendance note for ${r.student_name}`} aria-expanded={!!expandedNotes[r.student_id]} aria-controls={`${formId}-${r.student_id}-note`} onClick={() => setExpandedNotes(prev => ({ ...prev, [r.student_id]: !prev[r.student_id] }))} className={styles.noteButton} title={notes[r.student_id] ? 'Edit attendance note' : 'Add attendance note'}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M14 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-9M14 3v7h7M7 14h5m-5 3h8" /></svg>
                  {notes[r.student_id] && <span className={styles.noteDot} />}
                </button>
              </div>
              <label id={`${formId}-${r.student_id}-note`} hidden={!expandedNotes[r.student_id]} className={styles.noteField}>Attendance note for {r.student_name}<input value={notes[r.student_id]} onChange={e => { setNotes(prev => ({ ...prev, [r.student_id]: e.target.value })); dirty() }} className="ds-input mt-1 min-h-11 w-full" placeholder="Optional attendance note" /></label>
            </div>)}</div>
          </section>
        </fieldset>
      </form>

      <section hidden={activeSection !== 'notes'} className="ds-card p-4" aria-label="Student notes and evaluations">
        <h2 className="text-base font-semibold">Student notes &amp; evaluations</h2>
        <p className="mt-1 text-sm text-(--muted)">Record individual feedback. These changes save separately from attendance.</p>
        <fieldset disabled={busy || !isLead && !canPropose} className="mt-3 divide-y divide-(--border-soft)">{rows.map((r, index) => <div key={r.student_id} className="flex flex-wrap items-center justify-between gap-3 py-3"><span className={`${styles.studentIdentity} text-sm font-medium`}><span className={styles.studentNumber} aria-hidden="true">{index + 1}</span>{r.student_name}</span><div className="flex items-center gap-2"><StudentNoteModal studentId={r.student_id} studentName={r.student_name} groupId={groupId} scheduleId={sessionId} /><StudentEvaluationModal studentId={r.student_id} studentName={r.student_name} groupId={groupId} scheduleId={sessionId} reviewMode={reviewMode} /></div></div>)}</fieldset>
      </section>
      {children}
      {editable && <div ref={toolbar} style={{ left: toolbarBounds?.left ?? '1rem', width: toolbarBounds?.width ?? 'calc(100% - 2rem)' }} className={`${styles.toolbar} fixed bottom-[calc(var(--bottom-nav-height)+var(--safe-bottom))] z-(--z-fab) max-h-[60dvh] overflow-y-auto rounded-xl border border-(--border) bg-(--bg-card) shadow-lg md:bottom-4`}>
        {error && <WorkflowNotice tone="error" action={needsAttendanceReload(error) ? <button type="button" className="min-h-11 font-semibold underline" onClick={() => setReloadConfirm(true)}>Reload latest attendance</button> : undefined}>{error}</WorkflowNotice>}
        <div className={styles.toolbarContent}>
          <p role="status" aria-live="polite" className={`${styles.feedback} ${error ? styles.feedbackError : busy ? styles.feedbackBusy : hasChanges ? styles.unsaved : saved ? styles.feedbackSaved : ''}`}>{externalBusy ? 'Saving session changes…' : feedback}</p>
          <div className={styles.saveActions}><button type="submit" form={formId} name="intent" value="save" disabled={busy || rows.length === 0} className={buttonClass}><SessionIcon name="save" />{reviewMode ? 'Submit attendance for review' : 'Save attendance'}</button>{canEnd && <button type="submit" form={formId} name="intent" value="end" disabled={busy} onClick={event => { event.preventDefault(); reviewEnd() }} className={`${buttonClass} bg-(--navy) text-white hover:bg-(--navy-light)`}><SessionIcon name="present" />Save &amp; end session</button>}</div>
        </div>
      </div>}
      {confirmEnd && canEnd && <WorkflowConfirm title="Complete this session?" confirmLabel="Confirm save & end" busy={busy} onCancel={() => setConfirmEnd(false)} onConfirm={() => { if (!form.current) return; const data = new FormData(form.current); data.set('intent', 'end'); void submit(data) }}>
        <p className="font-semibold text-(--navy)">{topic}</p><p>{summary}</p>
        <p>Save attendance and close this shared class for everyone. Students are charged once. Assistant requests remain subject to administration approval.</p>
        {error && <WorkflowNotice tone="error">{error}</WorkflowNotice>}
      </WorkflowConfirm>}
      {bulkAbsent && <WorkflowConfirm title="Mark every student absent?" confirmLabel="Mark all absent" danger onCancel={() => setBulkAbsent(false)} onConfirm={() => { setStatuses(Object.fromEntries(rows.map(row => [row.student_id, 'absent']))); dirty(); setBulkAbsent(false) }}><p>This replaces the attendance choices for all {rows.length} students. Save attendance to apply the change.</p></WorkflowConfirm>}
      {reloadConfirm && <WorkflowConfirm title="Reload the latest attendance?" confirmLabel="Discard draft & reload" danger onCancel={() => setReloadConfirm(false)} onConfirm={() => window.location.reload()}><p>Your unsaved attendance choices and topic edits will be discarded. The latest shared record will be loaded.</p></WorkflowConfirm>}
    </div>
  )
}
