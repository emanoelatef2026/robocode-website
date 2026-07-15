import { requirePortalRole } from '@/modules/rbac/guards'
import { createServiceClient } from '@/lib/supabase/service'
import {
  getStudentTimeline,
  TIMELINE_EVENT_LABELS,
  TIMELINE_SEVERITY_COLORS,
  STUDENT_VISIBLE_TIMELINE_EVENT_TYPES,
  type TimelineEventType,
} from '@/lib/timeline'
import EmptyState from '@/components/admin/EmptyState'
import Link from 'next/link'

// Partial — only STUDENT_VISIBLE_TIMELINE_EVENT_TYPES are ever rendered here.
const EVENT_ICON: Partial<Record<TimelineEventType, string>> = {
  ENROLLMENT_CREATED:   '🎉',
  ENROLLMENT_CANCELLED: '🚪',
  RENEWAL_CREATED:      '🔄',
  TRANSFER:             '↔️',
  ATTENDANCE_RECORDED:  '✅',
  HOMEWORK_ASSIGNED:    '📝',
  HOMEWORK_COMPLETED:   '📗',
  CERTIFICATE_ISSUED:   '📜',
  EVALUATION_RECORDED:  '📊',
  COMPETITION_LOGGED:   '🎖️',
  ACHIEVEMENT_EARNED:   '🏅',
  BADGE_EARNED:         '🎗️',
  NOTE_ADDED:           '📌',
}

const CATEGORIES: Array<{ key: string; label: string; types: TimelineEventType[] }> = [
  { key: 'all',          label: 'All',          types: [...STUDENT_VISIBLE_TIMELINE_EVENT_TYPES] },
  { key: 'enrollment',   label: 'Enrollment',   types: ['ENROLLMENT_CREATED', 'ENROLLMENT_CANCELLED', 'RENEWAL_CREATED', 'TRANSFER'] },
  { key: 'attendance',   label: 'Attendance',   types: ['ATTENDANCE_RECORDED'] },
  { key: 'homework',     label: 'Homework',     types: ['HOMEWORK_ASSIGNED', 'HOMEWORK_COMPLETED'] },
  { key: 'evaluations',  label: 'Evaluations',  types: ['EVALUATION_RECORDED'] },
  { key: 'achievements', label: 'Achievements', types: ['ACHIEVEMENT_EARNED', 'BADGE_EARNED'] },
  { key: 'competitions', label: 'Competitions', types: ['COMPETITION_LOGGED'] },
  { key: 'certificates', label: 'Certificates', types: ['CERTIFICATE_ISSUED'] },
  { key: 'notes',        label: 'Notes',        types: ['NOTE_ADDED'] },
]

function timeAgo(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (diff < 60)    return 'Just now'
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

interface Props {
  searchParams: Promise<{ type?: string }>
}

export default async function StudentJourneyPage({ searchParams }: Props) {
  const user   = await requirePortalRole('student')
  const params = await searchParams
  const activeKey = params.type ?? 'all'

  const db = createServiceClient()
  const { data: studentRow } = await db
    .from('students').select('id').eq('user_id', user.id).maybeSingle()
  const studentId = (studentRow as any)?.id ?? null

  const rawEvents = studentId ? await getStudentTimeline(studentId, null, 100) : []
  const visibleTypes = new Set<string>(STUDENT_VISIBLE_TIMELINE_EVENT_TYPES)
  const events = rawEvents.filter(e => visibleTypes.has(e.event_type))

  const activeCategory = CATEGORIES.find(c => c.key === activeKey) ?? CATEGORIES[0]
  const activeTypes = new Set<string>(activeCategory.types)
  const filteredEvents = events.filter(e => activeTypes.has(e.event_type))

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div>
        <h1 className="text-base font-bold text-[#0B1F3A]">Learning Journey</h1>
        <p className="mt-0.5 text-[12.5px] text-[#64748B]">Every milestone in your learning story, in one place.</p>
      </div>

      {/* Filter chips */}
      <div className="flex flex-wrap gap-1.5">
        {CATEGORIES.map(c => {
          const count = c.key === 'all' ? events.length : events.filter(e => new Set(c.types).has(e.event_type)).length
          const active = c.key === activeKey
          return (
            <Link
              key={c.key}
              href={c.key === 'all' ? '/portal/student/journey' : `/portal/student/journey?type=${c.key}`}
              className={`rounded-full px-3 py-1.5 text-[11.5px] font-semibold transition ${
                active ? 'bg-[#0B1F3A] text-white' : 'bg-white border border-[#E2E8F0] text-[#475569] hover:border-[#FF8A1F]'
              }`}
            >
              {c.label}{count > 0 ? ` (${count})` : ''}
            </Link>
          )
        })}
      </div>

      {/* Timeline */}
      {filteredEvents.length === 0 ? (
        <EmptyState
          title={activeKey === 'all' ? 'Your journey starts here' : `No ${activeCategory.label.toLowerCase()} events yet`}
          description="As you attend sessions, earn achievements and hit milestones, they'll show up here."
        />
      ) : (
        <div className="relative space-y-0">
          {filteredEvents.map((e, i) => (
            <div key={e.id} className="relative flex gap-3 pb-5">
              {/* Connector line */}
              {i < filteredEvents.length - 1 && (
                <div className="absolute left-[15px] top-8 h-full w-px bg-[#E2E8F0]" />
              )}
              <div className="z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[#E2E8F0] bg-white text-[14px]">
                {EVENT_ICON[e.event_type] ?? '•'}
              </div>
              <div className="ds-card min-w-0 flex-1 px-3.5 py-2.5">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-[12.5px] font-bold text-[#0B1F3A]">{TIMELINE_EVENT_LABELS[e.event_type]}</p>
                  <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[9.5px] font-semibold ${TIMELINE_SEVERITY_COLORS[e.severity]}`}>
                    {timeAgo(e.created_at)}
                  </span>
                </div>
                {e.notes && <p className="mt-0.5 text-[11.5px] text-[#64748B]">{e.notes}</p>}
                {e.created_by_name && <p className="mt-0.5 text-[10.5px] text-[#94A3B8]">by {e.created_by_name}</p>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
