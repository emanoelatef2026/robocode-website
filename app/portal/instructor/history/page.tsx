import { requirePortalRole } from '@/modules/rbac/guards'
import {
  getInstructorByUserId,
  listSessionHistory,
  listInstructorGroups,
} from '@/modules/instructor-portal/queries'
import Link from 'next/link'
import EmptyState from '@/components/admin/EmptyState'
import StatusBadge from '@/components/admin/StatusBadge'
import HistoryFilterPanel from './_components/HistoryFilterPanel'

interface Props {
  searchParams: Promise<Record<string, string | undefined>>
}

// Cancelled/postponed sessions are excluded from all system KPIs — these tabs
// exist purely as an informational log for the instructor.
const TAB_STATUSES: Record<string, string[]> = {
  done:      ['completed'],
  scheduled: ['scheduled', 'ongoing'],
  postponed: ['postponed'],
  cancelled: ['cancelled', 'cancelled_with_makeup'],
}
const TABS: { key: string; label: string }[] = [
  { key: 'done',      label: 'Done' },
  { key: 'scheduled', label: 'Scheduled' },
  { key: 'postponed', label: 'Postponed' },
  { key: 'cancelled', label: 'Cancelled' },
]

export default async function MySessionsPage({ searchParams }: Props) {
  const user       = await requirePortalRole('instructor')
  const instructor = await getInstructorByUserId(user.id)

  if (!instructor) {
    return (
      <EmptyState
        title="No instructor record found"
        description="Contact your team leader to link your account."
      />
    )
  }

  const sp      = await searchParams
  const from    = sp.from    ?? undefined
  const to      = sp.to      ?? undefined
  const groupId = sp.groupId ?? undefined
  const topic   = sp.topic   ?? undefined
  const tab     = sp.tab && TAB_STATUSES[sp.tab] ? sp.tab : 'done'

  const [groups, sessions] = await Promise.all([
    listInstructorGroups(instructor.id),
    listSessionHistory(instructor.id, { from, to, groupId, topic, status: TAB_STATUSES[tab] }),
  ])

  const activeGroups = groups.filter(g => !!g.course_title)

  const tabHref = (key: string) => {
    const params = new URLSearchParams()
    if (from)    params.set('from', from)
    if (to)      params.set('to', to)
    if (groupId) params.set('groupId', groupId)
    if (topic)   params.set('topic', topic)
    if (key !== 'done') params.set('tab', key)
    const qs = params.toString()
    return `/portal/instructor/history${qs ? `?${qs}` : ''}`
  }

  return (
    <div className="space-y-3 md:space-y-4">

      {/* Tabs */}
      <div className="flex gap-1 border-b border-[#E2E8F0]">
        {TABS.map(t => (
          <Link
            key={t.key}
            href={tabHref(t.key)}
            className={`px-3.5 py-2 text-[13px] font-semibold transition ${
              tab === t.key
                ? 'border-b-2 border-[#FF8A1F] text-[#0B1F3A]'
                : 'text-[#94A3B8] hover:text-[#0B1F3A]'
            }`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {/* Filters */}
      <HistoryFilterPanel
        groups={activeGroups}
        from={from}
        to={to}
        groupId={groupId}
        topic={topic}
        tab={tab}
      />

      {/* Results */}
      {sessions.length === 0 ? (
        <EmptyState
          title="No sessions found"
          description="Try adjusting the filters above."
        />
      ) : (
        <div className="overflow-hidden ds-card">

          {/* Count header */}
          <div className="border-b border-[#E2E8F0] px-4 py-2.5">
            <p className="text-[12px] font-semibold text-[#0B1F3A]">
              {sessions.length} session{sessions.length !== 1 ? 's' : ''}
            </p>
          </div>

          {/* Desktop table header */}
          <div className="hidden lg:grid grid-cols-[110px_1fr_1fr_90px_1fr_130px_100px] gap-3 border-b border-[#F1F5F9] bg-[#F8FAFC] px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-[#94A3B8]">
            <span>Date</span>
            <span>Group</span>
            <span>Course</span>
            <span>Session</span>
            <span>Topic</span>
            <span>Attendance</span>
            <span>Status</span>
          </div>

          <div className="divide-y divide-[#F1F5F9]">
            {sessions.map(s => {
              const dateShort = new Date(s.scheduled_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' })
              const dateFull  = new Date(s.scheduled_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })

              const href = s.session_type === 'primary'
                ? `/portal/instructor/history/${s.session_id}`
                : `/portal/instructor/special-sessions/${s.session_id}`
              const typeBadge = s.session_type === 'trial'
                ? { label: '🟣 Trial',  style: 'bg-purple-100 text-purple-700' }
                : s.session_type === 'makeup'
                ? { label: '🟠 Makeup', style: 'bg-orange-100 text-orange-700' }
                : null

              return (
                <Link
                  key={s.session_id}
                  href={href}
                  className="block transition active:bg-[#F8FAFC] lg:hover:bg-[#F8FAFC]"
                >

                  {/* ── Mobile card ── */}
                  <div className="px-4 py-3 lg:hidden">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-[11px] text-[#94A3B8] shrink-0">{dateShort}</span>
                        {typeBadge ? (
                          <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold shrink-0 ${typeBadge.style}`}>
                            {typeBadge.label}
                          </span>
                        ) : (
                          <span className="text-[11px] font-bold text-[#0B1F3A] shrink-0">
                            #{s.session_num}/{s.total_in_group}
                          </span>
                        )}
                      </div>
                      <StatusBadge status={s.status} dot />
                    </div>
                    <div className="mt-1 flex items-baseline gap-1.5 min-w-0">
                      <p className="text-[13px] font-bold text-[#0B1F3A] truncate leading-tight">{s.group_name}</p>
                      {s.course_title && (
                        <p className="text-[11px] text-[#64748B] truncate shrink-0 leading-tight">{s.course_title}</p>
                      )}
                    </div>
                    <div className="mt-1 flex items-center justify-between gap-2">
                      <p className={`text-[11px] truncate ${s.topic ? 'text-[#64748B]' : 'italic text-[#CBD5E1]'}`}>
                        {s.topic ?? 'No topic'}
                      </p>
                      {s.total_students > 0 && (
                        <p className="shrink-0 text-[11px] font-medium">
                          <span className="text-[#10B981]">{s.present_count}P</span>
                          <span className="text-[#CBD5E1]"> · </span>
                          <span className="text-[#EF4444]">{s.absent_count}A</span>
                          {s.late_count > 0 && (
                            <><span className="text-[#CBD5E1]"> · </span><span className="text-[#F59E0B]">{s.late_count}L</span></>
                          )}
                          <span className="text-[#94A3B8]">/{s.total_students}</span>
                        </p>
                      )}
                    </div>
                  </div>

                  {/* ── Desktop row ── */}
                  <div className="hidden lg:grid grid-cols-[110px_1fr_1fr_90px_1fr_130px_100px] items-center gap-3 px-4 py-3">
                    <span className="text-[12px] text-[#64748B]">{dateFull}</span>
                    <span className="text-[13px] font-semibold text-[#0B1F3A] truncate">{s.group_name}</span>
                    <span className="text-[12px] text-[#64748B] truncate">{s.course_title || '—'}</span>
                    {typeBadge ? (
                      <span className={`inline-flex w-fit rounded-full px-2 py-0.5 text-[10px] font-bold ${typeBadge.style}`}>
                        {typeBadge.label}
                      </span>
                    ) : (
                      <span className="text-[12px] font-semibold text-[#0B1F3A]">
                        {s.session_num} / {s.total_in_group}
                      </span>
                    )}
                    <span className={`text-[12px] truncate ${s.topic ? 'text-[#64748B]' : 'italic text-[#CBD5E1]'}`}>
                      {s.topic ?? 'No topic'}
                    </span>
                    {s.total_students > 0 ? (
                      <span className="text-[12px]">
                        <span className="text-[#10B981]">{s.present_count}P</span>
                        {' · '}
                        <span className="text-[#EF4444]">{s.absent_count}A</span>
                        {s.late_count > 0 && <>{' · '}<span className="text-[#F59E0B]">{s.late_count}L</span></>}
                        <span className="text-[#94A3B8]"> / {s.total_students}</span>
                      </span>
                    ) : (
                      <span className="text-[12px] text-[#CBD5E1]">—</span>
                    )}
                    <StatusBadge status={s.status} dot />
                  </div>

                </Link>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
