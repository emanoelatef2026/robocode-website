import { getLead, getLeadTimeline } from '@/modules/leads/queries'
import { requireAuth }              from '@/modules/rbac/guards'
import { notFound }                 from 'next/navigation'
import Link                         from 'next/link'
import type { LeadStatus }          from '@/modules/leads/types'

const STATUS_META: Record<LeadStatus, { label: string; color: string }> = {
  NEW:           { label: 'New',            color: 'bg-[#F1F5F9] text-[#334155]' },
  CONTACTED:     { label: 'Contacted',      color: 'bg-[#EFF6FF] text-[#1D4ED8]' },
  INTERESTED:    { label: 'Interested',     color: 'bg-violet-100 text-violet-700' },
  TRIAL_BOOKED:  { label: 'Trial Booked',   color: 'bg-[#FFFBEB] text-[#B45309]' },
  TRIAL_ATTENDED:{ label: 'Trial Attended', color: 'bg-orange-100 text-orange-700' },
  FOLLOW_UP:     { label: 'Follow-up',      color: 'bg-purple-100 text-purple-700' },
  CONVERTED:     { label: 'Converted',      color: 'bg-[#E7F8EE] text-[#15803D]' },
  LOST:          { label: 'Lost',           color: 'bg-[#FEE2E2] text-[#DC2626]' },
}

const PIPELINE_ORDER: LeadStatus[] = [
  'NEW', 'CONTACTED', 'INTERESTED', 'TRIAL_BOOKED', 'TRIAL_ATTENDED', 'FOLLOW_UP', 'CONVERTED',
]

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wider text-[#94A3B8]">{label}</p>
      <p className="mt-0.5 text-sm text-[#0B1F3A]">{value ?? <span className="text-[#94A3B8]">—</span>}</p>
    </div>
  )
}

interface Props {
  params: Promise<{ id: string }>
}

