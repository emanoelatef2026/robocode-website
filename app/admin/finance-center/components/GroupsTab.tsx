'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import type { FinancialExpense, RecurringExpense, GroupPnL } from '@/modules/finance/types'
import { fmt, fmtK, ProfitBadge, RateBadge, exportGroupsExcel, type Branch, type Group } from './shared'
import { ExpenseModal } from '../dialogs/ExpenseModal'
import { GroupDetailModal } from '../dialogs/GroupDetailModal'

// ── Status badge ───────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  active:    'bg-[#E7F8EE] text-[#15803D]',
  forming:   'bg-[#EFF6FF] text-[#1D4ED8]',
  completed: 'bg-[#F1F5F9] text-[#475569]',
  archived:  'bg-[#F3F4F6] text-[#6B7280]',
}

function StatusBadge({ status }: { status: string }) {
  const cls = STATUS_COLORS[status] ?? 'bg-[#F3F4F6] text-[#6B7280]'
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize ${cls}`}>
      {status}
    </span>
  )
}

const ALL_STATUSES = ['all', 'active', 'forming', 'completed', 'archived'] as const
type StatusFilter = typeof ALL_STATUSES[number]

// ── Groups Tab ─────────────────────────────────────────────────────────────────

export function GroupsTab({
  rows, expenses, recurring, branches, groups, onRefresh,
}: {
  rows:      GroupPnL[]
  expenses:  FinancialExpense[]
  recurring: RecurringExpense[]
  branches:  Branch[]
  groups:    Group[]
  onRefresh: () => void
}) {
  const [search,       setSearch]       = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [sortCol,      setSortCol]      = useState<keyof GroupPnL>('net_expected_revenue')
  const [sortAsc,      setSortAsc]      = useState(false)
  const [detailId,     setDetailId]     = useState<string | null>(null)
  const [addOpen,      setAddOpen]      = useState(false)

  const headerScrollRef = useRef<HTMLDivElement>(null)
  const bodyScrollRef   = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const body = bodyScrollRef.current
    const head = headerScrollRef.current
    if (!body || !head) return
    const sync = () => { head.scrollLeft = body.scrollLeft }
    body.addEventListener('scroll', sync, { passive: true })
    return () => body.removeEventListener('scroll', sync)
  }, [])

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return rows
      .filter(r => {
        if (statusFilter !== 'all' && r.group_status !== statusFilter) return false
        if (q && !r.group_name.toLowerCase().includes(q) && !r.branch_name.toLowerCase().includes(q)) return false
        return true
      })
      .sort((a, b) => {
        const av = a[sortCol] as number, bv = b[sortCol] as number
        return sortAsc ? av - bv : bv - av
      })
  }, [rows, search, statusFilter, sortCol, sortAsc])

  function toggleSort(col: keyof GroupPnL) {
    if (sortCol === col) setSortAsc(!sortAsc)
    else { setSortCol(col); setSortAsc(false) }
  }

  const SortTh = ({ col, label }: { col: keyof GroupPnL; label: string }) => (
    <th
      className="px-3 py-2.5 text-right text-[11px] font-medium text-[#64748B] whitespace-nowrap cursor-pointer hover:text-[#0B1F3A] select-none"
      onClick={() => toggleSort(col)}
    >
      {label}{sortCol === col ? (sortAsc ? ' ↑' : ' ↓') : ''}
    </th>
  )

  const detailGroup = detailId ? rows.find(r => r.group_id === detailId) : null

  const totalNetExpRev = filtered.reduce((s, r) => s + r.net_expected_revenue,  0)
  const totalNetColRev = filtered.reduce((s, r) => s + r.net_collected_revenue, 0)
  const totalEarned    = filtered.reduce((s, r) => s + r.instructor_earned,     0)
  const totalFinalCost = filtered.reduce((s, r) => s + r.final_instructor_cost, 0)
  const totalProfit    = filtered.reduce((s, r) => s + r.actual_profit,         0)

  // Fixed column widths — keeps header & body tables perfectly aligned
  const COL_W = [155,125,85,75,75,120,120,115,115,110,110,110,110,110,110,110,110,75,85]
  const TABLE_W = COL_W.reduce((a, b) => a + b, 0)

  const Colgroup = () => (
    <colgroup>
      {COL_W.map((w, i) => <col key={i} style={{ width: w }} />)}
    </colgroup>
  )

  return (
    <div className="space-y-4">
      {/* Summary KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {[
          { label: 'Net Expected',      value: fmtK(totalNetExpRev),   color: 'bg-[#94A3B8]' },
          { label: 'Net Collected',     value: fmtK(totalNetColRev),   color: 'bg-[#10B981]' },
          { label: 'Instr. Earned',     value: fmtK(totalEarned),      color: 'bg-violet-400' },
          { label: 'Final Instr. Cost', value: fmtK(totalFinalCost),   color: 'bg-orange-400' },
          { label: 'Actual Profit',     value: fmtK(totalProfit),      color: totalProfit >= 0 ? 'bg-[#10B981]' : 'bg-[#EF4444]' },
        ].map(k => (
          <div key={k.label} className="ds-card p-4">
            <div className={`mb-2 h-1.5 w-8 rounded-full ${k.color} opacity-80`} />
            <p className={`text-xl font-bold ${k.label === 'Actual Profit' && totalProfit < 0 ? 'text-[#EF4444]' : 'text-[#0B1F3A]'}`}>{k.value}</p>
            <p className="mt-0.5 text-xs text-[#64748B]">{k.label}</p>
          </div>
        ))}
      </div>

      {/*
        TABLE — sticky header and body are DOM siblings.
        isolation:isolate creates an explicit stacking context so z-30 vs z-0
        is always resolved inside this div.
        transform:translateZ(0) promotes the sticky header to its own GPU
        compositor layer, which always paints above the overflow-x body layer.
      */}
      <div style={{ isolation: 'isolate' }}>

        {/* ── STICKY HEADER ── */}
        <div
          className="sticky top-0 z-30"
          style={{ transform: 'translateZ(0)', background: '#fff', border: '1px solid #e7ebf1', borderBottom: 'none', borderRadius: '16px 16px 0 0', boxShadow: '0 -1px 3px rgba(11,31,58,.04)' }}
        >
          {/* Single header row: label · pills · search · excel · add */}
          <div className="flex flex-nowrap items-center gap-2 px-4 py-2.5 border-b border-[#E2E8F0] overflow-hidden">
            <p className="text-[10.5px] font-semibold uppercase tracking-wider text-[#94A3B8] flex-shrink-0 mr-1">
              {filtered.length} groups
            </p>
            <div className="w-px h-4 bg-[#E2E8F0] flex-shrink-0" />
            {ALL_STATUSES.map(s => {
              const count = s === 'all' ? rows.length : rows.filter(r => r.group_status === s).length
              const isActive = statusFilter === s
              return (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={`rounded-full px-2.5 py-1 text-[11px] font-semibold transition border flex-shrink-0 ${
                    isActive
                      ? 'border-[#FF8A1F] bg-orange-50 text-[#FF8A1F]'
                      : 'border-[#E2E8F0] text-[#64748B] hover:border-[#CBD5E1]'
                  }`}
                >
                  {s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)} ({count})
                </button>
              )
            })}
            <div className="w-px h-4 bg-[#E2E8F0] flex-shrink-0" />
            <input
              type="text" placeholder="Search…"
              value={search} onChange={e => setSearch(e.target.value)}
              className="rounded-lg border border-[#E2E8F0] px-3 py-1 text-xs focus:border-[#FF8A1F] focus:outline-none w-32 flex-shrink-0"
            />
            <button
              onClick={() => exportGroupsExcel(filtered)}
              className="rounded-lg border border-[#E2E8F0] px-2.5 py-1 text-xs font-medium text-[#64748B] hover:border-[#CBD5E1] hover:text-[#0B1F3A] transition flex-shrink-0"
            >
              ↓ Excel
            </button>
            <button
              onClick={() => setAddOpen(true)}
              className="rounded-lg bg-[#FF8A1F] px-3 py-1 text-xs font-semibold text-white hover:bg-[#e07a1a] flex-shrink-0 ml-auto"
            >
              + Add Expense
            </button>
          </div>

          {/* Column headers — overflow-hidden, synced with body scroll */}
          <div ref={headerScrollRef} className="overflow-hidden bg-[#F8FAFC]">
            <table className="text-sm" style={{ width: TABLE_W, tableLayout: 'fixed' }}>
              <Colgroup />
              <thead>
                <tr>
                  <th className="px-3 py-2.5 text-left text-[11px] font-medium text-[#64748B]">Group</th>
                  <th className="px-3 py-2.5 text-left text-[11px] font-medium text-[#64748B]">Branch</th>
                  <th className="px-3 py-2.5 text-center text-[11px] font-medium text-[#64748B]">Status</th>
                  <th className="px-3 py-2.5 text-center text-[11px] font-medium text-[#64748B]">Students</th>
                  <th className="px-3 py-2.5 text-center text-[11px] font-medium text-[#64748B]">Share %</th>
                  <SortTh col="net_expected_revenue"   label="Net Expected" />
                  <SortTh col="net_collected_revenue"  label="Net Collected" />
                  <SortTh col="outstanding"            label="Outstanding" />
                  <SortTh col="instructor_earned"      label="Instr. Earned" />
                  <SortTh col="instructor_paid"        label="Instr. Paid" />
                  <SortTh col="instructor_remaining"   label="Instr. Owing" />
                  <SortTh col="future_liability"       label="Future Liab." />
                  <SortTh col="final_instructor_cost"  label="Final Instr." />
                  <SortTh col="manual_expenses"        label="Manual Exp" />
                  <SortTh col="total_expenses"         label="Total Exp" />
                  <SortTh col="expected_profit"        label="Exp. Profit" />
                  <SortTh col="actual_profit"          label="Act. Profit" />
                  <th className="px-3 py-2.5 text-center text-[11px] font-medium text-[#64748B]">Rate</th>
                  <th className="px-3 py-2.5" />
                </tr>
              </thead>
            </table>
          </div>
        </div>

        {/* ── BODY: z-index:0 keeps it below sticky header (z-30) in parent stacking context ── */}
        <div style={{ position: 'relative', zIndex: 0, border: '1px solid #e7ebf1', borderTop: 'none', borderRadius: '0 0 16px 16px', overflow: 'hidden' }}>
        <div ref={bodyScrollRef} className="overflow-x-auto">
          <table className="text-sm" style={{ width: TABLE_W, tableLayout: 'fixed' }}>
            <Colgroup />
            <tbody>
              {filtered.map(g => (
                <tr
                  key={g.group_id}
                  className="ds-table-row cursor-pointer border-b border-[#F1F5F9] last:border-0"
                  onClick={() => setDetailId(g.group_id)}
                >
                  <td className="px-3 py-3 font-semibold text-[#0B1F3A] truncate">{g.group_name}</td>
                  <td className="px-3 py-3 text-[#64748B] truncate">{g.branch_name}</td>
                  <td className="px-3 py-3 text-center"><StatusBadge status={g.group_status} /></td>
                  <td className="px-3 py-3 text-center text-[#64748B]">{g.student_count}</td>
                  <td className="px-3 py-3 text-center">
                    <span className={`font-semibold text-xs ${g.robocode_share_percent < 100 ? 'text-[#F59E0B]' : 'text-[#94A3B8]'}`}>
                      {g.robocode_share_percent}%
                    </span>
                  </td>
                  <td className="px-3 py-3 text-right font-medium text-[#15803D]">{fmt(g.net_expected_revenue)}</td>
                  <td className="px-3 py-3 text-right font-medium text-[#15803D]">{fmt(g.net_collected_revenue)}</td>
                  <td className="px-3 py-3 text-right text-[#F59E0B]">{fmt(g.outstanding)}</td>
                  <td className="px-3 py-3 text-right text-violet-700">{fmt(g.instructor_earned)}</td>
                  <td className="px-3 py-3 text-right text-[#15803D]">{fmt(g.instructor_paid)}</td>
                  <td className="px-3 py-3 text-right text-orange-600">{fmt(g.instructor_remaining)}</td>
                  <td className="px-3 py-3 text-right text-rose-600">{fmt(g.future_liability)}</td>
                  <td className="px-3 py-3 text-right font-semibold text-[#DC2626]">{fmt(g.final_instructor_cost)}</td>
                  <td className="px-3 py-3 text-right text-indigo-700">{fmt(g.manual_expenses)}</td>
                  <td className="px-3 py-3 text-right text-[#EF4444] font-medium">{fmt(g.total_expenses)}</td>
                  <td className="px-3 py-3 text-right"><ProfitBadge value={g.expected_profit} size="xs" /></td>
                  <td className="px-3 py-3 text-right"><ProfitBadge value={g.actual_profit}   size="xs" /></td>
                  <td className="px-3 py-3 text-center"><RateBadge rate={g.collection_rate} /></td>
                  <td className="px-3 py-3">
                    <button
                      onClick={ev => { ev.stopPropagation(); setDetailId(g.group_id) }}
                      className="text-[11px] font-medium text-[#FF8A1F] hover:underline whitespace-nowrap"
                    >
                      Details →
                    </button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={19} className="px-4 py-10 text-center text-sm text-[#94A3B8]">
                    No groups match your filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        </div>
      </div>

      {/* Group detail modal */}
      {detailId && detailGroup && (
        <GroupDetailModal
          groupId={detailId}
          groupName={detailGroup.group_name}
          expenses={expenses}
          recurring={recurring}
          branches={branches}
          groups={groups}
          onClose={() => setDetailId(null)}
          onRefresh={onRefresh}
        />
      )}

      {addOpen && (
        <ExpenseModal
          scope="GROUP"
          branches={branches}
          groups={groups}
          onClose={() => setAddOpen(false)}
          onSuccess={onRefresh}
        />
      )}
    </div>
  )
}
