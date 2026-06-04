import type { RecommendedAction } from '@/modules/actions-engine'

interface Props {
  actions: RecommendedAction[]
  max?: number
}

export default function ActionBadges({ actions, max = 3 }: Props) {
  if (!actions.length) return null

  const shown = actions.slice(0, max)
  const rest  = actions.length - shown.length

  return (
    <div className="flex flex-wrap gap-1">
      {shown.map(a => (
        <span
          key={a.code}
          title={a.description}
          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${a.color} ${a.textColor}`}
        >
          {a.icon} {a.label}
        </span>
      ))}
      {rest > 0 && (
        <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
          +{rest} more
        </span>
      )}
    </div>
  )
}
