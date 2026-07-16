import { requirePortalRole } from '@/modules/rbac/guards'
import {
  getInstructorByUserId,
  getStudentProfileForInstructor,
  getStudentGroupAssignments,
} from '@/modules/instructor-portal/queries'
import { getStudentEvaluations } from '@/modules/student-evaluations/queries'
import { EVALUATION_CRITERION_LABELS } from '@/modules/student-evaluations/types'
import { getStudentCompetitions } from '@/modules/student-competitions/queries'
import { listCertificates } from '@/modules/certificates/queries'
import { getStudentPortfolioDetail } from '@/modules/portfolio/queries'
import { PROJECT_STATUS_CONFIG } from '@/modules/portfolio/types'
import { getStudentTimeline, INSTRUCTOR_VISIBLE_TIMELINE_EVENT_TYPES, TIMELINE_EVENT_LABELS, TIMELINE_SEVERITY_COLORS } from '@/lib/timeline'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import NoteForm from './NoteForm'
import DeleteNoteButton from './DeleteNoteButton'
import { EvaluationForm } from '@/components/portal/instructor/StudentEvaluationModal'

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

  const [profile, assignments, evaluations, competitions, certificatesResult, timelineRaw, portfolio] = await Promise.all([
    getStudentProfileForInstructor(studentId, id, instructor.id, user.id),
    getStudentGroupAssignments(studentId, id),
    getStudentEvaluations(studentId, 'staff'),
    getStudentCompetitions(studentId),
    listCertificates({ studentId, perPage: 10 }),
    getStudentTimeline(studentId),
    getStudentPortfolioDetail(studentId),
  ])
  if (!profile) notFound()

  const certificates = certificatesResult.data
  const portfolioProjects = portfolio?.projects.filter((p) => !p.is_archived) ?? []
  const timeline = timelineRaw.filter((e) => INSTRUCTOR_VISIBLE_TIMELINE_EVENT_TYPES.includes(e.event_type))

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
                  {(n.visibility === 'PRIVATE_INSTRUCTOR' || n.visibility === 'PRIVATE_TEAM_LEADER') && (
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

      {/* ── Evaluations ────────────────────────────────────────────────────── */}
      <div className="ds-card px-4 py-3.5">
        <p className="mb-3 text-sm font-semibold text-[#0B1F3A]">Evaluations</p>

        <EvaluationForm studentId={studentId} groupId={id} />

        {evaluations.length === 0 ? (
          <p className="mt-3 text-sm text-[#94A3B8]">No evaluations yet.</p>
        ) : (
          <div className="mt-4 divide-y divide-[#F1F5F9]">
            {evaluations.map((e) => (
              <div key={e.id} className="py-2.5">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium text-[#0B1F3A]">
                    {e.criterion === 'CUSTOM' ? (e.custom_label ?? 'Custom') : EVALUATION_CRITERION_LABELS[e.criterion]}
                  </p>
                  <div className="flex shrink-0 items-center gap-1.5 text-xs">
                    {e.score != null && <span className="font-semibold text-[#0B1F3A]">{e.score}/100</span>}
                    {e.rating != null && <span className="text-[#F59E0B]">{'★'.repeat(e.rating)}</span>}
                  </div>
                </div>
                {e.feedback && <p className="mt-1 text-xs text-[#64748B]">{e.feedback}</p>}
                <p className="mt-1 text-[10px] text-[#94A3B8]">
                  {new Date(e.evaluated_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Competitions ───────────────────────────────────────────────────── */}
      <div className="ds-card px-4 py-3.5">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-semibold text-[#0B1F3A]">Competitions</p>
          <span className="rounded-full bg-[#F1F5F9] px-2 py-0.5 text-[10px] font-medium text-[#64748B]">
            Logged by team leader
          </span>
        </div>

        {competitions.length === 0 ? (
          <p className="text-sm text-[#94A3B8]">No competition history yet.</p>
        ) : (
          <div className="divide-y divide-[#F1F5F9]">
            {competitions.map((c) => (
              <div key={c.id} className="py-2.5">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium text-[#0B1F3A]">{c.competition_name}</p>
                  <span className="shrink-0 text-xs text-[#94A3B8]">{c.year}</span>
                </div>
                {(c.rank || c.award) && (
                  <p className="mt-0.5 text-xs text-[#B45309]">
                    {[c.rank, c.award].filter(Boolean).join(' · ')}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Certificates ───────────────────────────────────────────────────── */}
      <div className="ds-card px-4 py-3.5">
        <p className="mb-3 text-sm font-semibold text-[#0B1F3A]">Certificates</p>

        {certificates.length === 0 ? (
          <p className="text-sm text-[#94A3B8]">No certificates issued yet.</p>
        ) : (
          <div className="divide-y divide-[#F1F5F9]">
            {certificates.map((c) => (
              <div key={c.id} className="flex items-center justify-between gap-2 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-[#0B1F3A]">{c.title}</p>
                  <p className="text-xs text-[#94A3B8]">
                    {c.certificate_code} · {new Date(c.issued_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </p>
                </div>
                <span className="shrink-0 rounded-full bg-[#E7F8EE] px-2 py-0.5 text-[10px] font-medium capitalize text-[#15803D]">
                  {c.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Portfolio & Achievements ──────────────────────────────────────── */}
      <div className="ds-card px-4 py-3.5">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-semibold text-[#0B1F3A]">Portfolio &amp; Achievements</p>
          <Link
            href={`/portal/instructor/portfolio?tab=pending_review`}
            className="text-xs font-medium text-[#FF8A1F] hover:underline"
          >
            Review projects →
          </Link>
        </div>

        {portfolioProjects.length === 0 && (portfolio?.achievements.length ?? 0) === 0 && (portfolio?.badges.length ?? 0) === 0 ? (
          <p className="text-sm text-[#94A3B8]">No portfolio activity yet.</p>
        ) : (
          <div className="space-y-4">
            {portfolioProjects.length > 0 && (
              <div>
                <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-[#94A3B8]">
                  Projects ({portfolioProjects.length})
                </p>
                <div className="divide-y divide-[#F1F5F9]">
                  {portfolioProjects.map((p) => {
                    const statusCfg = p.status
                      ? (PROJECT_STATUS_CONFIG[p.status] ?? PROJECT_STATUS_CONFIG.pending_review)
                      : PROJECT_STATUS_CONFIG.pending_review
                    return (
                      <div key={p.id} className="flex items-center justify-between gap-2 py-2">
                        <p className="min-w-0 flex-1 truncate text-sm text-[#0B1F3A]">{p.title}</p>
                        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${statusCfg.cls}`}>
                          {statusCfg.label}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {(portfolio?.badges.length ?? 0) > 0 && (
              <div>
                <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-[#94A3B8]">Badges</p>
                <div className="flex flex-wrap gap-1.5">
                  {portfolio!.badges.map((b) => (
                    <span key={b.id} className="rounded-full bg-[#FFFBEB] px-2.5 py-1 text-xs font-medium text-[#B45309]">
                      {b.badge_name}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {(portfolio?.achievements.length ?? 0) > 0 && (
              <div>
                <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-[#94A3B8]">Achievements</p>
                <div className="divide-y divide-[#F1F5F9]">
                  {portfolio!.achievements.map((a) => (
                    <div key={a.id} className="py-2">
                      <p className="text-sm font-medium text-[#0B1F3A]">{a.title}</p>
                      {a.description && <p className="text-xs text-[#64748B]">{a.description}</p>}
                      <p className="mt-0.5 text-[10px] text-[#94A3B8]">
                        {new Date(a.date_awarded).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Timeline ───────────────────────────────────────────────────────── */}
      {timeline.length > 0 && (
        <div className="ds-card px-4 py-3.5">
          <p className="mb-3 text-sm font-semibold text-[#0B1F3A]">Timeline</p>
          <div className="relative space-y-3 pl-4 before:absolute before:left-1.5 before:top-0 before:h-full before:w-px before:bg-[#E2E8F0]">
            {timeline.map((t) => (
              <div key={t.id} className="relative">
                <div className="absolute -left-4.5 top-1 h-2.5 w-2.5 rounded-full border-2 border-white bg-[#94A3B8]" />
                <div className="flex items-center gap-1.5">
                  <p className="text-xs font-medium text-[#0B1F3A]">{TIMELINE_EVENT_LABELS[t.event_type]}</p>
                  <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-semibold ${TIMELINE_SEVERITY_COLORS[t.severity]}`}>
                    {t.severity}
                  </span>
                </div>
                {t.notes && <p className="mt-0.5 text-xs text-[#64748B]">{t.notes}</p>}
                <p className="mt-0.5 text-[10px] text-[#94A3B8]">
                  {new Date(t.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                  {t.created_by_name ? ` · ${t.created_by_name}` : ''}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  )
}
