"use client"

import { useState, useTransition }  from "react"
import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { AnimatePresence, motion }                from "framer-motion"
import {
  generateMonthlyPayrollAction,
  approvePayrollRunAction,
  markPayrollPaidAction,
  archivePayrollRunAction,
  addPayrollAdjustmentAction,
  deletePayrollAdjustmentAction,
  approvePayrollItemAction,
  exportPayrollCSVAction,
  getPayrollItemDetailAction,
} from "@/modules/payroll/actions"
import type {
  PayrollRunWithItems, PayrollItemRow, PayrollDetailItem,
  PayrollRunStatus, AdjustmentType,
} from "@/modules/payroll/types"
import { MONTH_NAMES, fmtAmount, fmtCurrency, formatPayrollPeriod } from "@/modules/payroll/types"

// ── Status helpers ─────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<PayrollRunStatus, { label: string; cls: string }> = {
  draft:    { label: "Draft",    cls: "bg-amber-100 text-amber-700" },
  approved: { label: "Approved", cls: "bg-blue-100  text-blue-700"  },
  paid:     { label: "Paid",     cls: "bg-emerald-100 text-emerald-700" },
  archived: { label: "Archived", cls: "bg-slate-100 text-slate-500"  },
}

const ITEM_STATUS_CONFIG = {
  draft:    { label: "Draft",    cls: "bg-amber-100 text-amber-700"     },
  approved: { label: "Approved", cls: "bg-blue-100  text-blue-700"      },
  paid:     { label: "Paid",     cls: "bg-emerald-100 text-emerald-700" },
}

const ADJ_TYPE_LABELS: Record<AdjustmentType, string> = {
  bonus:      "Bonus",
  penalty:    "Penalty",
  transport:  "Transport",
  allowance:  "Allowance",
  deduction:  "Deduction",
  other:      "Other",
}

function StatusBadge({ status }: { status: PayrollRunStatus }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.draft
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${cfg.cls}`}>
      {cfg.label}
    </span>
  )
}

function ItemStatusBadge({ status }: { status: 'draft' | 'approved' | 'paid' }) {
  const cfg = ITEM_STATUS_CONFIG[status] ?? ITEM_STATUS_CONFIG.draft
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${cfg.cls}`}>
      {cfg.label}
    </span>
  )
}

// ── Avatar initial ─────────────────────────────────────────────────────────────

function Avatar({ name, size = "sm" }: { name: string; size?: "sm" | "md" }) {
  const initials = name.split(" ").slice(0, 2).map(w => w[0]).join("").toUpperCase()
  const sizeClass = size === "md" ? "h-10 w-10 text-[14px]" : "h-8 w-8 text-[12px]"
  return (
    <div className={`${sizeClass} shrink-0 rounded-full bg-[#0B1F3A] flex items-center justify-center font-bold text-white`}>
      {initials || "?"}
    </div>
  )
}

// ── KPI strip ─────────────────────────────────────────────────────────────────

function KPIStrip({ run }: { run: PayrollRunWithItems }) {
  const items = run.items
  const currency = items[0]?.currency ?? "EGP"

  const total    = run.total_amount
  const draft    = items.filter(i => i.status === "draft"   ).reduce((s, i) => s + i.final_amount, 0)
  const approved = items.filter(i => i.status === "approved").reduce((s, i) => s + i.final_amount, 0)
  const paid     = items.filter(i => i.status === "paid"    ).reduce((s, i) => s + i.final_amount, 0)
  const sessions = items.reduce((s, i) => s + i.sessions_count, 0)
  const avgRate  = items.length ? items.reduce((s, i) => s + i.rate_per_session, 0) / items.length : 0

  const kpis = [
    { label: "Total Payroll",      value: fmtCurrency(total,    currency), highlight: true },
    { label: "Pending",            value: fmtCurrency(draft,    currency), highlight: false },
    { label: "Approved",           value: fmtCurrency(approved, currency), highlight: false },
    { label: "Paid",               value: fmtCurrency(paid,     currency), highlight: false },
    { label: "Total Sessions",     value: String(sessions),                highlight: false },
    { label: "Avg Rate / Session", value: fmtCurrency(avgRate,  currency), highlight: false },
  ]

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6 md:gap-3">
      {kpis.map(k => (
        <div
          key={k.label}
          className={`min-w-0 flex flex-col justify-center rounded-xl border px-3 py-2.5 md:px-4 md:py-3 ${
            k.highlight ? "border-[#FF8A1F]/30 bg-[#FF8A1F]/5" : "border-[#E2E8F0] bg-white"
          }`}
        >
          <p className={`truncate text-[13px] font-extrabold leading-none md:text-[17px] ${
            k.highlight ? "text-[#FF8A1F]" : "text-[#0B1F3A]"
          }`}>
            {k.value}
          </p>
          <p className="mt-0.5 truncate text-[8px] font-medium text-[#94A3B8] md:text-[10px]">{k.label}</p>
        </div>
      ))}
    </div>
  )
}

