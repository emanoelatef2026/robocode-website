import { requirePortalRole } from '@/modules/rbac/guards'
import {
  getInstructorByUserId,
  getGroupForInstructor,
  getGroupAttendanceAnalytics,
} from '@/modules/instructor-portal/queries'
import { getCourse } from '@/modules/courses/queries'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import StartGroupSessionButton from './StartGroupSessionButton'
import InstructorCoursePanel from './InstructorCoursePanel'

interface Props { params: Promise<{ id: string }> }

const SESSION_STATUS: Record<string, string> = {
  scheduled:   'bg-blue-100 text-blue-700',
  in_progress: 'bg-yellow-100 text-yellow-700',
  ongoing:     'bg-yellow-100 text-yellow-700',
  completed:   'bg-green-100 text-green-700',
  cancelled:   'bg-red-100 text-red-700',
}

const DAY_SHORT: Record<string, string> = {
  sunday: 'Sun', monday: 'Mon', tuesday: 'Tue', wednesday: 'Wed',
  thursday: 'Thu', friday: 'Fri', saturday: 'Sat',
}

export default async function GroupDetailPage({ params }: Props) {
  const user       = await requirePortalRole('instructor')
  const { id }     = await params
  const instructor = await getInstructorByUserId(user.id)
  if (!instructor) notFound()

  const group = await getGroupForInstructor(id, instructor.id)
  if (!group) notFound()

  const [analytics, course] = await Promise.all([
    getGroupAttendanceAnalytics(id, instructor.id),
    group.course_id ? getCourse(group.course_id) : Promise.resolve(null),
  ])

  const isActive = !!group.group_course_id

  const totalPct =
    group.total_sessions != null && group.total_sessions > 0
      ? Math.round((group.completed_sessions / group.total_sessions) * 100)
      : null

  const scheduleLabel = group.day_of_week
    ? [DAY_SHORT[group.day_of_week.toLowerCase()] ?? group.day_of_week, group.time]
        .filter(Boolean)
        .join(' · ')
    : null

  // Build a map so each student can look up their own attendance in O(1)
  const attMap = new Map(analytics.map((a) => [a.student_id, a]))
  const hasAttentionFlag = analytics.some((a) => a.attention)

  return (
    <div className="space-y-4">

      {/* ── 1. COMPACT HEADER ────────────────────────────────────────────────── */}
      <div>
        <Link
          href="/portal/instructor/groups"
          className="inline-flex items-center gap-1 text-sm text-[#64748B] hover:text-[#0B1F3A]"
        >
          ← My Groups
        </Link>

        {/* Group name + status badge */}
        <div className="mt-1.5 flex flex-wrap items-center gap-2">
          <h1 className="text-lg font-bold text-[#0B1F3A] leading-snug wrap-break-word">
            {group.group_name}
          </h1>
          {isActive ? (
            <span className="inline-flex shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700">
              Active
            </span>
          ) : (
            <span className="inline-flex shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700">
              Forming
            </span>
          )}
        </div>

        {/* Course · Schedule · Branch — single compact row */}
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-[#64748B]">
          {group.course_title && <span>{group.course_title}</span>}
          {group.course_title && scheduleLabel && <span className="text-[#CBD5E1]">·</span>}
          {scheduleLabel && <span>{scheduleLabel}</span>}
          {group.branch_name && (
            <>
              <span className="text-[#CBD5E1]">·</span>
              <span>{group.branch_name}</span>
            </>
          )}
        </div>

        {/* Session progress bar — inline in header, no separate card */}
        {isActive && group.total_sessions != null && group.total_sessions > 0 && (
          <div className="mt-2.5">
            <div className="mb-1 flex items-center justify-between text-xs text-[#64748B]">
              <span>Session {group.completed_sessions} / {group.total_sessions}</span>
              {totalPct !== null && <span className="font-medium text-[#FF8A1F]">{totalPct}%</span>}
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#F1F5F9]">
              <div
                className="h-full rounded-full bg-[#FF8A1F] transition-all"
                style={{ width: `${totalPct ?? 0}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* ── 2. NO-COURSE BANNER ──────────────────────────────────────────────── */}
      {!isActive && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3.5">
          <p className="text-sm font-semibold text-amber-800">No course assigned yet</p>
          <p className="mt-0.5 text-xs text-amber-700">
            Sessions can be started once a course is assigned. Contact your administrator.
          </p>
        </div>
      )}

      {/* ── 3. START SESSION — appears exactly once ───────────────────────────── */}
      {isActive && (
        <StartGroupSessionButton
          groupId={id}
          groupCourseId={group.group_course_id!}
          branchId={group.branch_id}
        />
      )}

      {/* ── 4. COURSE CONTENT (accordion, collapsed by default) ──────────────── */}
      {isActive && course && (
        <InstructorCoursePanel course={course} />
      )}

      {/* ── 5. STUDENTS + ATTENDANCE — unified, no duplication ───────────────── */}
      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-[#0B1F3A]">
            Students ({group.students.length})
          </h2>
          {hasAttentionFlag && (
            <span className="text-xs text-red-600">⚠ attendance issues</span>
          )}
        </div>

        {group.students.length === 0 ? (
          <div className="flex h-16 items-center justify-center rounded-xl border border-dashed border-[#E2E8F0] text-sm text-[#64748B]">
            No students enrolled.
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-[#E2E8F0] bg-white divide-y divide-[#F1F5F9]">
            {group.students.map((s) => {
              const att         = attMap.get(s.student_id)
              const initials    = (s.first_name?.[0] ?? s.email[0]).toUpperCase()
              const displayName = [s.first_name, s.last_name].filter(Boolean).join(' ') || s.email
              const pctColor    = !att || att.total === 0
                ? ''
                : att.pct >= 75 ? 'text-emerald-600' : att.pct >= 50 ? 'text-amber-500' : 'text-red-500'

              return (
                <Link
                  key={s.student_id}
                  href={`/portal/instructor/groups/${id}/students/${s.student_id}`}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-[#F8FAFC] active:bg-[#F1F5F9] transition"
                >
                  {/* Avatar */}
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#EFF6FF] text-xs font-bold text-[#3B82F6]">
                    {initials}
                  </div>

                  {/* Name + attendance row */}
                  <div className="min-w-0 flex-1">
                    <div className="flex min-w-0 items-center gap-1.5">
                      {att?.attention && (
                        <span className="shrink-0 text-[11px] text-red-500">⚠</span>
                      )}
                      <p className="truncate text-sm font-medium text-[#0B1F3A]">{displayName}</p>
                    </div>

                    {att && att.total > 0 ? (
                      /* Attendance stats inline */
                      <div className="mt-0.5 flex items-center gap-2 text-[11px]">
                        <span className="font-semibold text-emerald-600">{att.present}P</span>
                        <span className="text-[#E2E8F0]">·</span>
                        <span className="font-semibold text-red-500">{att.absent}A</span>
                        <span className="text-[#E2E8F0]">·</span>
                        <span className="font-semibold text-amber-500">{att.late}L</span>
                        <span className="text-[#E2E8F0]">·</span>
                        <span className={`font-bold ${pctColor}`}>{att.pct}%</span>
                      </div>
                    ) : (
                      <p className="mt-0.5 text-[11px] capitalize text-[#94A3B8]">
                        {s.enrollment_type}
                        {isActive && group.sessions.length > 0 ? ' · no attendance yet' : ''}
                      </p>
                    )}
                  </div>

                  {/* Chevron */}
                  <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 shrink-0 text-[#CBD5E1]">
                    <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
                  </svg>
                </Link>
              )
            })}
          </div>
        )}
      </section>

      {/* ── 6. SESSIONS LIST ─────────────────────────────────────────────────── */}
      <section>
        <h2 className="mb-2 text-sm font-semibold text-[#0B1F3A]">Sessions</h2>

        {!isActive ? (
          <div className="rounded-xl border border-dashed border-amber-200 bg-amber-50 px-4 py-4 text-center">
            <p className="text-sm font-medium text-amber-800">Sessions unavailable</p>
            <p className="mt-0.5 text-xs text-amber-700">Assign a course to this group first.</p>
          </div>
        ) : group.sessions.length === 0 ? (
          <div className="flex h-14 items-center justify-center rounded-xl border border-dashed border-[#E2E8F0] text-sm text-[#94A3B8]">
            No sessions yet — use the form above to start one.
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-[#E2E8F0] bg-white divide-y divide-[#F1F5F9]">
            {group.sessions.map((s, idx) => (
              <Link
                key={s.id}
                href={`/portal/instructor/groups/${id}/sessions/${s.id}`}
                className="flex items-center gap-3 px-4 py-3 hover:bg-[#F8FAFC] active:bg-[#F1F5F9] transition"
              >
                {/* Session number badge */}
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#F1F5F9] text-xs font-semibold text-[#64748B]">
                  {group.sessions.length - idx}
                </div>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-[#0B1F3A]">
                    {s.topic ??
                      new Date(s.scheduled_at).toLocaleDateString('en-GB', {
                        weekday: 'short', day: 'numeric', month: 'short',
                      })}
                  </p>
                  <p className="text-xs text-[#64748B]">
                    {new Date(s.scheduled_at).toLocaleDateString('en-GB', {
                      day: 'numeric', month: 'short',
                    })}
                    {' · '}{s.duration_minutes}min
                    {s.attendance_count !== null && <> · {s.attendance_count} marked</>}
                  </p>
                </div>

                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${SESSION_STATUS[s.status] ?? 'bg-gray-100 text-gray-600'}`}>
                  {s.status}
                </span>
              </Link>
            ))}
          </div>
        )}
      </section>

    </div>
  )
}
