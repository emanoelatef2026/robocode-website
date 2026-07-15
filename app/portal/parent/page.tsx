import { requirePortalRole } from '@/modules/rbac/guards'
import {
  getParentChildren, getChildDashboardData, getChildEnrollmentContracts,
  getChildSessionsProgress, getChildrenOverview, getChildLearningCards,
  getChildEvaluations, getChildCompetitions, getChildNotes,
} from '@/modules/parents/parent-portal-queries'
import { getPendingFeedbackMilestone }           from '@/modules/parent-feedback/queries'
import Link                                      from 'next/link'
import ChildSelector                             from '@/components/portal/parent/ChildSelector'
import NoChildrenLinked                          from '@/components/portal/parent/NoChildrenLinked'
import ParentHero                                from '@/components/portal/parent/ParentHero'
import RecentActivityFeed                        from '@/components/portal/parent/RecentActivityFeed'
import LearningCard                              from '@/components/portal/student/LearningCard'
import type { ChildOverviewCard as ChildOverviewCardData } from '@/modules/parents/parent-portal-queries'

function fmtMoney(n: number) {
  return new Intl.NumberFormat('en-EG', { maximumFractionDigits: 0 }).format(n)
}
function fmtDate(iso: string | null | undefined) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

interface Props {
  searchParams: Promise<{ child?: string }>
}

