'use client'

import { useState, useMemo } from 'react'
import type { InstructorOperationalRow } from '@/modules/instructors/types'
import type { ViewMode, QuickFilter } from '../types'
import { filterInstructors } from '../utils'

export function useInstructorFilters(instructors: InstructorOperationalRow[]) {
  const [viewMode, setViewMode]         = useState<ViewMode>('grid')
  const [searchQ, setSearchQ]           = useState('')
  const [branchFilter, setBranchFilter] = useState('')
  const [quickFilter, setQuickFilter]   = useState<QuickFilter>('')

  const visible = useMemo(
    () => filterInstructors(instructors, searchQ, branchFilter, quickFilter),
    [instructors, searchQ, branchFilter, quickFilter],
  )

  function clearFilters() {
    setSearchQ('')
    setBranchFilter('')
    setQuickFilter('')
  }

  return {
    viewMode, setViewMode,
    searchQ, setSearchQ,
    branchFilter, setBranchFilter,
    quickFilter, setQuickFilter,
    visible,
    clearFilters,
    hasActiveFilter: !!(searchQ || branchFilter || quickFilter),
  }
}
