'use client'

import { useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { openSharedSession } from '@/modules/instructor-portal/shared-actions'
import type { SharedSessionItem } from '@/modules/instructor-portal/shared-queries'
import SessionParticipation from '@/components/portal/instructor/SessionParticipation'
import WorkflowNotice from '@/components/portal/instructor/WorkflowNotice'
import SessionIcon from './sessions/[sid]/SessionIcon'
import { instructorError } from '@/modules/instructor-portal/ux'

export default function SharedSessionHub({ groupId, courseId, sessions, workflowReady = true }: { groupId: string; courseId: string; sessions: SharedSessionItem[]; workflowReady?: boolean }) {
  const router = useRouter()
  const lock = useRef(false)
  const [topic, setTopic] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [role, setRole] = useState<'lead' | 'assistant'>('lead')
  const currentCourse = sessions.filter(s => s.group_course_id === courseId)
  const ongoing = currentCourse.find(s => s.status === 'ongoing')
  const next = currentCourse.filter(s => s.status === 'scheduled').sort((a, b) => (a.session_number ?? Infinity) - (b.session_number ?? Infinity) || a.scheduled_at.localeCompare(b.scheduled_at))[0]
  const previous = currentCourse.filter(s => s.status === 'completed').sort((a, b) => (b.ended_at ?? '').localeCompare(a.ended_at ?? '') || b.id.localeCompare(a.id))[0]
  const past = sessions.filter(s => s.status === 'completed')
  async function resumeLegacy() {
    if (!workflowReady || !ongoing || ongoing.leadInstructorId !== null || lock.current) return
    lock.current = true; setBusy(true); setError('')
    try {
      const result = await openSharedSession(courseId, ongoing.id, null, ongoing.topic?.trim() || 'Legacy class', 'lead')
      if (!result.success) setError(instructorError(result.error, 'resume this class'))
      else { router.push(`/portal/instructor/groups/${result.data.groupId}/sessions/${result.data.sessionId}`); router.refresh() }
    } catch { setError(instructorError(null, 'resume this class')) }
    finally { lock.current = false; setBusy(false) }
  }
  async function start() {
    if (!workflowReady || lock.current || !topic.trim() || topic.trim().toLowerCase() === 'no topic') return
    if (role === 'assistant') return
    lock.current = true; setBusy(true); setError('')
    try {
      const result = await openSharedSession(courseId, next?.id ?? null, previous?.id ?? null, topic, 'lead')
      if (!result.success) setError(instructorError(result.error, 'start this class'))
      else router.push(`/portal/instructor/groups/${result.data.groupId}/sessions/${result.data.sessionId}`)
    } catch { setError(instructorError(null, 'start this class')) }
    finally { lock.current = false; setBusy(false) }
  }
  return <section className="space-y-4" aria-label="Group sessions">
    {!workflowReady && <p role="status" className="rounded-lg border border-(--border) bg-(--amber-soft) p-3 text-sm font-semibold text-(--amber-dark)">Session workflow update is pending. You can view classes and attendance; starting classes and requesting participation will be available after the database update.</p>}
    <p className="rounded-lg border border-(--border) bg-(--bg-card) p-3 text-sm font-semibold">Your teaching participation: {sessions.filter(s=>s.myState==='confirmed'||s.myState==='requested').length} classes · {sessions.filter(s=>s.myState==='confirmed').length} approved · <span className="text-(--amber-dark)">{sessions.filter(s=>s.myState==='requested').length} awaiting administration approval</span></p>
    <div className="ds-card space-y-3 p-4">
      <h2 className="flex items-center gap-2 text-lg font-bold text-(--navy)"><SessionIcon name={ongoing ? 'play' : 'late'} />{ongoing ? `Session ${ongoing.session_number ?? ''} is in progress` : next ? `Next: session ${next.session_number ?? ''}` : 'Start a new class'}</h2>
      <p className="text-sm font-medium text-(--text-2)">{ongoing ? ongoing.topic : next ? new Date(next.scheduled_at).toLocaleString('en-GB', { timeZone: 'Africa/Cairo' }) : 'Check previous classes below before creating another class.'}</p>
      {ongoing ? <>
        {workflowReady && (ongoing.leadInstructorId === null ? <div className="space-y-2 rounded-lg border border-(--border) bg-(--amber-soft) p-3 text-sm"><p>This class was opened before teaching roles were recorded. If you are teaching it as lead, resume the existing class below. Your lead rate applies; no extra class is created.</p><button type="button" disabled={busy} onClick={() => void resumeLegacy()} className="min-h-11 rounded-lg bg-(--navy) px-4 py-2 font-semibold text-white disabled:opacity-50">{busy ? 'Resuming…' : 'Resume this class as lead'}</button></div> : <SessionParticipation key={`${ongoing.id}-${ongoing.myState}`} session={ongoing} />)}
        <Link className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-(--navy) px-4 py-2 font-semibold text-white" href={`/portal/instructor/groups/${groupId}/sessions/${ongoing.id}`}><SessionIcon name={ongoing.isLead ? 'play' : 'content'} />{ongoing.isLead ? 'Continue my class' : 'View shared class'}</Link>
      </> : workflowReady ? <form className="flex flex-col gap-3" onSubmit={e => { e.preventDefault(); void start() }}>
        <fieldset disabled={busy} className="flex flex-wrap items-center gap-3"><legend className="mb-2 text-sm font-semibold">Your role in this class</legend>{(['lead','assistant'] as const).map(value => <label key={value} className="flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border border-(--border) px-4 text-sm font-semibold"><input type="radio" name="teaching_role" value={value} checked={role === value} onChange={() => setRole(value)} />{value === 'lead' ? 'Lead instructor' : 'Assistant instructor'}</label>)}</fieldset>
        {role === 'assistant' && <div role="alert" className="rounded-lg border border-(--border) bg-(--amber-soft) p-3 text-sm text-(--amber-dark)"><p>A lead instructor must start this class first. Ask them to start it, or start as lead if you are teaching in their place. Your lead rate will apply to this class.</p><button type="button" onClick={() => setRole('lead')} className="mt-2 min-h-11 rounded-lg border border-(--amber-dark) px-3 font-semibold">Teach this class as lead</button></div>}
        <div className="flex flex-col gap-3 sm:flex-row">
        <label className="min-w-0 flex-1 text-sm font-semibold">Session topic<input required maxLength={1000} disabled={busy} value={topic} onChange={e => setTopic(e.target.value)} className="ds-input mt-2 min-h-11 w-full" placeholder="What will students learn?" /></label>
        <button type="submit" disabled={busy || !topic.trim() || topic.trim().toLowerCase() === 'no topic' || role !== 'lead'} className="inline-flex min-h-11 items-center justify-center gap-2 self-end rounded-xl bg-(--orange-strong) px-5 py-3 font-semibold text-white disabled:opacity-50"><SessionIcon name="play" />{busy ? 'Starting…' : next ? 'Start next scheduled session' : 'Create & start a new class'}</button>
        </div>
        {role === 'lead' && !topic.trim() && <p className="text-sm font-medium text-(--text-2)">Enter the topic to enable starting. You will be the lead instructor for this class.</p>}
      </form> : <p className="text-sm text-(--text-2)">Class creation is temporarily unavailable while the workflow update is pending.</p>}
      {error && <WorkflowNotice tone="error" action={<button type="button" className="min-h-11 font-semibold underline" onClick={() => router.refresh()}>Refresh session list</button>}>{error}</WorkflowNotice>}
    </div>
    <div className="ds-card p-4">
      <h2 className="text-lg font-bold text-(--navy)">Previous classes ({past.length})</h2>
      <p className="mt-1 text-sm text-(--text-2)">Open a class or request assistant participation. Requests count as pending; earnings require administration approval and a completed class.</p>
      {!past.length && <p className="mt-3 text-sm">No completed classes yet.</p>}
      {past.map(s => <details key={s.id} className="border-b border-(--border) py-3">
        <summary className="min-h-11 cursor-pointer font-semibold">#{s.session_number ?? '—'} · {new Date(s.scheduled_at).toLocaleDateString('en-GB')} · {s.topic || 'Session'} <span className="text-sm text-(--cyan-strong)">· {s.myState === 'confirmed' ? 'My participation confirmed' : s.myState === 'requested' ? 'Approval pending' : 'View participation'}</span></summary>
        <div className="mt-3 space-y-3">{workflowReady && <SessionParticipation key={`${s.id}-${s.myState}`} session={s} />}<Link className="inline-flex min-h-11 items-center font-semibold text-(--cyan-strong) underline" href={`/portal/instructor/groups/${groupId}/sessions/${s.id}`}>View class & attendance</Link></div>
      </details>)}
      <details className="mt-4"><summary className="min-h-11 cursor-pointer font-semibold">Scheduled & other sessions</summary><div className="divide-y divide-(--border)">{sessions.filter(s => s.status !== 'completed' && s.status !== 'ongoing').map(s => <Link key={s.id} className="flex min-h-11 flex-wrap items-center justify-between gap-2 py-3 text-sm font-medium" href={`/portal/instructor/groups/${groupId}/sessions/${s.id}`}><span>#{s.session_number ?? '—'} · {new Date(s.scheduled_at).toLocaleDateString('en-GB')} · {s.topic}</span><span>{s.status}</span></Link>)}</div></details>
    </div>
  </section>
}
