'use client'

import { useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { openSharedSession } from '@/modules/instructor-portal/shared-actions'
import type { SharedSessionItem } from '@/modules/instructor-portal/shared-queries'
import SessionParticipation from '@/components/portal/instructor/SessionParticipation'

export default function SharedSessionHub({ groupId, courseId, sessions }: { groupId: string; courseId: string; sessions: SharedSessionItem[] }) {
  const router = useRouter()
  const lock = useRef(false)
  const [topic, setTopic] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const currentCourse = sessions.filter(s => s.group_course_id === courseId)
  const ongoing = currentCourse.find(s => s.status === 'ongoing')
  const next = currentCourse.filter(s => s.status === 'scheduled').sort((a, b) => (a.session_number ?? Infinity) - (b.session_number ?? Infinity) || a.scheduled_at.localeCompare(b.scheduled_at))[0]
  const previous = currentCourse.filter(s => s.status === 'completed').sort((a, b) => (b.ended_at ?? '').localeCompare(a.ended_at ?? '') || b.id.localeCompare(a.id))[0]
  const past = sessions.filter(s => s.status === 'completed')
  async function start() {
    if (lock.current || !topic.trim()) return
    lock.current = true; setBusy(true); setError('')
    try {
      const result = await openSharedSession(courseId, next?.id ?? null, previous?.id ?? null, topic)
      if (!result.success) setError(result.error.message)
      else router.push(`/portal/instructor/groups/${result.data.groupId}/sessions/${result.data.sessionId}`)
    } catch { setError('Unable to start. Retry safely; your topic is kept.') }
    finally { lock.current = false; setBusy(false) }
  }
  return <section className="space-y-4" aria-label="Group sessions">
    <div className="ds-card space-y-3 p-4">
      <h2 className="text-lg font-bold text-(--navy)">{ongoing ? `Session ${ongoing.session_number ?? ''} is in progress` : next ? `Next: session ${next.session_number ?? ''}` : 'Start a new class'}</h2>
      <p className="text-sm font-medium text-(--text-2)">{ongoing ? ongoing.topic : next ? new Date(next.scheduled_at).toLocaleString('en-GB') : 'Check previous classes below before creating another class.'}</p>
      {ongoing ? <>
        <SessionParticipation key={`${ongoing.id}-${ongoing.myState}`} session={ongoing} />
        <Link className="inline-flex min-h-11 items-center rounded-xl bg-(--navy) px-4 py-2 font-semibold text-white" href={`/portal/instructor/groups/${groupId}/sessions/${ongoing.id}`}>Open shared session</Link>
      </> : <form className="flex flex-col gap-3 sm:flex-row" onSubmit={e => { e.preventDefault(); void start() }}>
        <label className="min-w-0 flex-1 text-sm font-semibold">Session topic<input required maxLength={1000} disabled={busy} value={topic} onChange={e => setTopic(e.target.value)} className="ds-input mt-2 min-h-11 w-full" placeholder="What will students learn?" /></label>
        <button type="submit" disabled={busy || !topic.trim()} className="min-h-11 self-end rounded-xl bg-(--orange-strong) px-5 py-3 font-semibold text-white disabled:opacity-50">{busy ? 'Starting…' : next ? 'Start next scheduled session' : 'Create & start a new class'}</button>
      </form>}
      {error && <div role="alert" className="text-sm font-semibold text-(--red-dark)">{error}<button type="button" className="ml-2 min-h-11 underline" onClick={() => router.refresh()}>Refresh session list</button></div>}
    </div>
    <div className="ds-card p-4">
      <h2 className="text-lg font-bold text-(--navy)">Previous classes ({past.length})</h2>
      <p className="mt-1 text-sm text-(--text-2)">Review the class or confirm your participation. Late claims need approval, not a new class.</p>
      {!past.length && <p className="mt-3 text-sm">No completed classes yet.</p>}
      {past.map(s => <details key={s.id} className="border-b border-(--border) py-3">
        <summary className="min-h-11 cursor-pointer font-semibold">#{s.session_number ?? '—'} · {new Date(s.scheduled_at).toLocaleDateString('en-GB')} · {s.topic || 'Session'} <span className="text-sm text-(--cyan-strong)">· {s.myState === 'confirmed' ? 'My participation confirmed' : s.myState === 'requested' ? 'Approval pending' : 'View participation'}</span></summary>
        <div className="mt-3 space-y-3"><SessionParticipation key={`${s.id}-${s.myState}`} session={s} /><Link className="inline-flex min-h-11 items-center font-semibold text-(--cyan-strong) underline" href={`/portal/instructor/groups/${groupId}/sessions/${s.id}`}>View class & attendance</Link></div>
      </details>)}
      <details className="mt-4"><summary className="min-h-11 cursor-pointer font-semibold">Scheduled & other sessions</summary><div className="divide-y divide-(--border)">{sessions.filter(s => s.status !== 'completed' && s.status !== 'ongoing').map(s => <Link key={s.id} className="flex min-h-11 flex-wrap items-center justify-between gap-2 py-3 text-sm font-medium" href={`/portal/instructor/groups/${groupId}/sessions/${s.id}`}><span>#{s.session_number ?? '—'} · {new Date(s.scheduled_at).toLocaleDateString('en-GB')} · {s.topic}</span><span>{s.status}</span></Link>)}</div></details>
    </div>
  </section>
}
