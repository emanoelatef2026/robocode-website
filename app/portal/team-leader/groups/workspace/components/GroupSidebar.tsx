import type { GroupOperationalRow, GroupFormOptions } from '@/modules/groups/operational'
import type { Filters, QuickFilter } from '../types'
import { applyFilters } from '../utils'
import { DAYS_FULL } from '../utils'
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
  const searchFiltered = applyFilters(allGroups, { q: filters.q, branch_id: '', quickFilter: '', day_of_week: filters.day_of_week })
  // Keep the branch filter available even if the form-options request was
  // incomplete. The operational group rows already contain the authoritative
  // branch id/name pair, so they are a reliable fallback for this UI filter.
  const branchOptions = options.branches.length
    ? options.branches
    : Array.from(
        new Map(allGroups.map(g => [g.branch_id, { id: g.branch_id, name: g.branch_name }])).values(),
      ).sort((a, b) => a.name.localeCompare(b.name))

  return (
    <div className="flex flex-col">
      <div className="sticky top-0 z-10 border-b border-[#E2E8F0] bg-[#F5F7FA] p-3">
        <div className="grid gap-2 rounded-[14px] border border-[#D7E0EA] bg-white p-2 sm:grid-cols-2 lg:grid-cols-4">
        <input
          type="text"
          value={filters.q}
          onChange={e => onFilterChange({ q: e.target.value })}
          placeholder="Search name, instructor, course…"
          className="ds-input ds-search-field h-10 w-full px-3 text-[14px] font-normal text-[#0F172A] placeholder:text-[#94A3B8]"
        />
          {branchOptions.length > 0 && (
            <select
              value={filters.branch_id}
              onChange={e => onFilterChange({ branch_id: e.target.value })}
              className="ds-filter-select w-full text-[14px] font-normal"
            >
              <option value="">All Branches ({searchFiltered.length})</option>
              {branchOptions.map(b => (
                <option key={b.id} value={b.id}>
                  {b.name} ({searchFiltered.filter(g => g.branch_id === b.id).length})
                </option>
              ))}
            </select>
          )}
          <select
            value={filters.day_of_week}
            onChange={e => onFilterChange({ day_of_week: e.target.value })}
            className="ds-filter-select w-full text-[14px] font-normal"
          >
            <option value="">All Days</option>
            {Object.entries(DAYS_FULL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
          <select
            value={filters.quickFilter}
            onChange={e => onFilterChange({ quickFilter: e.target.value as QuickFilter })}
            className="ds-filter-select w-full text-[14px] font-normal"
          >
            {QUICK_FILTER_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>
                {opt.label} ({opt.count(baseFiltered)})
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="p-3">
        <p className="mb-2 text-[13px] font-medium text-[#52677F]" aria-live="polite">
          Showing {groups.length} of {allGroups.length} groups
        </p>
        {groups.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-14 text-[#94A3B8]">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="mb-3 h-9 w-9 opacity-30">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <p className="text-[13px]">No groups found.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {groups.map(g => (
              <GroupListItem
                key={g.group_id}
                group={g}
                selected={g.group_id === selectedId}
                onClick={() => onSelect(g)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