export default async function AdminLeadDetailPage({ params }: Props) {
  await requireAuth()
  const { id } = await params

  const [lead, timeline] = await Promise.all([
    getLead(id),
    getLeadTimeline(id),
  ])

  if (!lead) notFound()

  const meta          = STATUS_META[lead.status]
  const isConverted   = lead.status === 'CONVERTED'
  const isLost        = lead.status === 'LOST'
  const stageIdx      = PIPELINE_ORDER.indexOf(lead.status)
  const daysInStage   = lead.days_in_stage ?? 0
  const hasOverdueFU  = lead.next_follow_up_at && new Date(lead.next_follow_up_at) < new Date()

  return (
    <div className="max-w-3xl space-y-5">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between">
        <div>
          <Link href="/admin/leads" className="text-xs text-[#94A3B8] hover:text-[#FF8A1F]">
            ← Back to Leads
          </Link>
          <div className="mt-1 flex items-center gap-2">
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${meta.color}`}>
              {meta.label}
            </span>
            {!isConverted && !isLost && (
              <span className={`text-xs ${daysInStage > 7 ? 'text-[#EF4444] font-semibold' : 'text-[#94A3B8]'}`}>
                {daysInStage}d in this stage{daysInStage > 7 ? ' ⚠' : ''}
              </span>
            )}
            {isConverted && lead.converted_student_id && (
              <Link
                href={`/admin/students/${lead.converted_student_id}`}
                className="text-xs font-medium text-[#10B981] hover:underline"
              >
                View Student Record →
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* ── Pipeline progress bar ──────────────────────────────────────── */}
      {!isLost && (
        <div className="ds-card p-4">
          <p className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-[#94A3B8]">Pipeline</p>
          <div className="flex items-center gap-1 overflow-x-auto">
            {PIPELINE_ORDER.map((s, i) => {
              const active  = s === lead.status
              const passed  = !isConverted ? i < stageIdx : true
              const sm      = STATUS_META[s]
              return (
                <div key={s} className="flex items-center gap-1 shrink-0">
                  <div className={[
                    'rounded-full px-2.5 py-1 text-[11px] font-medium transition',
                    active  ? 'bg-[#FF8A1F] text-white' :
                    passed  ? 'bg-[#E7F8EE] text-[#15803D]' :
                              'bg-[#F1F5F9] text-[#94A3B8]',
                  ].join(' ')}>
                    {sm.label}
                  </div>
                  {i < PIPELINE_ORDER.length - 1 && (
                    <span className={`text-xs ${passed ? 'text-[#34D399]' : 'text-[#CBD5E1]'}`}>→</span>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {isLost && (
        <div className="rounded-xl border border-[#FECACA] bg-[#FEE2E2] px-4 py-3 text-sm text-[#DC2626]">
          <span className="font-semibold">Lead lost</span>
          {lead.lost_reason && <span className="ml-2 text-[#EF4444]">{lead.lost_reason}</span>}
        </div>
      )}

      {hasOverdueFU && !isConverted && !isLost && (
        <div className="rounded-xl border border-[#FDE68A] bg-[#FFFBEB] px-4 py-3 text-sm text-[#B45309]">
          <span className="font-semibold">Follow-up overdue</span>
          <span className="ml-2">
            was due {new Date(lead.next_follow_up_at!).toLocaleDateString('en-GB')}
          </span>
        </div>
      )}

      {/* ── Details grid ───────────────────────────────────────────────── */}
      <div className="ds-card p-5">
        <p className="mb-4 text-[11px] font-semibold uppercase tracking-wider text-[#94A3B8]">Lead Details</p>
        <div className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
          <Field label="Child Name"        value={lead.child_name} />
          <Field label="Parent Name"       value={lead.parent_name} />
          <Field label="Age"               value={lead.age ? `${lead.age} years` : null} />
          <Field label="Phone"             value={lead.phone} />
          <Field label="WhatsApp"          value={lead.whatsapp} />
          <Field label="Email"             value={lead.email} />
          <Field label="Branch"            value={lead.branch_name} />
          <Field label="Source"            value={lead.source?.replace(/_/g, ' ')} />
          <Field label="Interested Course" value={lead.interested_course} />
          <Field label="Assigned To"       value={lead.assigned_name} />
          <Field label="Next Follow-Up"    value={
            lead.next_follow_up_at
              ? new Date(lead.next_follow_up_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
              : null
          } />
          <Field label="Created"           value={
            new Date(lead.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
          } />
        </div>

        {lead.notes && (
          <div className="mt-4 border-t border-[#E2E8F0] pt-4">
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-[#94A3B8]">Notes</p>
            <p className="whitespace-pre-wrap text-sm text-[#0B1F3A]">{lead.notes}</p>
          </div>
        )}
      </div>

      {/* ── Timeline ───────────────────────────────────────────────────── */}
      <div className="ds-card p-5">
        <p className="mb-4 text-[11px] font-semibold uppercase tracking-wider text-[#94A3B8]">
          Activity Timeline
        </p>

        {timeline.length === 0 ? (
          <p className="text-sm text-[#94A3B8]">No activity recorded yet.</p>
        ) : (
          <ol className="space-y-3">
            {timeline.map(event => (
              <li key={event.id} className="flex gap-3">
                <div className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[#FF8A1F]" />
                <div className="flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="text-xs font-semibold capitalize text-[#0B1F3A]">
                      {event.event_type.replace(/_/g, ' ')}
                    </p>
                    <p className="shrink-0 text-[11px] text-[#94A3B8]">
                      {new Date(event.created_at).toLocaleDateString('en-GB', {
                        day: '2-digit', month: 'short', year: 'numeric',
                      })}
                    </p>
                  </div>
                  {event.note && (
                    <p className="mt-0.5 text-xs text-[#64748B]">{event.note}</p>
                  )}
                  {event.created_by_name && (
                    <p className="mt-0.5 text-[11px] text-[#94A3B8]">by {event.created_by_name}</p>
                  )}
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  )
}
