import Link from 'next/link'
import { EVALUATION_CRITERION_LABELS } from '@/modules/student-evaluations/types'
import type { ActivityEvent } from '@/modules/parents/parent-portal-queries'
import type { StudentEvaluation } from '@/modules/student-evaluations/types'
import type { StudentCompetition } from '@/modules/student-competitions/types'
import type { StudentNote } from '@/modules/student-notes/types'

interface FeedItem {
  id:        string
  icon:      string
  iconBg:    string
  iconColor: string
  title:     string
  subtitle:  string | null
  date:      string
  href:      string
}

const ACTIVITY_ICON: Record<ActivityEvent['event_type'], { icon: string; bg: string; color: string }> = {
  attendance_marked:  { icon: '✓',  bg: 'bg-[#E7F8EE]',    color: 'text-[#10B981]' },
  homework_submitted: { icon: '📄', bg: 'bg-[#EFF6FF]',    color: 'text-[#2563EB]' },
  homework_graded:    { icon: '✦',  bg: 'bg-indigo-100',   color: 'text-indigo-600' },
  portfolio_uploaded: { icon: '🖼', bg: 'bg-purple-100',   color: 'text-purple-600' },
  portfolio_approved: { icon: '★',  bg: 'bg-[#E7F8EE]',    color: 'text-[#10B981]' },
  certificate_earned: { icon: '🏆', bg: 'bg-[#FF8A1F]/15', color: 'text-[#FF8A1F]' },
}

function activityHref(childHref: (path: string) => string, type: ActivityEvent['event_type']): string {
  if (type === 'attendance_marked') return childHref('/portal/parent/attendance')
  if (type.startsWith('homework'))  return childHref('/portal/parent/assignments')
  if (type.startsWith('portfolio')) return childHref('/portal/parent/portfolio')
  return childHref('/portal/parent/certificates')
}

interface Props {
  activity:     ActivityEvent[]
  evaluations:  StudentEvaluation[]
  competitions: StudentCompetition[]
  notes:        StudentNote[]
  childHref:    (path: string) => string
  limit?:       number
}

// The parent-facing activity feed — merges every "something happened" source
// (attendance, homework, portfolio, certificates, evaluations, competitions,
// notes) into one reverse-chronological list instead of six separate cards.
export default function RecentActivityFeed({ activity, evaluations, competitions, notes, childHref, limit = 8 }: Props) {
  const items: FeedItem[] = [
    ...activity.map((a): FeedItem => {
      const cfg = ACTIVITY_ICON[a.event_type] ?? { icon: '•', bg: 'bg-[#F3F4F6]', color: 'text-[#6B7280]' }
      return { id: a.id, icon: cfg.icon, iconBg: cfg.bg, iconColor: cfg.color, title: a.title, subtitle: a.subtitle, date: a.date, href: activityHref(childHref, a.event_type) }
    }),
    ...evaluations.slice(0, 5).map((e): FeedItem => ({
      id: `eval-${e.id}`,
      icon: '📊', iconBg: 'bg-blue-50', iconColor: 'text-blue-600',
      title: 'Evaluation added',
      subtitle: `${EVALUATION_CRITERION_LABELS[e.criterion] ?? e.criterion}${e.rating != null ? ` · ${e.rating}★` : ''}`,
      date: e.evaluated_at,
      href: childHref('/portal/parent/evaluations'),
    })),
    ...competitions.slice(0, 5).map((c): FeedItem => ({
      id: `comp-${c.id}`,
      icon: '🎖️', iconBg: 'bg-purple-50', iconColor: 'text-purple-600',
      title: 'Competition added',
      subtitle: `${c.competition_name} (${c.year})${c.award ? ` · ${c.award}` : ''}`,
      date: c.created_at,
      href: childHref('/portal/parent/competitions'),
    })),
    ...notes.slice(0, 5).map((n): FeedItem => ({
      id: `note-${n.id}`,
      icon: '📌', iconBg: 'bg-amber-50', iconColor: 'text-amber-600',
      title: 'Note from Academy',
      subtitle: n.content,
      date: n.created_at,
      href: childHref('/portal/parent/notes'),
    })),
  ]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, limit)

  return (
    <div className="ds-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-semibold text-[#0B1F3A]">Recent Activity</p>
        <Link href={childHref('/portal/parent/journey')} className="text-[12px] text-[#FF8A1F] hover:underline">
          Full journey →
        </Link>
      </div>

      {items.length === 0 ? (
        <p className="text-sm text-[#64748B]">No activity yet.</p>
      ) : (
        <div className="space-y-1">
          {items.map(item => (
            <Link
              key={item.id}
              href={item.href}
              className="flex items-start gap-2.5 rounded-lg px-1.5 py-2 transition hover:bg-[#F8FAFC]"
            >
              <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[13px] ${item.iconBg} ${item.iconColor}`}>
                {item.icon}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-medium text-[#0B1F3A]">{item.title}</p>
                {item.subtitle && <p className="truncate text-[11px] text-[#64748B]">{item.subtitle}</p>}
              </div>
              <p className="shrink-0 text-[11px] text-[#64748B]">
                {new Date(item.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
