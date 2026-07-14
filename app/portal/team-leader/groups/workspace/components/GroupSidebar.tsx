import type { GroupOperationalRow, GroupFormOptions } from '@/modules/groups/operational'
import type { Filters, QuickFilter } from '../types'
import { applyFilters } from '../utils'
import { GroupListItem } from './GroupListItem'
import { getCohortLifecycleStage } from '@/modules/groups/lifecycle-stage'

const QUICK_FILTER_OPTIONS: {
  value: QuickFilter
  label: string
  count: (g: GroupOperationalRow[]) => number
}[] = [
  { value: '',               label: 'All Groups',     count: g => g.length },
  { value: 'draft',          label: 'Draft',          count: g => g.filter(x => getCohortLifecycleStage(x) === 'draft').length },
  { value: 'open',           label: 'Open',           count: g => g.filter(x => getCohortLifecycleStage(x) === 'open').length },
  { value: 'running',        label: 'Running',        count: g => g.filter(x => getCohortLifecycleStage(x) === 'running').length },
  { value: 'completed',      label: 'Completed',      count: g => g.filter(x => getCohortLifecycleStage(x) === 'completed').length },
  { value: 'no_instructor',  label: 'No Instructor',  count: g => g.filter(x => !x.has_instructor).length },
  { value: 'low_attendance', label: 'Low Attendance', count: g => g.filter(x => x.is_low_attendance).length },
  { value: 'low_capacity',   label: 'Under Capacity', count: g => g.filter(x => x.is_low_capacity).length },
  { value: 'overloaded',     label: 'Full',           count: g => g.filter(x => x.is_overloaded).length },
  { value: 'starts_soon',    label: 'Starting Soon',  count: g => g.filter(x => x.starts_soon).length },
  { value: 'archived',       label: 'Archived',       count: g => g.filter(x => x.status === 'archived').length },
  { value: 'cancelled',      label: 'Cancelled',      count: g => g.filter(x => x.status === 'cancelled').length },
]

export function GroupSidebar({
  groups, allGroups, filters, onFilterChange, options,
  selectedId, onSelect,
}: {
  groups:         GroupOperationalRow[]
  allGroups:      GroupOperationalRow[]
  filters:        Filters
  onFilterChange: (patch: Partial<Filters>) => void
  options:        GroupFormOptions
  selectedId:     string | null
  onSelect:       (g: GroupOperationalRow) => void
}) {
  const baseFiltered   = applyFilters(allGroups, { ...filters, quickFilter: '' })
  const searchFiltered = applyFilters(allGroups, { q: filters.q, branch_id: '', quickFilter: '' })

  return (
    <div className="flex flex-col h-full">
      <div className="border-b border-[#E2E8F0] px-3 py-2 space-y-1.5 shrink-0">
        <input
          type="text"
          value={filters.q}
          onChange={e => onFilterChange({ q: e.target.value })}
          placeholder="Search name, instructor, course…"
          className="w-full rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-1.5 text-[12px] text-[#0B1F3A] outline-none focus:border-[#FF8A1F] focus:bg-white"
        />
        <div className={options.branches.length > 1 ? 'grid grid-cols-2 gap-1.5' : ''}>
          {options.branches.length > 1 && (
            <select
              value={filters.branch_id}
              onChange={e => onFilterChange({ branch_id: e.target.value })}
              className="w-full rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-2 py-1.5 text-[12px] text-[#374151] outline-none focus:border-[#FF8A1F]"
            >
              <option value="">All Branches ({searchFiltered.length})</option>
              {options.branches.map(b => (
                <option key={b.id} value={b.id}>
                  {b.name} ({searchFiltered.filter(g => g.branch_id === b.id).length})
                </option>
              ))}
            </select>
          )}
          <select
            value={filters.quickFilter}
            onChange={e => onFilterChange({ quickFilter: e.target.value as QuickFilter })}
            className={[
              'w-full rounded-lg border px-2 py-1.5 text-[12px] outline-none focus:border-[#FF8A1F] transition',
              filters.quickFilter
                ? 'border-[#FF8A1F] bg-[#FFF7ED] text-[#FF8A1F] font-medium'
                : 'border-[#E2E8F0] bg-[#F8FAFC] text-[#374151]',
            ].join(' ')}
          >
            {QUICK_FILTER_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>
                {opt.label} ({opt.count(baseFiltered)})
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {groups.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-14 text-[#94A3B8]">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="mb-3 h-9 w-9 opacity-30">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <p className="text-[12px]">No groups found.</p>
          </div>
        ) : (
          groups.map(g => (
            <GroupListItem
              key={g.group_id}
              group={g}
              selected={g.group_id === selectedId}
              onClick={() => onSelect(g)}
            />
          ))
        )}
      </div>
    </div>
  )
}
