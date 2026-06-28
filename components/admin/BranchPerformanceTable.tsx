import { getBranchFinanceStats } from '@/modules/finance/queries'
import Link                      from 'next/link'

function statusFor(rate: number) {
  if (rate >= 80) return { label: 'Healthy', tagBg: '#E7F8EE', tagFg: '#15803D', barColor: '#10B981', rateFg: '#15803D' }
  if (rate >= 65) return { label: 'Watch',   tagBg: '#FFFBEB', tagFg: '#B45309', barColor: '#F59E0B', rateFg: '#B45309' }
  return           { label: 'At Risk', tagBg: '#FEF2F2', tagFg: '#DC2626', barColor: '#EF4444', rateFg: '#DC2626' }
}

export default async function BranchPerformanceTable() {
  const branches = await getBranchFinanceStats()
  if (!branches.length) return null

  return (
    <div className="ds-card overflow-hidden">
      {/* Table header */}
      <div className="flex items-center px-[18px] py-[9px] border-b border-[#f1f4f8]">
        <span className="flex-1 min-w-[120px] text-[9.5px] font-bold uppercase tracking-[.1em] text-[#94A3B8]">
          Branch
        </span>
        <span className="hidden sm:block w-[140px] text-center text-[9.5px] font-bold uppercase tracking-[.1em] text-[#94A3B8]">
          Collection Rate
        </span>
        <span className="w-[68px] text-end text-[9.5px] font-bold uppercase tracking-[.1em] text-[#94A3B8]">
          Students
        </span>
        <span className="w-[76px] text-end text-[9.5px] font-bold uppercase tracking-[.1em] text-[#94A3B8]">
          Status
        </span>
      </div>

      {branches.map(b => {
        const s = statusFor(b.collection_rate)
        return (
          <Link
            key={b.branch_id}
            href={`/admin/branches/${b.branch_id}/performance`}
            className="flex items-center px-[18px] py-[11px] border-b border-[#f8fafc] last:border-0 hover:bg-[#fafbfc] transition-colors"
          >
            {/* Branch name + meta */}
            <div className="flex-1 min-w-[120px]">
              <p className="text-[12.5px] font-semibold text-[#0B1F3A]">{b.branch_name}</p>
              <p className="text-[10.5px] text-[#94A3B8] mt-[1px]">{b.total_students} students</p>
            </div>

            {/* Collection rate bar — desktop only */}
            <div className="hidden sm:block w-[140px] px-[12px]">
              <div className="h-[5px] bg-[#eef1f6] rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${Math.min(100, b.collection_rate)}%`, background: s.barColor }}
                />
              </div>
              <p
                className="font-orbitron text-[10px] font-bold mt-[3px] text-center"
                style={{ color: s.rateFg }}
              >
                {b.collection_rate}%
              </p>
            </div>

            {/* Student count */}
            <div className="w-[68px] text-end">
              <span className="font-orbitron text-[14px] font-bold text-[#0B1F3A]">
                {b.total_students}
              </span>
            </div>

            {/* Status badge */}
            <div className="w-[76px] text-end">
              <span
                className="text-[10px] font-bold px-[9px] py-[3px] rounded-[20px]"
                style={{ background: s.tagBg, color: s.tagFg }}
              >
                {s.label}
              </span>
            </div>
          </Link>
        )
      })}
    </div>
  )
}
