export function Empty({ text, sub }: { text: string; sub?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-center">
      <p className="text-[13px] font-medium text-[#94A3B8]">{text}</p>
      {sub && <p className="mt-0.5 text-[11px] text-[#CBD5E1]">{sub}</p>}
    </div>
  )
}
