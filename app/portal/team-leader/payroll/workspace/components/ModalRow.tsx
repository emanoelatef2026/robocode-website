export function ModalRow({ label, value, right, rightCls }: { label: string; value?: string; right?: string; rightCls?: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[12px] text-[#64748B]">{label}</span>
      <span className={`text-[12px] text-[#0B1F3A] ${rightCls ?? ""}`}>{right ?? value ?? "—"}</span>
    </div>
  )
}
