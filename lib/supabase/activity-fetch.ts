import 'server-only'
import { getSessionCookie } from '@/lib/lms-session'

// Resolve identity per HTTP operation, never in singleton client headers. This
// prevents concurrent staff requests from being attributed to another user.
export function createActivityFetch(baseFetch: typeof fetch = fetch): typeof fetch {
  return async (input, init) => {
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url)
    const method = (init?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase()
    if (!url.pathname.startsWith('/rest/v1/') || !['POST','PATCH','DELETE','PUT'].includes(method)) return baseFetch(input,init)
    const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined))
    headers.delete('x-activity-actor')
    let actor: string | null = null
    try { actor = (await getSessionCookie())?.sub ?? null } catch { /* background worker, no request cookies */ }
    if (actor) headers.set('x-activity-actor',actor)
    const resource = url.pathname.slice('/rest/v1/'.length).replace(/[^a-zA-Z0-9_/]/g,'').slice(0,100)
    const excluded = /^(system_event_logs|admin_activity_events|notifications|notification_reads|audit_logs)(\/|$)/.test(resource)
    async function logFailure(status: number) {
      if (excluded) return
      try {
        await baseFetch(new URL('/rest/v1/system_event_logs',url.origin),{
          method:'POST',signal:AbortSignal.timeout(2000),headers:{ apikey:headers.get('apikey') ?? '', Authorization:headers.get('Authorization') ?? '', 'Content-Type':'application/json',Prefer:'return=minimal' },
          body:JSON.stringify({type:status===403?'SECURITY_DENIAL':'SYNC_ERROR',severity:'error',module:'database-operations',message:'A database operation failed. Review the related workflow.',actor_user_id:actor,payload:{resource,method,status}}),
        })
      } catch { /* original failure must remain authoritative */ }
    }
    try {
      const response = await baseFetch(input,{...init,headers})
      if (!response.ok) await logFailure(response.status)
      return response
    } catch (error) { await logFailure(0); throw error }
  }
}
