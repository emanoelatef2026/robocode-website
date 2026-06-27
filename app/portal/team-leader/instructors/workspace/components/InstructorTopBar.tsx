import type { ViewMode } from '../types'

export function InstructorTopBar({
  viewMode,
  onViewModeChange,
}: {
  viewMode:          ViewMode
  onViewModeChange:  (m: ViewMode) => void
}) {
  return (
    <div className="shrink-0 border-b border-[#E2E8F0] bg-white px-4 md:px-6 py-2 md:py-3">
      <div className="flex items-center justify-between gap-2 md:gap-4">
        <div className="flex items-center gap-1.5 md:gap-2 shrink-0">
          <div className="flex rounded-lg border border-[#E2E8F0] overflow-hidden">
            <button
              onClick={() => onViewModeChange('grid')}
              className={`px-2.5 md:px-3 py-1.5 transition ${viewMode === 'grid' ? 'bg-[#0B1F3A] text-white' : 'bg-white text-[#64748B] hover:bg-[#F8FAFC]'}`}
              title="Grid view"
            >
              <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                <path d="M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zM5 11a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5zM11 5a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V5zM11 13a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"/>
              </svg>
            </button>
            <button
              onClick={() => onViewModeChange('list')}
              className={`px-2.5 md:px-3 py-1.5 transition ${viewMode === 'list' ? 'bg-[#0B1F3A] text-white' : 'bg-white text-[#64748B] hover:bg-[#F8FAFC]'}`}
              title="List view"
            >
              <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                <path fillRule="evenodd" d="M3 4a1 1 0 000 2h14a1 1 0 100-2H3zm0 4a1 1 0 000 2h14a1 1 0 100-2H3zm0 4a1 1 0 000 2h14a1 1 0 100-2H3zm0 4a1 1 0 000 2h14a1 1 0 100-2H3z" clipRule="evenodd"/>
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
