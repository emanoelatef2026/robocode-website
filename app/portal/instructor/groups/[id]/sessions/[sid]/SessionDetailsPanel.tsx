'use client'

import { useActionState, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  updateSession,
  addSessionRecording,
  removeSessionRecording,
  updateSessionResources,
  createSessionHomework,
  endSession,
  cancelSession,
  postponeSession,
} from '@/modules/instructor-portal/actions'
import type {
  SessionDetail,
  SessionRecording,
  ResourceLink,
  CourseModuleItem,
} from '@/modules/instructor-portal/types'
import type { ActionResult } from '@/types/app'

interface Props {
  session: SessionDetail
  groupId: string
}

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
function SectionCard({ title, children, defaultOpen = true }: {
  title: string
  children: React.ReactNode
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="ds-card overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between px-5 py-3.5 text-left"
      >
        <span className="text-sm font-semibold text-[#0B1F3A]">{title}</span>
        <span className={`text-xs text-[#94A3B8] transition-transform ${open ? 'rotate-180' : ''}`}>▾</span>
      </button>
      {open && <div className="border-t border-[#F1F5F9] px-5 py-4">{children}</div>}
    </div>
  )
}

export default function SessionDetailsPanel({ session, groupId }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const cls = 'w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm text-[#0B1F3A] outline-none focus:border-[#FF8A1F] focus:ring-2 focus:ring-[#FF8A1F]/15'
  const selectCls = `${cls} bg-white`

  const isCancelled = session.status === 'cancelled' || session.status === 'cancelled_with_makeup'
  const isPostponed = session.status === 'postponed'
  const isTerminal  = session.status === 'completed' || isCancelled

  const markedCount = session.attendance.filter((r) => r.status !== null).length
  const allMarked   = markedCount === session.student_count

  // ── Session details (topic / notes) ──────────────────────────────────────────
  const [detailState, detailAction] = useActionState<ActionResult<void> | null, FormData>(updateSession, null)

  // ── Add recording ─────────────────────────────────────────────────────────────
  const [recState, recAction] = useActionState<ActionResult<{ id: string }> | null, FormData>(addSessionRecording, null)

  // ── Resources ─────────────────────────────────────────────────────────────────
  const [resources, setResources] = useState<ResourceLink[]>(session.resources_links)
  const [newResTitle, setNewResTitle] = useState('')
  const [newResUrl,   setNewResUrl]   = useState('')
  const [resError,    setResError]    = useState<string | null>(null)
  const [resState, resAction] = useActionState<ActionResult<void> | null, FormData>(updateSessionResources, null)

  const handleAddResource = () => {
    if (!newResUrl.trim()) { setResError('URL is required.'); return }
    try { new URL(newResUrl.trim()) } catch { setResError('Enter a valid URL.'); return }
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
  const [hwState, hwAction] = useActionState<ActionResult<{ assignmentId: string }> | null, FormData>(createSessionHomework, null)
  const [hwOpen, setHwOpen] = useState(false)
  const defaultModule = session.course_modules[0]

  // ── End Session ───────────────────────────────────────────────────────────────
  const [endError, setEndError] = useState<string | null>(null)
  const [isPendingEnd, startEndTransition] = useTransition()

  const handleEnd = (force = false) => {
    setEndError(null)
    startEndTransition(async () => {
      const res = await endSession(session.id, groupId, force)
      if (!res.success) { setEndError(res.error.message); return }
      router.push('/portal/instructor/history')
    })
  }

  // ── Cancel Session ────────────────────────────────────────────────────────────
  const [showCancelForm,  setShowCancelForm]  = useState(false)
  const [cancelState, cancelAction] = useActionState<ActionResult<{ makeupSessionId?: string }> | null, FormData>(cancelSession, null)
  const [createMakeup, setCreateMakeup] = useState(false)

  // ── Postpone Session ──────────────────────────────────────────────────────────
  const [showPostponeForm, setShowPostponeForm] = useState(false)
  const [postponeState, postponeAction] = useActionState<ActionResult<void> | null, FormData>(postponeSession, null)

  return (
    <div className="space-y-4">

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
      <SectionCard title="Session Details">
        {detailState && !detailState.success && (
          <div className="mb-3 rounded-lg bg-[#FEE2E2] px-3 py-2 text-xs text-[#DC2626]">{detailState.error.message}</div>
        )}
        {detailState?.success && (
          <div className="mb-3 rounded-lg bg-[#E7F8EE] px-3 py-2 text-xs text-[#15803D]">Saved.</div>
        )}

        <form action={detailAction} className="space-y-3">
          <input type="hidden" name="session_id" value={session.id} />
          <input type="hidden" name="group_id"   value={groupId} />
          <input type="hidden" name="status"     value={session.status} />

          <div>
            <label className="mb-1 block text-xs font-medium text-[#64748B]">Topic</label>
            <input name="topic" defaultValue={session.topic ?? ''} placeholder="e.g. Introduction to Loops" className={cls} />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-[#64748B]">
              Session Notes
              <span className="ml-1 font-normal text-[#94A3B8]">(visible to team leaders)</span>
            </label>
            <textarea name="notes" rows={3} defaultValue={session.notes ?? ''} placeholder="Observations about this session…" className={cls} />
          </div>

          <button type="submit" disabled={isPending}
            className="rounded-lg bg-[#FF8A1F] px-4 py-2 text-sm font-medium text-white hover:bg-[#e07818] disabled:opacity-60 transition">
            Save Details
          </button>
        </form>
      </SectionCard>

      {/* ── Homework ─────────────────────────────────────────────────────────── */}
      <SectionCard title={`Homework ${session.session_homework.length > 0 ? `(${session.session_homework.length})` : ''}`}>
        {/* Existing homework list */}
        {session.session_homework.length > 0 && (
          <div className="mb-4 space-y-2">
            {session.session_homework.map((hw) => (
              <div key={hw.id} className="flex items-start gap-2 rounded-lg border border-[#E2E8F0] px-3 py-2.5">
                <div className="flex-1 min-w-0">
                  <p className="truncate text-sm font-medium text-[#0B1F3A]">{hw.title}</p>
                  <p className="mt-0.5 text-xs text-[#94A3B8] capitalize">
                    {hw.type} · {hw.submission_type.replace('_', ' ')}
                    {hw.due_at && ` · Due ${new Date(hw.due_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`}
                  </p>
                </div>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${hw.status === 'published' ? 'bg-[#E7F8EE] text-[#15803D]' : 'bg-yellow-100 text-yellow-700'}`}>
                  {hw.status}
                </span>
              </div>
            ))}
          </div>
        )}

        {hwState && !hwState.success && (
          <div className="mb-3 rounded-lg bg-[#FEE2E2] px-3 py-2 text-xs text-[#EF4444]">{hwState.error.message}</div>
        )}
        {hwState?.success && (
          <div className="mb-3 rounded-lg bg-[#E7F8EE] px-3 py-2 text-xs text-[#10B981]">Homework created and published.</div>
        )}

        {!hwOpen ? (
          <button type="button" onClick={() => setHwOpen(true)}
            className="w-full rounded-lg border border-dashed border-[#E2E8F0] py-2 text-sm text-[#64748B] hover:border-[#FF8A1F] hover:text-[#FF8A1F] transition">
            + Create Homework
          </button>
        ) : (
          <form action={hwAction} className="space-y-3">
            <input type="hidden" name="session_id" value={session.id} />
            <input type="hidden" name="group_id"   value={groupId} />
            {defaultModule && (
              <input type="hidden" name="module_id" value={defaultModule.id} />
            )}

            <div>
              <label className="mb-1 block text-xs font-medium text-[#64748B]">Title <span className="text-[#EF4444]">*</span></label>
              <input name="title" required placeholder="e.g. Practice loops exercise" className={cls} />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-[#64748B]">Type</label>
                <select name="type" className={selectCls}>
                  <option value="homework">Homework</option>
                  <option value="classwork">Classwork</option>
                  <option value="project">Project</option>
                  <option value="challenge">Challenge</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-[#64748B]">Submission</label>
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
              <label className="mb-1 block text-xs font-medium text-[#64748B]">Description</label>
              <textarea name="description" rows={2} placeholder="What students should do…" className={cls} />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-[#64748B]">Instructions (optional)</label>
              <textarea name="instructions" rows={2} placeholder="Step-by-step guidance…" className={cls} />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-[#64748B]">Due date</label>
                <input name="due_at" type="date" className={cls} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-[#64748B]">Max score</label>
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
                className="flex-1 rounded-lg bg-[#FF8A1F] py-2 text-sm font-medium text-white hover:bg-[#e07818] transition">
                Create &amp; Publish
              </button>
              <button type="button" onClick={() => setHwOpen(false)}
                className="rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm text-[#64748B] hover:bg-[#F8FAFC] transition">
                Cancel
              </button>
            </div>
          </form>
        )}
      </SectionCard>

      {/* ── Resources ─────────────────────────────────────────────────────────── */}
      <SectionCard title={`Resources ${resources.length > 0 ? `(${resources.length})` : ''}`} defaultOpen={resources.length > 0}>
        {resources.length > 0 && (
          <div className="mb-3 space-y-1.5">
            {resources.map((r, i) => (
              <div key={i} className="flex items-center gap-2 rounded-lg border border-[#E2E8F0] px-3 py-2">
                <a href={r.url} target="_blank" rel="noopener noreferrer"
                  className="min-w-0 flex-1 truncate text-sm text-[#3B82F6] hover:underline">{r.title}</a>
                <button type="button" onClick={() => handleRemoveResource(i)}
                  className="shrink-0 text-xs text-[#F87171] hover:text-[#EF4444] transition">✕</button>
              </div>
            ))}
          </div>
        )}

        {resError && <p className="mb-2 text-xs text-[#EF4444]">{resError}</p>}
        {resState && !resState.success && <p className="mb-2 text-xs text-[#EF4444]">{resState.error.message}</p>}

        <div className="space-y-2">
          <input value={newResUrl} onChange={(e) => setNewResUrl(e.target.value)}
            placeholder="URL (slides, drive folder, reference…)" type="url" className={cls} />
          <input value={newResTitle} onChange={(e) => setNewResTitle(e.target.value)}
            placeholder="Label (optional)" className={cls} />
          <button type="button" onClick={handleAddResource} disabled={isPending}
            className="rounded-lg border border-[#E2E8F0] px-3 py-1.5 text-sm font-medium text-[#0B1F3A] hover:border-[#FF8A1F] hover:text-[#FF8A1F] disabled:opacity-60 transition">
            Add Resource
          </button>
        </div>
      </SectionCard>

      {/* ── Recording ─────────────────────────────────────────────────────────── */}
      <SectionCard title={`Recordings ${session.recordings.length > 0 ? `(${session.recordings.length})` : ''}`} defaultOpen={session.recordings.length > 0}>
        {session.recordings.length > 0 && (
          <div className="mb-3 space-y-1.5">
            {session.recordings.map((rec) => (
              <div key={rec.id} className="flex items-center gap-2 rounded-lg border border-[#E2E8F0] px-3 py-2">
                <a href={rec.external_url} target="_blank" rel="noopener noreferrer"
                  className="min-w-0 flex-1 truncate text-sm text-[#3B82F6] hover:underline">
                  {rec.title || PROVIDER_LABELS[rec.provider] || 'Recording'}
                </a>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="text-[10px] text-[#94A3B8]">{PROVIDER_LABELS[rec.provider]}</span>
                  {rec.visible_to_students && (
                    <span className="rounded-full bg-[#EFF6FF] px-1.5 py-0.5 text-[9px] font-medium text-[#2563EB]">Students</span>
                  )}
                  <button type="button"
                    onClick={() => startTransition(async () => { await removeSessionRecording(rec.id, session.id, groupId) })}
                    className="text-xs text-[#F87171] hover:text-[#EF4444] transition">✕</button>
                </div>
              </div>
            ))}
          </div>
        )}

        {recState && !recState.success && (
          <p className="mb-2 text-xs text-[#EF4444]">{recState.error.message}</p>
        )}
        {recState?.success && (
          <p className="mb-2 text-xs text-[#10B981]">Recording added.</p>
        )}

        <form action={recAction} className="space-y-2">
          <input type="hidden" name="session_id" value={session.id} />
          <input type="hidden" name="group_id"   value={groupId} />
          <input name="external_url" type="url" required
            placeholder="Recording URL (Drive, YouTube, Zoom, Loom…)" className={cls} />
          <input name="title" placeholder="Label (optional)" className={cls} />
          <button type="submit"
            className="rounded-lg border border-[#E2E8F0] px-3 py-1.5 text-sm font-medium text-[#0B1F3A] hover:border-[#FF8A1F] hover:text-[#FF8A1F] transition">
            Add Recording
          </button>
        </form>
      </SectionCard>

      {/* ── Session Actions ───────────────────────────────────────────────────── */}
      {!isTerminal && (
        <SectionCard title="Session Actions">
          {/* End Session */}
          {session.status !== 'cancelled' && (
            <div className="mb-4">
              <p className="mb-2 text-xs font-medium text-[#64748B]">End session</p>
              <div className="mb-3 space-y-1.5">
                <div className={`flex items-center gap-2 text-xs ${allMarked ? 'text-[#10B981]' : 'text-[#64748B]'}`}>
                  <span className={`flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold ${allMarked ? 'bg-[#E7F8EE]' : 'bg-[#F1F5F9]'}`}>
                    {allMarked ? '✓' : '○'}
                  </span>
                  Attendance — {markedCount}/{session.student_count} marked
                </div>
                <div className={`flex items-center gap-2 text-xs ${(session.topic || session.notes) ? 'text-[#10B981]' : 'text-[#64748B]'}`}>
                  <span className={`flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold ${(session.topic || session.notes) ? 'bg-[#E7F8EE]' : 'bg-[#F1F5F9]'}`}>
                    {(session.topic || session.notes) ? '✓' : '○'}
                  </span>
                  Notes — {(session.topic || session.notes) ? 'added' : 'required'}
                </div>
              </div>

              {endError && (
                <div className="mb-3 rounded-lg bg-[#FFFBEB] px-3 py-2 text-xs text-[#B45309]">{endError}</div>
              )}

              <button type="button" onClick={() => handleEnd(false)} disabled={isPendingEnd}
                className="w-full rounded-lg bg-[#059669] py-2.5 text-sm font-semibold text-white hover:bg-[#047857] disabled:opacity-60 transition">
                {isPendingEnd ? 'Ending…' : 'End Session'}
              </button>
              {endError && (
                <button type="button" onClick={() => handleEnd(true)} disabled={isPendingEnd}
                  className="mt-2 w-full rounded-lg border border-[#E2E8F0] py-2 text-xs font-medium text-[#64748B] hover:border-amber-300 hover:text-[#B45309] disabled:opacity-60 transition">
                  End anyway (skip validation)
                </button>
              )}
            </div>
          )}

          {/* Divider */}
          <div className="my-4 border-t border-[#F1F5F9]" />

          {/* Postpone */}
          {!showCancelForm && (
            <div>
              {!showPostponeForm ? (
                <button type="button" onClick={() => setShowPostponeForm(true)}
                  className="w-full rounded-lg border border-[#E2E8F0] py-2 text-sm text-[#64748B] hover:border-yellow-400 hover:text-yellow-700 transition">
                  Postpone Session
                </button>
              ) : (
                <form action={postponeAction} className="space-y-3">
                  <input type="hidden" name="session_id" value={session.id} />
                  <input type="hidden" name="group_id"   value={groupId} />

                  {postponeState && !postponeState.success && (
                    <p className="text-xs text-[#EF4444]">{postponeState.error.message}</p>
                  )}

                  <div>
                    <label className="mb-1 block text-xs font-medium text-[#64748B]">New date (optional)</label>
                    <input name="new_date" type="datetime-local" className={cls} />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-[#64748B]">Reason (optional)</label>
                    <input name="reason" placeholder="Why is this being postponed?" className={cls} />
                  </div>
                  <div className="flex gap-2">
                    <button type="submit"
                      className="flex-1 rounded-lg bg-yellow-500 py-2 text-sm font-medium text-white hover:bg-yellow-600 transition">
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
                  className="w-full rounded-lg border border-[#FECACA] py-2 text-sm text-[#EF4444] hover:bg-[#FEE2E2] transition">
                  Cancel Session
                </button>
              ) : (
                <form action={cancelAction} className="space-y-3 rounded-xl border border-[#FECACA] bg-[#FEE2E2] p-4">
                  <p className="text-sm font-semibold text-[#991B1B]">Cancel this session?</p>
                  <input type="hidden" name="session_id" value={session.id} />
                  <input type="hidden" name="group_id"   value={groupId} />

                  {cancelState && !cancelState.success && (
                    <p className="text-xs text-[#DC2626]">{cancelState.error.message}</p>
                  )}

                  <div>
                    <label className="mb-1 block text-xs font-medium text-[#991B1B]">Reason <span className="text-[#EF4444]">*</span></label>
                    <textarea name="reason" required rows={2}
                      placeholder="Why is this session being cancelled?"
                      className="w-full rounded-lg border border-[#FECACA] bg-white px-3 py-2 text-sm outline-none focus:border-[#F87171] focus:ring-2 focus:ring-[#FECACA]" />
                  </div>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" name="create_makeup" value="true"
                      checked={createMakeup} onChange={(e) => setCreateMakeup(e.target.checked)}
                      className="accent-[#FF8A1F]" />
                    <span className="text-xs text-[#991B1B]">Schedule makeup session</span>
                  </label>

                  {createMakeup && (
                    <div>
                      <label className="mb-1 block text-xs font-medium text-[#991B1B]">Makeup date</label>
                      <input name="makeup_date" type="datetime-local"
                        className="w-full rounded-lg border border-[#FECACA] bg-white px-3 py-2 text-sm outline-none focus:border-[#F87171]" />
                      <p className="mt-0.5 text-[10px] text-[#EF4444]">Defaults to +7 days if left empty.</p>
                    </div>
                  )}

                  <div className="flex gap-2">
                    <button type="submit"
                      className="flex-1 rounded-lg bg-[#DC2626] py-2 text-sm font-medium text-white hover:bg-[#B91C1C] transition">
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
    </div>
  )
}
