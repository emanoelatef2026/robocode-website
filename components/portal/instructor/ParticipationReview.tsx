'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { reviewParticipation } from '@/modules/instructor-portal/shared-actions'

interface Request { sessionId: string; instructorId: string; name: string; group: string; topic: string; date: string; reason: string }
export default function ParticipationReview({ requests }: { requests: Request[] }) {
  const router = useRouter()
  const lock = useRef(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [resolved, setResolved] = useState<string[]>([])
  async function review(request: Request, approve: boolean) {
    if (lock.current || !window.confirm(`${approve ? 'Approve this teaching participation for payroll' : 'Decline this participation request'}? Student attendance and contracts will not change.`)) return
    lock.current = true; setBusy(true); setError('')
    try {
      const result = await reviewParticipation(request.sessionId, request.instructorId, approve)
      if (!result.success) setError(result.error.message)
      else { setResolved(v => [...v, `${request.sessionId}:${request.instructorId}`]); router.refresh() }
    } catch { setError('Unable to review participation. Please retry.') }
    finally { lock.current = false; setBusy(false) }
  }
  const visible = requests.filter(r => !resolved.includes(`${r.sessionId}:${r.instructorId}`))
  return <section className="ds-card mb-5 space-y-3 p-4" aria-label="Participation approvals">
    <h2 className="text-lg font-bold text-(--navy)">Teaching participation approvals ({visible.length})</h2>
    <p className="text-sm text-(--text-2)">Late claims for completed classes. Approval records this instructor only; it never adds a class or charges students again.</p>
    {visible.length === 0 && <p className="text-sm font-medium">No pending requests.</p>}
    {visible.map(r => <article key={`${r.sessionId}:${r.instructorId}`} className="flex flex-wrap items-center justify-between gap-3 border-t border-(--border) pt-3">
      <div className="min-w-0"><h3 className="font-semibold">{r.name} · {r.group}</h3><p className="text-sm">{r.topic} · {new Date(r.date).toLocaleDateString('en-GB')}</p><p className="mt-1 whitespace-pre-wrap break-words text-sm text-(--text-2)">{r.reason}</p></div>
      <div className="flex gap-2"><button type="button" disabled={busy} onClick={() => void review(r, true)} className="min-h-11 rounded-xl bg-(--navy) px-4 py-2 font-semibold text-white disabled:opacity-50">Approve participation</button><button type="button" disabled={busy} onClick={() => void review(r, false)} className="min-h-11 rounded-xl border border-(--border) px-4 py-2 font-semibold disabled:opacity-50">Decline</button></div>
    </article>)}
    {error && <p role="alert" className="text-sm font-semibold text-(--red-dark)">{error}</p>}
  </section>
}
