import { requirePortalRole } from '@/modules/rbac/guards'
import {
  getInstructorByUserId,
  getStudentProfileForInstructor,
  getStudentGroupAssignments,
} from '@/modules/instructor-portal/queries'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import NoteForm from './NoteForm'
import DeleteNoteButton from './DeleteNoteButton'

interface Props { params: Promise<{ id: string; studentId: string }> }

const SUB_META: Record<string, { label: string; cls: string }> = {
  not_submitted: { label: 'Not submitted', cls: 'bg-[#F1F5F9] text-[#64748B]'         },
  submitted:     { label: 'Submitted',     cls: 'bg-[#FFFBEB] text-[#B45309]'          },
  resubmitted:   { label: 'Resubmitted',   cls: 'bg-purple-100 text-purple-700'        },
  graded:        { label: 'Graded',        cls: 'bg-[#E7F8EE] text-[#15803D]'          },
  returned:      { label: 'Returned',      cls: 'bg-[#EFF6FF] text-[#1D4ED8]'            },
}

export default async function StudentProfilePage({ params }: Props) {
  const user              = await requirePortalRole('instructor')
  const { id, studentId } = await params
  const instructor        = await getInstructorByUserId(user.id)
  if (!instructor) notFound()

  const [profile, assignments] = await Promise.all([
    getStudentProfileForInstructor(studentId, id, instructor.id, user.id),
    getStudentGroupAssignments(studentId, id),
  ])
  if (!profile) notFound()

  const name         = [profile.first_name, profile.last_name].filter(Boolean).join(' ') || profile.email
  const initials     = (profile.first_name?.[0] ?? profile.email[0]).toUpperCase()
  const total        = profile.attendance_total
  const present      = profile.attendance_present
  const absent       = profile.attendance_absent
  const late         = profile.attendance_late
  const pct          = total > 0 ? Math.round((present / total) * 100) : null
  const pctColor     = pct === null ? '' : pct >= 75 ? 'text-[#10B981]' : pct >= 50 ? 'text-[#F59E0B]' : 'text-[#EF4444]'
  const barColor     = pct === null ? '' : pct >= 75 ? 'bg-[#10B981]'  : pct >= 50 ? 'bg-[#F59E0B]'  : 'bg-[#EF4444]'

  const doneCount    = assignments.filter(a => ['graded', 'returned', 'submitted', 'resubmitted'].includes(a.sub_status)).length
  const pendingCount = assignments.filter(a => a.sub_status === 'not_submitted').length

  return (
    <div className="mx-auto max-w-xl space-y-4">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div>
        <Link
          href={`/portal/instructor/groups/${id}`}
          className="inline-flex items-center gap-1 text-sm text-[#64748B] hover:text-[#0B1F3A]"
        >
          ← {profile.group_name}
        </Link>

        <div className="mt-2 flex items-center gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#EFF6FF] text-base font-bold text-[#3B82F6]">
            {initials}
          </div>
          <div className="min-w-0">
            <h1 className="text-lg font-bold text-[#0B1F3A] leading-tight truncate">{name}</h1>
            <p className="text-xs text-[#94A3B8] truncate">{profile.email}</p>
          </div>
        </div>
      </div>

      {/* ── Attendance ─────────────────────────────────────────────────────── */}
      <div className="ds-card px-4 py-3.5">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-semibold text-[#0B1F3A]">Attendance</p>
          {pct !== null && (
            <span className={`text-sm font-bold ${pctColor}`}>{pct}%</span>
          )}
        </div>

        {total === 0 ? (
          <p className="text-sm text-[#94A3B8]">No sessions recorded yet.</p>
        ) : (
          <>
            {/* 4-stat grid */}
            <div className="grid grid-cols-4 gap-2">
              {[
                { label: 'Present', value: present, color: 'text-[#10B981]',  bg: 'bg-[#E7F8EE]'  },
                { label: 'Absent',  value: absent,  color: 'text-[#EF4444]',    bg: 'bg-[#FEE2E2]'    },
                { label: 'Late',    value: late,    color: 'text-[#F59E0B]',  bg: 'bg-[#FFFBEB]'  },
                { label: 'Total',   value: total,   color: 'text-[#0B1F3A]', bg: 'bg-[#F8FAFC]' },
              ].map(({ label, value, color, bg }) => (
                <div key={label} className={`rounded-lg ${bg} px-2 py-2.5 text-center`}>
                  <p className={`text-lg font-bold leading-none ${color}`}>{value}</p>
                  <p className="mt-1 text-[10px] text-[#94A3B8]">{label}</p>
                </div>
              ))}
            </div>

            {/* Progress bar */}
            {pct !== null && (
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[#F1F5F9]">
                <div
                  className={`h-full rounded-full transition-all ${barColor}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            )}

            {/* Attention alert */}
            {absent >= 3 && (
              <div className="mt-3 flex items-start gap-2 rounded-lg border border-[#FECACA] bg-[#FEE2E2] px-3 py-2">
                <span className="shrink-0 text-[#EF4444]">⚠</span>
                <p className="text-xs text-[#DC2626]">
                  {absent} absences — this student requires attention.
                </p>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Assignments ────────────────────────────────────────────────────── */}
      {assignments.length > 0 && (
        <div className="ds-card px-4 py-3.5">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-semibold text-[#0B1F3A]">Assignments</p>
            <div className="flex items-center gap-1.5 text-xs text-[#94A3B8]">
              <span className="font-medium text-[#10B981]">{doneCount} done</span>
              {pendingCount > 0 && (
                <>
                  <span>·</span>
                  <span className="text-[#94A3B8]">{pendingCount} pending</span>
                </>
              )}
            </div>
          </div>

          <div className="divide-y divide-[#F1F5F9]">
            {assignments.map((a) => {
              const meta = SUB_META[a.sub_status] ?? SUB_META.not_submitted
              const due  = a.due_at
                ? new Date(a.due_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
                : null

              return (
                <div key={a.assignment_id} className="flex items-start gap-3 py-2.5">
                  {/* Status dot */}
                  <div className={`mt-1 h-2 w-2 shrink-0 rounded-full ${
                    a.sub_status === 'graded' || a.sub_status === 'returned'
                      ? 'bg-[#10B981]'
                      : a.sub_status === 'submitted' || a.sub_status === 'resubmitted'
                      ? 'bg-[#F59E0B]'
                      : 'bg-[#E2E8F0]'
                  }`} />

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-[#0B1F3A]">{a.title}</p>
                    <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-[#94A3B8]">
                      {due && <span>Due {due}</span>}
                      {a.is_late && (
                        <>
                          {due && <span className="text-[#E2E8F0]">·</span>}
                          <span className="text-[#EF4444]">Late</span>
                        </>
                      )}
                      {a.submitted_at && (
                        <>
                          <span className="text-[#E2E8F0]">·</span>
                          <span>
                            Submitted {new Date(a.submitted_at).toLocaleDateString('en-GB', {
                              day: 'numeric', month: 'short',
                            })}
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="shrink-0 text-right">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${meta.cls}`}>
                      {meta.label}
                    </span>
                    {a.score !== null && (
                      <p className="mt-0.5 text-xs font-semibold text-[#0B1F3A]">{a.score}/100</p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Notes ──────────────────────────────────────────────────────────── */}
      <div className="ds-card px-4 py-3.5">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-semibold text-[#0B1F3A]">Notes</p>
          <span className="rounded-full bg-[#FFF7ED] px-2 py-0.5 text-[10px] font-medium text-[#FF8A1F]">
            Instructor only
          </span>
        </div>

        <NoteForm studentId={studentId} groupId={id} />

        {profile.notes.length === 0 ? (
          <p className="mt-3 text-sm text-[#94A3B8]">No notes yet.</p>
        ) : (
          <div className="relative mt-4 space-y-3 pl-4 before:absolute before:left-1.5 before:top-0 before:h-full before:w-px before:bg-[#E2E8F0]">
            {profile.notes.map((n, idx) => {
              const isPinned = idx === 0 && n.severity === 'HIGH'
              return (
              <div key={n.id} className={`relative rounded-lg border px-3 py-2.5 ${
                isPinned ? 'border-[#FECACA] bg-[#FEF2F2]' : 'border-[#F1F5F9] bg-[#F8FAFC]'
              }`}>
                {/* Timeline dot */}
                <div className={`absolute -left-4.5 top-3.5 h-2.5 w-2.5 rounded-full border-2 border-white ${
                  isPinned ? 'bg-[#EF4444]' : 'bg-[#FF8A1F]'
                }`} />
                {isPinned && (
                  <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-[#DC2626]">📌 Important Note</p>
                )}

                <div className="flex items-start justify-between gap-2">
                  <p className="flex-1 whitespace-pre-wrap text-sm text-[#0B1F3A]">{n.content}</p>
                  {n.is_own && (
                    <DeleteNoteButton noteId={n.id} studentId={studentId} groupId={id} />
                  )}
                </div>

                <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[10px] text-[#94A3B8]">
                  <span className="font-medium text-[#64748B]">{n.author_name}</span>
                  <span>·</span>
                  <span>
                    {new Date(n.created_at).toLocaleDateString('en-GB', {
                      day: 'numeric', month: 'short', year: 'numeric',
                    })}
                  </span>
                  {n.schedule_topic && (
                    <>
                      <span>·</span>
                      <span className="italic">{n.schedule_topic}</span>
                    </>
                  )}
                  {n.is_private && (
                    <>
                      <span>·</span>
                      <span className="text-[#FF8A1F]">private</span>
                    </>
                  )}
                </div>
              </div>
            )})}

          </div>
        )}
      </div>

    </div>
  )
}
