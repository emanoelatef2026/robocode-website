import { requirePortalRole } from '@/modules/rbac/guards'
import {
  getInstructorByUserId,
  listInboxSubmissions,
  listInstructorGroups,
} from '@/modules/instructor-portal/queries'
import Link from 'next/link'

interface Props {
  searchParams: Promise<Record<string, string | undefined>>
}

const STATUS_COLORS: Record<string, string> = {
  submitted:   'bg-amber-100 text-amber-700',
  resubmitted: 'bg-purple-100 text-purple-700',
  graded:      'bg-green-100 text-green-700',
  returned:    'bg-blue-100 text-blue-700',
}

export default async function HomeworkInboxPage({ searchParams }: Props) {
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
      <div>
        <h1 className="text-xl font-bold text-[#0B1F3A]">Homework Inbox</h1>
        <p className="mt-0.5 text-sm text-[#64748B]">Review and grade student submissions</p>
      </div>

      {/* Filters row */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Status tabs */}
        <div className="flex rounded-lg border border-[#E2E8F0] bg-white overflow-hidden">
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
          <form method="GET">
            <input type="hidden" name="filter" value={filter} />
            <select
              name="groupId"
              defaultValue={groupId ?? ''}
              onChange={(e) => {
                // JS-based immediate submit — form action handles it on server
              }}
              className="rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-sm text-[#0B1F3A] focus:border-[#FF8A1F] focus:outline-none"
            >
              <option value="">All groups</option>
              {activeGroups.map((g) => (
                <option key={g.group_id} value={g.group_id}>{g.group_name}</option>
              ))}
            </select>
            <button type="submit" className="ml-1 rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-sm text-[#64748B] hover:border-[#FF8A1F] transition">
              Go
            </button>
          </form>
        )}
      </div>

      {/* Table */}
      {submissions.length === 0 ? (
        <div className="flex h-48 items-center justify-center rounded-xl border border-dashed border-[#E2E8F0] text-sm text-[#64748B]">
          No submissions found.
        </div>
      ) : (
        <div className="rounded-xl border border-[#E2E8F0] bg-white overflow-hidden">
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
                    <span className="text-[10px] text-red-500">late</span>
                  )}
                </div>
                <p className="text-sm text-[#64748B] truncate">{s.assignment_title}</p>
                <p className="text-xs text-[#94A3B8]">{s.group_name ?? '—'}</p>
                <p className="text-xs text-[#64748B]">
                  {new Date(s.submitted_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                </p>
                <div className="flex items-center gap-1 flex-wrap">
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${STATUS_COLORS[s.status] ?? 'bg-gray-100 text-gray-600'}`}>
                    {s.status}
                  </span>
                  {s.resubmission_count > 0 && (
                    <span className="rounded-full bg-purple-100 px-1.5 py-0.5 text-[10px] font-medium text-purple-600">
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
