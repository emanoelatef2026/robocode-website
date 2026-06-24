import Link                              from 'next/link'
import { getLiveDashboardPayrollSummary } from '@/modules/staff-finance/queries'
import { fmtEGP }                         from '@/modules/staff-finance/types'

// ─── Widget ───────────────────────────────────────────────────────────────────

export default async function InstructorPayrollWidget({ branchIds }: { branchIds: string[] }) {
  const now     = new Date()
  const label   = now.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
  const summary = await getLiveDashboardPayrollSummary(branchIds)

  return (
    <div className="ds-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-[12px] font-semibold text-[#0B1F3A]">Payroll — {label}</p>
        <Link
          href="/portal/team-leader/payroll"
          className="text-[11px] font-medium text-[#FF8A1F] hover:text-[#e07018] transition"
        >
          View →
        </Link>
      </div>

      {!summary.has_data ? (
        <div className="rounded-lg border border-dashed border-[#E2E8F0] bg-[#F8FAFC] px-4 py-4 text-center">
          <p className="text-[12px] text-[#94A3B8]">No completed sessions in {label} yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2.5 text-center">
            <p className="text-[14px] font-extrabold leading-none text-[#0B1F3A]">
              {summary.instructor_count}
            </p>
            <p className="mt-0.5 text-[9px] font-medium text-[#94A3B8]">Instructors</p>
          </div>
          <div className="rounded-lg border border-[#FF8A1F]/30 bg-[#FFF7F0] px-3 py-2.5 text-center">
            <p className="text-[14px] font-extrabold leading-none text-[#FF8A1F]">
              {fmtEGP(summary.total_net)}
            </p>
            <p className="mt-0.5 text-[9px] font-medium text-[#94A3B8]">Net Payroll</p>
          </div>
        </div>
      )}
    </div>
  )
}
