'use client'

import { useActionState, useState, useEffect } from 'react'
import { useRouter }                            from 'next/navigation'
import {
  updateLeadStatus,
  updateFollowUp,
  addLeadNote,
  reassignLead,
  reopenLead,
  convertLeadToStudent,
  assignLeadToGroup,
} from '@/modules/leads/actions'
import { LEAD_STATUSES, LEAD_SOURCES } from '@/modules/leads/schemas'
import { AGING_THRESHOLDS }             from '@/modules/leads/types'
import SubmitButton from '@/components/admin/SubmitButton'
import type { Lead, LeadTimelineEvent, BranchTeamMember } from '@/modules/leads/types'
import type { ActionResult } from '@/types/app'

// ── Prop types ────────────────────────────────────────────────────────────────

interface Props {
  lead:          Lead
  timeline:      LeadTimelineEvent[]
  branches:      { id: string; name: string }[]
  groups:        { id: string; name: string; type: string }[]
  teamMembers:   BranchTeamMember[]
  currentUserId: string
}

// ── Constants ─────────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  NEW:            'bg-[#EFF6FF]  text-[#1D4ED8]',
  CONTACTED:      'bg-yellow-100 text-yellow-700',
  INTERESTED:     'bg-purple-100 text-purple-700',
  TRIAL_BOOKED:   'bg-indigo-100 text-indigo-700',
  TRIAL_ATTENDED: 'bg-cyan-100  text-cyan-700',
  FOLLOW_UP:      'bg-orange-100 text-orange-700',
  CONVERTED:      'bg-[#E7F8EE] text-[#15803D]',
  LOST:           'bg-[#FEE2E2]  text-[#DC2626]',
}

const EVENT_ICONS: Record<string, string> = {
  REOPENED:               '🔁',
  CREATED:                '📋',
  ASSIGNED:               '👤',
  REASSIGNED:             '🔀',
  STATUS_NEW:             '🔵',
  STATUS_CONTACTED:       '📞',
  STATUS_INTERESTED:      '💜',
  STATUS_TRIAL_BOOKED:    '📅',
  STATUS_TRIAL_ATTENDED:  '✅',
  STATUS_FOLLOW_UP:       '🔄',
  STATUS_CONVERTED:       '🎉',
  STATUS_LOST:            '❌',
  FOLLOW_UP_UPDATED:      '📅',
  CONVERTED:              '🎉',
  ASSIGNED_TO_GROUP:      '👥',
  NOTE:                   '📝',
}

const SOURCE_LABELS: Record<string, string> = {
  website: 'Website', facebook_ad: 'Facebook Ad', instagram_ad: 'Instagram Ad',
  whatsapp: 'WhatsApp', referral: 'Referral', walk_in: 'Walk-In', other: 'Other',
}

const TABS = [
  { id: 'status',   label: 'Status' },
  { id: 'followup', label: 'Follow-Up' },
  { id: 'reassign', label: 'Reassign' },
  { id: 'convert',  label: 'Convert' },
  { id: 'assign',   label: 'Group' },
] as const

type TabId = typeof TABS[number]['id']

const inputCls = 'w-full rounded-lg border border-[#E2E8F0] px-3 py-2.5 text-sm text-[#0B1F3A] outline-none transition focus:border-[#FF8A1F] focus:ring-2 focus:ring-[#FF8A1F]/15'
const labelCls = 'mb-1 block text-sm font-medium text-[#0B1F3A]'

// ── Component ─────────────────────────────────────────────────────────────────

