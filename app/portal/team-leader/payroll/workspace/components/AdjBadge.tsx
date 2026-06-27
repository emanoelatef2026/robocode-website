import { ADJ_LABELS, ADJ_SIGN, ADJ_COLOR, fmtNum } from "@/modules/staff-finance/types"
import type { FinanceAdjType } from "@/modules/staff-finance/types"

export function AdjBadge({ type, amount }: { type: FinanceAdjType; amount: number }) {
  const sign = ADJ_SIGN[type] === 1 ? "+" : "−"
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${ADJ_COLOR[type]}`}>
      {ADJ_LABELS[type]} {sign}{fmtNum(amount)}
    </span>
  )
}
