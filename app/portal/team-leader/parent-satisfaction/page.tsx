import { requirePortalRole }          from '@/modules/rbac/guards'
import { getParentFeedbackAnalytics } from '@/modules/parent-feedback/queries'

function MetricCard({
  label,
  value,
  unit = '%',
  description,
  color = 'text-[#0B1F3A]',
}: {
  label:       string
  value:       number
  unit?:       string
  description?: string
  color?:      string
}) {
  const pct    = unit === '%' ? value : null
  const barClr = pct != null ? (pct >= 75 ? 'bg-green-500' : pct >= 50 ? 'bg-yellow-500' : 'bg-red-500') : ''

  return (
    <div className="rounded-xl border border-[#E2E8F0] bg-white p-5">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-[#94A3B8]">{label}</p>
      <p className={`mt-1 text-3xl font-bold ${color}`}>
        {unit === '★' ? (
          <span className="flex items-center gap-1">
            {value.toFixed(1)} <span className="text-xl text-[#FF8A1F]">★</span>
          </span>
        ) : (
          `${Math.round(value)}${unit}`
        )}
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

export default async function ParentSatisfactionPage() {
  await requirePortalRole('team_leader')

  const { aggregate, rows } = await getParentFeedbackAnalytics()

  return (
    <div className="mx-auto max-w-5xl space-y-8">

      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-[#0B1F3A]">Parent Satisfaction</h1>
        <p className="mt-0.5 text-sm text-[#64748B]">
          Aggregated feedback from parent milestone surveys · {aggregate.total_responses} response{aggregate.total_responses !== 1 ? 's' : ''}
        </p>
      </div>

      {aggregate.total_responses === 0 ? (
        <div className="rounded-xl border border-[#E2E8F0] bg-white px-6 py-16 text-center">
          <p className="text-sm text-[#64748B]">No parent feedback collected yet.</p>
          <p className="mt-1 text-xs text-[#94A3B8]">Feedback is requested after every 6 completed sessions.</p>
        </div>
      ) : (
        <>
          {/* Aggregate metrics */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <MetricCard
              label="Overall Rating"
              value={aggregate.avg_rating}
              unit="★"
              description="Average across all submissions"
              color="text-[#FF8A1F]"
            />
            <MetricCard
              label="Would Recommend"
              value={aggregate.recommend_pct}
              description="Parents who would recommend Robocode"
              color="text-green-600"
            />
            <MetricCard
              label="Communication Satisfaction"
              value={aggregate.communication_pct}
              description="Satisfied with follow-up & communication"
            />
            <MetricCard
              label="Skill Growth Observed"
              value={aggregate.skill_growth_pct}
              description="Noticed improvement in child's skills"
            />
            <MetricCard
              label="Excitement to Attend"
              value={aggregate.excitement_pct}
              description="Child is excited to come to class"
            />
            <div className="rounded-xl border border-[#E2E8F0] bg-white p-5 flex flex-col justify-center items-center">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-[#94A3B8]">Total Responses</p>
              <p className="mt-2 text-4xl font-bold text-[#0B1F3A]">{aggregate.total_responses}</p>
            </div>
          </div>

          {/* Detailed responses */}
          <div className="rounded-xl border border-[#E2E8F0] bg-white overflow-hidden">
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
                  {rows.map(r => (
                    <tr key={r.id} className="hover:bg-[#F8FAFC]">
                      <td className="px-5 py-3">
                        <p className="font-medium text-[#0B1F3A]">{r.student_name}</p>
                        {r.branch_name && <p className="text-[11px] text-[#94A3B8]">{r.branch_name}</p>}
                      </td>
                      <td className="px-5 py-3 text-[#64748B]">
                        After {r.session_milestone} sessions
                      </td>
                      <td className="px-5 py-3">
                        <StarDisplay rating={r.rating} />
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`text-[13px] font-semibold ${r.q1_yes ? 'text-green-600' : 'text-red-500'}`}>
                          {r.q1_yes ? 'Yes' : 'No'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`text-[13px] font-semibold ${r.q2_yes ? 'text-green-600' : 'text-red-500'}`}>
                          {r.q2_yes ? 'Yes' : 'No'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`text-[13px] font-semibold ${r.q3_yes ? 'text-green-600' : 'text-red-500'}`}>
                          {r.q3_yes ? 'Yes' : 'No'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`text-[13px] font-semibold ${r.q4_yes ? 'text-green-600' : 'text-red-500'}`}>
                          {r.q4_yes ? 'Yes' : 'No'}
                        </span>
                      </td>
                      <td className="hidden px-5 py-3 text-[#94A3B8] md:table-cell">
                        {new Date(r.submitted_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Notes section */}
            {rows.some(r => r.notes) && (
              <div className="border-t border-[#F1F5F9] p-5">
                <p className="mb-3 text-[13px] font-semibold text-[#0B1F3A]">Parent Notes</p>
                <div className="space-y-2">
                  {rows.filter(r => r.notes).map(r => (
                    <div key={`note-${r.id}`} className="rounded-lg border border-[#F1F5F9] bg-[#F8FAFC] px-3 py-2.5">
                      <p className="text-[12px] font-medium text-[#64748B]">
                        {r.student_name} · After {r.session_milestone} sessions
                      </p>
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
  )
}
