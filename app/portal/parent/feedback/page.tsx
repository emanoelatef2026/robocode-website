import { requirePortalRole }           from '@/modules/rbac/guards'
import { getParentChildren }           from '@/modules/parents/parent-portal-queries'
import { getChildSessionsProgress }    from '@/modules/parents/parent-portal-queries'
import { getPendingFeedbackMilestone } from '@/modules/parent-feedback/queries'
import { getParentFeedbackHistory }    from '@/modules/parent-feedback/queries'
import { getParentMessages }           from '@/modules/parent-messages/queries'
import { CATEGORY_LABELS, STATUS_CONFIG } from '@/modules/parent-messages/queries'
import FeedbackForm                    from './FeedbackForm'
import ContactForm                     from './ContactForm'
import Link                            from 'next/link'

interface Props {
  searchParams: Promise<{ child?: string; tab?: string }>
}

type Tab = 'session' | 'contact'

export default async function ParentFeedbackPage({ searchParams }: Props) {
  const { child, tab = 'session' } = await searchParams
  const user                       = await requirePortalRole('parent')
  const activeTab                  = (tab === 'contact' ? 'contact' : 'session') as Tab

  const children = await getParentChildren(user.id)

  if (!children.length) {
    return (
      <div className="flex min-h-100 items-center justify-center">
        <p className="text-sm text-[#94A3B8]">No children linked to this account.</p>
      </div>
    )
  }

  const studentId  = child ?? children[0].student_id
  const selected   = children.find(c => c.student_id === studentId) ?? children[0]
  const childParam = `&child=${selected.student_id}`

  // ── Tab 1 data ─────────────────────────────────────────────────────────────
  const [sessions, milestoneHistory] = await Promise.all([
    getChildSessionsProgress(user.id, selected.student_id),
    getParentFeedbackHistory(user.id, selected.student_id),
  ])
  const completedSessions = sessions?.completed_sessions ?? 0
  const pendingMilestone  = await getPendingFeedbackMilestone(user.id, selected.student_id, completedSessions)

  // ── Tab 2 data ─────────────────────────────────────────────────────────────
  const myMessages = activeTab === 'contact'
    ? await getParentMessages(user.id, selected.student_id)
    : []

  const tabHref = (t: Tab) => `/portal/parent/feedback?tab=${t}${childParam}`

  return (
    <div className="mx-auto max-w-2xl space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-[#0B1F3A]">Feedback Center</h1>
          <p className="mt-0.5 text-sm text-[#64748B]">{selected.student_name}</p>
        </div>
        <Link href={`/portal/parent?child=${selected.student_id}`} className="text-[13px] text-[#FF8A1F] hover:underline">
          ← Dashboard
        </Link>
      </div>

      {/* Tab switcher */}
      <div className="flex rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-1 gap-1">
        {([
          { key: 'session', label: 'Session Feedback', badge: pendingMilestone ? '1' : null },
          { key: 'contact', label: 'Contact Team Leader', badge: null },
        ] as { key: Tab; label: string; badge: string | null }[]).map(({ key, label, badge }) => (
          <Link
            key={key}
            href={tabHref(key)}
            className={[
              'flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-[13px] font-medium transition-all',
              activeTab === key
                ? 'bg-white text-[#0B1F3A] shadow-sm'
                : 'text-[#64748B] hover:text-[#0B1F3A]',
            ].join(' ')}
          >
            {label}
            {badge && (
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[#FF8A1F] text-[9px] font-bold text-white">
                {badge}
              </span>
            )}
          </Link>
        ))}
      </div>

      {/* ── TAB 1: SESSION FEEDBACK ─────────────────────────────────────────── */}
      {activeTab === 'session' && (
        <div className="space-y-5">
          {pendingMilestone ? (
            <>
              <div className="rounded-xl border border-[#FF8A1F]/30 bg-[#FFF7ED] px-4 py-3">
                <p className="text-sm font-semibold text-[#0B1F3A]">
                  Milestone Reached: {pendingMilestone} Sessions
                </p>
                <p className="mt-0.5 text-[13px] text-[#64748B]">
                  {selected.student_name} has completed {pendingMilestone} sessions.
                  Please share your experience so we can keep improving.
                </p>
              </div>
              <FeedbackForm
                studentId={studentId}
                studentName={selected.student_name}
                sessionMilestone={pendingMilestone}
                childParam={`?child=${selected.student_id}`}
              />
            </>
          ) : (
            <div className="rounded-xl border border-[#E2E8F0] bg-white px-6 py-12 text-center">
              <p className="text-sm text-[#64748B]">No session feedback pending at this time.</p>
              <p className="mt-1 text-xs text-[#94A3B8]">
                Feedback is requested every 6 completed sessions · {completedSessions} completed so far.
              </p>
            </div>
          )}

          {milestoneHistory.length > 0 && (
            <div className="space-y-3">
              <p className="text-[13px] font-semibold text-[#0B1F3A]">
                Previous Submissions ({milestoneHistory.length})
              </p>
              {milestoneHistory.map(fb => (
                <div key={fb.id} className="rounded-xl border border-[#E2E8F0] bg-white p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-[#0B1F3A]">
                      After {fb.session_milestone} Sessions
                    </p>
                    <div className="flex">
                      {[1,2,3,4,5].map(s => (
                        <span key={s} className={s <= fb.rating ? 'text-[#FF8A1F]' : 'text-[#E2E8F0]'}>★</span>
                      ))}
                    </div>
                  </div>
                  <p className="mt-1 text-[11px] text-[#94A3B8]">
                    {new Date(fb.submitted_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
                  </p>
                  {fb.notes && (
                    <p className="mt-2 text-[13px] text-[#64748B] italic">&ldquo;{fb.notes}&rdquo;</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── TAB 2: CONTACT TEAM LEADER ──────────────────────────────────────── */}
      {activeTab === 'contact' && (
        <div className="space-y-6">

          {/* Form */}
          <div className="rounded-xl border border-[#E2E8F0] bg-white p-5">
            <p className="mb-4 text-sm font-semibold text-[#0B1F3A]">Send a Message</p>
            <ContactForm studentId={selected.student_id} studentName={selected.student_name} />
          </div>

          {/* My Messages history */}
          <div>
            <p className="mb-3 text-[13px] font-semibold text-[#0B1F3A]">
              My Messages {myMessages.length > 0 && `(${myMessages.length})`}
            </p>
            {myMessages.length === 0 ? (
              <div className="rounded-xl border border-[#E2E8F0] bg-white px-6 py-10 text-center">
                <p className="text-sm text-[#94A3B8]">No messages sent yet.</p>
              </div>
            ) : (
              <div className="overflow-hidden rounded-xl border border-[#E2E8F0] bg-white">
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="border-b border-[#F1F5F9] text-left">
                      <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-[#94A3B8]">Date</th>
                      <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-[#94A3B8]">Category</th>
                      <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-[#94A3B8]">Status</th>
                      <th className="hidden px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-[#94A3B8] md:table-cell">Last Updated</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F8FAFC]">
                    {myMessages.map(msg => {
                      const statusCfg = STATUS_CONFIG[msg.status]
                      return (
                        <tr key={msg.id} className="hover:bg-[#F8FAFC]">
                          <td className="px-4 py-3 text-[#0B1F3A]">
                            {new Date(msg.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </td>
                          <td className="px-4 py-3 text-[#64748B]">
                            {CATEGORY_LABELS[msg.category] ?? msg.category}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${statusCfg.cls}`}>
                              {statusCfg.label}
                            </span>
                          </td>
                          <td className="hidden px-4 py-3 text-[#94A3B8] md:table-cell">
                            {new Date(msg.updated_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
