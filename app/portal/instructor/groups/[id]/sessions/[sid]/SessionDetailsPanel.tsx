'use client'

import { useActionState, useEffect, useState, useTransition } from 'react'
import {
  updateSession,
  addSessionRecording,
  removeSessionRecording,
  updateSessionResources,
  createSessionHomework,
  updateSessionHomework,
  cancelSession,
  postponeSession,
} from '@/modules/instructor-portal/actions'
import type {
  SessionDetail,
  ResourceLink,
} from '@/modules/instructor-portal/types'
import type { ActionResult } from '@/types/app'
import WorkflowNotice from '@/components/portal/instructor/WorkflowNotice'
import SessionIcon from './SessionIcon'
import { instructorError } from '@/modules/instructor-portal/ux'

interface Props {
  session: SessionDetail
  groupId: string
  activeSection?: 'attendance' | 'content' | 'homework' | 'notes'
  busy?: boolean
  onBusyChange?: (busy: boolean) => void
  reviewMode?: boolean
  readOnly?: boolean
}

function withSaveError<T>(action: (previous: ActionResult<T> | null, data: FormData) => Promise<ActionResult<T>>) {
  return async (previous: ActionResult<T> | null, data: FormData): Promise<ActionResult<T>> => {
    try {
      const result = await action(previous, data)
      return result.success ? result : { ...result, error: { ...result.error, message: instructorError(result.error) } }
    } catch {
      return { success: false, error: { code: 'NETWORK_ERROR', message: instructorError(null) } }
    }
  }
}

const saveNotes = withSaveError(updateSession)
const addRecording = withSaveError(addSessionRecording)
const saveResources = withSaveError(updateSessionResources)
const createHomework = withSaveError(createSessionHomework)
const editHomework = withSaveError(updateSessionHomework)
const cancel = withSaveError(cancelSession)
const postpone = withSaveError(postponeSession)

const PROVIDER_LABELS: Record<string, string> = {
  google_drive: 'Google Drive',
  youtube:      'YouTube',
  vimeo:        'Vimeo',
  zoom:         'Zoom',
  loom:         'Loom',
  other:        'Link',
}

const STATUS_BADGE: Record<string, string> = {
  cancelled:             'bg-[#FEE2E2] text-[#DC2626] border-[#FECACA]',
  cancelled_with_makeup: 'bg-orange-100 text-orange-700 border-orange-200',
  postponed:             'bg-yellow-100 text-yellow-800 border-yellow-200',
  completed:             'bg-[#E7F8EE] text-[#15803D] border-[#A7F3D0]',
  ongoing:               'bg-[#EFF6FF] text-[#1D4ED8] border-blue-200',
  scheduled:             'bg-[#F1F5F9] text-[#475569] border-slate-200',
}

// ── Section collapse state ────────────────────────────────────────────────────
function SectionCard({ title, children, defaultOpen = true, hidden = false }: {
  title: string
  children: React.ReactNode
  hidden?: boolean
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div hidden={hidden} className="ds-card overflow-hidden">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between px-5 py-3.5 text-left"
      >
        <span className="flex items-center gap-2 text-sm font-semibold text-(--navy)"><SessionIcon name="content" />{title}</span>
        <span className={`text-xs text-(--muted) transition-transform ${open ? 'rotate-180' : ''}`}>▾</span>
      </button>
      {open && <div className="border-t border-[#F1F5F9] px-5 py-4">{children}</div>}
    </div>
  )
}

