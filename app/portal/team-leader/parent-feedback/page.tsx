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

type Tab = 'messages' | 'satisfaction' | 'followups' | 'complaints' | 'suggestions'

interface Props {
  searchParams: Promise<{
    tab?:      string
    status?:   string
    category?: string
    from?:     string
    to?:       string
  }>
}

// SLA: messages older than 48h without resolution need a reply badge
function needsReply(createdAt: string, status: string): boolean {
  if (status === 'resolved') return false
  const ageHours = (Date.now() - new Date(createdAt).getTime()) / 3600000
  return ageHours >= 48
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
    <div className="min-w-0 rounded-xl border border-[#E2E8F0] bg-white px-2 py-1.5 md:p-4">
      <p className="truncate text-[8px] font-semibold uppercase tracking-wide text-[#94A3B8] md:text-[10px]">{label}</p>
      <p className={`mt-0.5 truncate text-[13px] font-bold leading-none md:text-2xl ${color}`}>
        {unit === '★'
          ? <span className="flex items-center gap-1">{value.toFixed(1)} <span className="text-[#FF8A1F]">★</span></span>
          : `${Math.round(value)}${unit}`}
      </p>
      {description && <p className="mt-0.5 truncate text-[8px] text-[#94A3B8] leading-tight md:text-[10px]">{description}</p>}
      {pct != null && (
        <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-[#F1F5F9]">
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
  const { tab = 'messages', status, category, from, to } = await searchParams
  const user       = await requirePortalRole('team_leader')
  const VALID_TABS: Tab[] = ['messages', 'satisfaction', 'followups', 'complaints', 'suggestions']
  const activeTab  = (VALID_TABS.includes(tab as Tab) ? tab : 'messages') as Tab
  const branchIds  = user.branchIds

  // Map virtual tabs to category filters
  const categoryOverride =
    activeTab === 'complaints'  ? 'academic_concern' :
    activeTab === 'suggestions' ? 'suggestion' :
    activeTab === 'followups'   ? 'general_comment' :
    category

  // KPI counts always loaded
  const counts = await getTLMessageCounts(branchIds)

  // Tab-specific data
  const [analytics, messages] = await Promise.all([
    activeTab === 'satisfaction'
      ? getParentFeedbackAnalytics()
      : Promise.resolve({ aggregate: { total_responses: 0, avg_rating: 0, recommend_pct: 0, communication_pct: 0, skill_growth_pct: 0, excitement_pct: 0 }, rows: [] }),
    activeTab !== 'satisfaction'
      ? getTLMessages({
          branchIds,
          status:   (status as MessageStatus)   || undefined,
          category: (categoryOverride as MessageCategory) || undefined,
          from:     from  || undefined,
          to:       to    || undefined,
        })
      : Promise.resolve([]),
  ])

  const needsReplyCount = messages.filter(m => needsReply(m.created_at, m.status)).length

  const tabHref = (t: Tab) => `/portal/team-leader/parent-feedback?tab=${t}`

  const buildFilterHref = (params: Record<string, string>) => {
    const base = new URLSearchParams({ tab: activeTab })
    for (const [k, v] of Object.entries(params)) if (v) base.set(k, v)
    return `/portal/team-leader/parent-feedback?${base}`
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-[#0B1F3A]">Parent Relations Center</h1>
          <p className="mt-0.5 text-sm text-[#64748B]">Messages, satisfaction, follow-ups, complaints and suggestions</p>
        </div>
        {needsReplyCount > 0 && (
          <span className="flex items-center gap-1.5 rounded-full border border-red-200 bg-red-50 px-3 py-1.5 text-[12px] font-semibold text-red-600">
            ⚠ {needsReplyCount} Needs Reply (48h+)
          </span>
        )}
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 gap-1.5 md:gap-4 sm:grid-cols-4">
        <Link
          href={buildFilterHref({ status: 'submitted' })}
          className="min-w-0 rounded-xl border border-[#E2E8F0] bg-white px-2 py-1.5 md:p-4 transition hover:border-[#CBD5E1]"
        >
          <p className="truncate text-[8px] font-semibold uppercase tracking-wide text-[#94A3B8] md:text-[10px]">Open Messages</p>
          <p className="mt-0.5 truncate text-[13px] font-bold leading-none text-yellow-600 md:text-2xl">{counts.open}</p>
        </Link>
        <Link
          href={buildFilterHref({ status: 'resolved' })}
          className="min-w-0 rounded-xl border border-[#E2E8F0] bg-white px-2 py-1.5 md:p-4 transition hover:border-[#CBD5E1]"
        >
          <p className="truncate text-[8px] font-semibold uppercase tracking-wide text-[#94A3B8] md:text-[10px]">Resolved Messages</p>
          <p className="mt-0.5 truncate text-[13px] font-bold leading-none text-green-600 md:text-2xl">{counts.resolved}</p>
        </Link>
        <div className="min-w-0 rounded-xl border border-[#E2E8F0] bg-white px-2 py-1.5 md:p-4">
          <p className="truncate text-[8px] font-semibold uppercase tracking-wide text-[#94A3B8] md:text-[10px]">Avg. Satisfaction</p>
          <p className="mt-0.5 truncate text-[13px] font-bold leading-none text-[#FF8A1F] md:text-2xl">
            {analytics.aggregate.avg_rating > 0 ? `${analytics.aggregate.avg_rating.toFixed(1)}★` : '—'}
          </p>
        </div>
        <div className="min-w-0 rounded-xl border border-[#E2E8F0] bg-white px-2 py-1.5 md:p-4">
          <p className="truncate text-[8px] font-semibold uppercase tracking-wide text-[#94A3B8] md:text-[10px]">Would Recommend</p>
          <p className="mt-0.5 truncate text-[13px] font-bold leading-none text-green-600 md:text-2xl">
            {analytics.aggregate.total_responses > 0 ? `${analytics.aggregate.recommend_pct}%` : '—'}
          </p>
        </div>
      </div>

      {/* Tab switcher — scrollable on mobile */}
      <div className="flex gap-1 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-1 overflow-x-auto no-scrollbar">
        {([
          { key: 'messages',     label: 'Messages',      badge: counts.open > 0 ? String(counts.open) : null },
          { key: 'satisfaction', label: 'Satisfaction',  badge: null },
          { key: 'followups',    label: 'Follow Ups',    badge: null },
          { key: 'complaints',   label: 'Complaints',    badge: null },
          { key: 'suggestions',  label: 'Suggestions',   badge: null },
        ] as { key: Tab; label: string; badge?: string | null }[]).map(({ key, label, badge }) => (
          <Link
            key={key}
            href={tabHref(key)}
            className={[
              'shrink-0 flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-[12px] font-medium transition-all whitespace-nowrap',
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

      {/* ── TAB: SATISFACTION REVIEWS ─────────────────────────────────────── */}
      {activeTab === 'satisfaction' && (
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
                <div className="border-b border-[#F1F5F9] px-4 py-3">
                  <p className="text-[13px] font-semibold text-[#0B1F3A]">All Responses</p>
                </div>

                {/* Mobile cards */}
                <div className="md:hidden divide-y divide-[#F1F5F9]">
                  {analytics.rows.map(r => (
                    <div key={r.id} className="px-4 py-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-[13px] font-medium text-[#0B1F3A]">{r.student_name}</p>
                          {r.branch_name && <p className="text-[11px] text-[#94A3B8]">{r.branch_name}</p>}
                          <p className="text-[11px] text-[#64748B]">After {r.session_milestone} sessions</p>
                        </div>
                        <div className="shrink-0 text-right">
                          <StarDisplay rating={r.rating} />
                          <p className="mt-0.5 text-[10px] text-[#94A3B8]">{new Date(r.submitted_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</p>
                        </div>
                      </div>
                      <div className="mt-2 flex gap-3 text-[11px]">
                        {[
                          { label: 'Skills', v: r.q1_yes },
                          { label: 'Excited', v: r.q2_yes },
                          { label: 'Comm', v: r.q3_yes },
                          { label: 'Recommend', v: r.q4_yes },
                        ].map(({ label, v }) => (
                          <span key={label} className="flex flex-col items-center gap-0.5">
                            <span className={`font-semibold ${v ? 'text-green-600' : 'text-red-500'}`}>{v ? '✓' : '✗'}</span>
                            <span className="text-[#94A3B8]">{label}</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Desktop table */}
                <div className="hidden md:block overflow-x-auto">
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
                        <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wide text-[#94A3B8]">Date</th>
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
                          <td className="px-5 py-3 text-[#94A3B8]">
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

      {/* ── TABS: MESSAGES / FOLLOW UPS / COMPLAINTS / SUGGESTIONS ──────── */}
      {activeTab !== 'satisfaction' && (
        <div className="space-y-5">

          {/* Filters */}
          <div className="space-y-2">
            {/* Status filter */}
            <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
              {(['', 'submitted', 'under_review', 'resolved'] as const).map(s => {
                const isActive = (status ?? '') === s
                const label    = s === '' ? 'All' : STATUS_CONFIG[s as MessageStatus].label
                return (
                  <Link
                    key={s}
                    href={buildFilterHref({ status: s, category: category ?? '' })}
                    className={[
                      'shrink-0 rounded-full border px-3 py-1 text-[12px] font-medium transition-all whitespace-nowrap',
                      isActive
                        ? 'border-[#FF8A1F] bg-[#FF8A1F]/10 text-[#FF8A1F]'
                        : 'border-[#E2E8F0] bg-white text-[#64748B] hover:border-[#CBD5E1]',
                    ].join(' ')}
                  >
                    {label}
                  </Link>
                )
              })}
            </div>
            {/* Category filter */}
            <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
              {(['', ...Object.keys(CATEGORY_LABELS)] as string[]).map(c => {
                const isActive = (category ?? '') === c
                const label    = c === '' ? 'All Categories' : CATEGORY_LABELS[c as MessageCategory]
                return (
                  <Link
                    key={c}
                    href={buildFilterHref({ status: status ?? '', category: c })}
                    className={[
                      'shrink-0 rounded-full border px-3 py-1 text-[12px] font-medium transition-all whitespace-nowrap',
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
                      <div className="flex items-center gap-1.5">
                        {needsReply(msg.created_at, msg.status) && (
                          <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-600">
                            Needs Reply
                          </span>
                        )}
                        <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ${statusCfg.cls}`}>
                          {statusCfg.label}
                        </span>
                      </div>
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
