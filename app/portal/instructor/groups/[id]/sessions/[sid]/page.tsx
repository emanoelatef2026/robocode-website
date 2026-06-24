import { requirePortalRole } from '@/modules/rbac/guards'
import { getInstructorByUserId, getSessionDetail } from '@/modules/instructor-portal/queries'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import AttendanceForm from './AttendanceForm'
import SessionDetailsPanel from './SessionDetailsPanel'
import StartSessionButton from './StartSessionButton'

interface Props { params: Promise<{ id: string; sid: string }> }

const STATUS_COLORS: Record<string, string> = {
  scheduled:             'bg-[#EFF6FF] text-[#1D4ED8] border-blue-200',
  ongoing:               'bg-yellow-100 text-yellow-700 border-yellow-200',
  completed:             'bg-[#E7F8EE] text-[#15803D] border-[#A7F3D0]',
  cancelled:             'bg-[#FEE2E2] text-[#DC2626] border-[#FECACA]',
  cancelled_with_makeup: 'bg-orange-100 text-orange-700 border-orange-200',
  postponed:             'bg-yellow-100 text-yellow-800 border-yellow-200',
}

const STATUS_LABELS: Record<string, string> = {
  scheduled:             'Scheduled',
  ongoing:               'In Progress',
  completed:             'Completed',
  cancelled:             'Cancelled',
  cancelled_with_makeup: 'Cancelled (makeup)',
  postponed:             'Postponed',
}

