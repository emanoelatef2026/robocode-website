export function DrawerRow({
  label, value, bold, hi, cls,
}: {
  label: string; value: string; bold?: boolean; hi?: boolean; cls?: string
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[12px] text-[#64748B]">{label}</span>
      <span className={`text-[12px] ${hi ? "text-[#FF8A1F] font-bold" : bold ? "font-semibold text-[#0B1F3A]" : "text-[#0B1F3A]"} ${cls ?? ""}`}>
        {value}
      </span>
    </div>
  )
}
