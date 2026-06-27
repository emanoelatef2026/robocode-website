export function StatCard({ label, value, sub, accent, danger }: {
  label:   string
  value:   string | number
  sub?:    string
  accent?: boolean
  danger?: boolean
}) {
  return (
    <div className={`min-w-0 rounded-xl border px-2 py-1.5 md:p-3 ${
      accent ? 'border-[#FF8A1F]/30 bg-[#FFF7ED]'
             : danger ? 'border-[#FECACA] bg-[#FEE2E2]'
                      : 'border-[#E2E8F0] bg-white'
    }`}>
      <p className={`truncate text-[8px] font-medium leading-tight md:text-[11px] ${
        accent ? 'text-[#FF8A1F]/70' : danger ? 'text-[#F87171]' : 'text-[#64748B]'
      }`}>{label}</p>
      <p className={`mt-0.5 truncate text-[13px] font-bold leading-none md:text-[20px] ${
        accent ? 'text-[#FF8A1F]' : danger ? 'text-[#EF4444]' : 'text-[#0B1F3A]'
      }`}>{value}</p>
      {sub && (
        <p className={`mt-0.5 truncate text-[8px] leading-tight md:text-[10px] ${
          accent ? 'text-[#FF8A1F]/60' : danger ? 'text-[#F87171]' : 'text-[#94A3B8]'
        }`}>{sub}</p>
      )}
    </div>
  )
}
