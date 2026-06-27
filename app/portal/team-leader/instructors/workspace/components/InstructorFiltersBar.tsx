import type { InstructorOperationalRow } from '@/modules/instructors/types'
import type { QuickFilter } from '../types'

export function InstructorFiltersBar({
  searchQ, onSearchChange,
  branchFilter, onBranchChange,
  quickFilter, onQuickFilterChange,
  onClear, hasActiveFilter,
  branches, instructors,
  visibleCount, totalCount,
}: {
  searchQ:              string
  onSearchChange:       (v: string) => void
  branchFilter:         string
  onBranchChange:       (v: string) => void
  quickFilter:          QuickFilter
  onQuickFilterChange:  (v: QuickFilter) => void
  onClear:              () => void
  hasActiveFilter:      boolean
  branches:             { id: string; name: string }[]
  instructors:          InstructorOperationalRow[]
  visibleCount:         number
  totalCount:           number
}) {
  return (
    <div className="shrink-0 border-b border-[#E2E8F0] bg-white px-3 md:px-6 py-2 md:py-2.5">
      <div className="flex flex-col gap-1.5 md:flex-row md:items-center md:gap-3">
        {/* Row 1: search + mobile count */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <svg viewBox="0 0 20 20" fill="currentColor" className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#CBD5E1]">
              <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd"/>
            </svg>
            <input
              type="text"
              value={searchQ}
              onChange={e => onSearchChange(e.target.value)}
              placeholder="Search name, code, branch…"
              className="w-full rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] pl-8 pr-3 py-1.5 text-[11px] md:text-[12px] outline-none focus:border-[#FF8A1F] focus:bg-white transition"
            />
          </div>
          <span className="md:hidden text-[10px] text-[#94A3B8] shrink-0 whitespace-nowrap">
            {visibleCount !== totalCount ? `${visibleCount}/${totalCount}` : `${totalCount}`}
          </span>
        </div>

        {/* Row 2: selects + clear + desktop count */}
        <div className="flex items-center gap-1.5 md:gap-3">
          {branches.length > 1 && (
            <select
              value={branchFilter}
              onChange={e => onBranchChange(e.target.value)}
              className="flex-1 md:flex-none rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-2 md:px-3 py-1 md:py-1.5 text-[11px] md:text-[12px] text-[#374151] outline-none focus:border-[#FF8A1F] focus:bg-white transition"
            >
              <option value="">All Branches</option>
              {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          )}
          <select
            value={quickFilter}
            onChange={e => onQuickFilterChange(e.target.value as QuickFilter)}
            className={`flex-1 md:flex-none rounded-lg border px-2 md:px-3 py-1 md:py-1.5 text-[11px] md:text-[12px] outline-none transition ${quickFilter ? 'border-[#FF8A1F] bg-[#FFF7ED] text-[#FF8A1F]' : 'border-[#E2E8F0] bg-[#F8FAFC] text-[#374151] focus:border-[#FF8A1F] focus:bg-white'}`}
          >
            <option value="">All Status</option>
            <option value="active">Active ({instructors.filter(i => i.status === 'active').length})</option>
            <option value="inactive">Inactive ({instructors.filter(i => i.status === 'inactive').length})</option>
            <option value="on_leave">On Leave ({instructors.filter(i => i.status === 'on_leave').length})</option>
            <option value="no_groups">No Groups ({instructors.filter(i => i.group_count === 0).length})</option>
          </select>
          {hasActiveFilter && (
            <button
              onClick={onClear}
              className="rounded-lg border border-[#E2E8F0] px-2 md:px-3 py-1 md:py-1.5 text-[11px] md:text-[12px] text-[#64748B] hover:bg-[#F1F5F9] transition shrink-0"
            >
              Clear
            </button>
          )}
          <span className="hidden md:block ml-auto text-[11px] text-[#94A3B8] whitespace-nowrap">
            {visibleCount !== totalCount ? `${visibleCount} of ${totalCount}` : `${totalCount} instructors`}
          </span>
        </div>
      </div>
    </div>
  )
}
