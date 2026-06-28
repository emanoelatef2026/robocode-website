interface Props {
  title: string
  sub?:  string
}

export default function SectionDivider({ title, sub }: Props) {
  return (
    <div className="flex items-center gap-[10px] mb-3 mt-7 first:mt-0">
      <span className="text-[9.5px] font-bold uppercase tracking-[0.16em] text-[#94A3B8] whitespace-nowrap">
        {title}
      </span>
      <div className="flex-1 h-px bg-[#eef1f6]" />
      {sub && (
        <span className="text-[10.5px] text-[#94A3B8] whitespace-nowrap">{sub}</span>
      )}
    </div>
  )
}
