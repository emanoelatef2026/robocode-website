import { requirePortalRole } from '@/modules/rbac/guards'
import {
  getInstructorByUserId,
  listSessionHistory,
  listInstructorGroups,
} from '@/modules/instructor-portal/queries'
import Link from 'next/link'
import HistoryFilterPanel from './_components/HistoryFilterPanel'

interface Props {
  searchParams: Promise<Record<string, string | undefined>>
}

const STATUS_META: Record<string, { label: string; cls: string; dot: string }> = {
  completed: { label: 'Completed', cls: 'bg-[#E7F8EE] text-[#15803D]', dot: 'bg-[#10B981]' },
  ongoing:   { label: 'Ongoing',   cls: 'bg-[#EFF6FF] text-[#1D4ED8]',       dot: 'bg-[#3B82F6] animate-pulse' },
  scheduled: { label: 'Scheduled', cls: 'bg-[#F1F5F9] text-[#475569]',     dot: 'bg-[#94A3B8]' },
  cancelled: { label: 'Cancelled', cls: 'bg-[#FEE2E2] text-[#EF4444]',         dot: 'bg-[#EF4444]' },
}

export default async function SessionHistoryPage({ searchParams }: Props) {
  const user       = await requirePortalRole('instructor')
  const instructor = await getInstructorByUserId(user.id)

  if (!instructor) {
    return (
      <div className="flex h-64 items-center justify-center text-[#64748B]">
        No instructor record found. Contact your team leader.
      </div>
    )
  }

  const sp      = await searchParams
  const from    = sp.from    ?? undefined
  const to      = sp.to      ?? undefined
  const groupId = sp.groupId ?? undefined
  const topic   = sp.topic   ?? undefined
  const status  = sp.status  ?? undefined

  const [groups, sessions] = await Promise.all([
    listInstructorGroups(instructor.id),
    listSessionHistory(instructor.id, { from, to, groupId, topic, status }),
  ])

  const activeGroups = groups.filter(g => !!g.course_title)

  return (
    <div className="space-y-3 md:space-y-4">

      {/* Header */}
      <div>
        <h1 className="text-[18px] md:text-xl font-bold text-[#0B1F3A]">Session History</h1>
        <p className="mt-0.5 text-[12px] md:text-sm text-[#64748B]">All sessions across your groups</p>
      </div>

      {/* Filters */}
      <HistoryFilterPanel
        groups={activeGroups}
        from={from}
        to={to}
        groupId={groupId}
        topic={topic}
        status={status}
      />

      {/* Results */}
      {sessions.length === 0 ? (
        <div className="flex h-40 items-center justify-center rounded-xl border border-dashed border-[#E2E8F0] text-[13px] text-[#94A3B8]">
          No sessions found
        </div>
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
              const meta      = STATUS_META[s.status] ?? { label: s.status, cls: 'bg-[#F1F5F9] text-[#475569]', dot: 'bg-[#94A3B8]' }
              const dateShort = new Date(s.scheduled_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' })
              const dateFull  = new Date(s.scheduled_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })

              return (
                <Link
                  key={s.session_id}
                  href={`/portal/instructor/history/${s.session_id}`}
                  className="block transition active:bg-[#F8FAFC] lg:hover:bg-[#F8FAFC]"
                >

                  {/* ── Mobile card ── */}
                  <div className="px-4 py-3 lg:hidden">
                    {/* Row 1: date + session# + status */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-[11px] text-[#94A3B8] shrink-0">{dateShort}</span>
                        <span className="text-[11px] font-bold text-[#0B1F3A] shrink-0">
                          #{s.session_num}/{s.total_in_group}
                        </span>
                      </div>
                      <span className={`shrink-0 flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${meta.cls}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
                        {meta.label}
                      </span>
                    </div>

                    {/* Row 2: group name + course */}
                    <div className="mt-1 flex items-baseline gap-1.5 min-w-0">
                      <p className="text-[13px] font-bold text-[#0B1F3A] truncate leading-tight">{s.group_name}</p>
                      {s.course_title && (
                        <p className="text-[11px] text-[#64748B] truncate shrink-0 leading-tight">{s.course_title}</p>
                      )}
                    </div>

                    {/* Row 3: topic + attendance */}
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
                    <span className="text-[12px] text-[#64748B] truncate">{s.course_title ?? '—'}</span>
                    <span className="text-[12px] font-semibold text-[#0B1F3A]">
                      {s.session_num} / {s.total_in_group}
                    </span>
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
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold w-fit ${meta.cls}`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
                      {meta.label}
                    </span>
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
