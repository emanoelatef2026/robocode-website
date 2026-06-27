export function SummaryCard({
  label, value, color,
}: {
  label: string
  value: string
  color?: "emerald" | "red" | "amber"
}) {
  const textCls = color === "emerald" ? "text-[#15803D]" : color === "red" ? "text-[#EF4444]" : color === "amber" ? "text-[#B45309]" : "text-[#0B1F3A]"
  return (
    <div className="ds-card px-4 py-3">
      <p className={`text-[18px] font-extrabold ${textCls}`}>{value}</p>
      <p className="text-[11px] font-medium text-[#94A3B8] mt-0.5">{label}</p>
    </div>
  )
}
