import { useMemo } from "react"
import { fmtEGP } from "@/modules/staff-finance/types"
import type { StaffFinanceRow } from "@/modules/staff-finance/types"
import { STAFF_ROLE_LABELS, PAYMENT_STATUS_LABELS, PAYMENT_STATUS_COLORS } from "@/modules/staff-finance/types"
import { Avatar } from "./Avatar"
import { NetChip } from "./NetChip"
import { EmptyState } from "./EmptyState"

interface Props {
  rows: StaffFinanceRow[]
  onAdjust: (row: StaffFinanceRow) => void
  onEdit: (row: StaffFinanceRow) => void
  onDelete: (id: string) => void
  onOpenDrawer: (row: StaffFinanceRow) => void
  onRemoveAdj: (id: string) => void
  onOpenDetail: (row: StaffFinanceRow) => void
  onQuickAct: (row: StaffFinanceRow) => void
  onQuickPay: (row: StaffFinanceRow) => void
}

export function StaffTab({
  rows,
  onAdjust,
  onEdit,
  onDelete,
  onOpenDrawer,
  onRemoveAdj,
  onOpenDetail,
  onQuickAct,
  onQuickPay,
}: Props) {
  const kpis = useMemo(() => ({
    totalSalaries:         rows.reduce((s, r) => s + r.basic_salary, 0),
    totalActivityEarnings: rows.reduce((s, r) => s + r.session_earnings, 0),
    totalNet:              rows.reduce((s, r) => s + r.net_amount, 0),
    totalPaid:             rows.reduce((s, r) => s + r.total_paid, 0),
    totalRemaining:        rows.reduce((s, r) => s + r.remaining, 0),
  }), [rows])

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
        {[
          { label: "Staff",       value: String(rows.length),                   hi: false },
          { label: "Salaries",    value: fmtEGP(kpis.totalSalaries),            hi: false },
          { label: "Activities",  value: fmtEGP(kpis.totalActivityEarnings),    hi: false },
          { label: "Net Total",   value: fmtEGP(kpis.totalNet),                 hi: true  },
          { label: "Paid",        value: fmtEGP(kpis.totalPaid),                hi: false },
          { label: "Remaining",   value: fmtEGP(kpis.totalRemaining),           hi: false },
        ].map(k => (
          <div key={k.label} className={`rounded-xl border px-3 py-3 ${k.hi ? "border-[#FF8A1F]/30 bg-[#FFF7F0]" : "border-[#E2E8F0] bg-white"}`}>
            <p className={`text-[16px] font-extrabold ${k.hi ? "text-[#FF8A1F]" : "text-[#0B1F3A]"}`}>{k.value}</p>
            <p className="text-[10px] font-medium text-[#94A3B8] mt-0.5">{k.label}</p>
          </div>
        ))}
      </div>

      {rows.length === 0 ? (
        <EmptyState message="No staff profiles yet. Click &quot;Add Staff&quot; to get started." />
      ) : (
        <>
          {/* Desktop */}
          <div className="hidden md:block">
            <div className="ds-card overflow-hidden">
              <table className="w-full text-[12px]">
                <thead className="ds-table-head">
                  <tr>
                    <th className="py-3 pl-4 pr-2 text-left font-semibold text-[#64748B]">Name</th>
                    <th className="py-3 px-2 text-left font-semibold text-[#64748B]">Role</th>
                    <th className="py-3 px-2 text-left font-semibold text-[#64748B]">Department</th>
                    <th className="py-3 px-2 text-left font-semibold text-[#64748B]">Branch</th>
                    <th className="py-3 px-2 text-right font-semibold text-[#64748B]">Basic Salary</th>
                    <th className="py-3 px-2 text-right font-semibold text-[#64748B]">Activities</th>
                    <th className="py-3 px-2 text-right font-semibold text-[#64748B]">Adjustments</th>
                    <th className="py-3 px-2 text-right font-semibold text-[#64748B]">Paid</th>
                    <th className="py-3 px-2 text-right font-semibold text-[#64748B]">Remaining</th>
                    <th className="py-3 px-2 text-right font-semibold text-[#64748B]">Net Total</th>
                    <th className="py-3 px-2 text-center font-semibold text-[#64748B]">Status</th>
                    <th className="py-3 px-4 text-right font-semibold text-[#64748B]">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(row => (
                    <tr key={row.profile_id} className={`border-b border-[#F1F5F9] hover:bg-[#F8FAFC] transition ${row.employment_status === "inactive" ? "opacity-50" : ""}`}>
                      <td className="py-3 pl-4 pr-2">
                        <div className="flex items-center gap-2.5">
                          <Avatar name={row.display_name} />
                          <button
                            onClick={() => onOpenDetail(row)}
                            className="font-semibold text-[#0B1F3A] hover:text-[#FF8A1F] transition text-left"
                          >
                            {row.display_name}
                          </button>
                        </div>
                      </td>
                      <td className="py-3 px-2">
                        <span className="rounded-full bg-[#F1F5F9] px-2 py-0.5 text-[10px] font-semibold text-[#64748B]">
                          {STAFF_ROLE_LABELS[row.role] ?? row.role}
                        </span>
                      </td>
                      <td className="py-3 px-2 text-[11px] text-[#64748B]">
                        {row.department ?? <span className="text-[#CBD5E1]">—</span>}
                      </td>
                      <td className="py-3 px-2 text-[11px] text-[#64748B]">
                        {row.works_all_branches ? "All Branches" : row.branch_name}
                      </td>
                      <td className="py-3 px-2 text-right font-medium text-[#0B1F3A]">
                        {row.basic_salary > 0 ? fmtEGP(row.basic_salary) : <span className="text-[#CBD5E1]">—</span>}
                      </td>
                      <td className="py-3 px-2 text-right">
                        {row.session_earnings > 0 ? (
                          <span className="font-medium text-[#0B1F3A]">{fmtEGP(row.session_earnings)}</span>
                        ) : (
                          <span className="text-[#CBD5E1]">—</span>
                        )}
                      </td>
                      <td className="py-3 px-2 text-right">
                        {row.adjustments.length === 0 ? (
                          <span className="text-[#94A3B8]">—</span>
                        ) : (
                          <span className={`font-semibold ${row.adj_net >= 0 ? "text-[#15803D]" : "text-[#EF4444]"}`}>
                            {row.adj_net >= 0 ? "+" : ""}{fmtEGP(row.adj_net)}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-2 text-right font-medium text-[#15803D]">
                        {row.total_paid > 0 ? fmtEGP(row.total_paid) : <span className="text-[#CBD5E1]">—</span>}
                      </td>
                      <td className="py-3 px-2 text-right">
                        {row.remaining > 0 ? (
                          <span className="font-medium text-[#EF4444]">{fmtEGP(row.remaining)}</span>
                        ) : (
                          <span className="text-[#CBD5E1]">—</span>
                        )}
                      </td>
                      <td className="py-3 px-2 text-right"><NetChip amount={row.net_amount} /></td>
                      <td className="py-3 px-2 text-center">
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${PAYMENT_STATUS_COLORS[row.payment_status]}`}>
                          {PAYMENT_STATUS_LABELS[row.payment_status]}
                        </span>
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
                            onClick={() => onQuickPay(row)}
                            className="rounded-lg border border-[#A7F3D0] bg-[#E7F8EE] px-2.5 py-1 text-[11px] font-semibold text-[#15803D] hover:bg-[#E7F8EE] transition"
                          >
                            + Pay
                          </button>
                          <button onClick={() => onEdit(row)} className="rounded-lg border border-[#E2E8F0] px-2.5 py-1 text-[11px] font-medium text-[#64748B] hover:bg-[#F8FAFC]">Edit</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile */}
          <div className="md:hidden space-y-2">
            {rows.map(row => (
              <div key={row.profile_id} className={`ds-card p-3.5 ${row.employment_status === "inactive" ? "opacity-60" : ""}`}>
                <div className="flex items-start gap-2.5">
                  <Avatar name={row.display_name} />
                  <div className="flex-1 min-w-0">
                    <button
                      onClick={() => onOpenDetail(row)}
                      className="font-semibold text-[#0B1F3A] hover:text-[#FF8A1F] text-[13px] transition text-left"
                    >
                      {row.display_name}
                    </button>
                    <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                      <span className="text-[11px] text-[#94A3B8]">{STAFF_ROLE_LABELS[row.role] ?? row.role} · {row.branch_name}</span>
                      <span className={`rounded-full px-1.5 py-0 text-[10px] font-semibold ${PAYMENT_STATUS_COLORS[row.payment_status]}`}>
                        {PAYMENT_STATUS_LABELS[row.payment_status]}
                      </span>
                    </div>
                  </div>
                  <NetChip amount={row.net_amount} />
                </div>
                <div className="mt-2.5 grid grid-cols-3 gap-2">
                  <div className="rounded-lg bg-[#F8FAFC] px-2 py-1.5">
                    <p className="text-[12px] font-bold text-[#0B1F3A]">
                      {row.basic_salary > 0 ? fmtEGP(row.basic_salary) : "—"}
                    </p>
                    <p className="text-[10px] text-[#94A3B8]">Salary</p>
                  </div>
                  <div className="rounded-lg bg-[#F8FAFC] px-2 py-1.5">
                    <p className="text-[12px] font-bold text-[#15803D]">
                      {row.total_paid > 0 ? fmtEGP(row.total_paid) : "—"}
                    </p>
                    <p className="text-[10px] text-[#94A3B8]">Paid</p>
                  </div>
                  <div className="rounded-lg bg-[#F8FAFC] px-2 py-1.5">
                    <p className={`text-[12px] font-bold ${row.remaining > 0 ? "text-[#EF4444]" : "text-[#CBD5E1]"}`}>
                      {row.remaining > 0 ? fmtEGP(row.remaining) : "—"}
                    </p>
                    <p className="text-[10px] text-[#94A3B8]">Remaining</p>
                  </div>
                </div>
                <div className="mt-2.5 flex gap-1.5">
                  <button onClick={() => onOpenDetail(row)} className="flex-1 rounded-lg border border-[#FF8A1F]/40 bg-[#FFF7F0] py-1.5 text-[11px] font-semibold text-[#FF8A1F]">View</button>
                  <button onClick={() => onQuickPay(row)} className="flex-1 rounded-lg border border-[#A7F3D0] bg-[#E7F8EE] py-1.5 text-[11px] font-semibold text-[#15803D]">+ Pay</button>
                  <button onClick={() => onEdit(row)} className="flex-1 rounded-lg border border-[#E2E8F0] py-1.5 text-[11px] font-semibold text-[#64748B]">Edit</button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
