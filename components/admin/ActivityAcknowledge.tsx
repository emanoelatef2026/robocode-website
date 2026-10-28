'use client'
import { useState, useTransition } from 'react'
import { acknowledgeActivity } from '@/modules/admin-activity/actions'
export default function ActivityAcknowledge({id}:{id:string}) {
  const [pending,start]=useTransition(); const [error,setError]=useState(''); const [done,setDone]=useState(false)
  return <div><button type="button" disabled={pending||done} className="ds-btn-ghost min-h-11 px-3 text-sm" onClick={()=>start(async()=>{
    setError('');const form=new FormData();form.set('event_id',id)
    try { const r=await acknowledgeActivity(form);if(r.success)setDone(true);else setError(r.error.message) } catch {setError('Unable to acknowledge this alert. Please retry.')}
  })}>{done?'Acknowledged':pending?'Saving…':'Acknowledge alert'}</button>{error&&<p role="alert" className="mt-2 text-sm text-(--red-dark)">{error}</p>}</div>
}
