import { requirePortalRole } from '@/modules/rbac/guards'
import { createServiceClient } from '@/lib/supabase/service'
import { getStudentEvaluations } from '@/modules/student-evaluations/queries'
import { EVALUATION_CRITERION_LABELS } from '@/modules/student-evaluations/types'
import type { StudentEvaluation, EvaluationCriterion } from '@/modules/student-evaluations/types'
import EmptyState from '@/components/admin/EmptyState'

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function RatingStars({ rating }: { rating: number }) {
  return (
    <span className="text-[13px] leading-none tracking-[1px]">
      {Array.from({ length: 5 }).map((_, i) => (
        <span key={i} className={i < rating ? 'text-[#F59E0B]' : 'text-[#E2E8F0]'}>★</span>
      ))}
    </span>
  )
}

function ScoreBar({ score }: { score: number }) {
  const pct = Math.min(100, Math.max(0, score))
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-24 overflow-hidden rounded-full bg-[#F1F5F9]">
        <div className="h-full rounded-full bg-[#3B82F6]" style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[11px] font-bold text-[#1D4ED8]">{score}%</span>
    </div>
  )
}

// Tiny CSS sparkline — no chart library, matches the existing hand-rolled
// bar pattern already used elsewhere in the portal (KpiCardSkeleton).
function TrendSparkline({ evaluations }: { evaluations: StudentEvaluation[] }) {
  const points = [...evaluations].reverse().slice(-8) // oldest → newest, last 8
  const values = points.map(e => e.rating != null ? e.rating * 20 : (e.score ?? 0))
  if (values.length < 2) return null

  return (
    <div className="mt-2 flex h-8 items-end gap-1">
      {values.map((v, i) => (
        <div
          key={i}
          className="flex-1 rounded-t-[2px] bg-[#3B82F6]/70"
          style={{ height: `${Math.max(8, v)}%` }}
          title={formatDate(points[i].evaluated_at)}
        />
      ))}
    </div>
  )
}

export default async function StudentEvaluationsPage() {
  const user = await requirePortalRole('student')

  const db = createServiceClient()
  const { data: studentRow } = await db
    .from('students').select('id').eq('user_id', user.id).maybeSingle()
  const studentId = (studentRow as any)?.id ?? null

  const evaluations = studentId ? await getStudentEvaluations(studentId, 'student') : []

  if (evaluations.length === 0) {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <h1 className="text-base font-bold text-[#0B1F3A]">Evaluations</h1>
        <EmptyState
          title="No evaluations yet"
          description="Your instructor's evaluations of your academic skills, behavior and progress will appear here."
        />
      </div>
    )
  }

  // Group by criterion, newest first within each group (already ordered by query).
  const byCriterion = new Map<EvaluationCriterion, StudentEvaluation[]>()
  for (const e of evaluations) {
    const list = byCriterion.get(e.criterion) ?? []
    list.push(e)
    byCriterion.set(e.criterion, list)
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div>
        <h1 className="text-base font-bold text-[#0B1F3A]">Evaluations</h1>
        <p className="mt-0.5 text-[12.5px] text-[#64748B]">How your instructors see your progress, criterion by criterion.</p>
      </div>

      <div className="space-y-3">
        {[...byCriterion.entries()].map(([criterion, list]) => {
          const latest = list[0]
          const label  = criterion === 'CUSTOM' && latest.custom_label ? latest.custom_label : EVALUATION_CRITERION_LABELS[criterion]

          return (
            <div key={criterion} className="ds-card p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-[13px] font-bold text-[#0B1F3A]">{label}</p>
                  <p className="mt-0.5 text-[10.5px] text-[#94A3B8]">Latest · {formatDate(latest.evaluated_at)}</p>
                </div>
                <div className="shrink-0 text-right">
                  {latest.rating != null && <RatingStars rating={latest.rating} />}
                  {latest.score != null && <div className="mt-1"><ScoreBar score={latest.score} /></div>}
                </div>
              </div>

              {latest.feedback && (
                <p className="mt-2.5 rounded-xl bg-[#F8FAFC] px-3 py-2 text-[11.5px] leading-relaxed text-[#475569]">
                  “{latest.feedback}”
                </p>
              )}

              {list.length > 1 && <TrendSparkline evaluations={list} />}

              {list.length > 1 && (
                <details className="mt-2.5">
                  <summary className="cursor-pointer text-[11px] font-semibold text-[#FF8A1F]">
                    History ({list.length - 1} earlier)
                  </summary>
                  <div className="mt-2 space-y-2 border-t border-[#F1F5F9] pt-2">
                    {list.slice(1).map(e => (
                      <div key={e.id} className="flex items-center justify-between gap-2 text-[11px]">
                        <span className="text-[#64748B]">{formatDate(e.evaluated_at)}</span>
                        <div className="flex items-center gap-2">
                          {e.rating != null && <RatingStars rating={e.rating} />}
                          {e.score != null && <span className="font-semibold text-[#1D4ED8]">{e.score}%</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                </details>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
