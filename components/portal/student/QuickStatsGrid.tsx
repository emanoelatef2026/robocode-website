import Link from 'next/link'

export interface QuickStat {
  label:   string
  emoji:   string
  value:   string
  sub:     string
  href?:   string
  bgFrom:  string
  bgTo:    string
  textColor: string
  subColor:  string
}

function StatTile({ label, emoji, value, sub, href, bgFrom, bgTo, textColor, subColor }: QuickStat) {
  const inner = (
    <div
      className="relative overflow-hidden rounded-2xl p-3 h-full"
      style={{ background: `linear-gradient(135deg, ${bgFrom} 0%, ${bgTo} 100%)` }}
    >
      <div className="flex items-center justify-between">
        <p className={`text-[9.5px] font-bold uppercase tracking-wider ${subColor}`}>{label}</p>
        <span className="text-[18px]">{emoji}</span>
      </div>
      <p className={`mt-1.5 text-[22px] font-extrabold leading-none ${textColor}`}>{value}</p>
      <p className={`mt-0.5 text-[10px] font-medium ${subColor}`}>{sub}</p>
    </div>
  )
  if (href) {
    return (
      <Link href={href} className="block transition active:scale-[0.97]">
        {inner}
      </Link>
    )
  }
  return inner
}

export default function QuickStatsGrid({ stats }: { stats: QuickStat[] }) {
  return (
    <div className="grid grid-cols-2 gap-2.5 md:grid-cols-3">
      {stats.map((s, i) => <StatTile key={i} {...s} />)}
    </div>
  )
}
