import type { GroupOperationalRow } from '@/modules/groups/operational'
import { buildKpis, buildPageKpis } from '../utils'

export function CompactKpiStrip({ groups }: { groups: GroupOperationalRow[] }) {
  const kpis = buildKpis(groups)
  return (
    <div className="hidden md:flex items-center gap-5 bg-white border border-[#E2E8F0] rounded-xl px-4 py-2 shrink-0 flex-wrap">
      <span className="text-[12px] font-semibold uppercase tracking-wider text-[#94A3B8]">Overview</span>
      <div className="h-4 w-px bg-[#E2E8F0]" />
      {kpis.map(k => (
        <div key={k.label} className="flex items-center gap-1.5">
          <span className={`h-2 w-2 rounded-full ${k.color} shrink-0`} />
          <span className="text-[13px] font-bold text-[#0B1F3A]">{k.value}</span>
          <span className="text-[12px] text-[#94A3B8]">{k.label}</span>
        </div>
      ))}
    </div>
  )
}

export function PageHeaderKpiStrip({ groups }: { groups: GroupOperationalRow[] }) {
  const kpis = buildPageKpis(groups)
  return (
    <>
      <div className="hidden grid-cols-2 gap-3 sm:grid sm:grid-cols-3 lg:grid-cols-6">
        {kpis.map(k => (
          <div key={k.label} className="rounded-xl border border-[#D7E0EA] bg-white p-4 shadow-[0_1px_3px_rgba(7,24,45,.03)]">
            <p className="text-[13px] font-normal leading-none text-[#64748B]">{k.label}</p>
            <p className="mt-2 text-[26px] font-bold leading-none tracking-[-0.03em] text-[#0B1F3A]">{k.value}</p>
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 md:hidden">
        <span className="text-[12px] font-semibold uppercase tracking-wide text-[#94A3B8]">Groups</span>
        <span className="text-[13px] font-bold text-[#0B1F3A]">{groups.length} total</span>
      </div>
    </>
  )
}
