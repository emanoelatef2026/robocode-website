import Link from 'next/link'
import type { DashboardFinanceSummary } from '@/modules/finance/types'

interface Props {
  data: DashboardFinanceSummary
}

function FinTile({
  value, label, valueFg, bg, bd,
}: {
  value: string; label: string; valueFg: string; bg: string; bd: string
}) {
  return (
    <div className="rounded-[11px] border p-[12px_13px]" style={{ background: bg, borderColor: bd }}>
      <p className="font-orbitron text-[20px] font-bold leading-none" style={{ color: valueFg }}>{value}</p>
      <p className="mt-[5px] text-[9.5px] font-semibold text-[#64748B]">{label}</p>
    </div>
  )
}

function fmt(n: number) {
  if (n >= 1_000_000) return `EGP ${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)     return `EGP ${Math.round(n / 1_000)}K`
  return `EGP ${n}`
}

export default function FinanceSummaryCard({ data }: Props) {
  const rate = Math.min(100, data.collection_rate)

  return (
    <div className="ds-card p-[18px_20px]">
      {/* Header */}
      <div className="flex items-start justify-between mb-[14px]">
        <div>
          <p className="text-[14px] font-bold text-[#0B1F3A]">Finance</p>
          <p className="mt-[2px] text-[11px] text-[#94A3B8]">Collections snapshot</p>
        </div>
        <Link
          href="/admin/finance"
          className="text-[11.5px] font-semibold text-[#FF8A1F] hover:text-[#d97706] transition-colors shrink-0"
        >
          View all →
        </Link>
      </div>

      {/* 4 colored tiles */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-[10px] mb-[15px]">
        <FinTile
          value={fmt(data.outstanding)}
          label="Outstanding"
          valueFg="#B45309" bg="#FFFBEB" bd="#f6e3c4"
        />
        <FinTile
          value={`${data.collection_rate}%`}
          label="Collection Rate"
          valueFg="#15803D" bg="#F0FDF4" bd="#d6f0e0"
        />
        <FinTile
          value={String(data.overdue_count)}
          label="Overdue Students"
          valueFg={data.overdue_count > 0 ? '#DC2626' : '#15803D'}
          bg={data.overdue_count > 0 ? '#FEF2F2' : '#F0FDF4'}
          bd={data.overdue_count > 0 ? '#f7d4d4' : '#d6f0e0'}
        />
        <FinTile
          value={String(data.due_this_week)}
          label="Due This Week"
          valueFg="#B45309" bg="#FFFBEB" bd="#f6e3c4"
        />
      </div>

      {/* Collection rate progress bar */}
      <div className="mb-[14px]">
        <div className="flex items-center justify-between mb-[6px]">
          <span className="text-[11px] text-[#64748B]">Collection rate this month</span>
          <span className="font-orbitron text-[12px] font-bold text-[#15803D]">{data.collection_rate}%</span>
        </div>
        <div className="h-[7px] rounded-full bg-[#eef1f6] overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${rate}%`,
              background: 'linear-gradient(90deg, #10B981, #38BDF8)',
            }}
          />
        </div>
      </div>

      {/* Finance alert rows */}
      <div className="flex flex-col gap-[7px]">
        {data.overdue_count > 0 && (
          <Link
            href="/admin/finance?status=OVERDUE"
            className="flex items-center gap-[11px] rounded-[10px] border border-[#FECACA] bg-[#FEF2F2] px-[13px] py-[10px] transition hover:brightness-[.97]"
          >
            <span className="h-[7px] w-[7px] shrink-0 rounded-full bg-[#EF4444]" />
            <span className="flex-1 text-[12px] font-medium text-[#DC2626]">
              Overdue student balances — immediate follow-up needed
            </span>
            <span className="font-orbitron text-[12px] font-bold text-[#DC2626] shrink-0">{data.overdue_count}</span>
            <svg viewBox="0 0 16 16" fill="currentColor" className="h-[11px] w-[11px] shrink-0 text-[#DC2626] opacity-40">
              <path fillRule="evenodd" d="M6.22 3.22a.75.75 0 011.06 0l4.25 4.25a.75.75 0 010 1.06L7.28 12.78a.75.75 0 01-1.06-1.06L9.94 8 6.22 4.28a.75.75 0 010-1.06z" clipRule="evenodd" />
            </svg>
          </Link>
        )}
        {data.broken_promises > 0 && (
          <Link
            href="/admin/finance"
            className="flex items-center gap-[11px] rounded-[10px] border border-[#FDE68A] bg-[#FFFBEB] px-[13px] py-[10px] transition hover:brightness-[.97]"
          >
            <span className="h-[7px] w-[7px] shrink-0 rounded-full bg-[#F59E0B]" />
            <span className="flex-1 text-[12px] font-medium text-[#B45309]">
              Broken payment promises — parents did not pay as agreed
            </span>
            <span className="font-orbitron text-[12px] font-bold text-[#B45309] shrink-0">{data.broken_promises}</span>
            <svg viewBox="0 0 16 16" fill="currentColor" className="h-[11px] w-[11px] shrink-0 text-[#B45309] opacity-40">
              <path fillRule="evenodd" d="M6.22 3.22a.75.75 0 011.06 0l4.25 4.25a.75.75 0 010 1.06L7.28 12.78a.75.75 0 01-1.06-1.06L9.94 8 6.22 4.28a.75.75 0 010-1.06z" clipRule="evenodd" />
            </svg>
          </Link>
        )}
      </div>
    </div>
  )
}
