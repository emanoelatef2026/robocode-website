import { requirePortalRole } from '@/modules/rbac/guards'
import { getInstructorByUserId, getSessionDetail } from '@/modules/instructor-portal/queries'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import AttendanceForm from './AttendanceForm'
import SessionDetailsPanel from './SessionDetailsPanel'

interface Props { params: Promise<{ id: string; sid: string }> }

const STATUS_COLORS: Record<string, string> = {
  scheduled: 'bg-blue-100 text-blue-700',
  ongoing:   'bg-yellow-100 text-yellow-700',
  completed: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
}

const STATUS_ICONS: Record<string, string> = {
  completed: '✓',
  ongoing:   '▶',
  scheduled: '○',
  cancelled: '✕',
}

export default async function SessionDetailPage({ params }: Props) {
  const user       = await requirePortalRole('instructor')
  const { id, sid } = await params
  const instructor  = await getInstructorByUserId(user.id)
  if (!instructor) notFound()

  const session = await getSessionDetail(sid, instructor.id)
  if (!session) notFound()

  const markedCount   = session.attendance.filter((r) => r.status !== null).length
  const unmarkedCount = session.student_count - markedCount

  return (
    <div className="space-y-5">
      {/* ── Breadcrumb + header ──────────────────────────────────────────── */}
      <div>
        <Link href={`/portal/instructor/groups/${id}`} className="text-sm text-[#64748B] hover:text-[#0B1F3A]">
          ← {session.group_name}
        </Link>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <h1 className="text-xl font-bold text-[#0B1F3A]">
            Session {session.current_session_num}
            {session.topic && <span className="ml-2 font-normal text-[#64748B]">· {session.topic}</span>}
          </h1>
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[session.status] ?? 'bg-gray-100 text-gray-600'}`}>
            {session.status}
          </span>
        </div>
        <p className="mt-0.5 text-sm text-[#64748B]">{session.course_title}</p>
      </div>

      {/* ── Curriculum Progress Timeline ─────────────────────────────────── */}
      {session.progress.length > 0 && (
        <div className="rounded-xl border border-[#E2E8F0] bg-white px-5 py-4">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide text-[#94A3B8]">
              Curriculum Progress
            </p>
            <p className="text-xs text-[#64748B]">
              {session.progress.filter((p) => p.status === 'completed').length} / {session.progress.length} completed
            </p>
          </div>
          <div className="flex gap-1.5 overflow-x-auto pb-1">
            {session.progress.map((p) => {
              const isCurrent = p.id === session.id
              const isDone    = p.status === 'completed'
              return (
                <Link
                  key={p.id}
                  href={`/portal/instructor/groups/${id}/sessions/${p.id}`}
                  title={p.topic ?? `Session ${p.session_num}`}
                  className={[
                    'flex h-8 min-w-[2rem] shrink-0 items-center justify-center rounded-lg text-xs font-semibold transition',
                    isCurrent
                      ? 'bg-[#FF8A1F] text-white ring-2 ring-[#FF8A1F] ring-offset-1'
                      : isDone
                        ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                        : 'bg-[#F1F5F9] text-[#94A3B8] hover:bg-[#E2E8F0]',
                  ].join(' ')}
                >
                  {isDone && !isCurrent ? '✓' : p.session_num}
                </Link>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Session meta ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'Date',     value: new Date(session.scheduled_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) },
          { label: 'Time',     value: new Date(session.scheduled_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) },
          { label: 'Duration', value: `${session.duration_minutes} min` },
          { label: 'Delivery', value: session.delivery ?? '—' },
        ].map(({ label, value }) => (
          <div key={label} className="rounded-lg border border-[#E2E8F0] bg-white px-4 py-3">
            <p className="text-xs text-[#94A3B8]">{label}</p>
            <p className="mt-0.5 text-sm font-medium text-[#0B1F3A]">{value}</p>
          </div>
        ))}
      </div>

      {session.meeting_url && (
        <a
          href={session.meeting_url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-lg border border-[#E2E8F0] bg-white px-4 py-2 text-sm text-[#3B82F6] hover:bg-[#F8FAFC] transition"
        >
          <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
            <path d="M11 3a1 1 0 100 2h2.586l-6.293 6.293a1 1 0 101.414 1.414L15 6.414V9a1 1 0 102 0V4a1 1 0 00-1-1h-5z" />
            <path d="M5 5a2 2 0 00-2 2v8a2 2 0 002 2h8a2 2 0 002-2v-3a1 1 0 10-2 0v3H5V7h3a1 1 0 000-2H5z" />
          </svg>
          Join Meeting
        </a>
      )}

      {/* ── Main two-column workspace ─────────────────────────────────────── */}
      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        {/* LEFT — Attendance */}
        <div className="space-y-4">
          {/* Attendance progress bar */}
          <div className="rounded-xl border border-[#E2E8F0] bg-white px-5 py-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-[#0B1F3A]">Attendance</p>
              <p className="text-sm text-[#64748B]">
                {markedCount}/{session.student_count} marked
                {unmarkedCount > 0 && <span className="ml-1 text-amber-600">· {unmarkedCount} pending</span>}
              </p>
            </div>
            {session.student_count > 0 && (
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[#F1F5F9]">
                <div
                  className="h-full rounded-full bg-[#FF8A1F] transition-all"
                  style={{ width: `${(markedCount / session.student_count) * 100}%` }}
                />
              </div>
            )}
          </div>

          <AttendanceForm sessionId={session.id} groupId={session.group_id} rows={session.attendance} />
        </div>

        {/* RIGHT — Session management panel */}
        <SessionDetailsPanel session={session} groupId={id} />
      </div>
    </div>
  )
}
