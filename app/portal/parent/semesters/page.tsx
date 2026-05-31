import { requirePortalRole }          from '@/modules/rbac/guards'
import { getParentChildren }          from '@/modules/parents/parent-portal-queries'
import { getChildHistoryTimeline }    from '@/modules/parents/parent-portal-queries'
import type { TimelineEvent }         from '@/modules/parents/parent-portal-queries'
import Link                           from 'next/link'

interface Props {
  searchParams: Promise<{ child?: string }>
}

const EVENT_CONFIG: Record<
  TimelineEvent['event_type'],
  { label: string; icon: string; cls: string; dotCls: string }
> = {
  attendance:          { label: 'Attendance',          icon: '📅', cls: 'bg-green-50  border-green-100',  dotCls: 'bg-green-400'   },
  homework_submitted:  { label: 'Homework Submitted',  icon: '📄', cls: 'bg-blue-50   border-blue-100',   dotCls: 'bg-blue-400'    },
  homework_graded:     { label: 'Homework Graded',     icon: '✦',  cls: 'bg-indigo-50 border-indigo-100', dotCls: 'bg-indigo-400'  },
  portfolio_uploaded:  { label: 'Portfolio Uploaded',  icon: '🖼', cls: 'bg-purple-50 border-purple-100', dotCls: 'bg-purple-400'  },
  portfolio_approved:  { label: 'Portfolio Approved',  icon: '★',  cls: 'bg-emerald-50 border-emerald-100', dotCls: 'bg-emerald-400' },
  certificate_earned:  { label: 'Certificate Earned',  icon: '🏆', cls: 'bg-amber-50  border-amber-100',  dotCls: 'bg-[#FF8A1F]'  },
}

export default async function ParentHistoryPage({ searchParams }: Props) {
  const { child } = await searchParams
  const user      = await requirePortalRole('parent')

  const children = await getParentChildren(user.id)

  if (!children.length) {
    return (
      <div className="flex min-h-100 items-center justify-center">
        <p className="text-sm text-[#94A3B8]">No children linked to this account.</p>
      </div>
    )
  }

  const studentId  = child ?? children[0].student_id
  const selected   = children.find(c => c.student_id === studentId) ?? children[0]
  const childParam = `?child=${selected.student_id}`

  const timeline = await getChildHistoryTimeline(user.id, selected.student_id)

  // Group by month_key, preserving newest-first order
  const monthGroups: { key: string; events: TimelineEvent[] }[] = []
  const seenMonths = new Map<string, TimelineEvent[]>()
  for (const ev of timeline) {
    if (!seenMonths.has(ev.month_key)) {
      const arr: TimelineEvent[] = []
      seenMonths.set(ev.month_key, arr)
      monthGroups.push({ key: ev.month_key, events: arr })
    }
    seenMonths.get(ev.month_key)!.push(ev)
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-[#0B1F3A]">Activity History</h1>
          <p className="mt-0.5 text-sm text-[#64748B]">
            {selected.student_name} · {timeline.length} events
          </p>
        </div>
        <Link href={`/portal/parent${childParam}`} className="text-[13px] text-[#FF8A1F] hover:underline">
          ← Dashboard
        </Link>
      </div>

      {monthGroups.length === 0 ? (
        <div className="rounded-xl border border-[#E2E8F0] bg-white px-6 py-12 text-center">
          <p className="text-sm text-[#64748B]">No activity recorded yet.</p>
          <p className="mt-1 text-xs text-[#94A3B8]">Activity will appear as sessions, assignments, and portfolio work progress.</p>
        </div>
      ) : (
        <div className="space-y-8">
          {monthGroups.map(({ key, events }) => (
            <div key={key}>
              {/* Month heading */}
              <div className="mb-4 flex items-center gap-3">
                <span className="text-[13px] font-semibold text-[#0B1F3A]">{key}</span>
                <div className="flex-1 border-t border-[#E2E8F0]" />
                <span className="text-[11px] text-[#94A3B8]">{events.length} events</span>
              </div>

              {/* Events */}
              <div className="relative space-y-3 pl-6">
                {/* Timeline spine */}
                <div className="absolute left-2 top-0 h-full w-px bg-[#E2E8F0]" />

                {events.map(ev => {
                  const cfg = EVENT_CONFIG[ev.event_type]
                  return (
                    <div key={ev.id} className="relative flex items-start gap-3">
                      {/* Timeline dot */}
                      <div className={`absolute -left-4 mt-2 h-2.5 w-2.5 rounded-full ring-2 ring-white ${cfg.dotCls}`} />

                      <div className={`flex-1 rounded-lg border px-3 py-2.5 ${cfg.cls}`}>
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[13px]">{cfg.icon}</span>
                            <span className="text-[13px] font-medium text-[#0B1F3A]">{ev.title}</span>
                          </div>
                          <span className="shrink-0 text-[11px] text-[#94A3B8]">
                            {new Date(ev.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                          </span>
                        </div>
                        {ev.subtitle && (
                          <p className="mt-0.5 text-[12px] text-[#64748B]">{ev.subtitle}</p>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
