'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Branch } from './shared'

export function LiveFilterBar({
  branches, currentBranchId, currentDateFrom, currentDateTo, includeArchived, activeTab, rightAction,
}: {
  branches:        Branch[]
  currentBranchId: string
  currentDateFrom: string
  currentDateTo:   string
  includeArchived: boolean
  activeTab:       string
  rightAction?:    React.ReactNode
}) {
  const router = useRouter()
  const [from, setFrom] = useState(currentDateFrom)
  const [to,   setTo]   = useState(currentDateTo)

  function navigate(overrides: { branch?: string; from?: string; to?: string; archived?: boolean } = {}) {
    const branch   = overrides.branch   ?? currentBranchId
    const f        = overrides.from     ?? from
    const t        = overrides.to       ?? to
    const archived = overrides.archived ?? includeArchived
    const params = new URLSearchParams({ tab: activeTab })
    if (branch)   params.set('branch_id', branch)
    if (f)        params.set('date_from',  f)
    if (t)        params.set('date_to',    t)
    if (archived) params.set('archived',   '1')
    router.push(`/admin/finance-center?${params.toString()}`)
  }

  function preset(p: string) {
    const today = new Date()
    let f = '', t = today.toISOString().slice(0, 10)
    if (p === 'month') {
      f = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10)
      t = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().slice(0, 10)
    } else if (p === 'year') {
      f = `${today.getFullYear()}-01-01`; t = `${today.getFullYear()}-12-31`
    } else if (p === '3m') {
      f = new Date(today.getFullYear(), today.getMonth() - 2, 1).toISOString().slice(0, 10)
    } else if (p === '6m') {
      f = new Date(today.getFullYear(), today.getMonth() - 5, 1).toISOString().slice(0, 10)
    }
    setFrom(f); setTo(t)
    navigate({ from: f, to: t })
  }

  function clear() {
    setFrom(''); setTo('')
    router.push(`/admin/finance-center?tab=${activeTab}`)
  }

  // Filter status labels for the indicator
  const activeBranch   = branches.find(b => b.id === currentBranchId)
  const hasDateFilter  = !!(currentDateFrom || currentDateTo)
  const hasFilters     = !!(currentBranchId || currentDateFrom || currentDateTo)
  const filterParts: string[] = []
  if (activeBranch)   filterParts.push(`Branch: ${activeBranch.name}`)
  if (hasDateFilter)  filterParts.push(`Period: ${currentDateFrom || '…'} → ${currentDateTo || '…'}`)

  return (
    <div className="ds-card px-4 py-2.5">
      <div className="flex flex-wrap items-center gap-2">
        {/* Branch — live on change */}
        <select
          value={currentBranchId}
          onChange={e => navigate({ branch: e.target.value })}
          className="min-w-0 flex-1 rounded-lg border border-[#E2E8F0] px-3 py-1.5 text-xs focus:border-[#FF8A1F] focus:outline-none sm:min-w-[130px] sm:flex-none"
        >
          <option value="">All Branches</option>
          {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>

        {/* Date presets — live on click */}
        {(['month', 'year', '3m', '6m'] as const).map(p => {
          const isActive =
            p === 'month' && currentDateFrom === new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10) ? true :
            p === 'year'  && currentDateFrom === `${new Date().getFullYear()}-01-01` ? true : false
          return (
            <button key={p} onClick={() => preset(p)}
              className={`rounded-lg border px-2.5 py-1.5 text-[11px] font-medium transition flex-shrink-0 ${
                isActive
                  ? 'border-[#FF8A1F] bg-orange-50 text-[#FF8A1F]'
                  : 'border-[#E2E8F0] text-[#64748B] hover:border-[#CBD5E1] hover:text-[#0B1F3A]'
              }`}>
              {p === 'month' ? 'This Month' : p === 'year' ? 'This Year' : p === '3m' ? 'Last 3M' : 'Last 6M'}
            </button>
          )
        })}

        {/* Custom date range — live on blur */}
        <div className="flex min-w-0 flex-1 items-center gap-1 sm:flex-none">
          <input
            type="date" value={from}
            onChange={e => setFrom(e.target.value)}
            onBlur={() => from !== currentDateFrom && navigate({ from })}
            className="min-w-0 w-full rounded-lg border border-[#E2E8F0] px-2.5 py-1.5 text-xs focus:border-[#FF8A1F] focus:outline-none sm:w-auto"
          />
          <span className="text-xs text-[#94A3B8]">—</span>
          <input
            type="date" value={to}
            onChange={e => setTo(e.target.value)}
            onBlur={() => to !== currentDateTo && navigate({ to })}
            className="min-w-0 w-full rounded-lg border border-[#E2E8F0] px-2.5 py-1.5 text-xs focus:border-[#FF8A1F] focus:outline-none sm:w-auto"
          />
        </div>

        {hasFilters && (
          <button onClick={clear} className="text-[11px] text-[#94A3B8] hover:text-[#EF4444] underline flex-shrink-0">
            Clear
          </button>
        )}

        {rightAction && <div className="ml-auto flex-shrink-0">{rightAction}</div>}

        {/* Inline filter status */}
        <div className={`${rightAction ? '' : 'ml-auto'} flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] flex-shrink-0 ${hasFilters ? 'bg-orange-50 text-[#FF8A1F]' : 'bg-[#F8FAFC] text-[#94A3B8]'}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${hasFilters ? 'bg-[#FF8A1F]' : 'bg-[#CBD5E1]'}`} />
          {hasFilters ? filterParts.join(' · ') : 'All data'}
        </div>
      </div>
    </div>
  )
}
