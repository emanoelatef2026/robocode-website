'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { changeParticipation } from '@/modules/instructor-portal/shared-actions'
import type { SharedSessionItem } from '@/modules/instructor-portal/shared-queries'

export default function SessionParticipation({ session }: { session: SharedSessionItem }) {
  const router = useRouter()
  const lock = useRef(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [reason, setReason] = useState('')
  const [requesting, setRequesting] = useState(false)
  const [state, setState] = useState(session.myState)
  // A refreshed shared snapshot is authoritative; keep state local only until refresh.
  const current = state
  async function act(mode: 'join' | 'confirm' | 'request') {
    if (lock.current) return
    lock.current = true; setBusy(true); setError('')
    try {
      const result = await changeParticipation(session.id, mode, reason)
      if (!result.success) setError(result.error.message)
      else { setState(result.data.state ?? null); setRequesting(false); router.refresh() }
    } catch { setError('Unable to save your participation. Please retry.') }
    finally { lock.current = false; setBusy(false) }
  }
  const button = 'min-h-11 rounded-xl border border-(--border) px-4 py-2 text-sm font-semibold disabled:opacity-50'
  return <section className="ds-card space-y-3 p-4" aria-label="Teaching participation">
    <h2 className="font-bold text-(--navy)">My teaching participation</h2>
    <p className="text-sm text-(--text-2)">One shared class and attendance register. Each instructor confirms their own participation separately; students are charged once.</p>
    <div className="flex flex-wrap gap-2">{session.participants.filter(p => !['requested', 'rejected'].includes(p.state)).map(p => <span key={p.instructor_id} className="rounded-full bg-(--bg-muted) px-3 py-2 text-sm font-medium">{p.name} · {p.state === 'confirmed' ? 'Confirmed' : 'Joined'}</span>)}</div>
    <div className="flex flex-wrap items-center gap-2">
      {current === 'confirmed' ? <p role="status" className="font-semibold text-(--green-dark)">✓ Your participation is confirmed. Payable when this class is completed.</p>
        : current === 'requested' ? <p role="status" className="font-semibold text-(--amber-dark)">Awaiting team leader / admin approval</p>
        : current === 'rejected' ? <p className="font-semibold text-(--red-dark)">Request declined. Contact your team leader.</p>
        : session.status === 'ongoing' ? <>
          {!session.joined && current !== 'joined' && <button type="button" disabled={busy} onClick={() => void act('join')} className={button}>Join session</button>}
          {(session.joined || current === 'joined') && <button type="button" disabled={busy} onClick={() => void act('confirm')} className={`${button} bg-(--navy) text-white`}>Confirm my participation</button>}
        </> : session.status === 'completed' && (session.joined || current === 'joined') ? <button type="button" disabled={busy} onClick={() => void act('confirm')} className={button}>Confirm my participation</button>
        : session.status === 'completed' && <button type="button" disabled={busy} onClick={() => setRequesting(v => !v)} className={button}>Request participation approval</button>}
    </div>
    {requesting && <div className="space-y-2"><label className="block text-sm font-semibold">Why should your participation be recorded?<textarea maxLength={2000} value={reason} disabled={busy} onChange={e => setReason(e.target.value)} className="ds-input mt-2 min-h-24 w-full" /></label><button type="button" disabled={busy || reason.trim().length < 5} onClick={() => void act('request')} className={button}>Send approval request</button></div>}
    {busy && <p role="status" className="text-sm">Saving participation…</p>}
    {error && <p role="alert" className="text-sm font-semibold text-(--red-dark)">{error}</p>}
  </section>
}
