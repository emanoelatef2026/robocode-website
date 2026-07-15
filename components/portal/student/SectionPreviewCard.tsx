import Link from 'next/link'

interface Props {
  icon:        string
  iconBg:      string
  title:       string
  /** Total count to badge next to the title. Omit when the fetched list is a
   *  preview/limit, not the true total (e.g. a 5-row timeline slice). */
  count?:      number
  countLabel?: string
  hasItems:    boolean
  preview?:    string
  emptyText:   string
  href:        string
}

export default function SectionPreviewCard({ icon, iconBg, title, count, countLabel, hasItems, preview, emptyText, href }: Props) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 ds-card px-3.5 py-3 transition hover:border-[#FF8A1F]/40 hover:shadow-sm active:scale-[0.98]"
    >
      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-[18px] ${iconBg}`}>
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-1.5">
          <p className="text-[12.5px] font-bold text-[#0B1F3A]">{title}</p>
          {!!count && count > 0 && (
            <span className="text-[10.5px] font-semibold text-[#64748B]">{count} {countLabel}</span>
          )}
        </div>
        <p className="mt-0.5 truncate text-[11px] text-[#64748B]">
          {hasItems ? (preview ?? 'View details') : emptyText}
        </p>
      </div>
      <span className="shrink-0 text-[11px] font-bold text-[#FF8A1F]">→</span>
    </Link>
  )
}
