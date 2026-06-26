import type { GroupOperationalRow } from '@/modules/groups/operational'
import { buildKpis, buildPageKpis } from '../utils'

export function CompactKpiStrip({ groups }: { groups: GroupOperationalRow[] }) {
  const kpis = buildKpis(groups)
  return (
    <div className="hidden md:flex items-center gap-5 bg-white border border-[#E2E8F0] rounded-xl px-4 py-2 shrink-0 flex-wrap">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-[#94A3B8]">Overview</span>
      <div className="h-4 w-px bg-[#E2E8F0]" />
      {kpis.map(k => (
        <div key={k.label} className="flex items-center gap-1.5">
          <span className={`h-2 w-2 rounded-full ${k.color} shrink-0`} />
          <span className="text-[13px] font-bold text-[#0B1F3A]">{k.value}</span>
          <span className="text-[11px] text-[#94A3B8]">{k.label}</span>
        </div>
      ))}
    </div>
  )
}

export function PageHeaderKpiStrip({ groups }: { groups: GroupOperationalRow[] }) {
  const kpis = buildPageKpis(groups)
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
      {kpis.map(k => (
        <div key={k.label} className={`rounded-xl border border-[#E2E8F0] ${k.bgColor} p-3`}>
          <div className="flex items-center gap-1.5 mb-1.5">
            <span className={`h-2 w-2 rounded-full ${k.dotColor} shrink-0`} />
            <p className="text-[10px] font-semibold uppercase tracking-wide text-[#94A3B8]">{k.label}</p>
          </div>
          <p className={`text-[22px] font-bold leading-none ${k.valueColor}`}>{k.value}</p>
        </div>
      ))}
    </div>
  )
}