export default async function ParentDashboardPage({ searchParams }: Props) {
  const { child } = await searchParams
  const user      = await requirePortalRole('parent')

  const children = await getParentChildren(user.id)

  if (!children.length) {
    return <NoChildrenLinked />
  }

  const studentId = child ?? children[0].student_id
  const selected  = children.find(c => c.student_id === studentId) ?? children[0]

  const [dashboard, sessions, contracts, childrenOverview, learningCards, evaluations, competitions, notes] = await Promise.all([
    getChildDashboardData(user.id, selected.student_id),
    getChildSessionsProgress(user.id, selected.student_id),
    getChildEnrollmentContracts(user.id, selected.student_id),
    getChildrenOverview(user.id),
    getChildLearningCards(user.id, selected.student_id),
    getChildEvaluations(user.id, selected.student_id),
    getChildCompetitions(user.id, selected.student_id),
    getChildNotes(user.id, selected.student_id),
  ])

  const pendingMilestone = dashboard
    ? await getPendingFeedbackMilestone(user.id, selected.student_id, sessions?.completed_sessions ?? 0)
    : null

  const childHref = (path: string) => `${path}?child=${selected.student_id}`

  // Single source of identity/status/stats data for the Hero — no other
  // section on this page repeats student name, status, or course count.
  const overview: ChildOverviewCardData = childrenOverview.find(c => c.student_id === selected.student_id) ?? {
    student_id:          selected.student_id,
    student_name:        selected.student_name,
    avatar_url:          selected.avatar_url,
    status:              selected.status,
    branch_name:         selected.branch_name,
    active_courses:      learningCards.length,
    attendance_pct:      dashboard?.attendance_pct ?? null,
    latest_evaluation:   evaluations[0] ? { criterion: evaluations[0].criterion, score: evaluations[0].score, rating: evaluations[0].rating } : null,
    latest_achievement:  null,
    certificates_count:  dashboard?.certificate_count ?? 0,
    competitions_count:  competitions.length,
    outstanding_balance: null,
  }

  const activeContract = contracts.find(c => c.status === 'ACTIVE')
  const pastContracts   = contracts.filter(c => c.status !== 'ACTIVE')

  const alerts: { icon: string; text: string; cls: string }[] = []
  if (activeContract) {
    if (activeContract.enrolled_sessions > 0 && activeContract.remaining_sessions <= 2) {
      alerts.push({ icon: '🔄', text: `Sessions running low — ${activeContract.remaining_sessions} sessions remaining. Please renew soon.`, cls: 'border-[#FDE68A] bg-[#FFFBEB] text-[#92400E]' })
    }
    if (activeContract.remaining_amount > 0 && activeContract.next_due_date && new Date(activeContract.next_due_date) < new Date()) {
      alerts.push({ icon: '💰', text: `Payment overdue — EGP ${fmtMoney(activeContract.remaining_amount)} due since ${fmtDate(activeContract.next_due_date)}.`, cls: 'border-[#FECACA] bg-[#FEE2E2] text-[#991B1B]' })
    }
    if (activeContract.remaining_amount > 0 && activeContract.next_due_date && new Date(activeContract.next_due_date) >= new Date()) {
      const daysUntil = Math.ceil((new Date(activeContract.next_due_date).getTime() - Date.now()) / 86400000)
      if (daysUntil <= 7) {
        alerts.push({ icon: '📅', text: `Payment due in ${daysUntil} day${daysUntil !== 1 ? 's' : ''} — EGP ${fmtMoney(activeContract.remaining_amount)}.`, cls: 'border-blue-200 bg-[#EFF6FF] text-blue-800' })
      }
    }
  }
  if ((dashboard?.attendance_pct ?? 100) < 60 && (dashboard?.attendance_pct ?? 100) > 0) {
    alerts.push({ icon: '⚠️', text: `Attendance is below 60%. Regular attendance is essential for progress.`, cls: 'border-orange-200 bg-orange-50 text-orange-800' })
  }

  return (
    <div className="mx-auto max-w-7xl space-y-5">

      {/* Multi-child switcher — renders nothing for single-child accounts */}
      <ChildSelector
        linkedChildren={children}
        selectedId={selected.student_id}
        hrefFor={(id) => `/portal/parent?child=${id}`}
      />

      {/* ── Hero — the one and only identity/status/stats block on this page ── */}
      <ParentHero
        overview={overview}
        assignmentPct={dashboard?.assignment_pct ?? null}
        upcomingClass={dashboard?.upcoming_class ?? null}
        nextDueDate={activeContract?.next_due_date ?? null}
        childHref={childHref}
      />

      {/* ── Important alerts — surfaced immediately below the Hero ─────────── */}
      {(pendingMilestone || alerts.length > 0) && (
        <div className="space-y-2">
          {pendingMilestone && (
            <div className="rounded-xl border border-[#FF8A1F]/30 bg-[#FFF7ED] p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-[#0B1F3A]">Share Your Feedback</p>
                  <p className="mt-0.5 text-sm text-[#64748B]">
                    {selected.student_name} has completed {pendingMilestone} sessions.
                    We would love to hear from you!
                  </p>
                </div>
                <Link
                  href={childHref('/portal/parent/feedback')}
                  className="shrink-0 rounded-lg bg-[#FF8A1F] px-3 py-1.5 text-sm font-medium text-white hover:bg-[#e87c18]"
                >
                  Give Feedback
                </Link>
              </div>
            </div>
          )}
          {alerts.map((a, i) => (
            <div key={i} className={`flex items-start gap-3 rounded-xl border p-4 ${a.cls}`}>
              <span className="text-lg">{a.icon}</span>
              <p className="text-sm font-medium leading-tight">{a.text}</p>
            </div>
          ))}
        </div>
      )}

      {/* ── Current Learning — one card per active enrollment ──────────────── */}
      {learningCards.length > 0 && (
        <div>
          <p className="mb-3 text-sm font-semibold text-[#0B1F3A]">Current Learning</p>
          <div className="grid gap-4 lg:grid-cols-2">
            {learningCards.map(card => (
              <LearningCard
                key={card.group_id}
                data={card}
                basePath="/portal/parent"
                childId={selected.student_id}
                hideContinueLearning
              />
            ))}
          </div>
        </div>
      )}

      {/* ── Recent Activity — unified feed (evaluations, achievements,
             competitions, notes, attendance, certificates) ──────────────────── */}
      <RecentActivityFeed
        activity={dashboard?.recent_activity ?? []}
        evaluations={evaluations}
        competitions={competitions}
        notes={notes}
        childHref={childHref}
      />

      {/* ── Enrollment Contracts — detailed, per-course financial breakdown ── */}
      {contracts.length > 0 && (
        <div>
          <p className="mb-3 text-sm font-semibold text-[#0B1F3A]">Enrollment Contracts</p>
          <div className="space-y-3">
            {contracts.filter(c => c.status === 'ACTIVE').map(c => (
              <div key={c.enrollment_id} className="ds-card p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-[#0B1F3A]">{c.course_name ?? 'Course'}</p>
                    <p className="text-xs text-[#64748B]">{[c.group_name, c.instructor_name].filter(Boolean).join(' · ')}</p>
                    {c.contract_code && <p className="font-mono text-[10px] text-[#64748B]">{c.contract_code}</p>}
                  </div>
                  <span className="rounded-full bg-[#E7F8EE] px-2 py-0.5 text-[10px] font-semibold text-[#15803D] shrink-0">Active</span>
                </div>

                <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="rounded-lg bg-[#F8FAFC] p-2">
                    <p className={`font-bold text-sm ${c.enrolled_sessions > 0 && c.remaining_sessions <= 2 ? 'text-[#EF4444]' : 'text-[#0B1F3A]'}`}>
                      {c.enrolled_sessions > 0 ? `${c.remaining_sessions}` : '∞'}
                    </p>
                    <p className="text-[#64748B]">Sessions Left</p>
                    {c.enrolled_sessions > 0 && <p className="text-[10px] text-[#CBD5E1]">{c.consumed_sessions}/{c.enrolled_sessions} used</p>}
                  </div>
                  <div className="rounded-lg bg-[#F8FAFC] p-2">
                    <p className={`font-bold text-sm ${c.remaining_amount > 0 ? 'text-[#F59E0B]' : 'text-[#10B981]'}`}>
                      {c.remaining_amount > 0 ? `EGP ${fmtMoney(c.remaining_amount)}` : 'Paid ✓'}
                    </p>
                    <p className="text-[#64748B]">Balance</p>
                  </div>
                  <div className="rounded-lg bg-[#F8FAFC] p-2">
                    <p className="font-bold text-sm text-[#0B1F3A]">EGP {fmtMoney(c.net_amount)}</p>
                    <p className="text-[#64748B]">Total</p>
                  </div>
                </div>

                {c.remaining_amount > 0 && c.next_due_date && (
                  <div className="mt-2 flex items-center justify-between text-xs">
                    <span className="text-[#64748B]">Next due</span>
                    <span className={`font-medium ${new Date(c.next_due_date) < new Date() ? 'text-[#EF4444]' : 'text-[#64748B]'}`}>
                      {fmtDate(c.next_due_date)}
                    </span>
                  </div>
                )}
              </div>
            ))}

            {/* Completed contracts summary */}
            {pastContracts.length > 0 && (
              <details className="rounded-xl border border-[#E2E8F0]">
                <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-[#64748B] hover:bg-[#F8FAFC] rounded-xl">
                  Past Contracts ({pastContracts.length})
                </summary>
                <div className="divide-y divide-[#F1F5F9]">
                  {pastContracts.map(c => (
                    <div key={c.enrollment_id} className="px-4 py-3 flex items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-medium text-[#0B1F3A]">{c.course_name ?? '—'}</p>
                        <p className="text-[11px] text-[#64748B]">{fmtDate(c.start_date)} → {fmtDate(c.end_date)}</p>
                      </div>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold
                        ${c.status === 'COMPLETED' ? 'bg-[#F1F5F9] text-[#475569]' : 'bg-[#FFFBEB] text-[#B45309]'}`}>
                        {c.status}
                      </span>
                    </div>
                  ))}
                </div>
              </details>
            )}
          </div>
        </div>
      )}

    </div>
  )
}