// ── Empty KPI strip ────────────────────────────────────────────────────────────

function EmptyKPIStrip() {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6 md:gap-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="h-[52px] rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] animate-pulse" />
      ))}
    </div>
  )
}

// ── Payroll table row (desktop) ───────────────────────────────────────────────

function PayrollTableRow({
  item, runStatus, onView, onApprove,
}: {
  item: PayrollItemRow
  runStatus: PayrollRunStatus
  onView: (id: string) => void
  onApprove: (id: string) => void
}) {
  const adj = item.adjustments_total
  return (
    <tr className="border-b border-[#F1F5F9] hover:bg-[#F8FAFC] transition-colors">
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <Avatar name={item.instructor_name} />
          <span className="text-[13px] font-semibold text-[#0B1F3A] truncate max-w-[160px]">
            {item.instructor_name}
          </span>
        </div>
      </td>
      <td className="px-4 py-3 text-[13px] text-[#0B1F3A] tabular-nums">{item.sessions_count}</td>
      <td className="px-4 py-3 text-[13px] text-[#64748B] tabular-nums">
        {fmtCurrency(item.rate_per_session, item.currency)}
      </td>
      <td className="px-4 py-3 text-[13px] text-[#0B1F3A] font-medium tabular-nums">
        {fmtCurrency(item.gross_amount, item.currency)}
      </td>
      <td className="px-4 py-3 text-[13px] tabular-nums">
        <span className={adj > 0 ? "text-emerald-600" : adj < 0 ? "text-red-500" : "text-[#94A3B8]"}>
          {adj !== 0 ? `${adj > 0 ? "+" : ""}${fmtCurrency(adj, item.currency)}` : "—"}
        </span>
      </td>
      <td className="px-4 py-3 text-[13px] font-bold text-[#0B1F3A] tabular-nums">
        {fmtCurrency(item.final_amount, item.currency)}
      </td>
      <td className="px-4 py-3">
        <ItemStatusBadge status={item.status} />
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => onView(item.id)}
            className="rounded-lg border border-[#E2E8F0] bg-white px-2.5 py-1 text-[11px] font-medium text-[#64748B] hover:border-[#CBD5E1] hover:text-[#0B1F3A] transition"
          >
            View
          </button>
          {item.status === "draft" && runStatus !== "paid" && (
            <button
              onClick={() => onApprove(item.id)}
              className="rounded-lg bg-blue-600 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-blue-700 transition"
            >
              Approve
            </button>
          )}
        </div>
      </td>
    </tr>
  )
}

// ── Payroll mobile card ────────────────────────────────────────────────────────

