import { fmtEGP } from "@/modules/staff-finance/types"
import type { StaffFinanceSummary } from "@/modules/staff-finance/types"
import { SummaryCard } from "./SummaryCard"

interface Props {
  summary: StaffFinanceSummary
  dateFrom: string
  dateTo: string
  monthLabel: string
}

export function SummaryTab({ summary, dateFrom, dateTo, monthLabel }: Props) {
  return (
    <div className="space-y-4 max-w-2xl">
      <div className="ds-card p-5">
        <p className="text-[13px] font-semibold text-[#0B1F3A] mb-1">Period</p>
        <p className="text-[22px] font-extrabold text-[#0B1F3A]">{monthLabel}</p>
        <p className="text-[11px] text-[#94A3B8] mt-1">{dateFrom} → {dateTo}</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <SummaryCard label="Instructors"           value={String(summary.instructor_count)} />
        <SummaryCard label="Employees"              value={String(summary.staff_count)} />
        <SummaryCard label="Instructor Sessions"   value={fmtEGP(summary.total_session_earnings)} />
        <SummaryCard label="Employee Salaries"      value={fmtEGP(summary.total_staff_salaries)} />
        <SummaryCard label="Employee Sessions"      value={fmtEGP(summary.total_staff_session_earnings)} />
        <SummaryCard label="Total Bonuses"         value={fmtEGP(summary.total_bonus)} color="emerald" />
        <SummaryCard label="Total Penalties"       value={fmtEGP(summary.total_penalty)} color="red" />
        <SummaryCard label="Total Advances"        value={fmtEGP(summary.total_advance)} color="amber" />
      </div>

      <div className="rounded-xl border border-[#FF8A1F]/30 bg-[#FFF7F0] p-4">
        <p className="text-[12px] font-semibold text-[#FF8A1F]">Grand Total Net Payroll</p>
        <p className="text-[28px] font-extrabold text-[#0B1F3A] mt-1">{fmtEGP(summary.total_net)}</p>
        <p className="text-[11px] text-[#94A3B8] mt-0.5">{summary.currency} · {monthLabel}</p>
      </div>
    </div>
  )
}
