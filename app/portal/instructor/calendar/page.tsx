import { requirePortalRole } from '@/modules/rbac/guards'
import { getInstructorByUserId, resolveGcContext } from '@/modules/instructor-portal/queries'
import { listSpecialSessions } from '@/modules/special-sessions/queries'
import { createServiceClient } from '@/lib/supabase/service'
import EmptyState from '@/components/admin/EmptyState'
import Link from 'next/link'

interface Props {
  searchParams: Promise<Record<string, string | undefined>>
}

export default async function InstructorCalendarPage({ searchParams }: Props) {
  const user       = await requirePortalRole('instructor')
  const instructor = await getInstructorByUserId(user.id)

  if (!instructor) return <EmptyState title="No instructor record found" description="Contact your team leader." />

  const db = createServiceClient()
  const sp = await searchParams

  const now    = new Date()
  const year   = Number(sp.year  ?? now.getFullYear())
  const month  = Number(sp.month ?? now.getMonth() + 1)
  const filter = (sp.filter === 'primary' || sp.filter === 'trial' || sp.filter === 'makeup') ? sp.filter : 'all'

  const monthStart = new Date(year, month - 1, 1)
  const monthEnd   = new Date(year, month, 0, 23, 59, 59)

  const showPrimary = filter === 'all' || filter === 'primary'
  const showTrial   = filter === 'all' || filter === 'trial'
  const showMakeup  = filter === 'all' || filter === 'makeup'
  const specialType = filter === 'trial' ? 'trial' : filter === 'makeup' ? 'makeup' : undefined

  // Primary sessions via group_courses — resolved through both direct
  // group_courses.instructor_id assignment and the group_instructors pivot,
  // so co-taught / pivot-only groups still show on the calendar.
  const { gcIds: myGcIds } = await resolveGcContext(instructor.id, db)

  const [primaryRes, specialSessions] = await Promise.all([
    showPrimary && myGcIds.length > 0
      ? db.from('schedules')
          .select(
            `id, type, scheduled_at, status,
             group_courses!schedules_group_course_id_fkey(
               groups!group_courses_group_id_fkey(id, name)
             )`
          )
          .in('group_course_id', myGcIds)
          .gte('scheduled_at', monthStart.toISOString())
          .lte('scheduled_at', monthEnd.toISOString())
          .not('status', 'in', '("cancelled","cancelled_with_makeup")')
          .order('scheduled_at')
      : Promise.resolve({ data: [] }),
    (showTrial || showMakeup)
      ? listSpecialSessions({
          instructorId: instructor.id,
          fromDate:     monthStart.toISOString(),
          toDate:       monthEnd.toISOString(),
          type:         specialType,
        })
      : Promise.resolve([]),
  ])

  type CalEvent = { id: string; label: string; color: string; href: string; time: string }
  const eventsByDate = new Map<string, CalEvent[]>()

  for (const s of (primaryRes.data ?? []) as any[]) {
    const dateKey = s.scheduled_at.slice(0, 10)
    const list    = eventsByDate.get(dateKey) ?? []
    list.push({
      id:    s.id,
      label: s.group_courses?.groups?.name ?? 'Session',
      color: 'bg-blue-100 text-blue-700',
      href:  `/portal/instructor/groups/${s.group_courses?.groups?.id ?? ''}`,
      time:  new Date(s.scheduled_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
    })
    eventsByDate.set(dateKey, list)
  }

  for (const s of specialSessions) {
    const dateKey = s.scheduled_at.slice(0, 10)
    const list    = eventsByDate.get(dateKey) ?? []
    list.push({
      id:    s.id,
      label: s.type === 'trial' ? '🟣 Trial' : '🟠 Makeup',
      color: s.type === 'trial' ? 'bg-purple-100 text-purple-700' : 'bg-orange-100 text-orange-700',
      href:  `/portal/instructor/special-sessions/${s.id}`,
      time:  new Date(s.scheduled_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
    })
    eventsByDate.set(dateKey, list)
  }

  const daysInMonth    = new Date(year, month, 0).getDate()
  const firstDayOfWeek = monthStart.getDay()
  const monthLabel     = monthStart.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  const prevMonth = month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 }
  const nextMonth = month === 12 ? { year: year + 1, month: 1 } : { year, month: month + 1 }
  const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const filterBase = `?year=${year}&month=${month}`

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Link href={`?year=${prevMonth.year}&month=${prevMonth.month}&filter=${filter}`}
          className="rounded-lg border border-[#E2E8F0] px-3 py-1.5 text-[13px] text-[#64748B] hover:bg-[#F8FAFC]">
          ← Prev
        </Link>
        <h1 className="text-[16px] font-bold text-[#0B1F3A]">{monthLabel}</h1>
        <Link href={`?year=${nextMonth.year}&month=${nextMonth.month}&filter=${filter}`}
          className="rounded-lg border border-[#E2E8F0] px-3 py-1.5 text-[13px] text-[#64748B] hover:bg-[#F8FAFC]">
          Next →
        </Link>
      </div>

      {/* Type filters */}
      <div className="flex flex-wrap gap-2">
        {[
          { key: 'all',     label: 'All'       },
          { key: 'primary', label: '🔵 Primary' },
          { key: 'trial',   label: '🟣 Trial'   },
          { key: 'makeup',  label: '🟠 Makeup'  },
        ].map(f => (
          <Link
            key={f.key}
            href={`${filterBase}&filter=${f.key}`}
            className={`rounded-full border px-3 py-1 text-[11px] font-semibold transition ${
              filter === f.key
                ? 'border-[#0B1F3A] bg-[#0B1F3A] text-white'
                : 'border-[#E2E8F0] text-[#64748B] hover:border-[#CBD5E1]'
            }`}
          >
            {f.label}
          </Link>
        ))}
      </div>

      <div className="ds-card overflow-hidden">
        <div className="grid grid-cols-7 border-b border-[#E2E8F0]">
          {DAY_LABELS.map(d => (
            <div key={d} className="py-2 text-center text-[10px] font-bold uppercase tracking-widest text-[#94A3B8]">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 divide-x divide-y divide-[#F1F5F9]">
          {Array.from({ length: firstDayOfWeek }).map((_, i) => (
            <div key={`e-${i}`} className="min-h-[80px] bg-[#F8FAFC]" />
          ))}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day     = i + 1
            const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
            const events  = eventsByDate.get(dateStr) ?? []
            const isToday = dateStr === now.toISOString().slice(0, 10)
            return (
              <div key={day} className={`min-h-[80px] p-1 ${isToday ? 'bg-blue-50' : ''}`}>
                <p className={`text-[11px] font-semibold mb-1 ${isToday ? 'text-[#3B82F6]' : 'text-[#64748B]'}`}>{day}</p>
                <div className="space-y-0.5">
                  {events.slice(0, 3).map(ev => (
                    <Link key={ev.id} href={ev.href}
                      className={`block truncate rounded px-1 py-0.5 text-[9px] font-semibold leading-tight ${ev.color}`}
                      title={`${ev.time} ${ev.label}`}>
                      {ev.time} {ev.label}
                    </Link>
                  ))}
                  {events.length > 3 && <p className="text-[9px] text-[#94A3B8] px-1">+{events.length - 3} more</p>}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
