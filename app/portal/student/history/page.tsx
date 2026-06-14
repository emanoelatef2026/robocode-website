import { requirePortalRole } from '@/modules/rbac/guards'
import { getStudentTimeline } from '@/modules/student-portal/queries'
import type { TimelineEvent } from '@/modules/student-portal/types'

const EVENT_CONFIG: Record<string, { icon: string; iconCls: string; lineCls: string }> = {
  attended:    { icon: '✓', iconCls: 'bg-emerald-100 text-emerald-700', lineCls: 'bg-emerald-200' },
  missed:      { icon: '✕', iconCls: 'bg-red-100 text-red-600',         lineCls: 'bg-red-200'     },
  submitted:   { icon: '📝', iconCls: 'bg-blue-100 text-blue-700',      lineCls: 'bg-blue-200'    },
  graded:      { icon: '⭐', iconCls: 'bg-green-100 text-green-700',    lineCls: 'bg-green-200'   },
  portfolio:   { icon: '🖼', iconCls: 'bg-purple-100 text-purple-700',  lineCls: 'bg-purple-200'  },
  certificate: { icon: '🏆', iconCls: 'bg-[#FFF7ED] text-[#FF8A1F]',   lineCls: 'bg-orange-200'  },
}

function groupByDate(events: TimelineEvent[]): Map<string, TimelineEvent[]> {
  const map = new Map<string, TimelineEvent[]>()
  for (const e of events) {
    const key = new Date(e.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(e)
  }
  return map
}

export default async function StudentHistoryPage() {
  const user   = await requirePortalRole('student')
  const events = await getStudentTimeline(user.id)
  const groups = groupByDate(events)

  return (
    <div className="mx-auto max-w-2xl space-y-3">
      <div>
        <h1 className="text-base font-bold text-[#0B1F3A]">Activity History</h1>
        <p className="text-xs text-[#64748B]">Your journey — newest first</p>
      </div>

      {events.length === 0 ? (
        <div className="rounded-xl border border-[#E2E8F0] bg-white px-5 py-10 text-center">
          <p className="text-sm text-[#94A3B8]">No activity yet. Your history will appear here as you attend sessions and complete assignments.</p>
        </div>
      ) : (
        <div className="space-y-5">
          {[...groups.entries()].map(([dateLabel, dayEvents]) => (
            <section key={dateLabel}>
              {/* Date header */}
              <div className="mb-2 flex items-center gap-3">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-[#94A3B8]">{dateLabel}</p>
                <div className="flex-1 h-px bg-[#F1F5F9]" />
              </div>

              {/* Events for this day */}
              <div className="relative space-y-2 pl-7">
                {/* Vertical timeline line */}
                <div className="absolute left-2.5 top-0 h-full w-px bg-[#E2E8F0]" />

                {dayEvents.map((event) => {
                  const cfg = EVENT_CONFIG[event.event_type] ?? EVENT_CONFIG.submitted
                  return (
                    <div key={event.id} className="relative">
                      {/* Icon dot */}
                      <div className={`absolute -left-[18px] flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${cfg.iconCls} border-2 border-white`}>
                        {cfg.icon}
                      </div>

                      <div className="rounded-lg border border-[#F1F5F9] bg-white px-3.5 py-2.5">
                        <p className="text-sm font-medium text-[#0B1F3A]">{event.title}</p>
                        {event.subtitle && (
                          <p className="mt-0.5 text-xs text-[#64748B]">{event.subtitle}</p>
                        )}
                        <p className="mt-0.5 text-[10px] text-[#94A3B8]">
                          {new Date(event.date).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
