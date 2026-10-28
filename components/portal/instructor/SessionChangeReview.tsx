'use client'
import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { reviewSessionChange } from '@/modules/instructor-portal/shared-actions'
import type { SessionChangeRequest } from '@/modules/instructor-portal/change-queries'
import type { SessionAttendanceRow } from '@/modules/instructor-portal/types'

const labels: Record<string,string> = { attendance:'Attendance',session_details:'Session details',resources:'Resources',recording_add:'Add recording',recording_remove:'Remove recording',homework_create:'New homework',homework_update:'Edit homework',evaluation:'Student evaluation',student_note:'Student note' }
export default function SessionChangeReview({ requests, isLead, students, participants }: { requests: SessionChangeRequest[]; isLead: boolean; students: SessionAttendanceRow[]; participants: { instructor_id: string; name: string }[] }) {
  const router = useRouter()
  const lock = useRef(false)
  const [busy,setBusy] = useState<string | null>(null)
  const [error,setError] = useState('')
  const [resolved,setResolved] = useState<Record<string,string>>({})
  const pending = requests.filter(request => (resolved[request.id] ?? request.status)==='pending')
  async function review(id: string, approve: boolean) {
    if (lock.current) return
    lock.current=true; setBusy(id); setError('')
    try {
      const result=await reviewSessionChange(id,approve)
      if (!result.success) setError(result.error.message)
      else { setResolved(prev=>({...prev,[id]:approve?'approved':'rejected'})); router.refresh() }
    } catch { setError('Unable to review this request. Please retry.') }
    finally { lock.current=false; setBusy(null) }
  }
  if (!requests.length) return null
  return <section id="change-requests" aria-label="Class change requests" className="ds-card scroll-mt-24 p-4">
    <h2 className="text-base font-bold text-(--navy)">{isLead ? 'Assistant changes to review' : 'My submitted changes'} <span className="text-sm text-(--amber-dark)">· {pending.length} pending</span></h2>
    <p className="mt-1 text-xs text-(--text-2)">Participation approval and content approval are separate. Pending changes are not published to students or parents.</p>
    {error && <p role="alert" className="mt-3 text-sm text-(--red-dark)">{error}</p>}
    <div className="mt-3 divide-y divide-(--border)">{requests.map(request=>{
      const state=resolved[request.id] ?? request.status
      const payload=request.payload
      const studentName=(id:unknown)=>students.find(s=>s.student_id===id)?.student_name ?? 'Student'
      return <details key={request.id} className="py-2">
        <summary className="min-h-11 cursor-pointer text-sm font-semibold">{labels[request.kind]} · {participants.find(p=>p.instructor_id===request.instructor_id)?.name ?? 'Assistant'} · <span className={state==='pending'?'text-(--amber-dark)':state==='approved'?'text-(--green-dark)':'text-(--red-dark)'}>{state}</span></summary>
        <div className="space-y-3 rounded-lg bg-(--bg-muted) p-3 text-sm">
          {request.kind==='attendance' ? <ul className="space-y-1">{(payload.attendance as {student_id:string;status:string;notes?:string}[] ?? []).map(row=><li key={row.student_id}>{studentName(row.student_id)}: <strong>{row.status}</strong>{row.notes ? ` · ${row.notes}`:''}</li>)}</ul>
            : request.kind==='evaluation' ? <div><p className="font-semibold">{studentName(payload.student_id)}</p><ul>{(payload.ratings as {criterion:string;rating:number}[] ?? []).map(item=><li key={item.criterion}>{item.criterion.replaceAll('_',' ')}: {item.rating}/5</li>)}</ul><p>{String(payload.feedback ?? '')}</p></div>
            : <dl className="space-y-1">{Object.entries(payload).filter(([key])=>!key.endsWith('_id')&&!['group_id','session_id'].includes(key)).map(([key,value])=><div key={key}><dt className="inline font-semibold">{key.replaceAll('_',' ')}: </dt><dd className="inline break-words">{typeof value==='object'? JSON.stringify(value):String(value ?? '—')}</dd></div>)}</dl>}
          {isLead && state==='pending' && <div className="flex flex-wrap gap-2"><button type="button" disabled={!!busy} onClick={()=>void review(request.id,true)} className="min-h-11 rounded-lg bg-(--navy) px-4 font-semibold text-white disabled:opacity-50">{busy===request.id?'Saving…':'Approve & apply changes'}</button><button type="button" disabled={!!busy} onClick={()=>void review(request.id,false)} className="min-h-11 rounded-lg border border-(--border) px-4 font-semibold text-(--red-dark) disabled:opacity-50">Decline changes</button></div>}
        </div>
      </details>
    })}</div>
  </section>
}