export default function LeadDetailClient({
  lead, timeline, branches, groups, teamMembers, currentUserId,
}: Props) {
  const router     = useRouter()
  const [tab, setTab] = useState<TabId>('status')

  const isConverted = lead.status === 'CONVERTED'
  const isLost      = lead.status === 'LOST'

  // Tracks the selected status in the status-change form so we can show lost_reason field
  const [newStatus, setNewStatus] = useState(lead.status)

  const threshold    = AGING_THRESHOLDS[lead.status as keyof typeof AGING_THRESHOLDS]
  const daysInStage  = lead.days_in_stage ?? 0
  const isAging      = threshold != null && daysInStage > threshold

  // ── Actions ──────────────────────────────────────────────────────────────
  const [statusState,   statusAction]   = useActionState<ActionResult<void> | null, FormData>(updateLeadStatus, null)
  const [followUpState, followUpAction] = useActionState<ActionResult<void> | null, FormData>(updateFollowUp, null)
  const [noteState,     noteAction]     = useActionState<ActionResult<void> | null, FormData>(addLeadNote, null)
  const [reopenState,   reopenAction]   = useActionState<ActionResult<void> | null, FormData>(reopenLead, null)
  const [reassignState, reassignAction] = useActionState<ActionResult<void> | null, FormData>(reassignLead, null)
  const [convertState,  convertAction]  = useActionState<ActionResult<{ student_id: string }> | null, FormData>(convertLeadToStudent, null)
  const [assignState,   assignAction]   = useActionState<ActionResult<void> | null, FormData>(assignLeadToGroup, null)

  useEffect(() => { if (convertState?.success)  { router.refresh(); setTab('assign') } }, [convertState, router])
  useEffect(() => { if (assignState?.success)   router.refresh() }, [assignState, router])
  useEffect(() => { if (reassignState?.success) router.refresh() }, [reassignState, router])
  useEffect(() => { if (statusState?.success)   router.refresh() }, [statusState, router])
  useEffect(() => { if (followUpState?.success) router.refresh() }, [followUpState, router])
  useEffect(() => { if (reopenState?.success)   router.refresh() }, [reopenState, router])

  return (
    <div className="grid gap-6 lg:grid-cols-3">

      {/* ── LEFT: Info + Tabs ── */}
      <div className="space-y-5 lg:col-span-2">

        {/* Info card */}
        <div className="ds-card">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E2E8F0] px-5 py-4">
            <h2 className="font-semibold text-[#0B1F3A]">Lead Information</h2>
            <div className="flex items-center gap-2">
              {isAging && (
                <span className="inline-flex items-center gap-1 rounded-full bg-[#FEE2E2] px-2.5 py-1 text-[11px] font-semibold text-[#DC2626]">
                  ⚠ Stuck {daysInStage}d
                </span>
              )}
              <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_COLORS[lead.status] ?? 'bg-[#F1F5F9] text-[#334155]'}`}>
                {lead.status.replace(/_/g, ' ')}
              </span>
            </div>
          </div>

          <div className="grid gap-4 p-5 sm:grid-cols-2">
            <InfoRow label="Child Name"    value={lead.child_name} />
            <InfoRow label="Parent Name"   value={lead.parent_name} />
            <InfoRow label="Age"           value={lead.age ? `${lead.age} years` : null} />
            <InfoRow label="Phone"         value={lead.phone} />
            <InfoRow label="WhatsApp"      value={lead.whatsapp} />
            <InfoRow label="Email"         value={lead.email} />
            <InfoRow label="Branch"        value={lead.branch_name} />
            <InfoRow label="Source"        value={SOURCE_LABELS[lead.source] ?? lead.source} />
            <InfoRow label="Interested In" value={lead.interested_course} />
            <InfoRow
              label="Owner"
              value={lead.assigned_name ?? 'Unassigned'}
              highlight={!lead.assigned_name}
              sub={lead.assigned_at ? `Since ${new Date(lead.assigned_at).toLocaleDateString('en-GB')}` : undefined}
            />
            <InfoRow
              label="Days In Stage"
              value={`${daysInStage} day${daysInStage !== 1 ? 's' : ''}`}
              highlight={isAging}
              sub={threshold ? `Alert threshold: ${threshold}d` : undefined}
            />
            <InfoRow
              label="Last Contact"
              value={lead.last_contact_at ? new Date(lead.last_contact_at).toLocaleDateString('en-GB') : null}
            />
            <InfoRow
              label="Next Follow-Up"
              value={lead.next_follow_up_at ? new Date(lead.next_follow_up_at).toLocaleDateString('en-GB') : null}
              highlight={!!lead.next_follow_up_at && new Date(lead.next_follow_up_at) < new Date()}
            />
            {isLost && (
              <InfoRow
                label="Lost Reason"
                value={lead.lost_reason}
                highlight={true}
              />
            )}
            {lead.converted_student_id && (
              <InfoRow label="Student ID" value={lead.converted_student_id.slice(0, 8) + '…'} />
            )}
          </div>
          {lead.notes && (
            <div className="border-t border-[#E2E8F0] px-5 py-4">
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-[#94A3B8]">Notes</p>
              <p className="whitespace-pre-wrap text-sm text-[#0B1F3A]">{lead.notes}</p>
            </div>
          )}
        </div>

        {/* Action tabs */}
        <div className="ds-card">
          {/* Tab bar */}
          <div className="flex overflow-x-auto border-b border-[#E2E8F0]">
            {TABS.map(t => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={[
                  'whitespace-nowrap flex-1 px-4 py-3 text-[13px] font-medium transition',
                  tab === t.id
                    ? 'border-b-2 border-[#FF8A1F] text-[#FF8A1F]'
                    : 'text-[#64748B] hover:text-[#0B1F3A]',
                ].join(' ')}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="p-5">

            {/* STATUS */}
            {tab === 'status' && (
              <div className="space-y-4">
                {/* Reopen section — only when currently LOST */}
                {isLost && (
                  <div className="rounded-lg border border-[#FECACA] bg-[#FEE2E2] p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-sm font-semibold text-[#991B1B]">This lead is marked as Lost</p>
                        {lead.lost_reason && (
                          <p className="mt-0.5 text-sm text-[#DC2626]">Reason: {lead.lost_reason}</p>
                        )}
                      </div>
                    </div>
                    <Alert state={reopenState} success="Lead reopened — moved to Follow Up." />
                    <form action={reopenAction} className="mt-3">
                      <input type="hidden" name="id" value={lead.id} />
                      <SubmitButton label="Reopen Lead" pendingLabel="Reopening…" />
                    </form>
                  </div>
                )}

                <Alert state={statusState} success="Status updated." />
                <form action={statusAction} className="space-y-4">
                  <input type="hidden" name="id" value={lead.id} />
                  <div>
                    <label className={labelCls}>New Status</label>
                    <select
                      name="status"
                      defaultValue={lead.status}
                      onChange={e => setNewStatus(e.target.value as typeof lead.status)}
                      className={inputCls}
                    >
                      {LEAD_STATUSES.map(s => (
                        <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
                      ))}
                    </select>
                  </div>
                  {newStatus === 'LOST' && (
                    <div>
                      <label className={labelCls}>Lost Reason</label>
                      <input
                        name="lost_reason"
                        className={inputCls}
                        placeholder="e.g. Budget, no response, chose competitor…"
                        defaultValue={lead.lost_reason ?? ''}
                      />
                    </div>
                  )}
                  <div>
                    <label className={labelCls}>Note (optional)</label>
                    <textarea name="note" rows={2} className={`${inputCls} resize-none`} placeholder="What happened?" />
                  </div>
                  <SubmitButton label="Update Status" pendingLabel="Updating…" />
                </form>
              </div>
            )}

            {/* FOLLOW-UP */}
            {tab === 'followup' && (
              <div className="space-y-5">
                <div>
                  <Alert state={followUpState} success="Follow-up saved." />
                  <form action={followUpAction} className="space-y-4">
                    <input type="hidden" name="id" value={lead.id} />
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <label className={labelCls}>Last Contact Date</label>
                        <input name="last_contact_at" type="date"
                          defaultValue={lead.last_contact_at ? lead.last_contact_at.slice(0, 10) : ''}
                          className={inputCls} />
                      </div>
                      <div>
                        <label className={labelCls}>Next Follow-Up Date</label>
                        <input name="next_follow_up_at" type="date"
                          defaultValue={lead.next_follow_up_at ? lead.next_follow_up_at.slice(0, 10) : ''}
                          className={inputCls} />
                      </div>
                    </div>
                    <div>
                      <label className={labelCls}>Note</label>
                      <textarea name="note" rows={2} className={`${inputCls} resize-none`}
                        placeholder="e.g. Called — interested, sending info" />
                    </div>
                    <SubmitButton label="Save Follow-Up" pendingLabel="Saving…" />
                  </form>
                </div>

                <div className="border-t border-[#E2E8F0] pt-4">
                  <p className="mb-3 text-sm font-medium text-[#0B1F3A]">Add Note to Timeline</p>
                  <Alert state={noteState} success="Note added." />
                  <form action={noteAction} className="space-y-3">
                    <input type="hidden" name="id" value={lead.id} />
                    <textarea name="note" rows={3} required className={`${inputCls} resize-none`} placeholder="Write a note…" />
                    <SubmitButton label="Add Note" pendingLabel="Adding…" />
                  </form>
                </div>
              </div>
            )}

            {/* REASSIGN */}
            {tab === 'reassign' && (
              <div className="space-y-4">
                <div className="rounded-lg bg-[#F8FAFC] px-4 py-3 text-sm text-[#64748B]">
                  Current owner: <span className="font-semibold text-[#0B1F3A]">{lead.assigned_name ?? 'Unassigned'}</span>
                  {lead.assigned_at && (
                    <span className="ml-1 text-[#94A3B8]">· since {new Date(lead.assigned_at).toLocaleDateString('en-GB')}</span>
                  )}
                </div>
                <Alert state={reassignState} success="Lead reassigned successfully." />
                <form action={reassignAction} className="space-y-4">
                  <input type="hidden" name="id" value={lead.id} />
                  <div>
                    <label className={labelCls}>New Owner <span className="text-[#EF4444]">*</span></label>
                    {teamMembers.length === 0 ? (
                      <p className="text-sm text-[#94A3B8]">No team members found for this branch.</p>
                    ) : (
                      <select name="to_user" required className={inputCls}>
                        <option value="">Select team member…</option>
                        {teamMembers.map(m => (
                          <option key={m.user_id} value={m.user_id}>
                            {m.name}{m.user_id === currentUserId ? ' (you)' : ''}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                  <div>
                    <label className={labelCls}>Reason</label>
                    <input name="reason" className={inputCls} placeholder="e.g. Norhan now handles Maadi branch" />
                  </div>
                  {teamMembers.length > 0 && (
                    <SubmitButton label="Reassign Lead" pendingLabel="Reassigning…" />
                  )}
                </form>
              </div>
            )}

            {/* CONVERT */}
            {tab === 'convert' && (
              <div>
                {isConverted ? (
                  <div className="rounded-lg bg-[#E7F8EE] px-4 py-3 text-sm text-[#15803D]">
                    Already converted.
                    {lead.converted_student_id && (
                      <span className="ml-1">Student ID: {lead.converted_student_id.slice(0, 8)}…</span>
                    )}
                  </div>
                ) : (
                  <div className="space-y-4">
                    <p className="text-sm text-[#64748B]">Create parent + student accounts from this lead. Fields pre-filled from lead data.</p>
                    <Alert state={convertState} success="Lead converted to student!" />
                    <form action={convertAction} className="space-y-5">
                      <input type="hidden" name="lead_id" value={lead.id} />

                      <fieldset className="rounded-lg border border-[#E2E8F0] p-4">
                        <legend className="px-2 text-[10px] font-semibold uppercase tracking-wide text-[#94A3B8]">Student Account</legend>
                        <div className="mt-3 grid gap-4 sm:grid-cols-2">
                          <div>
                            <label className={labelCls}>First Name <span className="text-[#EF4444]">*</span></label>
                            <input name="first_name" required className={inputCls} defaultValue={lead.child_name.split(' ')[0] ?? ''} />
                          </div>
                          <div>
                            <label className={labelCls}>Last Name <span className="text-[#EF4444]">*</span></label>
                            <input name="last_name" required className={inputCls} defaultValue={lead.child_name.split(' ').slice(1).join(' ')} />
                          </div>
                          <div>
                            <label className={labelCls}>Email <span className="text-[#EF4444]">*</span></label>
                            <input name="email" type="email" required className={inputCls} placeholder="student@email.com" />
                          </div>
                          <div>
                            <label className={labelCls}>Password <span className="text-[#EF4444]">*</span></label>
                            <input name="password" type="password" required minLength={6} className={inputCls} />
                          </div>
                          <div className="sm:col-span-2">
                            <label className={labelCls}>Branch <span className="text-[#EF4444]">*</span></label>
                            <select name="branch_id" required className={inputCls} defaultValue={lead.branch_id ?? ''}>
                              <option value="">Select branch…</option>
                              {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                            </select>
                          </div>
                        </div>
                      </fieldset>

                      <fieldset className="rounded-lg border border-[#E2E8F0] p-4">
                        <legend className="px-2 text-[10px] font-semibold uppercase tracking-wide text-[#94A3B8]">Parent Account</legend>
                        <div className="mt-3 grid gap-4 sm:grid-cols-2">
                          <div>
                            <label className={labelCls}>First Name <span className="text-[#EF4444]">*</span></label>
                            <input name="parent_first" required className={inputCls} defaultValue={(lead.parent_name ?? '').split(' ')[0]} />
                          </div>
                          <div>
                            <label className={labelCls}>Last Name <span className="text-[#EF4444]">*</span></label>
                            <input name="parent_last" required className={inputCls} defaultValue={(lead.parent_name ?? '').split(' ').slice(1).join(' ')} />
                          </div>
                          <div>
                            <label className={labelCls}>Email <span className="text-[#EF4444]">*</span></label>
                            <input name="parent_email" type="email" required className={inputCls} defaultValue={lead.email ?? ''} />
                          </div>
                          <div>
                            <label className={labelCls}>Password <span className="text-[#EF4444]">*</span></label>
                            <input name="parent_password" type="password" required minLength={6} className={inputCls} />
                          </div>
                          <div>
                            <label className={labelCls}>Phone</label>
                            <input name="parent_phone" type="tel" className={inputCls} defaultValue={lead.phone ?? ''} />
                          </div>
                        </div>
                      </fieldset>

                      <SubmitButton label="Convert to Student" pendingLabel="Converting…" />
                    </form>
                  </div>
                )}
              </div>
            )}

            {/* ASSIGN GROUP */}
            {tab === 'assign' && (
              <div>
                {!isConverted ? (
                  <div className="rounded-lg bg-yellow-50 px-4 py-3 text-sm text-yellow-800">
                    Convert this lead to a student first, then assign to a group.
                  </div>
                ) : (
                  <div className="space-y-4">
                    <Alert state={assignState} success="Student assigned to group." />
                    <form action={assignAction} className="space-y-4">
                      <input type="hidden" name="lead_id"    value={lead.id} />
                      <input type="hidden" name="student_id" value={lead.converted_student_id ?? ''} />
                      <div>
                        <label className={labelCls}>Select Group <span className="text-[#EF4444]">*</span></label>
                        {groups.length === 0 ? (
                          <p className="text-sm text-[#94A3B8]">No active groups in this branch.</p>
                        ) : (
                          <select name="group_id" required className={inputCls}>
                            <option value="">Select group…</option>
                            {groups.map(g => (
                              <option key={g.id} value={g.id}>{g.name} ({g.type})</option>
                            ))}
                          </select>
                        )}
                      </div>
                      {groups.length > 0 && (
                        <SubmitButton label="Assign to Group" pendingLabel="Assigning…" />
                      )}
                    </form>
                  </div>
                )}
              </div>
            )}

          </div>
        </div>
      </div>

      {/* ── RIGHT: Timeline ── */}
      <div className="space-y-4">
        <div className="ds-card">
          <div className="border-b border-[#E2E8F0] px-5 py-4">
            <h2 className="font-semibold text-[#0B1F3A]">Activity Timeline</h2>
          </div>
          <div className="p-5">
            {timeline.length === 0 ? (
              <p className="text-sm text-[#94A3B8]">No activity yet.</p>
            ) : (
              <ol className="space-y-4">
                {timeline.map(event => (
                  <li key={event.id} className="flex gap-3">
                    <div className="mt-0.5 shrink-0 text-base">
                      {EVENT_ICONS[event.event_type] ?? '📌'}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-[#0B1F3A]">
                        {event.event_type.replace(/_/g, ' ')}
                      </p>
                      {event.note && (
                        <p className="mt-0.5 text-xs text-[#64748B]">{event.note}</p>
                      )}
                      <p className="mt-1 text-[11px] text-[#94A3B8]">
                        {event.created_by_name && (
                          <span className="font-medium text-[#64748B]">{event.created_by_name} · </span>
                        )}
                        {new Date(event.created_at).toLocaleString('en-GB', {
                          day: '2-digit', month: 'short', year: 'numeric',
                          hour: '2-digit', minute: '2-digit',
                        })}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>

        {/* Status flow reference */}
        <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-4">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-[#94A3B8]">Stage Thresholds</p>
          <div className="space-y-1.5">
            {(Object.entries(AGING_THRESHOLDS) as [string, number][]).map(([s, d]) => (
              <div key={s} className="flex items-center justify-between text-[11px]">
                <span className={`rounded-full px-2 py-0.5 font-semibold ${STATUS_COLORS[s]}`}>
                  {s.replace(/_/g, ' ')}
                </span>
                <span className="text-[#94A3B8]">alert after {d}d</span>
              </div>
            ))}
          </div>
        </div>
      </div>

    </div>
  )
}

// ── InfoRow ───────────────────────────────────────────────────────────────────

function InfoRow({ label, value, highlight = false, sub }: {
  label: string; value: string | null | undefined; highlight?: boolean; sub?: string
}) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-[#94A3B8]">{label}</p>
      <p className={`mt-0.5 text-sm font-medium ${highlight ? 'text-[#EF4444]' : 'text-[#0B1F3A]'}`}>
        {value ?? <span className="text-[#CBD5E1]">—</span>}
      </p>
      {sub && <p className="text-[11px] text-[#94A3B8]">{sub}</p>}
    </div>
  )
}

// ── Alert ─────────────────────────────────────────────────────────────────────

function Alert({ state, success }: { state: ActionResult<unknown> | null; success: string }) {
  if (!state) return null
  if (state.success) {
    return <div className="mb-3 rounded-lg bg-[#E7F8EE] px-4 py-3 text-sm text-[#15803D]">{success}</div>
  }
  return <div className="mb-3 rounded-lg bg-[#FEE2E2] px-4 py-3 text-sm text-[#DC2626]">{state.error.message}</div>
}
