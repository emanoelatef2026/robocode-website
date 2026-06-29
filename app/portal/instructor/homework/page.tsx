import { requirePortalRole } from '@/modules/rbac/guards'
import {
  getInstructorByUserId,
  listInboxSubmissions,
  listInstructorGroups,
} from '@/modules/instructor-portal/queries'
import Link from 'next/link'
import EmptyState from '@/components/admin/EmptyState'
import StatusBadge from '@/components/admin/StatusBadge'
import { HomeworkGroupSelect } from './_components/HomeworkGroupSelect'

interface Props {
  searchParams: Promise<Record<string, string | undefined>>
}

export default async function HomeworkInboxPage({ searchParams }: Props) {
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
  const filter  = (sp.filter  ?? 'pending') as 'pending' | 'reviewed' | 'all'
  const groupId = sp.groupId ?? undefined

  const [groups, submissions] = await Promise.all([
    listInstructorGroups(instructor.id),
    listInboxSubmissions(instructor.id, filter, groupId),
  ])

  const activeGroups = groups.filter((g) => !!g.course_title)

  const tabHref = (f: string) => {
    const params = new URLSearchParams()
    params.set('filter', f)
    if (groupId) params.set('groupId', groupId)
    return `/portal/instructor/homework?${params.toString()}`
  }

  return (
    <div className="space-y-6">

      {/* Filters row */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Status tabs */}
        <div className="flex ds-card overflow-hidden">
          {(['pending', 'reviewed', 'all'] as const).map((f) => (
            <Link
              key={f}
              href={tabHref(f)}
              className={[
                'px-4 py-2 text-sm font-medium capitalize transition',
                filter === f
                  ? 'bg-[#FF8A1F] text-white'
                  : 'text-[#64748B] hover:bg-[#F8FAFC]',
              ].join(' ')}
            >
              {f}
            </Link>
          ))}
        </div>

        {/* Group filter */}
        {activeGroups.length > 1 && (
          <HomeworkGroupSelect
            groups={activeGroups}
            currentFilter={filter}
            currentGroupId={groupId}
          />
        )}
      </div>

      {/* Table */}
      {submissions.length === 0 ? (
        <EmptyState
          title="No submissions found"
          description={filter === 'pending' ? 'All caught up — no pending homework to review.' : 'No submissions match this filter.'}
        />
      ) : (
        <div className="ds-card overflow-hidden">
          <div className="border-b border-[#E2E8F0] px-5 py-3">
            <p className="text-sm font-semibold text-[#0B1F3A]">
              {submissions.length} submission{submissions.length !== 1 ? 's' : ''}
            </p>
          </div>

          {/* Header row (desktop) */}
          <div className="hidden grid-cols-[1fr_1fr_1fr_110px_90px] gap-4 border-b border-[#F1F5F9] px-5 py-2 text-[11px] font-semibold uppercase tracking-wide text-[#94A3B8] lg:grid">
            <span>Student</span>
            <span>Assignment</span>
            <span>Group</span>
            <span>Submitted</span>
            <span>Status</span>
          </div>

          <div className="divide-y divide-[#F1F5F9]">
            {submissions.map((s) => (
              <Link
                key={s.submission_id}
                href={`/portal/instructor/homework/${s.submission_id}`}
                className="flex flex-col gap-1 px-5 py-3.5 transition hover:bg-[#F8FAFC] lg:grid lg:grid-cols-[1fr_1fr_1fr_110px_90px] lg:items-center lg:gap-4"
              >
                <div>
                  <p className="font-medium text-[#0B1F3A] text-sm">{s.student_name}</p>
                  {s.is_late && (
                    <span className="text-[10px] text-[#EF4444]">late</span>
                  )}
                </div>
                <p className="text-sm text-[#64748B] truncate">{s.assignment_title}</p>
                <p className="text-xs text-[#94A3B8]">{s.group_name ?? '—'}</p>
                <p className="text-xs text-[#64748B]">
                  {new Date(s.submitted_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                </p>
                <div className="flex items-center gap-1 flex-wrap">
                  <StatusBadge status={s.status} />
                  {s.is_late && <StatusBadge status="late" />}
                  {s.resubmission_count > 0 && (
                    <span className="rounded-full bg-[#F3E8FF] px-1.5 py-0.5 text-[10px] font-medium text-[#6B21A8]">
                      resub {s.resubmission_count}
                    </span>
                  )}
                  {s.score !== null && (
                    <span className="text-[10px] text-[#64748B]">{s.score}/100</span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
