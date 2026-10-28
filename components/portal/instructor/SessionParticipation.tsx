'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { changeParticipation } from '@/modules/instructor-portal/shared-actions'
import type { SharedSessionItem } from '@/modules/instructor-portal/shared-queries'
import styles from './SessionParticipation.module.css'

export default function SessionParticipation({ session }: { session: SharedSessionItem }) {
  const router = useRouter()
  const lock = useRef(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const reason = ''
  const [state, setState] = useState(session.myState)
  // A refreshed shared snapshot is authoritative; keep state local only until refresh.
  const current = state
  async function act(mode: 'join' | 'confirm' | 'request') {
    if (lock.current) return
    lock.current = true; setBusy(true); setError('')
    try {
      const result = await changeParticipation(session.id, mode, reason)
      if (!result.success) setError(result.error.message)
      else { setState(result.data.state ?? null); router.refresh() }
    } catch { setError('Unable to save your participation. Please retry.') }
    finally { lock.current = false; setBusy(false) }
  }
  const isLead = session.isLead === true
  const canRequest = !isLead && !['confirmed', 'requested', 'rejected'].includes(current ?? '')
  const participants = session.participants.filter(p => p.state !== 'rejected')
  const stateText = isLead ? session.status === 'completed' ? 'Lead instructor · Class completed' : 'Lead instructor · Responsible for ending this class' : current === 'confirmed' ? 'Assistant participation approved'
    : current === 'requested' ? 'Awaiting team leader / admin approval'
    : current === 'rejected' ? 'Request declined. Contact your team leader.'
    : 'Assistant participation not requested'
  return <section className={styles.section} aria-label="Teaching participation">
    <div className={styles.main}>
      <div className={styles.info}>
        <div className={styles.heading}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="9" cy="7" r="4" /><path d="M2 21v-3a7 7 0 0 1 12-5m1 5 2 2 5-6" /></svg>
          <h2>{isLead ? 'Class lead' : 'Assistant participation'}</h2>
          <p role="status" aria-live="polite" className={`${styles.state} ${isLead || current === 'confirmed' ? styles.confirmed : current === 'rejected' ? styles.rejected : styles.pending}`}>{(isLead || current === 'confirmed') && <span aria-hidden="true">✓ </span>}{stateText}</p>
        </div>
        <p className={styles.help}>{isLead ? session.status === 'completed' ? 'This completed class is recorded at your approved lead rate.' : 'No extra confirmation needed. Finish with Save & end session. Your lead rate applies to this class.'
          : current === 'requested' ? 'Included in your participation count. No earnings until administration approval and class completion.'
          : current === 'confirmed' ? 'Your assistant rate applies once this class is completed. Content changes still need the lead instructor’s review.'
          : 'Request participation once. The super admin or team leader approves your assistant earnings. The lead instructor ends the class.'}</p>
      </div>
      <div className={styles.actions}>
        {canRequest && <button type="button" disabled={busy} onClick={() => void act('request')} className={styles.button}>Request assistant participation</button>}
      </div>
    </div>
    {participants.length > 0 && <details className={styles.participants}>
      <summary>Participating instructors ({participants.length})</summary>
      <ul>{participants.map(p => <li key={p.instructor_id}><span>{p.name}</span><span className={p.state === 'confirmed' ? styles.confirmed : styles.pending}>{p.instructor_id === session.leadInstructorId ? 'Lead instructor' : p.state === 'confirmed' ? 'Assistant · Approved' : 'Assistant · Awaiting administration approval'}</span></li>)}</ul>
    </details>}
    {busy && <p className={styles.help} aria-live="polite">Saving teaching record…</p>}
    {error && <p role="alert" className={styles.error}>{error}</p>}
  </section>
}
