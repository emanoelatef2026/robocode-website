import type { StudentEvaluation } from '@/modules/student-evaluations/types'
import { EVALUATION_CRITERION_LABELS } from '@/modules/student-evaluations/types'

export default function EvaluationFeed({ evaluations, labels }: { evaluations: StudentEvaluation[]; labels: Record<string, string> }) {
  const groups = new Map<string, StudentEvaluation[]>()
  for (const e of evaluations) {
    const key = e.schedule_id ? `${e.group_id}:session:${e.schedule_id}` : e.source_id ? `${e.group_id}:${e.source_type}:${e.source_id}` : `general:${e.id}`
    groups.set(key, [...(groups.get(key) ?? []), e])
  }
  const entries = [...groups.values()].sort((a, b) => new Date(b[0].evaluated_at).getTime() - new Date(a[0].evaluated_at).getTime())
  return <div className="space-y-4">{entries.map(rows => {
    const first = rows[0]
    const label = labels[first.schedule_id ?? first.source_id ?? ''] ?? 'General evaluation'
    return <section key={first.schedule_id ?? first.source_id ?? first.id} className="overflow-hidden rounded-2xl border border-[#D7E0EA] bg-white shadow-sm">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E2E8F0] bg-[#F7F9FC] px-4 py-3 sm:px-5"><div><p className="text-sm font-bold text-[#0B1F3A]">{label}</p>{first.group_id && labels[first.group_id] && <p className="text-xs font-semibold text-[#64748B]">{labels[first.group_id]}</p>}</div><time className="text-xs font-semibold text-[#64748B]">{new Date(first.evaluated_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</time></header>
      <div className="divide-y divide-[#EDF1F5]">{rows.map(e => <div key={e.id} className="px-4 py-4 sm:px-5"><div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-bold text-[#0B1F3A]">{e.criterion === 'CUSTOM' ? e.custom_label ?? 'Evaluation' : EVALUATION_CRITERION_LABELS[e.criterion]}</p><div className="flex items-center gap-2 text-sm font-bold">{e.rating != null && <span aria-label={`${e.rating} of 5 stars`} className="text-[#C2410C]">{'★'.repeat(e.rating)}<span className="text-[#CBD5E1]">{'☆'.repeat(5 - e.rating)}</span></span>}{e.score != null && <span className="rounded-full bg-[#EFFBFE] px-2.5 py-1 text-[#0E7490]">{e.score}/100</span>}</div></div>{e.feedback && <p className="mt-2 rounded-xl bg-[#F8FAFC] px-3 py-2 text-sm leading-relaxed text-[#334155]">{e.feedback}</p>}{e.next_goal && <div className="mt-2 rounded-xl border-l-[3px] border-[#FF8A1F] bg-[#FFF7ED] px-3 py-2 text-sm text-[#7C2D12]"><span className="font-bold">Next goal: </span>{e.next_goal}</div>}</div>)}</div>
    </section>
  })}</div>
}