function PayrollMobileCard({
  item, runStatus, onView, onApprove,
}: {
  item: PayrollItemRow
  runStatus: PayrollRunStatus
  onView: (id: string) => void
  onApprove: (id: string) => void
}) {
  const adj = item.adjustments_total
  return (
    <div
      className="bg-white rounded-xl border border-[#E2E8F0] px-3 py-3 space-y-2 active:bg-[#F8FAFC] transition-colors cursor-pointer"
      onClick={() => onView(item.id)}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <Avatar name={item.instructor_name} size="sm" />
          <div className="min-w-0">
            <p className="text-[13px] font-semibold text-[#0B1F3A] truncate">{item.instructor_name}</p>
            <p className="text-[10px] text-[#94A3B8]">{item.sessions_count} sessions · {fmtCurrency(item.rate_per_session, item.currency)}/session</p>
          </div>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-[14px] font-bold text-[#0B1F3A]">{fmtCurrency(item.final_amount, item.currency)}</p>
          <ItemStatusBadge status={item.status} />
        </div>
      </div>

      {adj !== 0 && (
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-[#94A3B8]">Gross: {fmtCurrency(item.gross_amount, item.currency)}</span>
          <span className={adj > 0 ? "text-emerald-600" : "text-red-500"}>
            Adj: {adj > 0 ? "+" : ""}{fmtCurrency(adj, item.currency)}
          </span>
        </div>
      )}

      {item.status === "draft" && runStatus !== "paid" && (
        <button
          onClick={e => { e.stopPropagation(); onApprove(item.id) }}
          className="w-full rounded-lg bg-blue-600 py-1.5 text-[11px] font-semibold text-white hover:bg-blue-700 transition"
        >
          Approve
        </button>
      )}
    </div>
  )
}

// ── Detail drawer ─────────────────────────────────────────────────────────────

function DetailDrawer({
  detail,
  runStatus,
  onClose,
  onAdjustmentAdded,
  onAdjustmentDeleted,
}: {
  detail: PayrollDetailItem
  runStatus: PayrollRunStatus
  onClose: () => void
  onAdjustmentAdded: (updated: PayrollDetailItem) => void
  onAdjustmentDeleted: (updated: PayrollDetailItem) => void
}) {
  const [pending, startTransition] = useTransition()
  const [adjType,   setAdjType]   = useState<AdjustmentType>("bonus")
  const [adjAmount, setAdjAmount] = useState("")
  const [adjNotes,  setAdjNotes]  = useState("")
  const [adjError,  setAdjError]  = useState("")
  const [showForm,  setShowForm]  = useState(false)

  const canEdit = runStatus !== "paid" && detail.status !== "paid"

  function handleAddAdjustment() {
    const amt = parseFloat(adjAmount)
    if (!adjAmount || isNaN(amt) || amt === 0) {
      setAdjError("Enter a valid non-zero amount.")
      return
    }
    setAdjError("")
    startTransition(async () => {
      const finalAmt = ["penalty", "deduction"].includes(adjType) ? -Math.abs(amt) : Math.abs(amt)
      const res = await addPayrollAdjustmentAction(detail.id, adjType, finalAmt, adjNotes)
      if (res.success) {
        onAdjustmentAdded(res.data)
        setAdjAmount("")
        setAdjNotes("")
        setShowForm(false)
      } else {
        setAdjError(res.error.message)
      }
    })
  }

  function handleDeleteAdj(adjId: string) {
    startTransition(async () => {
      const res = await deletePayrollAdjustmentAction(adjId)
      if (res.success) onAdjustmentDeleted(res.data)
    })
  }

  const gross = detail.gross_amount
  const adj   = detail.adjustments_total
  const final = detail.final_amount

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#E2E8F0] px-5 py-4 shrink-0">
        <div className="flex items-center gap-3">
          <Avatar name={detail.instructor_name} size="md" />
          <div>
            <p className="text-[15px] font-bold text-[#0B1F3A]">{detail.instructor_name}</p>
            <div className="flex items-center gap-2 mt-0.5">
              <ItemStatusBadge status={detail.status} />
              <span className="text-[11px] text-[#94A3B8]">
                {fmtCurrency(detail.rate_per_session, detail.currency)}/session
              </span>
            </div>
          </div>
        </div>
        <button
          onClick={onClose}
          className="rounded-full p-1.5 text-[#94A3B8] hover:bg-[#F1F5F9] hover:text-[#0B1F3A] transition"
        >
          <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-5 space-y-6 pb-safe">

        {/* Salary summary */}
        <section>
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.15em] text-[#94A3B8] mb-3">Salary Summary</h3>
          <div className="rounded-xl border border-[#E2E8F0] bg-white divide-y divide-[#F1F5F9]">
            <div className="flex justify-between items-center px-4 py-3">
              <span className="text-[13px] text-[#64748B]">Sessions × Rate</span>
              <span className="text-[13px] font-medium text-[#0B1F3A] tabular-nums">
                {detail.sessions_count} × {fmtCurrency(detail.rate_per_session, detail.currency)}
              </span>
            </div>
            <div className="flex justify-between items-center px-4 py-3">
              <span className="text-[13px] text-[#64748B]">Gross Amount</span>
              <span className="text-[13px] font-semibold text-[#0B1F3A] tabular-nums">
                {fmtCurrency(gross, detail.currency)}
              </span>
            </div>
            <div className="flex justify-between items-center px-4 py-3">
              <span className="text-[13px] text-[#64748B]">Adjustments</span>
              <span className={`text-[13px] font-medium tabular-nums ${
                adj > 0 ? "text-emerald-600" : adj < 0 ? "text-red-500" : "text-[#94A3B8]"
              }`}>
                {adj !== 0 ? `${adj > 0 ? "+" : ""}${fmtCurrency(adj, detail.currency)}` : "—"}
              </span>
            </div>
            <div className="flex justify-between items-center px-4 py-3 bg-[#F8FAFC]">
              <span className="text-[14px] font-bold text-[#0B1F3A]">Final Salary</span>
              <span className="text-[16px] font-extrabold text-[#0B1F3A] tabular-nums">
                {fmtCurrency(final, detail.currency)}
              </span>
            </div>
          </div>
        </section>

        {/* Session breakdown */}
        <section>
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.15em] text-[#94A3B8] mb-3">
            Session Breakdown ({detail.snapshots.length} sessions)
          </h3>
          {detail.snapshots.length === 0 ? (
            <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-6 text-center">
              <p className="text-[13px] text-[#94A3B8]">No sessions contributed to this payroll item.</p>
            </div>
          ) : (
            <div className="rounded-xl border border-[#E2E8F0] divide-y divide-[#F1F5F9] overflow-hidden">
              {detail.snapshots.map(snap => (
                <div key={snap.id} className="flex items-start justify-between gap-3 px-4 py-2.5 bg-white">
                  <div className="min-w-0">
                    <p className="text-[12px] font-semibold text-[#0B1F3A] truncate">
                      #{snap.session_number} — {snap.group_name}
                    </p>
                    <p className="text-[11px] text-[#94A3B8] truncate">{snap.topic ?? "—"}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-[11px] font-medium text-[#64748B] tabular-nums">
                      {new Date(snap.session_date).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                    </p>
                    <p className="text-[11px] font-bold text-[#0B1F3A]">{fmtCurrency(snap.session_value, detail.currency)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Adjustments */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[11px] font-semibold uppercase tracking-[0.15em] text-[#94A3B8]">
              Adjustments
            </h3>
            {canEdit && !showForm && (
              <button
                onClick={() => setShowForm(true)}
                className="text-[11px] font-semibold text-[#FF8A1F] hover:text-[#e07018] transition"
              >
                + Add Adjustment
              </button>
            )}
          </div>

          {/* Add form */}
          {canEdit && showForm && (
            <div className="mb-3 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-4 space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-semibold text-[#64748B] uppercase tracking-wide">Type</label>
                  <select
                    value={adjType}
                    onChange={e => setAdjType(e.target.value as AdjustmentType)}
                    className="mt-1 w-full rounded-lg border border-[#E2E8F0] bg-white px-2.5 py-2 text-[12px] text-[#0B1F3A] focus:border-[#FF8A1F] focus:outline-none"
                  >
                    {Object.entries(ADJ_TYPE_LABELS).map(([v, l]) => (
                      <option key={v} value={v}>{l}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-[#64748B] uppercase tracking-wide">
                    Amount ({detail.currency})
                  </label>
                  <input
                    type="number"
                    value={adjAmount}
                    onChange={e => setAdjAmount(e.target.value)}
                    placeholder="0"
                    className="mt-1 w-full rounded-lg border border-[#E2E8F0] bg-white px-2.5 py-2 text-[12px] text-[#0B1F3A] focus:border-[#FF8A1F] focus:outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="text-[10px] font-semibold text-[#64748B] uppercase tracking-wide">Notes</label>
                <input
                  type="text"
                  value={adjNotes}
                  onChange={e => setAdjNotes(e.target.value)}
                  placeholder="Reason (optional)"
                  className="mt-1 w-full rounded-lg border border-[#E2E8F0] bg-white px-2.5 py-2 text-[12px] text-[#0B1F3A] focus:border-[#FF8A1F] focus:outline-none"
                />
              </div>
              {adjError && <p className="text-[11px] text-red-600">{adjError}</p>}
              <div className="flex gap-2">
                <button
                  onClick={handleAddAdjustment}
                  disabled={pending}
                  className="flex-1 rounded-lg bg-[#0B1F3A] py-2 text-[12px] font-semibold text-white hover:bg-[#1a2f4a] disabled:opacity-50 transition"
                >
                  {pending ? "Saving…" : "Save Adjustment"}
                </button>
                <button
                  onClick={() => { setShowForm(false); setAdjError("") }}
                  className="rounded-lg border border-[#E2E8F0] px-3 py-2 text-[12px] text-[#64748B] hover:bg-white transition"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Adjustment list */}
          {detail.adjustments.length === 0 ? (
            <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-4 text-center">
              <p className="text-[12px] text-[#94A3B8]">No adjustments yet.</p>
            </div>
          ) : (
            <div className="rounded-xl border border-[#E2E8F0] divide-y divide-[#F1F5F9] overflow-hidden">
              {detail.adjustments.map(adj => (
                <div key={adj.id} className="flex items-center justify-between gap-3 px-4 py-2.5 bg-white">
                  <div className="min-w-0">
                    <p className="text-[12px] font-semibold text-[#0B1F3A]">{ADJ_TYPE_LABELS[adj.type]}</p>
                    {adj.notes && <p className="text-[11px] text-[#94A3B8] truncate">{adj.notes}</p>}
                  </div>
                  <div className="shrink-0 flex items-center gap-3">
                    <span className={`text-[13px] font-bold tabular-nums ${
                      adj.amount > 0 ? "text-emerald-600" : "text-red-500"
                    }`}>
                      {adj.amount > 0 ? "+" : ""}{fmtCurrency(adj.amount, detail.currency)}
                    </span>
                    {canEdit && (
                      <button
                        onClick={() => handleDeleteAdj(adj.id)}
                        disabled={pending}
                        className="rounded p-1 text-red-400 hover:bg-red-50 hover:text-red-600 transition disabled:opacity-50"
                      >
                        <svg viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5">
                          <path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z"/>
                          <path fillRule="evenodd" d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"/>
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

// ── Generate modal ─────────────────────────────────────────────────────────────

function GenerateModal({
  month, year, branchName,
  onConfirm, onClose, loading, error,
}: {
  month: number; year: number; branchName: string
  onConfirm: () => void; onClose: () => void
  loading: boolean; error: string
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative z-10 w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
        <h2 className="text-[16px] font-bold text-[#0B1F3A]">Generate Payroll</h2>
        <p className="mt-2 text-[13px] text-[#64748B]">
          This will calculate instructor salaries for{" "}
          <strong className="text-[#0B1F3A]">{formatPayrollPeriod(month, year)}</strong>{" "}
          in <strong className="text-[#0B1F3A]">{branchName}</strong> based on completed sessions.
        </p>
        <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
          <p className="text-[11px] text-amber-700">
            This creates an immutable session snapshot. Future attendance changes will NOT affect this payroll. Use "Regenerate" to update.
          </p>
        </div>
        {error && (
          <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[12px] text-red-700">{error}</p>
        )}
        <div className="mt-5 flex gap-3">
          <button
            onClick={onConfirm}
            disabled={loading}
            className="flex-1 rounded-xl bg-[#0B1F3A] py-2.5 text-[13px] font-bold text-white hover:bg-[#1a2f4a] disabled:opacity-50 transition"
          >
            {loading ? "Generating…" : `Generate ${MONTH_NAMES[month - 1]} ${year}`}
          </button>
          <button
            onClick={onClose}
            className="rounded-xl border border-[#E2E8F0] px-4 py-2.5 text-[13px] text-[#64748B] hover:bg-[#F8FAFC] transition"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Empty state ────────────────────────────────────────────────────────────────

function EmptyPayrollState({ period, onGenerate }: { period: string; onGenerate: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 md:py-16 px-4 text-center">
      <div className="mb-3 md:mb-4 h-12 w-12 md:h-16 md:w-16 rounded-2xl bg-[#F1F5F9] flex items-center justify-center">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-6 w-6 md:h-8 md:w-8 text-[#94A3B8]">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
        </svg>
      </div>
      <h3 className="text-[15px] font-bold text-[#0B1F3A]">No payroll for {period}</h3>
      <p className="mt-1 text-[13px] text-[#64748B] max-w-xs">
        No payroll has been generated for this period yet. Click the button below to calculate instructor salaries from completed sessions.
      </p>
      <button
        onClick={onGenerate}
        className="mt-5 w-full md:w-auto rounded-xl bg-[#0B1F3A] px-5 py-3 min-h-[44px] text-[13px] font-bold text-white hover:bg-[#1a2f4a] transition"
      >
        Generate {period} Payroll
      </button>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

interface Props {
  initialPayroll:  PayrollRunWithItems | null
  branchIds:       string[]
  branches:        { id: string; name: string }[]
  initialMonth:    number
  initialYear:     number
  initialBranchId: string
}

export default function PayrollWorkspaceClient({
  initialPayroll, branchIds, branches,
  initialMonth, initialYear, initialBranchId,
}: Props) {
  const router         = useRouter()
  const pathname       = usePathname()
  const searchParams   = useSearchParams()
  const [pending, startTransition] = useTransition()

  const [payroll,      setPayroll]      = useState<PayrollRunWithItems | null>(initialPayroll)
  const [month,        setMonth]        = useState(initialMonth)
  const [year,         setYear]         = useState(initialYear)
  const [branchId,     setBranchId]     = useState(initialBranchId)
  const [showGenModal, setShowGenModal] = useState(false)
  const [genError,     setGenError]     = useState("")
  const [actionError,  setActionError]  = useState("")
  const [drawerItemId, setDrawerItemId] = useState<string | null>(null)
  const [drawerDetail, setDrawerDetail] = useState<PayrollDetailItem | null>(null)
  const [drawerLoading,setDrawerLoading]= useState(false)

  const branchName = branches.find(b => b.id === branchId)?.name
    ?? (branchIds.length === 1 ? "Branch" : branchId)

  // ── Routing helpers ──────────────────────────────────────────────────────────

  function navigate(m: number, y: number, b: string) {
    const params = new URLSearchParams(searchParams.toString())
    params.set("month",  String(m))
    params.set("year",   String(y))
    params.set("branch", b)
    router.push(`${pathname}?${params.toString()}`)
    // Optimistic clear while server fetches
    setPayroll(null)
  }

  function handleMonthChange(m: number) { setMonth(m); navigate(m, year, branchId) }
  function handleYearChange(y: number)  { setYear(y);  navigate(month, y, branchId) }
  function handleBranchChange(b: string){ setBranchId(b); navigate(month, year, b) }

  // ── Generate payroll ─────────────────────────────────────────────────────────

  function handleGenerate() {
    setGenError("")
    startTransition(async () => {
      const res = await generateMonthlyPayrollAction(month, year, branchId)
      if (res.success) {
        setShowGenModal(false)
        router.refresh()
      } else {
        setGenError(res.error.message)
      }
    })
  }

  // ── Approve run ──────────────────────────────────────────────────────────────

  function handleApproveRun() {
    if (!payroll) return
    setActionError("")
    startTransition(async () => {
      const res = await approvePayrollRunAction(payroll.id)
      if (!res.success) setActionError(res.error.message)
      else router.refresh()
    })
  }

  // ── Mark paid ────────────────────────────────────────────────────────────────

  function handleMarkPaid() {
    if (!payroll) return
    setActionError("")
    startTransition(async () => {
      const res = await markPayrollPaidAction(payroll.id)
      if (!res.success) setActionError(res.error.message)
      else router.refresh()
    })
  }

  // ── Archive (to allow regeneration) ─────────────────────────────────────────

  function handleArchive() {
    if (!payroll) return
    if (!confirm("Archive this payroll run? This lets you regenerate it. The old run will be kept for records.")) return
    setActionError("")
    startTransition(async () => {
      const res = await archivePayrollRunAction(payroll.id)
      if (!res.success) setActionError(res.error.message)
      else router.refresh()
    })
  }

  // ── Approve item ─────────────────────────────────────────────────────────────

  function handleApproveItem(itemId: string) {
    startTransition(async () => {
      const res = await approvePayrollItemAction(itemId)
      if (!res.success) setActionError(res.error.message)
      else router.refresh()
    })
  }

  // ── Open detail drawer ───────────────────────────────────────────────────────

  async function handleViewItem(itemId: string) {
    setDrawerItemId(itemId)
    setDrawerLoading(true)
    const res = await getPayrollItemDetailAction(itemId)
    setDrawerDetail(res.success ? res.data : null)
    setDrawerLoading(false)
  }

  function handleCloseDrawer() {
    setDrawerItemId(null)
    setDrawerDetail(null)
  }

  function handleAdjustmentChanged(updated: PayrollDetailItem) {
    setDrawerDetail(updated)
    // Refresh list (server will re-fetch)
    router.refresh()
  }

  // ── CSV export ───────────────────────────────────────────────────────────────

  function handleExportCSV() {
    if (!payroll) return
    startTransition(async () => {
      const res = await exportPayrollCSVAction(payroll.id)
      if (res.success) {
        const blob = new Blob([res.data], { type: "text/csv" })
        const url  = URL.createObjectURL(blob)
        const a    = document.createElement("a")
        a.href     = url
        a.download = `payroll-${formatPayrollPeriod(month, year).replace(" ", "-")}.csv`
        a.click()
        URL.revokeObjectURL(url)
      }
    })
  }

  // ── Year options ─────────────────────────────────────────────────────────────

  const currentYear = new Date().getFullYear()
  const yearOptions = Array.from({ length: 5 }, (_, i) => currentYear - i)

  const period = formatPayrollPeriod(month, year)

  return (
    <div className="space-y-4 md:space-y-6 pb-24 md:pb-8">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-[17px] md:text-[20px] font-extrabold tracking-tight text-[#0B1F3A]">
            Instructor Payroll
          </h1>
          <p className="mt-0.5 text-[11px] md:text-[13px] text-[#64748B]">
            Session-based salary tracking and approvals
          </p>
        </div>

        {/* Controls row — mobile: Branch full-width, Month+Year 2-col; sm+: flex row */}
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          {/* Branch filter */}
          {branches.length > 0 && (
            <select
              value={branchId}
              onChange={e => handleBranchChange(e.target.value)}
              className="w-full sm:w-auto rounded-lg border border-[#E2E8F0] bg-white px-2.5 py-1.5 text-[12px] text-[#0B1F3A] focus:border-[#FF8A1F] focus:outline-none"
            >
              {[...branchIds].map(id => {
                const b = branches.find(x => x.id === id)
                return <option key={id} value={id}>{b?.name ?? id}</option>
              })}
            </select>
          )}

          {/* Month + Year — 2-col on mobile, inline on sm+ */}
          <div className="grid grid-cols-2 gap-2 sm:contents">
            <select
              value={month}
              onChange={e => handleMonthChange(Number(e.target.value))}
              className="rounded-lg border border-[#E2E8F0] bg-white px-2.5 py-1.5 text-[12px] text-[#0B1F3A] focus:border-[#FF8A1F] focus:outline-none"
            >
              {MONTH_NAMES.map((n, i) => <option key={i+1} value={i+1}>{n}</option>)}
            </select>
            <select
              value={year}
              onChange={e => handleYearChange(Number(e.target.value))}
              className="rounded-lg border border-[#E2E8F0] bg-white px-2.5 py-1.5 text-[12px] text-[#0B1F3A] focus:border-[#FF8A1F] focus:outline-none"
            >
              {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* ── Error banner ────────────────────────────────────────────────── */}
      {actionError && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[12px] text-red-700 flex items-start gap-2">
          <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 shrink-0 mt-0.5 text-red-500">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          <span>{actionError}</span>
          <button onClick={() => setActionError("")} className="ml-auto text-red-400 hover:text-red-600">✕</button>
        </div>
      )}

      {/* ── No run: KPI skeleton + empty state ─────────────────────────── */}
      {!payroll ? (
        <>
          <EmptyKPIStrip />
          <EmptyPayrollState period={period} onGenerate={() => setShowGenModal(true)} />
        </>
      ) : (
        <>
          {/* ── KPI strip ─────────────────────────────────────────── */}
          <KPIStrip run={payroll} />

          {/* ── Run action bar ─────────────────────────────────────── */}
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#E2E8F0] bg-white px-4 py-3">
            <div className="flex items-center gap-3">
              <StatusBadge status={payroll.status} />
              <span className="text-[13px] font-semibold text-[#0B1F3A]">{period} Payroll</span>
              <span className="text-[12px] text-[#94A3B8]">
                Generated {new Date(payroll.generated_at).toLocaleDateString("en-GB")}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {payroll.status === "draft" && (
                <>
                  <button
                    onClick={handleApproveRun}
                    disabled={pending}
                    className="rounded-lg bg-blue-600 px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-blue-700 disabled:opacity-50 transition"
                  >
                    Approve All
                  </button>
                  <button
                    onClick={handleArchive}
                    disabled={pending}
                    className="rounded-lg border border-[#E2E8F0] px-3 py-1.5 text-[12px] text-[#64748B] hover:bg-[#F8FAFC] disabled:opacity-50 transition"
                  >
                    Regenerate
                  </button>
                </>
              )}
              {payroll.status === "approved" && (
                <button
                  onClick={handleMarkPaid}
                  disabled={pending}
                  className="rounded-lg bg-emerald-600 px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 transition"
                >
                  Mark as Paid
                </button>
              )}
              <button
                onClick={handleExportCSV}
                disabled={pending}
                className="rounded-lg border border-[#E2E8F0] px-3 py-1.5 text-[12px] text-[#64748B] hover:bg-[#F8FAFC] disabled:opacity-50 transition"
              >
                Export CSV
              </button>
            </div>
          </div>

          {/* ── Payroll table (desktop) ────────────────────────────── */}
          {payroll.items.length === 0 ? (
            <div className="rounded-xl border border-[#E2E8F0] bg-white px-4 py-10 text-center">
              <p className="text-[13px] text-[#94A3B8]">No instructor sessions found for this period.</p>
            </div>
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden md:block rounded-xl border border-[#E2E8F0] overflow-hidden bg-white">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                      {["Instructor", "Sessions", "Rate", "Gross", "Adjustments", "Final", "Status", "Actions"]
                        .map(h => (
                          <th key={h} className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wide text-[#94A3B8]">
                            {h}
                          </th>
                        ))}
                    </tr>
                  </thead>
                  <tbody>
                    {payroll.items.map(item => (
                      <PayrollTableRow
                        key={item.id}
                        item={item}
                        runStatus={payroll.status}
                        onView={handleViewItem}
                        onApprove={handleApproveItem}
                      />
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile cards */}
              <div className="md:hidden space-y-2">
                {payroll.items.map(item => (
                  <PayrollMobileCard
                    key={item.id}
                    item={item}
                    runStatus={payroll.status}
                    onView={handleViewItem}
                    onApprove={handleApproveItem}
                  />
                ))}
              </div>
            </>
          )}

          {/* ── Notes if any ──────────────────────────────────────── */}
          {payroll.notes && (
            <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-3">
              <p className="text-[12px] text-[#64748B]">{payroll.notes}</p>
            </div>
          )}
        </>
      )}

      {/* ── Generate modal ───────────────────────────────────────────────── */}
      <AnimatePresence>
        {showGenModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <GenerateModal
              month={month}
              year={year}
              branchName={branchName}
              onConfirm={handleGenerate}
              onClose={() => { setShowGenModal(false); setGenError("") }}
              loading={pending}
              error={genError}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Detail drawer ────────────────────────────────────────────────── */}
      <AnimatePresence>
        {drawerItemId && (
          <>
            {/* Backdrop */}
            <motion.div
              key="drawer-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-40 bg-black/30"
              onClick={handleCloseDrawer}
            />

            {/* Desktop: right-side drawer */}
            <motion.div
              key="drawer-desktop"
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
              className="fixed right-0 top-0 bottom-0 z-50 hidden md:flex flex-col w-[480px] bg-white shadow-2xl"
            >
              {drawerLoading || !drawerDetail ? (
                <div className="flex items-center justify-center flex-1">
                  <div className="h-8 w-8 rounded-full border-2 border-[#0B1F3A] border-t-transparent animate-spin" />
                </div>
              ) : (
                <DetailDrawer
                  detail={drawerDetail}
                  runStatus={payroll?.status ?? "draft"}
                  onClose={handleCloseDrawer}
                  onAdjustmentAdded={handleAdjustmentChanged}
                  onAdjustmentDeleted={handleAdjustmentChanged}
                />
              )}
            </motion.div>

            {/* Mobile: bottom sheet */}
            <motion.div
              key="drawer-mobile"
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
              className="fixed inset-x-0 bottom-0 z-50 md:hidden bg-white rounded-t-2xl shadow-2xl"
              style={{ maxHeight: "88vh", display: "flex", flexDirection: "column" }}
            >
              {/* Handle */}
              <div className="flex justify-center pt-3 pb-1 shrink-0">
                <div className="h-1 w-10 rounded-full bg-[#E2E8F0]" />
              </div>
              {drawerLoading || !drawerDetail ? (
                <div className="flex items-center justify-center py-16">
                  <div className="h-8 w-8 rounded-full border-2 border-[#0B1F3A] border-t-transparent animate-spin" />
                </div>
              ) : (
                <div className="flex-1 min-h-0">
                  <DetailDrawer
                    detail={drawerDetail}
                    runStatus={payroll?.status ?? "draft"}
                    onClose={handleCloseDrawer}
                    onAdjustmentAdded={handleAdjustmentChanged}
                    onAdjustmentDeleted={handleAdjustmentChanged}
                  />
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}
