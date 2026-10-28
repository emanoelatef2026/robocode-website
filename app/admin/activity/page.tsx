import Link from 'next/link'
import { getAdminActivity, activityFilters } from '@/modules/admin-activity/queries'
import { ACTIVITY_CATEGORIES, ACTIVITY_PRIORITIES, activityTitle } from '@/modules/admin-activity/types'
import ActivityAcknowledge from '@/components/admin/ActivityAcknowledge'

export default async function ActivityPage({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}) {
  const params=await searchParams
  const f=activityFilters.parse(params)
  const feed=await getAdminActivity(f)
  function pageLink(page:number) {const q=new URLSearchParams();for(const [k,v] of Object.entries(f))if(v!==undefined)q.set(k,String(v));q.set('page',String(page));return `/admin/activity?${q}`}
  const color={urgent:'bg-red-50 text-red-800 border-red-200',action:'bg-amber-50 text-amber-900 border-amber-200',info:'bg-sky-50 text-sky-900 border-sky-200'}
  return <div className="mx-auto max-w-6xl space-y-5">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h1 className="text-2xl font-bold text-(--navy)">Activity Center</h1><p className="mt-1 text-sm text-(--text-2)">System activity, important changes and requests that need attention.</p></div><Link href="/admin/system-events" className="ds-btn-ghost min-h-11 px-4">Technical alerts</Link></div>
    <form className="ds-card flex flex-wrap items-end gap-3 p-4" method="get">
      <label className="min-w-44 flex-1 text-sm font-semibold">Search<input name="q" defaultValue={f.q} maxLength={100} className="ds-input mt-1 w-full" placeholder="Person, record or action" /></label>
      <label className="text-sm font-semibold">Category<select name="category" defaultValue={f.category??''} className="ds-input mt-1 block"><option value="">All categories</option>{ACTIVITY_CATEGORIES.map(x=><option key={x} value={x}>{activityTitle(x)}</option>)}</select></label>
      <label className="text-sm font-semibold">Priority<select name="priority" defaultValue={f.priority??''} className="ds-input mt-1 block"><option value="">All priorities</option>{ACTIVITY_PRIORITIES.map(x=><option key={x} value={x}>{x==='action'?'Needs action':activityTitle(x)}</option>)}</select></label>
      <label className="text-sm font-semibold">Status<select name="state" defaultValue={f.state??''} className="ds-input mt-1 block"><option value="">All activity</option><option value="pending">Needs attention</option><option value="resolved">Resolved / acknowledged</option></select></label>
      <button type="submit" className="ds-btn-primary min-h-11 px-5">Filter</button><Link className="inline-flex min-h-11 items-center text-sm font-semibold underline" href="/admin/activity">Clear</Link>
    </form>
    <p className="text-sm font-semibold text-(--text-2)">{feed.total} activities · Times shown in Cairo time</p>
    {!feed.events.length&&<div className="ds-card p-10 text-center text-sm font-semibold">No activity matches these filters. New actions appear here automatically.</div>}
    <div className="space-y-3">{feed.events.map(event=>{
      const keys=[...new Set([...Object.keys(event.before_data),...Object.keys(event.after_data)])].filter(k=>!k.endsWith('_id')&&JSON.stringify(event.before_data[k])!==JSON.stringify(event.after_data[k]))
      return <article key={event.id} id={`event-${event.id}`} className="ds-card scroll-mt-24 p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2"><div className="flex flex-wrap gap-2"><span className={`rounded-full border px-2.5 py-1 text-xs font-bold ${color[event.priority]}`}>{event.priority==='action'?'Needs action':activityTitle(event.priority)}</span><span className="rounded-full bg-(--bg-muted) px-2.5 py-1 text-xs font-semibold">{activityTitle(event.category)}</span>{event.resolved_at&&<span className="text-xs font-semibold text-(--green-dark)">Resolved / acknowledged</span>}</div><time dateTime={event.created_at} className="text-xs font-medium text-(--text-2)">{new Date(event.created_at).toLocaleString('en-GB',{timeZone:'Africa/Cairo',dateStyle:'medium',timeStyle:'short'})}</time></div>
        <h2 className="mt-3 font-bold text-(--navy)">{activityTitle(event.action)}</h2><p className="mt-1 break-words text-sm font-semibold">{event.entity_label}</p><p className="mt-1 text-sm text-(--text-2)">By {event.actor_name}</p>
        {!!keys.length&&<details className="mt-3"><summary className="min-h-11 cursor-pointer text-sm font-semibold text-(--cyan-strong)">View changes ({keys.length})</summary><div className="overflow-x-auto rounded-lg border border-(--border)"><table className="w-full text-left text-sm"><thead className="bg-(--bg-muted)"><tr><th className="p-2">Field</th><th className="p-2">Before</th><th className="p-2">After</th></tr></thead><tbody>{keys.map(k=><tr key={k} className="border-t border-(--border)"><th className="p-2 font-semibold">{activityTitle(k)}</th><td className="max-w-64 break-words p-2">{String(event.before_data[k]??'—')}</td><td className="max-w-64 break-words p-2 font-medium">{String(event.after_data[k]??'—')}</td></tr>)}</tbody></table></div></details>}
        <div className="mt-3 flex flex-wrap items-center gap-3"><Link className="inline-flex min-h-11 items-center rounded-lg bg-(--navy) px-4 text-sm font-semibold text-white" href={event.target_href}>Open related record</Link>{event.requires_action&&!event.resolved_at&&!['session_participations','parent_messages'].includes(event.entity_type)&&<ActivityAcknowledge id={event.id}/>}</div>
        {event.entity_type==='session_participations'&&event.requires_action&&!event.resolved_at&&<p className="mt-2 text-xs font-semibold text-(--amber-dark)">Review the participation request to approve or decline it. Reading this event does not approve payment.</p>}
      </article>
    })}</div>
    <nav aria-label="Activity pages" className="flex items-center justify-between text-sm font-semibold">{f.page>1?<Link className="min-h-11 p-3 underline" href={pageLink(f.page-1)}>Previous</Link>:<span/>}<span>Page {f.page}</span>{f.page*50<feed.total?<Link className="min-h-11 p-3 underline" href={pageLink(f.page+1)}>Next</Link>:<span/>}</nav>
  </div>
}
