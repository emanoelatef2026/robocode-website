import Link from 'next/link'
import { getFinanceDailyData, getOverdueCollections } from '@/modules/tl-dashboard/dashboard-v2-queries'
import DashCard, { DashCardEmpty, DashRow } from '../_components/DashCard'
import WaCallButtons from '../_components/WaCallButtons'

function fmtEGP(n: number) {
  if (n >= 1_000_000) return `EGP ${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)     return `EGP ${(n / 1_000).toFixed(1)}K`
  return `EGP ${n.toLocaleString('en-EG', { maximumFractionDigits: 0 })}`
}

// ─── KPI tile ─────────────────────────────────────────────────────────────────

function FinKPI({ label, value, sub, color = 'text-[#0B1F3A]', alert = false }: {
  label: string; value: string; sub?: string
  color?: string; alert?: boolean
}) {
  return (
    <div className={`rounded-2xl border bg-white p-4 ${alert ? 'border-red-200' : 'border-[#E2E8F0]'}`}>
      <p className={`text-[11px] font-semibold uppercase tracking-wide ${alert ? 'text-red-500' : 'text-[#94A3B8]'}`}>{label}</p>
      <p className={`mt-1.5 text-[20px] font-bold leading-none ${color}`}>{value}</p>
      {sub && <p className="mt-1 text-[10px] text-[#94A3B8]">{sub}</p>}
    </div>
  )
}

// ─── Collection rate visual ───────────────────────────────────────────────────

function CollectionRateGauge({ rate }: { rate: number }) {
  const color = rate >= 80 ? '#10B981' : rate >= 60 ? '#F59E0B' : '#EF4444'
  const bg    = rate >= 80 ? 'bg-emerald-50 border-emerald-200' : rate >= 60 ? 'bg-amber-50 border-amber-200' : 'bg-red-50 border-red-200'

  return (
    <div className={`rounded-2xl border px-5 py-4 ${bg}`}>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-[#94A3B8]">Collection Rate</p>
      <div className="mt-2 flex items-end justify-between">
        <p className="text-[28px] font-extrabold" style={{ color }}>{rate}%</p>
        <p className="pb-1 text-[11px] text-[#64748B]">this month</p>
      </div>
      {/* Bar */}
      <div className="mt-2 h-2 w-full rounded-full bg-white/60">
        <div className="h-2 rounded-full transition-all" style={{ width: `${rate}%`, backgroundColor: color }} />
      </div>
    </div>
  )
}

export default async function FinanceCenter({ branchIds }: { branchIds: string[] }) {
  const [fin, topOverdue] = await Promise.all([
    getFinanceDailyData(branchIds),
    getOverdueCollections(branchIds, 8),
  ])

  const collectionOk = fin.collection_rate >= 80

  return (
    <section id="finance">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h2 className="text-[16px] font-bold text-[#0B1F3A]">Finance Command Center</h2>
          {fin.overdue_count > 0 && (
            <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-[11px] font-semibold text-red-700">
              {fin.overdue_count} overdue
            </span>
          )}
        </div>
        <Link href="/portal/team-leader/finance" className="text-[12px] font-medium text-[#FF8A1F] hover:underline">
          Open Finance →
        </Link>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <CollectionRateGauge rate={fin.collection_rate} />

        <FinKPI
          label="Collected Today"
          value={fmtEGP(fin.collected_today)}
          color={fin.collected_today > 0 ? 'text-emerald-600' : 'text-[#0B1F3A]'}
        />
        <FinKPI
          label="This Month"
          value={fmtEGP(fin.collected_this_month)}
        />
        <FinKPI
          label="Outstanding"
          value={fmtEGP(fin.outstanding)}
          color={fin.outstanding > 0 ? 'text-amber-600' : 'text-emerald-600'}
        />
        <FinKPI
          label="Overdue"
          value={fmtEGP(fin.overdue_total_amount)}
          sub={`${fin.overdue_count} student${fin.overdue_count !== 1 ? 's' : ''}`}
          color={fin.overdue_count > 0 ? 'text-red-600' : 'text-emerald-600'}
          alert={fin.overdue_count > 0}
        />
        <FinKPI
          label="Exhausted"
          value={String(fin.exhausted_count)}
          sub={`${fin.low_sessions_count} low (1–3)`}
          color={fin.exhausted_count > 0 ? 'text-red-600' : 'text-[#0B1F3A]'}
          alert={fin.exhausted_count > 0}
        />
      </div>

      {/* Top overdue table */}
      {topOverdue.length > 0 && (
        <div className="mt-4">
          <DashCard
            title="Top Overdue Accounts"
            count={fin.overdue_count}
            accent="border-red-200"
            action={
              <Link href="/portal/team-leader/finance?filter=overdue" className="text-[11px] font-medium text-[#FF8A1F] hover:underline">
                View all →
              </Link>
            }
          >
            {topOverdue.map(item => (
              <DashRow
                key={item.enrollment_id}
                left={
                  <>
                    <Link
                      href={`/portal/team-leader/students/${item.student_id}`}
                      className="block text-[13px] font-medium text-[#0B1F3A] hover:text-[#FF8A1F] leading-snug"
                    >
                      {item.student_name}
                      {item.student_code && (
                        <span className="ml-1 font-mono text-[10px] text-[#94A3B8]">#{item.student_code}</span>
                      )}
                    </Link>
                    <p className="mt-0.5 text-[11px] text-[#64748B]">
                      {item.group_name ?? 'No group'}
                      <span className="ml-1.5 font-medium text-red-600">{item.days_overdue}d overdue</span>
                    </p>
                  </>
                }
                right={
                  <p className="text-[13px] font-bold text-red-600">{fmtEGP(item.remaining_amount)}</p>
                }
                actions={
                  <>
                    <Link
                      href={`/portal/team-leader/finance?student=${item.student_id}&mode=collect`}
                      className="rounded-lg bg-[#FF8A1F] px-2.5 py-1 text-[10px] font-semibold text-white hover:bg-[#e87c18]"
                    >
                      Collect
                    </Link>
                    <WaCallButtons
                      parentPhone={item.parent_phone}
                      studentPhone={item.student_phone}
                      studentName={item.student_name}
                      context={`Payment of ${fmtEGP(item.remaining_amount)} is ${item.days_overdue} days overdue.`}
                    />
                  </>
                }
              />
            ))}
          </DashCard>
        </div>
      )}

      {/* Empty state */}
      {topOverdue.length === 0 && collectionOk && (
        <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-center">
          <p className="text-[14px] font-semibold text-emerald-700">Finance looking healthy! 💚</p>
          <p className="mt-0.5 text-[12px] text-emerald-600">Collection rate {fin.collection_rate}% · No overdue accounts.</p>
        </div>
      )}
    </section>
  )
}
