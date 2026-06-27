import { fmtEGP } from "@/modules/staff-finance/types"

export function NetChip({ amount }: { amount: number }) {
  const cls = amount >= 0
    ? "bg-[#E7F8EE] text-[#15803D]"
    : "bg-[#FEE2E2] text-[#EF4444]"
  return (
    <span className={`inline-flex items-center rounded-lg px-2.5 py-1 text-[13px] font-bold ${cls}`}>
      {fmtEGP(amount)}
    </span>
  )
}
