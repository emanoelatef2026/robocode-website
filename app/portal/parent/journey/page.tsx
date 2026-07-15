import { requirePortalRole } from '@/modules/rbac/guards'
import { getParentChildren, getChildJourneyTimeline } from '@/modules/parents/parent-portal-queries'
import { TIMELINE_EVENT_LABELS, TIMELINE_SEVERITY_COLORS, type TimelineEventType } from '@/lib/timeline'
import Link from 'next/link'
import ChildSelector from '@/components/portal/parent/ChildSelector'
import NoChildrenLinked from '@/components/portal/parent/NoChildrenLinked'
import EmptyState from '@/components/admin/EmptyState'

interface Props {
  searchParams: Promise<{ child?: string }>
}

// Partial — only PARENT_VISIBLE_TIMELINE_EVENT_TYPES are ever rendered here.
const EVENT_ICON: Partial<Record<TimelineEventType, string>> = {
  ENROLLMENT_CREATED:   '🎉',
  ENROLLMENT_CANCELLED: '🚪',
  RENEWAL_CREATED:      '🔄',
  TRANSFER:             '↔️',
  ATTENDANCE_RECORDED:  '✅',
  CERTIFICATE_ISSUED:   '📜',
  EVALUATION_RECORDED:  '📊',
  COMPETITION_LOGGED:   '🎖️',
  ACHIEVEMENT_EARNED:   '🏅',
  BADGE_EARNED:         '🎗️',
  NOTE_ADDED:           '📌',
}

function timeAgo(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (diff < 60)    return 'Just now'
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default async function ParentJourneyPage({ searchParams }: Props) {
  const { child } = await searchParams
  const user      = await requirePortalRole('parent')

  const children = await getParentChildren(user.id)
  if (!children.length) {
    return <NoChildrenLinked />
  }

  const studentId  = child ?? children[0].student_id
  const selected   = children.find(c => c.student_id === studentId) ?? children[0]
  const childParam = `?child=${selected.student_id}`

  const events = await getChildJourneyTimeline(user.id, selected.student_id)

  return (
    <div className="mx-auto max-w-2xl space-y-4">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-[#0B1F3A]">Learning Journey</h1>
          <p className="mt-0.5 text-sm text-[#64748B]">Every milestone in {selected.student_name}&apos;s learning story</p>
        </div>
        <Link href={`/portal/parent${childParam}`} className="text-[13px] text-[#FF8A1F] hover:underline">
          ← Dashboard
        </Link>
      </div>

      {/* Child switcher */}
      <ChildSelector
        linkedChildren={children}
        selectedId={selected.student_id}
        hrefFor={(id) => `/portal/parent/journey?child=${id}`}
      />

      {events.length === 0 ? (
        <EmptyState
          title="No activity yet"
          description={`As ${selected.student_name} attends sessions, earns achievements and hits milestones, they'll show up here.`}
        />
      ) : (
        <div className="relative space-y-0">
          {events.map((e, i) => (
            <div key={e.id} className="relative flex gap-3 pb-5">
              {i < events.length - 1 && (
                <div className="absolute left-[15px] top-8 h-full w-px bg-[#E2E8F0]" />
              )}
              <div className="z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[#E2E8F0] bg-white text-[14px]">
                {EVENT_ICON[e.event_type as TimelineEventType] ?? '•'}
              </div>
              <div className="ds-card min-w-0 flex-1 px-3.5 py-2.5">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-[12.5px] font-bold text-[#0B1F3A]">
                    {TIMELINE_EVENT_LABELS[e.event_type as TimelineEventType]}
                  </p>
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
