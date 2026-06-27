import { useMemo } from "react"
import { fmtEGP } from "@/modules/staff-finance/types"
import type { InstructorFinanceRow } from "@/modules/staff-finance/types"
import { INSTRUCTOR_PAYMENT_METHOD_LABELS } from "@/modules/staff-finance/types"
import { Avatar } from "./Avatar"
import { AdjBadge } from "./AdjBadge"
import { NetChip } from "./NetChip"
import { EmptyState } from "./EmptyState"

interface Props {
  rows: InstructorFinanceRow[]
  onAdjust: (row: InstructorFinanceRow) => void
  onPayInfo: (row: InstructorFinanceRow) => void
  onOpenDrawer: (row: InstructorFinanceRow) => void
  onOpenDetail: (row: InstructorFinanceRow) => void
  onRemoveAdj: (id: string) => void
}

export function InstructorsTab({
  rows,
  onAdjust,
  onPayInfo,
  onOpenDrawer,
  onOpenDetail,
  onRemoveAdj,
}: Props) {
  const { totalEarnings, totalNet, totalBonus, totalPenalty, totalSessions } = useMemo(() => ({
    totalEarnings: rows.reduce((s, r) => s + r.session_earnings, 0),
    totalNet:      rows.reduce((s, r) => s + r.net_amount, 0),
    totalBonus:    rows.reduce((s, r) => s + r.bonus_total, 0),
    totalPenalty:  rows.reduce((s, r) => s + r.penalty_total, 0),
    totalSessions: rows.reduce((s, r) => s + r.sessions_count, 0),
  }), [rows])

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
        {[
          { label: "Instructors",  value: String(rows.length),       hi: false },
          { label: "Sessions",     value: String(totalSessions),     hi: false },
          { label: "Earnings",     value: fmtEGP(totalEarnings),     hi: false },
          { label: "Bonuses",      value: fmtEGP(totalBonus),        hi: false },
          { label: "Net Payroll",  value: fmtEGP(totalNet),          hi: true  },
        ].map(k => (
          <div key={k.label} className={`rounded-xl border px-3 py-3 ${k.hi ? "border-[#FF8A1F]/30 bg-[#FFF7F0]" : "border-[#E2E8F0] bg-white"}`}>
            <p className={`text-[16px] font-extrabold ${k.hi ? "text-[#FF8A1F]" : "text-[#0B1F3A]"}`}>{k.value}</p>
            <p className="text-[10px] font-medium text-[#94A3B8] mt-0.5">{k.label}</p>
          </div>
        ))}
      </div>

      {rows.length === 0 ? (
        <EmptyState message="No instructors found for this date range and branch." />
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block">
            <div className="ds-card overflow-hidden">
              <table className="w-full text-[12px]">
                <thead className="ds-table-head">
                  <tr>
                    <th className="py-3 pl-4 pr-2 text-left font-semibold text-[#64748B]">Instructor</th>
                    <th className="py-3 px-2 text-right font-semibold text-[#64748B]">Sessions</th>
                    <th className="py-3 px-2 text-right font-semibold text-[#64748B]">Rate</th>
                    <th className="py-3 px-2 text-right font-semibold text-[#64748B]">Earnings</th>
                    <th className="py-3 px-2 text-right font-semibold text-[#64748B]">Adjustments</th>
                    <th className="py-3 px-2 text-right font-semibold text-[#64748B]">Net</th>
                    <th className="py-3 px-2 text-right font-semibold text-[#64748B]">Payment</th>
                    <th className="py-3 px-4 text-right font-semibold text-[#64748B]">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(row => (
                    <tr key={row.instructor_id} className="border-b border-[#F1F5F9] hover:bg-[#F8FAFC] transition">
                      <td className="py-3 pl-4 pr-2">
                        <div className="flex items-center gap-2.5">
                          <Avatar name={row.display_name} />
                          <div>
                            <button
                              onClick={() => onOpenDrawer(row)}
                              className="font-semibold text-[#0B1F3A] hover:text-[#FF8A1F] transition text-left"
                            >
                              {row.display_name}
                            </button>
                            <p className="text-[10px] text-[#94A3B8]">{row.branch_name} · {row.group_count} groups</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-2 text-right font-semibold text-[#0B1F3A]">{row.sessions_count}</td>
                      <td className="py-3 px-2 text-right text-[#64748B]">{fmtEGP(row.salary_per_session)}</td>
                      <td className="py-3 px-2 text-right font-medium text-[#0B1F3A]">{fmtEGP(row.session_earnings)}</td>
                      <td className="py-3 px-2 text-right">
                        {row.adjustments.length === 0 ? (
                          <span className="text-[#94A3B8]">—</span>
                        ) : (
                          <span className={`font-semibold ${row.adj_net >= 0 ? "text-[#15803D]" : "text-[#EF4444]"}`}>
                            {row.adj_net >= 0 ? "+" : ""}{fmtEGP(row.adj_net)}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-2 text-right"><NetChip amount={row.net_amount} /></td>
                      <td className="py-3 px-2 text-right text-[11px] text-[#64748B]">
                        {row.payment_method
                          ? INSTRUCTOR_PAYMENT_METHOD_LABELS[row.payment_method as keyof typeof INSTRUCTOR_PAYMENT_METHOD_LABELS] ?? row.payment_method
                          : <span className="text-[#CBD5E1]">Not set</span>
                        }
                      </td>
                      <td className="py-3 pl-2 pr-4">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => onOpenDetail(row)}
                            className="rounded-lg border border-[#FF8A1F]/40 bg-[#FFF7F0] px-2.5 py-1 text-[11px] font-semibold text-[#FF8A1F] hover:bg-[#FFE8CC] transition"
                          >
                            View
                          </button>
                          <button
                            onClick={() => onAdjust(row)}
                            className="rounded-lg border border-[#E2E8F0] px-2.5 py-1 text-[11px] font-medium text-[#0B1F3A] hover:bg-[#F8FAFC] transition"
                          >
                            + Adj
                          </button>
                          <button
                            onClick={() => onPayInfo(row)}
                            className="rounded-lg border border-[#E2E8F0] px-2.5 py-1 text-[11px] font-medium text-[#64748B] hover:bg-[#F8FAFC] transition"
                          >
                            Edit
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-2">
            {rows.map(row => (
              <div key={row.instructor_id} className="ds-card p-3.5">
                <div className="flex items-start gap-2.5">
                  <Avatar name={row.display_name} />
                  <div className="flex-1 min-w-0">
                    <button
                      onClick={() => onOpenDrawer(row)}
                      className="font-semibold text-[#0B1F3A] hover:text-[#FF8A1F] text-[13px] transition text-left"
                    >
                      {row.display_name}
                    </button>
                    <p className="text-[11px] text-[#94A3B8]">{row.branch_name} · {row.group_count} groups</p>
                  </div>
                  <NetChip amount={row.net_amount} />
                </div>
                <div className="mt-2.5 grid grid-cols-3 gap-2">
                  {[
                    { l: "Sessions", v: String(row.sessions_count) },
                    { l: "Rate",     v: fmtEGP(row.salary_per_session) },
                    { l: "Earnings", v: fmtEGP(row.session_earnings) },
                  ].map(c => (
                    <div key={c.l} className="rounded-lg bg-[#F8FAFC] px-2 py-1.5">
                      <p className="text-[12px] font-bold text-[#0B1F3A]">{c.v}</p>
                      <p className="text-[10px] text-[#94A3B8]">{c.l}</p>
                    </div>
                  ))}
                </div>
                {row.adjustments.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {row.adjustments.map(a => (
                      <AdjBadge key={a.id} type={a.type} amount={a.amount} />
                    ))}
                  </div>
                )}
                <div className="mt-2.5 flex gap-1.5">
                  <button onClick={() => onOpenDetail(row)} className="flex-1 rounded-lg border border-[#FF8A1F]/40 bg-[#FFF7F0] py-1.5 text-[11px] font-semibold text-[#FF8A1F]">View</button>
                  <button onClick={() => onAdjust(row)} className="flex-1 rounded-lg border border-[#E2E8F0] py-1.5 text-[11px] font-semibold text-[#0B1F3A]">+ Adj</button>
                  <button onClick={() => onPayInfo(row)} className="flex-1 rounded-lg border border-[#E2E8F0] py-1.5 text-[11px] font-semibold text-[#64748B]">Edit</button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
