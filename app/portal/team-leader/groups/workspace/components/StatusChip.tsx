export function StatusChip({ status }: { status: string }) {
  const cls = status === 'active'    ? 'bg-[#E7F8EE] text-[#15803D]'
            : status === 'forming'   ? 'bg-[#EFF6FF] text-[#1D4ED8]'
            : status === 'completed' ? 'bg-[#F1F5F9] text-[#475569]'
                                     : 'bg-[#FEE2E2] text-[#DC2626]'
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize ${cls}`}>
      {status}
    </span>
  )
}

export function RiskBadge({ level }: { level: 'HIGH' | 'MEDIUM' | 'LOW' }) {
  const cls = level === 'HIGH'   ? 'bg-[#FEE2E2] text-[#DC2626]'
            : level === 'MEDIUM' ? 'bg-[#FFFBEB] text-[#B45309]'
                                 : 'bg-[#E7F8EE] text-[#15803D]'
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${cls}`}>
      {level}
    </span>
  )
}
