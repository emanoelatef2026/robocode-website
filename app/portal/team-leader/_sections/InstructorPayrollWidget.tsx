import Link from 'next/link'
import { getDashboardPayrollSummary } from '@/modules/payroll/queries'
import { fmtCurrency }                from '@/modules/payroll/types'

// ─── Widget ───────────────────────────────────────────────────────────────────

export default async function InstructorPayrollWidget({ branchIds }: { branchIds: string[] }) {
  const now   = new Date()
  const label = now.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })

  const summary = await getDashboardPayrollSummary(branchIds)

  if (!summary.has_run) {
    return (
      <div className="rounded-xl border border-[#E2E8F0] bg-white p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-[12px] font-semibold text-[#0B1F3A]">Instructor Payroll — {label}</p>
          <Link
            href="/portal/team-leader/instructor-payroll"
            className="text-[11px] font-medium text-[#FF8A1F] hover:text-[#e07018] transition"
          >
            View Payroll →
          </Link>
        </div>
        <div className="rounded-lg border border-dashed border-[#E2E8F0] bg-[#F8FAFC] px-4 py-5 text-center">
          <p className="text-[12px] text-[#94A3B8]">No payroll generated for {label} yet.</p>
          <Link
            href="/portal/team-leader/instructor-payroll"
            className="mt-2 inline-block rounded-lg bg-[#0B1F3A] px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-[#1a2f4a] transition"
          >
            Generate Payroll
          </Link>
        </div>
      </div>
    )
  }

  const { currency, total_amount, pending_amount, paid_amount } = summary

  const tiles = [
    { label: 'Total Payroll',  value: fmtCurrency(total_amount,   currency), alert: false },
    { label: 'Pending',        value: fmtCurrency(pending_amount, currency), alert: pending_amount > 0 },
    { label: 'Paid',           value: fmtCurrency(paid_amount,    currency), alert: false },
  ]

  return (
    <div className="rounded-xl border border-[#E2E8F0] bg-white p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-[12px] font-semibold text-[#0B1F3A]">Instructor Payroll — {label}</p>
        <Link
          href="/portal/team-leader/instructor-payroll"
          className="text-[11px] font-medium text-[#FF8A1F] hover:text-[#e07018] transition"
        >
          View Payroll →
        </Link>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {tiles.map(t => (
          <div
            key={t.label}
            className={`rounded-lg border px-3 py-2.5 text-center ${
              t.alert ? 'border-amber-200 bg-amber-50' : 'border-[#E2E8F0] bg-[#F8FAFC]'
            }`}
          >
            <p className={`text-[14px] font-extrabold leading-none ${
              t.alert ? 'text-amber-700' : 'text-[#0B1F3A]'
            }`}>
              {t.value}
            </p>
            <p className="mt-0.5 text-[9px] font-medium text-[#94A3B8]">{t.label}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
