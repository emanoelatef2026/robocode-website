import { requirePortalRole } from '@/modules/rbac/guards'
import { getInstructorByUserId, getSessionDetail } from '@/modules/instructor-portal/queries'
import { notFound } from 'next/navigation'
import Link from 'next/link'

interface Props { params: Promise<{ sessionId: string }> }

const STATUS_COLORS: Record<string, string> = {
  completed: 'bg-green-100 text-green-700',
  ongoing:   'bg-yellow-100 text-yellow-700',
  scheduled: 'bg-blue-100 text-blue-700',
  cancelled: 'bg-red-100 text-red-700',
}

const ATT_COLORS: Record<string, string> = {
  present: 'text-green-600 bg-green-50',
  absent:  'text-red-600 bg-red-50',
  late:    'text-yellow-700 bg-yellow-50',
  excused: 'text-blue-600 bg-blue-50',
  makeup:  'text-purple-600 bg-purple-50',
}

export default async function SessionHistoryDetailPage({ params }: Props) {
  const user            = await requirePortalRole('instructor')
  const { sessionId }   = await params
  const instructor      = await getInstructorByUserId(user.id)
  if (!instructor) notFound()

  const session = await getSessionDetail(sessionId, instructor.id)
  if (!session) notFound()

  const present = session.attendance.filter((r) => r.status === 'present').length
  const absent  = session.attendance.filter((r) => r.status === 'absent').length
  const late    = session.attendance.filter((r) => r.status === 'late').length
  const marked  = session.attendance.filter((r) => r.status !== null).length

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Breadcrumb */}
      <div>
        <Link href="/portal/instructor/history" className="text-sm text-[#64748B] hover:text-[#0B1F3A]">
          ← Session History
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
        <p className="mt-0.5 text-sm text-[#64748B]">
          {session.group_name} · {session.course_title}
        </p>
      </div>

      {/* Session meta */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {[
          { label: 'Date',     value: new Date(session.scheduled_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) },
          { label: 'Group',    value: session.group_name },
          { label: 'Course',   value: session.course_title || '—' },
          { label: 'Session',  value: `${session.current_session_num} / ${session.progress.length || '?'}` },
          ...(session.started_at ? [{ label: 'Started', value: new Date(session.started_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) }] : []),
          ...(session.ended_at   ? [{ label: 'Ended',   value: new Date(session.ended_at).toLocaleTimeString('en-GB',   { hour: '2-digit', minute: '2-digit' }) }] : []),
          { label: 'Duration', value: `${session.duration_minutes} min` },
          { label: 'Delivery', value: session.delivery ?? '—' },
        ].map(({ label, value }) => (
          <div key={label} className="rounded-lg border border-[#E2E8F0] bg-white px-4 py-3">
            <p className="text-xs text-[#94A3B8]">{label}</p>
            <p className="mt-0.5 text-sm font-medium text-[#0B1F3A]">{value}</p>
          </div>
        ))}
      </div>

      {/* Notes */}
      {(session.topic || session.notes) && (
        <div className="rounded-xl border border-[#E2E8F0] bg-white p-5 space-y-3">
          <h2 className="text-sm font-semibold text-[#0B1F3A]">Session Notes</h2>
          {session.topic && (
            <div>
              <p className="text-xs font-medium text-[#94A3B8]">Topic</p>
              <p className="mt-1 text-sm text-[#0B1F3A]">{session.topic}</p>
            </div>
          )}
          {session.notes && (
            <div>
              <p className="text-xs font-medium text-[#94A3B8]">Notes</p>
              <p className="mt-1 whitespace-pre-wrap text-sm text-[#0B1F3A]">{session.notes}</p>
            </div>
          )}
        </div>
      )}

      {/* Attendance Summary */}
      <div className="rounded-xl border border-[#E2E8F0] bg-white p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-[#0B1F3A]">Attendance</h2>
          <p className="text-xs text-[#64748B]">{marked}/{session.student_count} recorded</p>
        </div>

        <div className="grid grid-cols-4 gap-3">
          {[
            { label: 'Present', value: present, cls: 'text-green-600' },
            { label: 'Absent',  value: absent,  cls: 'text-red-600' },
            { label: 'Late',    value: late,    cls: 'text-yellow-600' },
            { label: 'Total',   value: session.student_count, cls: 'text-[#0B1F3A]' },
          ].map(({ label, value, cls }) => (
            <div key={label} className="rounded-lg border border-[#E2E8F0] px-3 py-2 text-center">
              <p className={`text-lg font-bold ${cls}`}>{value}</p>
              <p className="text-xs text-[#94A3B8]">{label}</p>
            </div>
          ))}
        </div>

        {session.attendance.length > 0 && (
          <div className="divide-y divide-[#F1F5F9] rounded-lg border border-[#E2E8F0] overflow-hidden">
            {session.attendance.map((r) => (
              <div key={r.student_id} className="flex items-center gap-3 px-4 py-2.5">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#EFF6FF] text-xs font-semibold text-[#3B82F6]">
                  {r.student_name[0]?.toUpperCase() ?? '?'}
                </div>
                <p className="flex-1 text-sm text-[#0B1F3A]">{r.student_name}</p>
                {r.status ? (
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${ATT_COLORS[r.status] ?? 'bg-gray-100 text-gray-600'}`}>
                    {r.status}
                  </span>
                ) : (
                  <span className="text-xs text-[#94A3B8]">—</span>
                )}
                {r.notes && <p className="text-xs text-[#94A3B8] truncate max-w-[120px]">{r.notes}</p>}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Homework created */}
      {/* (Homework assignments are linked via schedule_id — no direct list needed here) */}

      {/* Resources */}
      {session.resources_links.length > 0 && (
        <div className="rounded-xl border border-[#E2E8F0] bg-white p-5 space-y-3">
          <h2 className="text-sm font-semibold text-[#0B1F3A]">Resources</h2>
          <div className="space-y-1.5">
            {session.resources_links.map((r, i) => (
              <a
                key={i}
                href={r.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm text-[#3B82F6] hover:bg-[#F8FAFC] transition"
              >
                <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5 shrink-0">
                  <path d="M11 3a1 1 0 100 2h2.586l-6.293 6.293a1 1 0 101.414 1.414L15 6.414V9a1 1 0 102 0V4a1 1 0 00-1-1h-5z" />
                  <path d="M5 5a2 2 0 00-2 2v8a2 2 0 002 2h8a2 2 0 002-2v-3a1 1 0 10-2 0v3H5V7h3a1 1 0 000-2H5z" />
                </svg>
                {r.title || r.url}
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Recordings */}
      {session.recordings.length > 0 && (
        <div className="rounded-xl border border-[#E2E8F0] bg-white p-5 space-y-3">
          <h2 className="text-sm font-semibold text-[#0B1F3A]">Recordings</h2>
          <div className="space-y-1.5">
            {session.recordings.map((rec) => (
              <a
                key={rec.id}
                href={rec.external_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm text-[#3B82F6] hover:bg-[#F8FAFC] transition"
              >
                <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5 shrink-0">
                  <path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zM14.553 7.106A1 1 0 0014 8v4a1 1 0 00.553.894l2 1A1 1 0 0018 13V7a1 1 0 00-1.447-.894l-2 1z" />
                </svg>
                {rec.title || 'Recording'}
                <span className="ml-auto text-[10px] text-[#94A3B8]">{rec.provider}</span>
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Meeting link */}
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
          Meeting Link
        </a>
      )}
    </div>
  )
}
