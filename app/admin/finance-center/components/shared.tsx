'use client'

import { useState, useTransition } from 'react'
import * as XLSX from 'xlsx'
import { deleteExpense } from '@/modules/finance/actions'
import type { GroupPnL, BranchPnL, AcademyPnL } from '@/modules/finance/types'

export interface Branch { id: string; name: string }
export interface Group  { id: string; name: string; branch_id: string; branch_name: string; status: string }

export function fmt(n: number) {
  return `EGP ${new Intl.NumberFormat('en-EG', { maximumFractionDigits: 0 }).format(n)}`
}

export function fmtK(n: number) {
  const abs = Math.abs(n), sign = n < 0 ? '-' : ''
  if (abs >= 1_000_000) return `${sign}EGP ${(abs / 1_000_000).toFixed(1)}M`
  if (abs >= 1_000)     return `${sign}EGP ${(abs / 1_000).toFixed(0)}K`
  return fmt(n)
}

export function ProfitBadge({ value, size = 'sm' }: { value: number; size?: 'sm' | 'xs' }) {
  const pos = value >= 0
  const cls = pos ? 'text-[#15803D]' : 'text-[#EF4444]'
  const text = size === 'sm' ? 'text-sm font-bold' : 'text-xs font-semibold'
  return (
    <span className={`${text} ${cls}`}>
      {value < 0 ? '−' : '+'}{fmt(Math.abs(value))}
    </span>
  )
}