export default function SessionDetailsPanel({ session, groupId, activeSection = 'content', busy = false, onBusyChange, reviewMode = false, readOnly = false }: Props) {
  const [isPending, startTransition] = useTransition()

  const cls = 'ds-input min-h-11 w-full'
  const selectCls = `${cls} bg-white`

  const isCancelled = session.status === 'cancelled' || session.status === 'cancelled_with_makeup'
  const isPostponed = session.status === 'postponed'
  const isTerminal  = session.status === 'completed' || isCancelled


  // ── Session details (topic / notes) ──────────────────────────────────────────
  const [detailState, detailAction, detailPending] = useActionState<ActionResult<void> | null, FormData>(saveNotes, null)

  // ── Add recording ─────────────────────────────────────────────────────────────
  const [recState, recAction, recPending] = useActionState<ActionResult<{ id: string }> | null, FormData>(addRecording, null)

  // ── Resources ─────────────────────────────────────────────────────────────────
  const [resources, setResources] = useState<ResourceLink[]>(session.resources_links)
  const [newResTitle, setNewResTitle] = useState('')
  const [newResUrl,   setNewResUrl]   = useState('')
  const [resError,    setResError]    = useState<string | null>(null)
  const [recordingFeedback, setRecordingFeedback] = useState<{ success: boolean; message: string } | null>(null)
  const [resState, resAction, resPending] = useActionState<ActionResult<void> | null, FormData>(saveResources, null)

  const handleAddResource = () => {
    if (!newResUrl.trim()) { setResError('Add the resource link first.'); return }
    try { const url = new URL(newResUrl.trim()); if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Invalid protocol') } catch { setResError('Enter a complete https:// link.'); return }
    setResError(null)
    const updated = [...resources, { title: newResTitle.trim() || newResUrl.trim(), url: newResUrl.trim() }]
    setResources(updated)
    setNewResTitle(''); setNewResUrl('')
    startTransition(async () => {
      const fd = new FormData()
      fd.set('session_id',     session.id)
      fd.set('group_id',       groupId)
      fd.set('resources_json', JSON.stringify(updated))
      await resAction(fd)
    })
  }

  const handleRemoveResource = (idx: number) => {
    const updated = resources.filter((_, i) => i !== idx)
    setResources(updated)
    startTransition(async () => {
      const fd = new FormData()
      fd.set('session_id',     session.id)
      fd.set('group_id',       groupId)
      fd.set('resources_json', JSON.stringify(updated))
      await resAction(fd)
    })
  }

  // ── Homework ──────────────────────────────────────────────────────────────────
  const [hwState, hwAction, hwPending] = useActionState<ActionResult<{ assignmentId: string }> | null, FormData>(createHomework, null)
  const [hwOpen, setHwOpen] = useState(false)
  const [editingHomeworkId, setEditingHomeworkId] = useState<string | null>(null)
  const [editHomeworkState, editHomeworkAction, editHomeworkPending] = useActionState<ActionResult<void> | null, FormData>(editHomework, null)
  const defaultModule = session.course_modules[0]

  // ── End Session ───────────────────────────────────────────────────────────────
  // ── Cancel Session ────────────────────────────────────────────────────────────
  const [showCancelForm,  setShowCancelForm]  = useState(false)
  const [cancelState, cancelAction, cancelPending] = useActionState<ActionResult<{ makeupSessionId?: string }> | null, FormData>(cancel, null)
  const [createMakeup, setCreateMakeup] = useState(false)

  // ── Postpone Session ──────────────────────────────────────────────────────────
  const [showPostponeForm, setShowPostponeForm] = useState(false)
  const [postponeState, postponeAction, postponePending] = useActionState<ActionResult<void> | null, FormData>(postpone, null)

  const operationPending = isPending || detailPending || recPending || resPending || hwPending || editHomeworkPending || cancelPending || postponePending
  useEffect(() => { onBusyChange?.(operationPending) }, [operationPending, onBusyChange])

  return (
    <fieldset disabled={busy || operationPending || isCancelled || readOnly} className="min-w-0 space-y-4">
      {reviewMode && <p className="text-xs font-semibold text-(--amber-dark)">All changes here are submitted to the lead instructor for review before publishing.</p>}

      {/* ── Cancelled / Postponed State Banner ─────────────────────────────── */}
      {isCancelled && (
        <div className={`rounded-xl border px-4 py-3 ${STATUS_BADGE[session.status]}`}>
          <p className="font-semibold text-sm">
            {session.status === 'cancelled_with_makeup' ? '✕ Cancelled — Makeup Scheduled' : '✕ Session Cancelled'}
          </p>
          {session.cancellation_reason && (
            <p className="mt-0.5 text-xs opacity-80">{session.cancellation_reason}</p>
          )}
          {session.cancelled_at && (
            <p className="mt-0.5 text-xs opacity-60">
              {new Date(session.cancelled_at).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}
            </p>
          )}
        </div>
      )}

      {isPostponed && (
        <div className={`rounded-xl border px-4 py-3 ${STATUS_BADGE.postponed}`}>
          <p className="font-semibold text-sm">⏸ Session Postponed</p>
          {session.postponed_reason && (
            <p className="mt-0.5 text-xs opacity-80">{session.postponed_reason}</p>
          )}
        </div>
      )}

      {/* ── Topic & Notes ─────────────────────────────────────────────────── */}
      <SectionCard hidden={activeSection !== 'notes'} title="Session notes">
        {detailState && !detailState.success && (
          <WorkflowNotice tone="error">{detailState.error.message}</WorkflowNotice>
        )}
        {detailState?.success && (
          <WorkflowNotice tone="success">{reviewMode ? 'Session notes sent to the lead for review.' : 'Session notes saved.'}</WorkflowNotice>
        )}

        <form onSubmit={event => { event.preventDefault(); if (operationPending) return; const fd = new FormData(event.currentTarget); startTransition(() => detailAction(fd)) }} className="space-y-3">
          <input type="hidden" name="session_id" value={session.id} />
          <input type="hidden" name="group_id"   value={groupId} />



          <div>
            <label className="mb-1 block text-sm font-medium text-[#64748B]">
              Session Notes
              <span className="ml-1 font-normal text-(--muted)">(visible to team leaders)</span>
            </label>
            <textarea name="notes" rows={3} defaultValue={session.notes ?? ''} placeholder="Observations about this session…" className={cls} />
          </div>

          <button type="submit" disabled={operationPending}
            className="min-h-11 rounded-lg bg-[#C2410C] px-4 py-2 text-sm font-medium text-white hover:bg-[#9A3412] disabled:opacity-60 transition">
            {reviewMode ? 'Submit session notes for review' : 'Save session notes'}
          </button>
        </form>
      </SectionCard>

      {/* ── Homework ─────────────────────────────────────────────────────────── */}
      <SectionCard hidden={activeSection !== 'homework'} title={`Homework ${session.session_homework.length > 0 ? `(${session.session_homework.length})` : ''}`}>
        <p className="mb-3 text-sm text-(--text-2)">Optional. Create homework when students need practice after this class.</p>
        {/* Existing homework list */}
        {session.session_homework.length > 0 && (
          <div className="mb-4 space-y-2">
            {session.session_homework.map((hw) => (
              <div key={hw.id}>
              <div className="min-h-11 flex items-start gap-2 rounded-lg border border-[#E2E8F0] px-3 py-2.5">
                <div className="flex-1 min-w-0">
                  <p className="truncate text-sm font-medium text-[#0B1F3A]">{hw.title}</p>
                  <p className="mt-0.5 text-xs text-(--muted) capitalize">
                    {hw.type} · {hw.submission_type.replace('_', ' ')}
                    {hw.due_at && ` · Due ${new Date(hw.due_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`}
                  </p>
                </div>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${hw.status === 'published' ? 'bg-[#E7F8EE] text-[#15803D]' : 'bg-yellow-100 text-yellow-700'}`}>
                  {hw.status}
                </span>
                <button type="button" onClick={() => setEditingHomeworkId(editingHomeworkId === hw.id ? null : hw.id)} className="text-sm font-medium text-[#C2410C] hover:underline">Edit</button>
              </div>
              {editingHomeworkId === hw.id && (
                <form onSubmit={event => { event.preventDefault(); if (operationPending) return; const fd = new FormData(event.currentTarget); startTransition(() => editHomeworkAction(fd)) }} className="mt-2 space-y-2 rounded-lg bg-[#F8FAFC] p-3">
                  <input type="hidden" name="assignment_id" value={hw.id} /><input type="hidden" name="session_id" value={session.id} /><input type="hidden" name="group_id" value={groupId} />
                  <input name="title" required defaultValue={hw.title} className={cls} />
                  <textarea name="description" defaultValue={hw.description ?? ''} placeholder="Description" rows={2} className={cls} />
                  <textarea name="instructions" defaultValue={hw.instructions ?? ''} placeholder="Instructions" rows={2} className={cls} />
                  <div className="grid grid-cols-2 gap-2"><input name="due_at" type="date" defaultValue={hw.due_at?.slice(0, 10) ?? ''} className={cls} /><input name="max_score" type="number" min={1} defaultValue={hw.max_score} className={cls} /></div>
                  <input type="hidden" name="type" value={hw.type} /><input type="hidden" name="submission_type" value={hw.submission_type} />
                  {editHomeworkState && !editHomeworkState.success && <WorkflowNotice tone="error">{editHomeworkState.error.message}</WorkflowNotice>}
                  {editHomeworkState?.success && <WorkflowNotice tone="success">{reviewMode ? 'Homework changes sent to the lead for review.' : 'Homework changes saved.'}</WorkflowNotice>}
                    <button type="submit" className="min-h-11 rounded-lg bg-[#C2410C] px-3 py-1.5 text-sm font-medium text-white">{reviewMode ? 'Submit homework changes' : 'Save homework'}</button>
                </form>
              )}
              </div>
            ))}
          </div>
        )}

        {hwState && !hwState.success && (
          <WorkflowNotice tone="error">{hwState.error.message}</WorkflowNotice>
        )}
        {hwState?.success && (
          <WorkflowNotice tone="success">{reviewMode ? 'Homework sent to the lead for review. Students cannot see it yet.' : 'Homework published. Students can now see it.'}</WorkflowNotice>
        )}

        {!hwOpen ? (
          <button type="button" onClick={() => setHwOpen(true)}
            className="min-h-11 w-full rounded-lg border border-dashed border-[#E2E8F0] py-2 text-sm text-[#64748B] hover:border-[#C2410C] hover:text-[#9A3412] transition">
            + Create Homework
          </button>
        ) : (
          <form onSubmit={event => { event.preventDefault(); if (operationPending) return; const fd = new FormData(event.currentTarget); startTransition(() => hwAction(fd)) }} className="space-y-3">
            <input type="hidden" name="session_id" value={session.id} />
            <input type="hidden" name="group_id"   value={groupId} />
            {defaultModule && (
              <input type="hidden" name="module_id" value={defaultModule.id} />
            )}

            <div>
              <label className="mb-1 block text-sm font-medium text-[#64748B]">Title <span className="text-[#EF4444]">*</span></label>
              <input name="title" required placeholder="e.g. Practice loops exercise" className={cls} />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-[#64748B]">Type</label>
                <select name="type" className={selectCls}>
                  <option value="homework">Homework</option>
                  <option value="classwork">Classwork</option>
                  <option value="project">Project</option>
                  <option value="challenge">Challenge</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-[#64748B]">Submission</label>
                <select name="submission_type" className={selectCls}>
                  <option value="text">Text</option>
                  <option value="drive_link">Google Drive</option>
                  <option value="github_link">GitHub</option>
                  <option value="url">Project URL</option>
                  <option value="video_link">Video Link</option>
                  <option value="image">Image Upload</option>
                  <option value="multiple">Multiple (any)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-[#64748B]">Description</label>
              <textarea name="description" rows={2} placeholder="What students should do…" className={cls} />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-[#64748B]">Instructions (optional)</label>
              <textarea name="instructions" rows={2} placeholder="Step-by-step guidance…" className={cls} />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-[#64748B]">Due date</label>
                <input name="due_at" type="date" className={cls} />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-[#64748B]">Max score</label>
                <input name="max_score" type="number" min={1} max={10000} defaultValue={100} className={cls} />
              </div>
            </div>

            <div className="flex flex-wrap gap-4 text-xs">
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input type="checkbox" name="allow_late" value="true" defaultChecked className="accent-[#FF8A1F]" />
                <span className="text-[#64748B]">Allow late submissions</span>
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input type="checkbox" name="resubmission_allowed" value="on" defaultChecked className="accent-[#FF8A1F]" />
                <span className="text-[#64748B]">Allow resubmission</span>
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input type="checkbox" name="portfolio_eligible" value="on" className="accent-[#FF8A1F]" />
                <span className="text-[#64748B]">Portfolio eligible</span>
              </label>
            </div>

            <div className="flex gap-2">
              <button type="submit"
                className="min-h-11 flex-1 rounded-lg bg-[#C2410C] py-2 text-sm font-medium text-white hover:bg-[#9A3412] transition">
                {reviewMode ? 'Submit homework for review' : 'Create & publish'}
              </button>
              <button type="button" onClick={() => setHwOpen(false)}
                className="min-h-11 rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm text-[#64748B] hover:bg-[#F8FAFC] transition">
                Cancel
              </button>
            </div>
          </form>
        )}
      </SectionCard>

      {/* ── Resources ─────────────────────────────────────────────────────────── */}
      <SectionCard hidden={activeSection !== 'content'} title={`Resources ${resources.length > 0 ? `(${resources.length})` : ''}`} defaultOpen={resources.length > 0}>
        {resources.length > 0 && (
          <div className="mb-3 space-y-1.5">
            {resources.map((r, i) => (
              <div key={i} className="min-h-11 flex items-center gap-2 rounded-lg border border-[#E2E8F0] px-3 py-2">
                <a href={r.url} target="_blank" rel="noopener noreferrer"
                  className="min-w-0 flex-1 truncate text-sm text-[#3B82F6] hover:underline">{r.title}</a>
                <button type="button" onClick={() => handleRemoveResource(i)}
                  className="shrink-0 text-xs text-[#F87171] hover:text-[#EF4444] transition">✕</button>
              </div>
            ))}
          </div>
        )}

        {resError && <WorkflowNotice tone="error">{resError}</WorkflowNotice>}
        {resState?.success && <WorkflowNotice tone="success">{reviewMode ? 'Resources sent to the lead for review.' : 'Resources saved.'}</WorkflowNotice>}
        {resState && !resState.success && <WorkflowNotice tone="error" action={<button type="button" disabled={operationPending} className="min-h-11 font-semibold underline" onClick={() => startTransition(() => { const fd = new FormData(); fd.set('session_id', session.id); fd.set('group_id', groupId); fd.set('resources_json', JSON.stringify(resources)); resAction(fd) })}>Retry saving resources</button>}>{resState.error.message}</WorkflowNotice>}

        <div className="space-y-2">
          <input value={newResUrl} onChange={(e) => setNewResUrl(e.target.value)}
            placeholder="URL (slides, drive folder, reference…)" type="url" className={cls} />
          <input value={newResTitle} onChange={(e) => setNewResTitle(e.target.value)}
            placeholder="Label (optional)" className={cls} />
          <button type="button" onClick={handleAddResource} disabled={operationPending}
            className="min-h-11 rounded-lg border border-[#E2E8F0] px-3 py-1.5 text-sm font-medium text-[#0B1F3A] hover:border-[#C2410C] hover:text-[#9A3412] disabled:opacity-60 transition">
            {reviewMode ? 'Propose resource' : 'Add resource'}
          </button>
        </div>
      </SectionCard>

      {/* ── Recording ─────────────────────────────────────────────────────────── */}
      <SectionCard hidden={activeSection !== 'content'} title={`Recordings ${session.recordings.length > 0 ? `(${session.recordings.length})` : ''}`} defaultOpen={session.recordings.length > 0}>
        {session.recordings.length > 0 && (
          <div className="mb-3 space-y-1.5">
            {session.recordings.map((rec) => (
              <div key={rec.id} className="min-h-11 flex items-center gap-2 rounded-lg border border-[#E2E8F0] px-3 py-2">
                <a href={rec.external_url} target="_blank" rel="noopener noreferrer"
                  className="min-w-0 flex-1 truncate text-sm text-[#3B82F6] hover:underline">
                  {rec.title || PROVIDER_LABELS[rec.provider] || 'Recording'}
                </a>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="text-[11px] text-(--muted)">{PROVIDER_LABELS[rec.provider]}</span>
                  {rec.visible_to_students && (
                    <span className="rounded-full bg-[#EFF6FF] px-1.5 py-0.5 text-[11px] font-medium text-[#2563EB]">Students</span>
                  )}
                  <button type="button"
                    aria-label={`Remove ${rec.title || 'recording'}`}
                    onClick={() => startTransition(async () => {
                      setRecordingFeedback(null)
                      try {
                        const result = await removeSessionRecording(rec.id, session.id, groupId)
                        setRecordingFeedback({ success: result.success, message: result.success ? reviewMode ? 'Removal sent to the lead for review.' : 'Recording removed from this class.' : instructorError(result.error, 'remove the recording') })
                      } catch { setRecordingFeedback({ success: false, message: instructorError(null, 'remove the recording') }) }
                    })}
                    className="text-xs text-[#F87171] hover:text-[#EF4444] transition">✕</button>
                </div>
              </div>
            ))}
          </div>
        )}

        {recordingFeedback && <WorkflowNotice tone={recordingFeedback.success ? 'success' : 'error'}>{recordingFeedback.message}</WorkflowNotice>}
        {recState && !recState.success && (
          <WorkflowNotice tone="error">{recState.error.message}</WorkflowNotice>
        )}
        {recState?.success && (
          <WorkflowNotice tone="success">{reviewMode ? 'Recording sent to the lead for review.' : 'Recording added.'}</WorkflowNotice>
        )}

        <form onSubmit={event => { event.preventDefault(); if (operationPending) return; const fd = new FormData(event.currentTarget); startTransition(() => recAction(fd)) }} className="space-y-2">
          <input type="hidden" name="session_id" value={session.id} />
          <input type="hidden" name="group_id"   value={groupId} />
          <input name="external_url" type="url" required
            placeholder="Recording URL (Drive, YouTube, Zoom, Loom…)" className={cls} />
          <input name="title" placeholder="Label (optional)" className={cls} />
          <button type="submit"
            className="min-h-11 rounded-lg border border-[#E2E8F0] px-3 py-1.5 text-sm font-medium text-[#0B1F3A] hover:border-[#C2410C] hover:text-[#9A3412] transition">
            {reviewMode ? 'Propose recording' : 'Add recording'}
          </button>
        </form>
      </SectionCard>

      {/* ── Session Actions ───────────────────────────────────────────────────── */}
      {!isTerminal && !reviewMode && !readOnly && activeSection === 'attendance' && (
        <SectionCard title="Session Actions">
          {/* Postpone */}
          {!showCancelForm && (
            <div>
              {!showPostponeForm ? (
                <button type="button" onClick={() => setShowPostponeForm(true)}
                  className="min-h-11 w-full rounded-lg border border-[#E2E8F0] py-2 text-sm text-[#64748B] hover:border-yellow-400 hover:text-yellow-700 transition">
                  Postpone Session
                </button>
              ) : (
                <form action={postponeAction} className="space-y-3">
                  <input type="hidden" name="session_id" value={session.id} />
                  <input type="hidden" name="group_id"   value={groupId} />

                  {postponeState && !postponeState.success && (
                    <WorkflowNotice tone="error">{postponeState.error.message}</WorkflowNotice>
                  )}

                  <div>
                    <label className="mb-1 block text-sm font-medium text-[#64748B]">New date (optional)</label>
                    <input name="new_date" type="datetime-local" className={cls} />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-[#64748B]">Reason (optional)</label>
                    <input name="reason" placeholder="Why is this being postponed?" className={cls} />
                  </div>
                  <div className="flex gap-2">
                    <button type="submit"
                      className="min-h-11 flex-1 rounded-lg bg-yellow-500 py-2 text-sm font-medium text-white hover:bg-yellow-600 transition">
                      Confirm Postpone
                    </button>
                    <button type="button" onClick={() => setShowPostponeForm(false)}
                      className="rounded-lg border border-[#E2E8F0] px-3 text-sm text-[#64748B] hover:bg-[#F8FAFC] transition">
                      Cancel
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

          {/* Cancel */}
          {!showPostponeForm && (
            <div className="mt-2">
              {!showCancelForm ? (
                <button type="button" onClick={() => setShowCancelForm(true)}
                  className="min-h-11 w-full rounded-lg border border-[#FECACA] py-2 text-sm text-[#EF4444] hover:bg-[#FEE2E2] transition">
                  Cancel Session
                </button>
              ) : (
                <form action={cancelAction} className="space-y-3 rounded-xl border border-[#FECACA] bg-[#FEE2E2] p-4">
                  <p className="text-sm font-semibold text-[#991B1B]">Cancel this session?</p>
                  <input type="hidden" name="session_id" value={session.id} />
                  <input type="hidden" name="group_id"   value={groupId} />

                  {cancelState && !cancelState.success && (
                    <WorkflowNotice tone="error">{cancelState.error.message}</WorkflowNotice>
                  )}

                  <div>
                    <label className="mb-1 block text-sm font-medium text-[#991B1B]">Reason <span className="text-[#EF4444]">*</span></label>
                    <textarea name="reason" required rows={2}
                      placeholder="Why is this session being cancelled?"
                      className="min-h-11 w-full rounded-lg border border-[#FECACA] bg-white px-3 py-2 text-sm outline-none focus:border-[#F87171] focus:ring-2 focus:ring-[#FECACA]" />
                  </div>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" name="create_makeup" value="true"
                      checked={createMakeup} onChange={(e) => setCreateMakeup(e.target.checked)}
                      className="accent-[#FF8A1F]" />
                    <span className="text-xs text-[#991B1B]">Schedule makeup session</span>
                  </label>

                  {createMakeup && (
                    <div>
                      <label className="mb-1 block text-sm font-medium text-[#991B1B]">Makeup date</label>
                      <input name="makeup_date" type="datetime-local"
                        className="min-h-11 w-full rounded-lg border border-[#FECACA] bg-white px-3 py-2 text-sm outline-none focus:border-[#F87171]" />
                      <p className="mt-0.5 text-[11px] text-[#EF4444]">Defaults to +7 days if left empty.</p>
                    </div>
                  )}

                  <div className="flex gap-2">
                    <button type="submit"
                      className="min-h-11 flex-1 rounded-lg bg-[#DC2626] py-2 text-sm font-medium text-white hover:bg-[#B91C1C] transition">
                      {createMakeup ? 'Cancel & Schedule Makeup' : 'Confirm Cancellation'}
                    </button>
                    <button type="button" onClick={() => setShowCancelForm(false)}
                      className="rounded-lg border border-[#FECACA] bg-white px-3 text-sm text-[#EF4444] hover:bg-[#FEE2E2] transition">
                      Back
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}
        </SectionCard>
      )}

      {/* ── Terminal state banners ────────────────────────────────────────────── */}
      {session.status === 'completed' && (
        <div className="rounded-lg bg-[#E7F8EE] px-4 py-3 text-center text-sm font-medium text-[#15803D]">
          ✓ Session completed
        </div>
      )}
    </fieldset>
  )
}
