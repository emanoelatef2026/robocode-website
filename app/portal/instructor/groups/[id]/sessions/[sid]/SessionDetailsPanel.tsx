'use client'

import { useActionState, useState, useTransition } from 'react'
import {
  updateSession,
  addSessionRecording,
  removeSessionRecording,
  updateSessionResources,
  createSessionHomework,
  endSession,
} from '@/modules/instructor-portal/actions'
import type {
  SessionDetail,
  SessionRecording,
  ResourceLink,
  CourseModuleItem,
} from '@/modules/instructor-portal/types'
import type { ActionResult } from '@/types/app'

interface Props {
  session:  SessionDetail
  groupId:  string
}

// ── Detect recording label ────────────────────────────────────────────────────
const PROVIDER_LABELS: Record<string, string> = {
  google_drive: 'Google Drive',
  youtube:      'YouTube',
  vimeo:        'Vimeo',
  zoom:         'Zoom',
  other:        'Link',
}

export default function SessionDetailsPanel({ session, groupId }: Props) {
  const [isPending, startTransition] = useTransition()

  // ── Session details (topic / notes) ─────────────────────────────────────
  const [detailState, detailAction] = useActionState<ActionResult<void> | null, FormData>(updateSession, null)

  // ── Add recording ────────────────────────────────────────────────────────
  const [recState, recAction] = useActionState<ActionResult<{ id: string }> | null, FormData>(addSessionRecording, null)

  // ── Resources ─────────────────────────────────────────────────────────────
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

  // ── Homework ───────────────────────────────────────────────────────────────
  const [hwState, hwAction] = useActionState<ActionResult<{ assignmentId: string }> | null, FormData>(createSessionHomework, null)
  const defaultModule = session.course_modules[0]

  // ── End Session ────────────────────────────────────────────────────────────
  const [endError, setEndError] = useState<string | null>(null)
  const [isPendingEnd, startEndTransition] = useTransition()

  const handleEnd = (force = false) => {
    setEndError(null)
    startEndTransition(async () => {
      const res = await endSession(session.id, groupId, force)
      if (!res.success) {
        setEndError(res.error.message)
      }
      // On success revalidatePath in action triggers page refresh
    })
  }

  const cls = 'w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm text-[#0B1F3A] outline-none focus:border-[#FF8A1F] focus:ring-2 focus:ring-[#FF8A1F]/15'

  const markedCount = session.attendance.filter((r) => r.status !== null).length
  const allMarked   = markedCount === session.student_count

  return (
    <div className="space-y-5">
      {/* ── Topic & Notes ──────────────────────────────────────────────── */}
      <div className="rounded-xl border border-[#E2E8F0] bg-white p-5">
        <h3 className="mb-3 text-sm font-semibold text-[#0B1F3A]">Session Details</h3>

        {detailState && !detailState.success && (
          <div className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{detailState.error.message}</div>
        )}
        {detailState?.success && (
          <div className="mb-3 rounded-lg bg-green-50 px-3 py-2 text-xs text-green-700">Saved.</div>
        )}

        <form action={detailAction} className="space-y-3">
          <input type="hidden" name="session_id"       value={session.id} />
          <input type="hidden" name="group_id"          value={groupId} />
          <input type="hidden" name="status"            value={session.status} />

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
            Save
          </button>
        </form>
      </div>

      {/* ── Recording Link ─────────────────────────────────────────────── */}
      <div className="rounded-xl border border-[#E2E8F0] bg-white p-5">
        <h3 className="mb-3 text-sm font-semibold text-[#0B1F3A]">Recording</h3>

        {/* Existing recordings */}
        {session.recordings.length > 0 && (
          <div className="mb-3 space-y-1.5">
            {session.recordings.map((rec) => (
              <div key={rec.id} className="flex items-center gap-2 rounded-lg border border-[#E2E8F0] px-3 py-2">
                <a href={rec.external_url} target="_blank" rel="noopener noreferrer"
                  className="min-w-0 flex-1 truncate text-sm text-[#3B82F6] hover:underline">
                  {rec.title || PROVIDER_LABELS[rec.provider] || 'Recording'}
                </a>
                <span className="shrink-0 text-[10px] text-[#94A3B8]">{PROVIDER_LABELS[rec.provider]}</span>
                <button type="button"
                  onClick={() => startTransition(async () => {
                    await removeSessionRecording(rec.id, session.id, groupId)
                  })}
                  className="shrink-0 text-xs text-red-400 hover:text-red-600">✕</button>
              </div>
            ))}
          </div>
        )}

        {recState && !recState.success && (
          <div className="mb-2 text-xs text-red-600">{recState.error.message}</div>
        )}
        {recState?.success && (
          <div className="mb-2 text-xs text-green-600">Recording added.</div>
        )}

        <form action={recAction} className="space-y-2">
          <input type="hidden" name="session_id" value={session.id} />
          <input type="hidden" name="group_id"   value={groupId} />
          <input name="external_url" type="url" required placeholder="Recording URL (Drive, YouTube, Zoom…)" className={cls} />
          <input name="title" placeholder="Label (optional)" className={cls} />
          <button type="submit" className="rounded-lg border border-[#E2E8F0] px-3 py-1.5 text-sm font-medium text-[#0B1F3A] hover:border-[#FF8A1F] hover:text-[#FF8A1F] transition">
            Add Recording
          </button>
        </form>
      </div>

      {/* ── Resources ──────────────────────────────────────────────────── */}
      <div className="rounded-xl border border-[#E2E8F0] bg-white p-5">
        <h3 className="mb-3 text-sm font-semibold text-[#0B1F3A]">Resources</h3>

        {resources.length > 0 && (
          <div className="mb-3 space-y-1.5">
            {resources.map((r, i) => (
              <div key={i} className="flex items-center gap-2 rounded-lg border border-[#E2E8F0] px-3 py-2">
                <a href={r.url} target="_blank" rel="noopener noreferrer"
                  className="min-w-0 flex-1 truncate text-sm text-[#3B82F6] hover:underline">{r.title}</a>
                <button type="button" onClick={() => handleRemoveResource(i)}
                  className="shrink-0 text-xs text-red-400 hover:text-red-600">✕</button>
              </div>
            ))}
          </div>
        )}

        {resError && <p className="mb-2 text-xs text-red-600">{resError}</p>}

        <div className="space-y-2">
          <input value={newResUrl} onChange={(e) => setNewResUrl(e.target.value)}
            placeholder="URL (slides, drive folder, reference…)" type="url" className={cls} />
          <input value={newResTitle} onChange={(e) => setNewResTitle(e.target.value)}
            placeholder="Label (optional)" className={cls} />
          <button type="button" onClick={handleAddResource}
            className="rounded-lg border border-[#E2E8F0] px-3 py-1.5 text-sm font-medium text-[#0B1F3A] hover:border-[#FF8A1F] hover:text-[#FF8A1F] transition">
            Add Resource
          </button>
        </div>
      </div>

      {/* ── Quick Homework ─────────────────────────────────────────────── */}
      {session.course_modules.length > 0 && (
        <div className="rounded-xl border border-[#E2E8F0] bg-white p-5">
          <h3 className="mb-3 text-sm font-semibold text-[#0B1F3A]">Create Homework</h3>
          {/* module_id field is the course semester (course_modules row) */}

          {hwState && !hwState.success && (
            <div className="mb-3 text-xs text-red-600">{hwState.error.message}</div>
          )}
          {hwState?.success && (
            <div className="mb-3 text-xs text-green-600">Homework created and published.</div>
          )}

          <form action={hwAction} className="space-y-3">
            <input type="hidden" name="session_id" value={session.id} />
            <input type="hidden" name="group_id"   value={groupId} />
            <input type="hidden" name="module_id"  value={defaultModule?.id ?? ''} />

            <div>
              <label className="mb-1 block text-xs font-medium text-[#64748B]">Title</label>
              <input name="title" required placeholder="e.g. Practice loops exercise" className={cls} />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-[#64748B]">Description (optional)</label>
              <textarea name="description" rows={2} placeholder="Instructions…" className={cls} />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-[#64748B]">Due date (optional)</label>
              <input name="due_at" type="date" className={cls} />
            </div>

            {session.course_modules.length > 1 && (
              <div>
                <label className="mb-1 block text-xs font-medium text-[#64748B]">Course Semester</label>
                <select name="module_id" defaultValue={defaultModule?.id} className={cls}>
                  {session.course_modules.map((m) => (
                    <option key={m.id} value={m.id}>{m.title}</option>
                  ))}
                </select>
              </div>
            )}

            <button type="submit"
              className="rounded-lg bg-[#FF8A1F] px-4 py-2 text-sm font-medium text-white hover:bg-[#e07818] transition">
              Create &amp; Publish Homework
            </button>
          </form>
        </div>
      )}

      {/* ── End Session ────────────────────────────────────────────────── */}
      {session.status !== 'completed' && session.status !== 'cancelled' && (
        <div className="rounded-xl border border-[#E2E8F0] bg-white p-5">
          <h3 className="mb-3 text-sm font-semibold text-[#0B1F3A]">End Session</h3>

          {/* Validation checklist */}
          <div className="mb-4 space-y-1.5">
            <div className={`flex items-center gap-2 text-xs ${allMarked ? 'text-emerald-600' : 'text-[#64748B]'}`}>
              <span className={`flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold ${allMarked ? 'bg-emerald-100' : 'bg-[#F1F5F9]'}`}>
                {allMarked ? '✓' : '○'}
              </span>
              Attendance — {markedCount}/{session.student_count} marked
            </div>
            <div className={`flex items-center gap-2 text-xs ${(session.topic || session.notes) ? 'text-emerald-600' : 'text-[#64748B]'}`}>
              <span className={`flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold ${(session.topic || session.notes) ? 'bg-emerald-100' : 'bg-[#F1F5F9]'}`}>
                {(session.topic || session.notes) ? '✓' : '○'}
              </span>
              Session notes — {(session.topic || session.notes) ? 'added' : 'required'}
            </div>
          </div>

          {endError && (
            <div className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
              {endError}
            </div>
          )}

          <button
            type="button"
            onClick={() => handleEnd(false)}
            disabled={isPendingEnd}
            className="w-full rounded-lg bg-emerald-600 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60 transition"
          >
            {isPendingEnd ? 'Ending…' : 'End Session'}
          </button>

          {/* Force-end option shown only after a validation failure */}
          {endError && (
            <button
              type="button"
              onClick={() => handleEnd(true)}
              disabled={isPendingEnd}
              className="mt-2 w-full rounded-lg border border-[#E2E8F0] py-2 text-xs font-medium text-[#64748B] hover:border-amber-300 hover:text-amber-700 disabled:opacity-60 transition"
            >
              End anyway (skip validation)
            </button>
          )}
        </div>
      )}
      {session.status === 'completed' && (
        <div className="rounded-lg bg-emerald-50 px-4 py-3 text-center text-sm font-medium text-emerald-700">
          ✓ Session completed
        </div>
      )}
    </div>
  )
}
