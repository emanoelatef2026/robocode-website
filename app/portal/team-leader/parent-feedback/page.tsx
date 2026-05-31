import { requirePortalRole }          from '@/modules/rbac/guards'
import { getParentFeedbackAnalytics } from '@/modules/parent-feedback/queries'
import {
  getTLMessages,
  getTLMessageCounts,
  CATEGORY_LABELS,
  STATUS_CONFIG,
}                                     from '@/modules/parent-messages/queries'
import type { MessageStatus, MessageCategory } from '@/modules/parent-messages/queries'
import MessageActions                 from './MessageActions'
import Link                           from 'next/link'

type Tab = 'reviews' | 'messages'

interface Props {
  searchParams: Promise<{
    tab?:      string
    status?:   string
    category?: string
    from?:     string
    to?:       string
  }>
}

// ── Shared helpers ─────────────────────────────────────────────────────────────

function MetricCard({
  label, value, unit = '%', description, color = 'text-[#0B1F3A]',
}: {
  label: string; value: number; unit?: string; description?: string; color?: string
}) {
  const pct    = unit === '%' ? value : null
  const barClr = pct != null ? (pct >= 75 ? 'bg-green-500' : pct >= 50 ? 'bg-yellow-500' : 'bg-red-500') : ''
  return (
    <div className="rounded-xl border border-[#E2E8F0] bg-white p-5">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-[#94A3B8]">{label}</p>
      <p className={`mt-1 text-3xl font-bold ${color}`}>
        {unit === '★'
          ? <span className="flex items-center gap-1">{value.toFixed(1)} <span className="text-xl text-[#FF8A1F]">★</span></span>
          : `${Math.round(value)}${unit}`}
      </p>
      {description && <p className="mt-1 text-[11px] text-[#94A3B8]">{description}</p>}
      {pct != null && (
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#F1F5F9]">
          <div className={`h-full rounded-full ${barClr}`} style={{ width: `${Math.min(100, pct)}%` }} />
        </div>
      )}
    </div>
  )
}

function StarDisplay({ rating }: { rating: number }) {
  return (
    <span className="inline-flex gap-0.5">
      {[1,2,3,4,5].map(s => (
        <span key={s} className={s <= rating ? 'text-[#FF8A1F]' : 'text-[#E2E8F0]'}>★</span>
      ))}
    </span>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default async function TLParentFeedbackPage({ searchParams }: Props) {
  const { tab = 'reviews', status, category, from, to } = await searchParams
  const user       = await requirePortalRole('team_leader')
  const activeTab  = (tab === 'messages' ? 'messages' : 'reviews') as Tab
  const branchIds  = user.branchIds

  // KPI counts always loaded
  const counts = await getTLMessageCounts(branchIds)

  // Tab-specific data
  const [analytics, messages] = await Promise.all([
    activeTab === 'reviews'
      ? getParentFeedbackAnalytics()
      : Promise.resolve({ aggregate: { total_responses: 0, avg_rating: 0, recommend_pct: 0, communication_pct: 0, skill_growth_pct: 0, excitement_pct: 0 }, rows: [] }),
    activeTab === 'messages'
      ? getTLMessages({
          branchIds,
          status:   (status as MessageStatus)   || undefined,
          category: (category as MessageCategory) || undefined,
          from:     from  || undefined,
          to:       to    || undefined,
        })
      : Promise.resolve([]),
  ])

  const tabHref = (t: Tab) => `/portal/team-leader/parent-feedback?tab=${t}`

  const buildFilterHref = (params: Record<string, string>) => {
    const base = new URLSearchParams({ tab: 'messages' })
    for (const [k, v] of Object.entries(params)) if (v) base.set(k, v)
    return `/portal/team-leader/parent-feedback?${base}`
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">

      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-[#0B1F3A]">Parent Feedback Center</h1>
        <p className="mt-0.5 text-sm text-[#64748B]">Satisfaction reviews and parent messages</p>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Link
          href={buildFilterHref({ status: 'submitted' })}
          className="rounded-xl border border-[#E2E8F0] bg-white p-4 transition hover:border-[#CBD5E1]"
        >
          <p className="text-[10px] font-semibold uppercase tracking-wide text-[#94A3B8]">Open Messages</p>
          <p className="mt-1 text-2xl font-bold text-yellow-600">{counts.open}</p>
        </Link>
        <Link
          href={buildFilterHref({ status: 'resolved' })}
          className="rounded-xl border border-[#E2E8F0] bg-white p-4 transition hover:border-[#CBD5E1]"
        >
          <p className="text-[10px] font-semibold uppercase tracking-wide text-[#94A3B8]">Resolved Messages</p>
          <p className="mt-1 text-2xl font-bold text-green-600">{counts.resolved}</p>
        </Link>
        <div className="rounded-xl border border-[#E2E8F0] bg-white p-4">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-[#94A3B8]">Avg. Satisfaction</p>
          <p className="mt-1 text-2xl font-bold text-[#FF8A1F]">
            {analytics.aggregate.avg_rating > 0 ? `${analytics.aggregate.avg_rating.toFixed(1)}★` : '—'}
          </p>
        </div>
        <div className="rounded-xl border border-[#E2E8F0] bg-white p-4">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-[#94A3B8]">Would Recommend</p>
          <p className="mt-1 text-2xl font-bold text-green-600">
            {analytics.aggregate.total_responses > 0 ? `${analytics.aggregate.recommend_pct}%` : '—'}
          </p>
        </div>
      </div>

      {/* Tab switcher */}
      <div className="flex rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-1 gap-1">
        {([
          { key: 'reviews',  label: 'Satisfaction Reviews'  },
          { key: 'messages', label: 'Parent Messages', badge: counts.open > 0 ? String(counts.open) : null },
        ] as { key: Tab; label: string; badge?: string | null }[]).map(({ key, label, badge }) => (
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

      {/* ── TAB 1: SATISFACTION REVIEWS ─────────────────────────────────────── */}
      {activeTab === 'reviews' && (
        <div className="space-y-6">
          {analytics.aggregate.total_responses === 0 ? (
            <div className="rounded-xl border border-[#E2E8F0] bg-white px-6 py-16 text-center">
              <p className="text-sm text-[#64748B]">No milestone feedback collected yet.</p>
              <p className="mt-1 text-xs text-[#94A3B8]">Feedback is requested after every 6 completed sessions.</p>
            </div>
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <MetricCard label="Overall Rating"            value={analytics.aggregate.avg_rating}          unit="★" description="Average across all submissions"           color="text-[#FF8A1F]" />
                <MetricCard label="Would Recommend"           value={analytics.aggregate.recommend_pct}                description="Would recommend Robocode to others"      color="text-green-600" />
                <MetricCard label="Communication Satisfaction" value={analytics.aggregate.communication_pct}            description="Satisfied with follow-up & communication" />
                <MetricCard label="Skill Growth Observed"     value={analytics.aggregate.skill_growth_pct}             description="Noticed improvement in child's skills"    />
                <MetricCard label="Excitement to Attend"      value={analytics.aggregate.excitement_pct}               description="Child is excited to come to class"        />
                <div className="flex flex-col items-center justify-center rounded-xl border border-[#E2E8F0] bg-white p-5">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-[#94A3B8]">Total Responses</p>
                  <p className="mt-2 text-4xl font-bold text-[#0B1F3A]">{analytics.aggregate.total_responses}</p>
                </div>
              </div>

              <div className="overflow-hidden rounded-xl border border-[#E2E8F0] bg-white">
                <div className="border-b border-[#F1F5F9] px-5 py-3.5">
                  <p className="text-[13px] font-semibold text-[#0B1F3A]">All Responses</p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-[13px]">
                    <thead>
                      <tr className="border-b border-[#F1F5F9] text-left">
                        <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wide text-[#94A3B8]">Student</th>
                        <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wide text-[#94A3B8]">Milestone</th>
                        <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wide text-[#94A3B8]">Rating</th>
                        <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-[#94A3B8]">Skills</th>
                        <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-[#94A3B8]">Excited</th>
                        <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-[#94A3B8]">Comm.</th>
                        <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-[#94A3B8]">Recommend</th>
                        <th className="hidden px-5 py-3 text-[11px] font-semibold uppercase tracking-wide text-[#94A3B8] md:table-cell">Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#F8FAFC]">
                      {analytics.rows.map(r => (
                        <tr key={r.id} className="hover:bg-[#F8FAFC]">
                          <td className="px-5 py-3">
                            <p className="font-medium text-[#0B1F3A]">{r.student_name}</p>
                            {r.branch_name && <p className="text-[11px] text-[#94A3B8]">{r.branch_name}</p>}
                          </td>
                          <td className="px-5 py-3 text-[#64748B]">After {r.session_milestone} sessions</td>
                          <td className="px-5 py-3"><StarDisplay rating={r.rating} /></td>
                          {[r.q1_yes, r.q2_yes, r.q3_yes, r.q4_yes].map((v, i) => (
                            <td key={i} className="px-4 py-3 text-center">
                              <span className={`text-[13px] font-semibold ${v ? 'text-green-600' : 'text-red-500'}`}>{v ? 'Yes' : 'No'}</span>
                            </td>
                          ))}
                          <td className="hidden px-5 py-3 text-[#94A3B8] md:table-cell">
                            {new Date(r.submitted_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {analytics.rows.some(r => r.notes) && (
                  <div className="border-t border-[#F1F5F9] p-5">
                    <p className="mb-3 text-[13px] font-semibold text-[#0B1F3A]">Parent Notes</p>
                    <div className="space-y-2">
                      {analytics.rows.filter(r => r.notes).map(r => (
                        <div key={`note-${r.id}`} className="rounded-lg border border-[#F1F5F9] bg-[#F8FAFC] px-3 py-2.5">
                          <p className="text-[12px] font-medium text-[#64748B]">{r.student_name} · After {r.session_milestone} sessions</p>
                          <p className="mt-1 text-[13px] text-[#0B1F3A] italic">&ldquo;{r.notes}&rdquo;</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* ── TAB 2: PARENT MESSAGES ──────────────────────────────────────────── */}
      {activeTab === 'messages' && (
        <div className="space-y-5">

          {/* Filters */}
          <div className="flex flex-wrap gap-2">
            {/* Status filter */}
            {(['', 'submitted', 'under_review', 'resolved'] as const).map(s => {
              const isActive = (status ?? '') === s
              const label    = s === '' ? 'All' : STATUS_CONFIG[s as MessageStatus].label
              return (
                <Link
                  key={s}
                  href={buildFilterHref({ status: s, category: category ?? '' })}
                  className={[
                    'rounded-full border px-3 py-1 text-[12px] font-medium transition-all',
                    isActive
                      ? 'border-[#FF8A1F] bg-[#FF8A1F]/10 text-[#FF8A1F]'
                      : 'border-[#E2E8F0] bg-white text-[#64748B] hover:border-[#CBD5E1]',
                  ].join(' ')}
                >
                  {label}
                </Link>
              )
            })}
            <span className="mx-1 text-[#E2E8F0]">|</span>
            {/* Category filter */}
            {(['', ...Object.keys(CATEGORY_LABELS)] as string[]).map(c => {
              const isActive = (category ?? '') === c
              const label    = c === '' ? 'All Categories' : CATEGORY_LABELS[c as MessageCategory]
              return (
                <Link
                  key={c}
                  href={buildFilterHref({ status: status ?? '', category: c })}
                  className={[
                    'rounded-full border px-3 py-1 text-[12px] font-medium transition-all',
                    isActive
                      ? 'border-[#0B1F3A] bg-[#0B1F3A]/8 text-[#0B1F3A]'
                      : 'border-[#E2E8F0] bg-white text-[#64748B] hover:border-[#CBD5E1]',
                  ].join(' ')}
                >
                  {label}
                </Link>
              )
            })}
          </div>

          {messages.length === 0 ? (
            <div className="rounded-xl border border-[#E2E8F0] bg-white px-6 py-16 text-center">
              <p className="text-sm text-[#64748B]">No messages found.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map(msg => {
                const statusCfg = STATUS_CONFIG[msg.status]
                return (
                  <div key={msg.id} className="rounded-xl border border-[#E2E8F0] bg-white p-5">
                    {/* Top row */}
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold text-[#0B1F3A]">
                          {msg.parent_name ?? 'Parent'}
                          {msg.student_name && (
                            <span className="ml-1.5 text-[13px] font-normal text-[#64748B]">
                              re: {msg.student_name}
                            </span>
                          )}
                        </p>
                        <p className="text-[12px] text-[#94A3B8]">
                          {CATEGORY_LABELS[msg.category] ?? msg.category}
                          {' · '}
                          {new Date(msg.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </p>
                      </div>
                      <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ${statusCfg.cls}`}>
                        {statusCfg.label}
                      </span>
                    </div>

                    {/* Message body */}
                    <p className="mt-3 text-[13px] text-[#0B1F3A] whitespace-pre-wrap leading-relaxed">
                      {msg.message}
                    </p>

                    {/* Image */}
                    {msg.image_url && (
                      <a href={msg.image_url} target="_blank" rel="noreferrer" className="mt-3 block">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={msg.image_url}
                          alt="Attached"
                          className="max-h-48 rounded-lg border border-[#E2E8F0] object-contain"
                        />
                      </a>
                    )}

                    {/* Internal note display */}
                    {msg.internal_note && (
                      <div className="mt-3 rounded-lg border border-[#F1F5F9] bg-[#F8FAFC] px-3 py-2">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-[#94A3B8]">Internal Note</p>
                        <p className="mt-0.5 text-[13px] text-[#64748B]">{msg.internal_note}</p>
                      </div>
                    )}

                    {/* Actions (client component) */}
                    <MessageActions
                      messageId={msg.id}
                      currentStatus={msg.status}
                      currentNote={msg.internal_note}
                    />
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