export function RateBadge({ rate }: { rate: number }) {
  const cls = rate >= 80 ? 'bg-[#E7F8EE] text-[#15803D]' : rate >= 50 ? 'bg-[#FFFBEB] text-[#B45309]' : 'bg-[#FEE2E2] text-[#EF4444]'
  return <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${cls}`}>{rate}%</span>
}

// ── Excel export helpers ───────────────────────────────────────────────────────

function downloadWorkbook(wb: XLSX.WorkBook, filename: string) {
  XLSX.writeFile(wb, filename)
}

export function exportGroupsExcel(rows: GroupPnL[]) {
  const data = rows.map(r => ({
    'Group':                   r.group_name,
    'Branch':                  r.branch_name,
    'Status':                  r.group_status,
    'Course':                  r.course_name ?? '',
    'Instructor':              r.instructor_name ?? '',
    'Students':                r.student_count,
    'Share %':                 r.robocode_share_percent,
    'Total Sessions':          r.total_sessions,
    'Completed Sessions':      r.completed_sessions,
    'Remaining Sessions':      r.remaining_sessions,
    'Session Rate (EGP)':      r.session_rate,
    'Net Expected (EGP)':      r.net_expected_revenue,
    'Net Collected (EGP)':     r.net_collected_revenue,
    'Outstanding (EGP)':       r.outstanding,
    'Collection Rate':         `${r.collection_rate}%`,
    'Instr. Earned (EGP)':     r.instructor_earned,
    'Instr. Paid (EGP)':       r.instructor_paid,
    'Instr. Remaining (EGP)':  r.instructor_remaining,
    'Future Liability (EGP)':  r.future_liability,
    'Final Instr. Cost (EGP)': r.final_instructor_cost,
    'Manual Exp (EGP)':        r.manual_expenses,
    'Recur. Exp (EGP)':        r.recurring_expenses,
    'Total Exp (EGP)':         r.total_expenses,
    'Exp. Profit (EGP)':       r.expected_profit,
    'Act. Profit (EGP)':       r.actual_profit,
  }))
  const ws = XLSX.utils.json_to_sheet(data)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Groups')
  downloadWorkbook(wb, `groups-pnl-${new Date().toISOString().slice(0, 10)}.xlsx`)
}

export function exportBranchesExcel(rows: BranchPnL[]) {
  const data = rows.map(r => ({
    'Branch':                  r.branch_name,
    'Groups':                  r.group_count,
    'Students':                r.student_count,
    'Net Expected (EGP)':      r.net_expected_revenue,
    'Net Collected (EGP)':     r.net_collected_revenue,
    'Outstanding (EGP)':       r.outstanding,
    'Collection Rate':         `${r.collection_rate}%`,
    'Instr. Earned (EGP)':     r.instructor_earned,
    'Instr. Paid (EGP)':       r.instructor_paid,
    'Instr. Remaining (EGP)':  r.instructor_remaining,
    'Future Liability (EGP)':  r.future_liability,
    'Final Instr. Cost (EGP)': r.final_instructor_cost,
    'Branch Exp (EGP)':        r.branch_expenses,
    'Group Exp (EGP)':         r.group_expenses,
    'Total Exp (EGP)':         r.total_expenses,
    'Exp. Profit (EGP)':       r.expected_profit,
    'Act. Profit (EGP)':       r.actual_profit,
  }))
  const ws = XLSX.utils.json_to_sheet(data)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Branches')
  downloadWorkbook(wb, `branches-pnl-${new Date().toISOString().slice(0, 10)}.xlsx`)
}

export function exportAcademyExcel(academy: AcademyPnL) {
  const summary = [{
    'Metric': 'Academy P&L Summary', 'Value (EGP)': '',
  }, {
    'Metric': 'Net Expected Revenue',     'Value (EGP)': academy.net_expected_revenue,
  }, {
    'Metric': 'Net Collected Revenue',    'Value (EGP)': academy.net_collected_revenue,
  }, {
    'Metric': 'Outstanding',              'Value (EGP)': academy.outstanding,
  }, {
    'Metric': 'Collection Rate',          'Value (EGP)': `${academy.collection_rate}%`,
  }, {
    'Metric': 'Instructor Earned',        'Value (EGP)': academy.instructor_earned,
  }, {
    'Metric': 'Instructor Paid',          'Value (EGP)': academy.instructor_paid,
  }, {
    'Metric': 'Instructor Remaining',     'Value (EGP)': academy.instructor_remaining,
  }, {
    'Metric': 'Future Liability',         'Value (EGP)': academy.future_liability,
  }, {
    'Metric': 'Final Instructor Cost',    'Value (EGP)': academy.final_instructor_cost,
  }, {
    'Metric': 'Branch Expenses',          'Value (EGP)': academy.branch_expenses,
  }, {
    'Metric': 'Group Expenses',           'Value (EGP)': academy.group_expenses,
  }, {
    'Metric': 'Academy Expenses',         'Value (EGP)': academy.academy_expenses,
  }, {
    'Metric': 'Total Expenses',           'Value (EGP)': academy.total_expenses,
  }, {
    'Metric': 'Expected Profit',          'Value (EGP)': academy.expected_profit,
  }, {
    'Metric': 'Actual Profit',            'Value (EGP)': academy.actual_profit,
  }]

  const trend = academy.monthly_trend.map(m => ({
    'Month':                    m.label,
    'Net Collected (EGP)':      m.net_collected_revenue,
    'Instr. Earned (EGP)':      m.instructor_earned,
    'Other Exp (EGP)':          m.other_expenses,
    'Total Exp (EGP)':          m.total_expenses,
    'Act. Profit (EGP)':        m.actual_profit,
  }))

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summary), 'Summary')
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(trend),   'Monthly Trend')
  downloadWorkbook(wb, `academy-pnl-${new Date().toISOString().slice(0, 10)}.xlsx`)
}

// ── Modal wrapper ─────────────────────────────────────────────────────────────

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[#E2E8F0] px-6 py-4">
          <h2 className="text-base font-semibold text-[#0B1F3A]">{title}</h2>
          <button onClick={onClose} className="text-xl text-[#94A3B8] hover:text-[#64748B] leading-none">×</button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  )
}

export function DeleteBtn({ id, onSuccess }: { id: string; onSuccess: () => void }) {
  const [isPending, startTransition] = useTransition()
  const [confirm, setConfirm] = useState(false)
  if (!confirm) {
    return (
      <button onClick={() => setConfirm(true)} className="rounded px-2 py-1 text-[11px] text-[#94A3B8] hover:text-[#EF4444] hover:bg-[#FEE2E2]">
        Delete
      </button>
    )
  }
  return (
    <div className="flex items-center gap-1">
      <button
        onClick={() => startTransition(async () => { await deleteExpense(id); onSuccess() })}
        disabled={isPending}
        className="rounded px-2 py-1 text-[11px] font-semibold text-[#EF4444] bg-[#FEE2E2] hover:bg-[#FEE2E2] disabled:opacity-50"
      >
        {isPending ? '…' : 'Confirm'}
      </button>
      <button onClick={() => setConfirm(false)} className="rounded px-2 py-1 text-[11px] text-[#94A3B8]">Cancel</button>
    </div>
  )
}
