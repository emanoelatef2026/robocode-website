import type { GroupOperationalRow } from '@/modules/groups/operational'
import { StatusChip } from './StatusChip'

export function GroupListItem({
  group, selected, onClick,
}: {
  group:    GroupOperationalRow
  selected: boolean
  onClick:  () => void
}) {
  return (
    <button
      onClick={onClick}
      className={[
        'w-full text-left px-3 py-2 border-b border-[#F1F5F9] transition-colors',
        selected
          ? 'bg-[#FFF7ED] border-l-[3px] border-l-[#FF8A1F]'
          : 'active:bg-[#F8FAFC] border-l-[3px] border-l-transparent',
      ].join(' ')}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-[12px] font-semibold text-[#0B1F3A] truncate">{group.name}</p>
        <StatusChip group={group} />
      </div>
      <p className="mt-0.5 text-[11px] text-[#94A3B8]">
        {group.student_count} student{group.student_count !== 1 ? 's' : ''}
        {group.day_of_week ? (
          <span className="ml-1.5 capitalize">{group.day_of_week.slice(0, 3)}</span>
        ) : null}
      </p>
    </button>
  )
}