export default async function SessionDetailPage({ params }: Props) {
  const user        = await requirePortalRole('instructor')
  const { id, sid } = await params
  const instructor  = await getInstructorByUserId(user.id)
  if (!instructor) notFound()

  const session = await getSessionDetail(sid, instructor.id)
  if (!session) notFound()

  const markedCount   = session.attendance.filter((r) => r.status !== null).length
  const unmarkedCount = session.student_count - markedCount
  const presentCount  = session.attendance.filter((r) => r.status === 'present').length
  const absentCount   = session.attendance.filter((r) => r.status === 'absent').length
  const lateCount     = session.attendance.filter((r) => r.status === 'late').length

  const isCancelled   = session.status === 'cancelled' || session.status === 'cancelled_with_makeup'
  const isPostponed   = session.status === 'postponed'
  const isActionable  = !isCancelled && session.status !== 'completed'

  return (
    <div className="space-y-5">
      {/* ── Breadcrumb ───────────────────────────────────────────────────────── */}
      <div>
        <Link href={`/portal/instructor/groups/${id}`}
          className="text-sm text-[#64748B] hover:text-[#0B1F3A] transition">
          ← {session.group_name}
        </Link>

        <div className="mt-1 flex flex-wrap items-center gap-2">
          <h1 className="text-xl font-bold text-[#0B1F3A]">
            Session {session.current_session_num}
            {session.topic && (
              <span className="ml-2 font-normal text-[#64748B]">· {session.topic}</span>
            )}
          </h1>
          <span className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[session.status] ?? 'bg-[#F3F4F6] text-[#4B5563] border-[#E2E8F0]'}`}>
            {STATUS_LABELS[session.status] ?? session.status}
          </span>
          {session.type === 'makeup' && (
            <span className="rounded-full border border-purple-200 bg-purple-50 px-2.5 py-0.5 text-xs font-medium text-purple-700">
              Makeup Session
            </span>
          )}
        </div>
        <p className="mt-0.5 text-sm text-[#64748B]">{session.course_title}</p>
      </div>

      {/* ── Curriculum Progress ──────────────────────────────────────────────── */}
      {session.progress.length > 0 && (
        <div className="ds-card px-5 py-4">
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
              const isCurrent  = p.id === session.id
              const isDone     = p.status === 'completed'
              const isCanceled = p.status === 'cancelled' || p.status === 'cancelled_with_makeup'
              return (
                <Link
                  key={p.id}
                  href={`/portal/instructor/groups/${id}/sessions/${p.id}`}
                  title={p.topic ?? `Session ${p.session_num}`}
                  className={[
                    'flex h-8 min-w-8 shrink-0 items-center justify-center rounded-lg text-xs font-semibold transition',
                    isCurrent
                      ? 'bg-[#FF8A1F] text-white ring-2 ring-[#FF8A1F] ring-offset-1'
                      : isDone
                        ? 'bg-[#E7F8EE] text-[#15803D] hover:bg-emerald-200'
                        : isCanceled
                          ? 'bg-[#FEE2E2] text-[#F87171] hover:bg-[#FECACA]'
                          : 'bg-[#F1F5F9] text-[#94A3B8] hover:bg-[#E2E8F0]',
                  ].join(' ')}
                >
                  {isDone && !isCurrent ? '✓' : isCanceled && !isCurrent ? '✕' : p.session_num}
                </Link>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Start Session banner (only when scheduled) ──────────────────────── */}
      {session.status === 'scheduled' && (
        <div className="rounded-xl border-2 border-[#A7F3D0] bg-[#E7F8EE] p-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="font-semibold text-[#065F46]">Ready to start this session?</p>
              <p className="mt-0.5 text-sm text-[#15803D]">
                Click Start Session to begin. Attendance tracking becomes active.
              </p>
            </div>
            <StartSessionButton sessionId={session.id} groupId={id} />
          </div>
        </div>
      )}

      {/* ── Postponed banner ────────────────────────────────────────────────── */}
      {isPostponed && (
        <div className="rounded-xl border border-yellow-200 bg-yellow-50 p-4">
          <p className="font-semibold text-yellow-800">⏸ Session Postponed</p>
          {session.postponed_reason && (
            <p className="mt-0.5 text-sm text-yellow-700">{session.postponed_reason}</p>
          )}
        </div>
      )}

      {/* ── Cancelled banner ────────────────────────────────────────────────── */}
      {isCancelled && (
        <div className="rounded-xl border border-[#FECACA] bg-[#FEE2E2] p-4">
          <p className="font-semibold text-[#991B1B]">
            {session.status === 'cancelled_with_makeup'
              ? '✕ Session Cancelled — Makeup session has been scheduled'
              : '✕ Session Cancelled'}
          </p>
          {session.cancellation_reason && (
            <p className="mt-0.5 text-sm text-[#DC2626]">{session.cancellation_reason}</p>
          )}
          {session.cancelled_at && (
            <p className="mt-0.5 text-xs text-[#EF4444]">
              Cancelled {new Date(session.cancelled_at).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}
            </p>
          )}
        </div>
      )}

      {/* ── Session meta chips ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'Date',     value: new Date(session.scheduled_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) },
          { label: 'Time',     value: new Date(session.scheduled_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) },
          { label: 'Duration', value: `${session.duration_minutes} min` },
          { label: 'Delivery', value: session.delivery ?? '—' },
          ...(session.started_at ? [{ label: 'Started', value: new Date(session.started_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) }] : []),
          ...(session.ended_at   ? [{ label: 'Ended',   value: new Date(session.ended_at).toLocaleTimeString('en-GB',   { hour: '2-digit', minute: '2-digit' }) }] : []),
        ].map(({ label, value }) => (
          <div key={label} className="ds-card px-4 py-3">
            <p className="text-xs text-[#94A3B8]">{label}</p>
            <p className="mt-0.5 text-sm font-medium text-[#0B1F3A]">{value}</p>
          </div>
        ))}
      </div>

      {session.meeting_url && (
        <a href={session.meeting_url} target="_blank" rel="noopener noreferrer"
          className="inline-flex items-center gap-2 ds-card px-4 py-2 text-sm text-[#3B82F6] hover:bg-[#F8FAFC] transition">
          <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
            <path d="M11 3a1 1 0 100 2h2.586l-6.293 6.293a1 1 0 101.414 1.414L15 6.414V9a1 1 0 102 0V4a1 1 0 00-1-1h-5z" />
            <path d="M5 5a2 2 0 00-2 2v8a2 2 0 002 2h8a2 2 0 002-2v-3a1 1 0 10-2 0v3H5V7h3a1 1 0 000-2H5z" />
          </svg>
          Join Meeting
        </a>
      )}

      {/* ── Main two-column workspace ─────────────────────────────────────────── */}
      <div className="grid gap-5 lg:grid-cols-[1fr_340px]">

        {/* LEFT — Attendance */}
        <div className="space-y-4">
          {/* Attendance summary chips */}
          {session.student_count > 0 && (
            <div className="ds-card px-5 py-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm font-semibold text-[#0B1F3A]">Attendance</p>
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="rounded-full bg-[#E7F8EE] px-2.5 py-0.5 font-medium text-[#15803D]">{presentCount} present</span>
                  <span className="rounded-full bg-[#FEE2E2] px-2.5 py-0.5 font-medium text-[#DC2626]">{absentCount} absent</span>
                  {lateCount > 0 && <span className="rounded-full bg-yellow-100 px-2.5 py-0.5 font-medium text-yellow-700">{lateCount} late</span>}
                  {unmarkedCount > 0 && <span className="rounded-full bg-[#FFFBEB] px-2.5 py-0.5 font-medium text-[#B45309]">{unmarkedCount} pending</span>}
                </div>
              </div>
              <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-[#F1F5F9]">
                <div
                  className="h-full rounded-full bg-[#FF8A1F] transition-all"
                  style={{ width: `${Math.round((markedCount / session.student_count) * 100)}%` }}
                />
              </div>
              <p className="mt-1 text-right text-xs text-[#94A3B8]">
                {markedCount}/{session.student_count} marked
              </p>
            </div>
          )}

          {isActionable || session.status === 'completed' ? (
            <AttendanceForm sessionId={session.id} groupId={session.group_id} rows={session.attendance} currentTopic={session.topic} />
          ) : (
            isCancelled && (
              <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-5 text-center text-sm text-[#94A3B8]">
                Attendance not tracked for cancelled sessions.
              </div>
            )
          )}
        </div>

        {/* RIGHT — Management panel */}
        <SessionDetailsPanel session={session} groupId={id} />
      </div>
    </div>
  )
}
