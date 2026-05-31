import { requirePortalRole } from '@/modules/rbac/guards'
import {
  getInstructorByUserId,
  listSessionHistory,
  listInstructorGroups,
} from '@/modules/instructor-portal/queries'
import Link from 'next/link'

interface Props {
  searchParams: Promise<Record<string, string | undefined>>
}

const STATUS_COLORS: Record<string, string> = {
  completed: 'bg-green-100 text-green-700',
  ongoing:   'bg-yellow-100 text-yellow-700',
  scheduled: 'bg-blue-100 text-blue-700',
  cancelled: 'bg-red-100 text-red-700',
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

  const activeGroups = groups.filter((g) => !!g.course_title)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-[#0B1F3A]">Session History</h1>
        <p className="mt-0.5 text-sm text-[#64748B]">All sessions across your groups</p>
      </div>

      {/* Filters */}
      <form method="GET" className="rounded-xl border border-[#E2E8F0] bg-white p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div>
            <label className="mb-1 block text-xs font-medium text-[#64748B]">From</label>
            <input
              type="date"
              name="from"
              defaultValue={from ?? ''}
              className="w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm focus:border-[#FF8A1F] focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[#64748B]">To</label>
            <input
              type="date"
              name="to"
              defaultValue={to ?? ''}
              className="w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm focus:border-[#FF8A1F] focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[#64748B]">Group</label>
            <select
              name="groupId"
              defaultValue={groupId ?? ''}
              className="w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm focus:border-[#FF8A1F] focus:outline-none"
            >
              <option value="">All groups</option>
              {activeGroups.map((g) => (
                <option key={g.group_id} value={g.group_id}>{g.group_name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[#64748B]">Topic</label>
            <input
              type="text"
              name="topic"
              defaultValue={topic ?? ''}
              placeholder="Search topics…"
              className="w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm focus:border-[#FF8A1F] focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[#64748B]">Status</label>
            <select
              name="status"
              defaultValue={status ?? ''}
              className="w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm focus:border-[#FF8A1F] focus:outline-none"
            >
              <option value="">All statuses</option>
              <option value="completed">Completed</option>
              <option value="ongoing">Ongoing</option>
              <option value="scheduled">Scheduled</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
        </div>
        <div className="mt-3 flex items-center gap-2">
          <button
            type="submit"
            className="rounded-lg bg-[#FF8A1F] px-4 py-2 text-sm font-medium text-white hover:bg-[#e07818] transition"
          >
            Apply Filters
          </button>
          <a
            href="/portal/instructor/history"
            className="rounded-lg border border-[#E2E8F0] px-4 py-2 text-sm font-medium text-[#64748B] hover:border-[#CBD5E1] transition"
          >
            Clear
          </a>
        </div>
      </form>

      {/* Results */}
      {sessions.length === 0 ? (
        <div className="flex h-48 items-center justify-center rounded-xl border border-dashed border-[#E2E8F0] text-sm text-[#64748B]">
          No sessions found.
        </div>
      ) : (
        <div className="rounded-xl border border-[#E2E8F0] bg-white overflow-hidden">
          <div className="border-b border-[#E2E8F0] px-5 py-3">
            <p className="text-sm font-semibold text-[#0B1F3A]">{sessions.length} session{sessions.length !== 1 ? 's' : ''}</p>
          </div>

          {/* Table header */}
          <div className="hidden grid-cols-[120px_1fr_1fr_100px_1fr_140px_90px] gap-4 border-b border-[#F1F5F9] px-5 py-2 text-[11px] font-semibold uppercase tracking-wide text-[#94A3B8] lg:grid">
            <span>Date</span>
            <span>Group</span>
            <span>Course</span>
            <span>Session #</span>
            <span>Topic</span>
            <span>Attendance</span>
            <span>Status</span>
          </div>

          <div className="divide-y divide-[#F1F5F9]">
            {sessions.map((s) => (
              <Link
                key={s.session_id}
                href={`/portal/instructor/history/${s.session_id}`}
                className="flex flex-col gap-1 px-5 py-3.5 transition hover:bg-[#F8FAFC] lg:grid lg:grid-cols-[120px_1fr_1fr_100px_1fr_140px_90px] lg:items-center lg:gap-4"
              >
                <span className="text-xs text-[#64748B]">
                  {new Date(s.scheduled_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                </span>
                <span className="font-medium text-[#0B1F3A] text-sm truncate">{s.group_name}</span>
                <span className="text-xs text-[#64748B] truncate">{s.course_title || '—'}</span>
                <span className="text-xs font-semibold text-[#0B1F3A]">
                  {s.session_num} / {s.total_in_group}
                </span>
                <span className="text-xs text-[#64748B] truncate">{s.topic || <span className="italic text-[#94A3B8]">No topic</span>}</span>
                <span className="text-xs text-[#64748B]">
                  {s.total_students > 0 ? (
                    <>
                      <span className="text-green-600">{s.present_count}P</span>
                      {' · '}
                      <span className="text-red-500">{s.absent_count}A</span>
                      {s.late_count > 0 && <>{' · '}<span className="text-yellow-600">{s.late_count}L</span></>}
                      {' / '}{s.total_students}
                    </>
                  ) : '—'}
                </span>
                <span className={`w-fit rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_COLORS[s.status] ?? 'bg-gray-100 text-gray-600'}`}>
                  {s.status}
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
