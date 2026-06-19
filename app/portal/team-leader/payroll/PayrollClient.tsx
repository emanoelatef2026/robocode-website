"use client"

import { useState, useTransition } from "react"
import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { AnimatePresence, motion } from "framer-motion"
import Link from "next/link"
import {
  generateMonthlyPayrollAction,
  generateUnifiedPayrollAction,
  approvePayrollRunAction,
  markPayrollPaidAction,
  archivePayrollRunAction,
  finalizePayrollRunAction,
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
import {
  MONTH_NAMES, fmtAmount, fmtCurrency, formatPayrollPeriod,
  ADJUSTMENT_TYPE_LABELS, ADJUSTMENT_SIGN,
  PAYROLL_TYPE_LABELS, PAYMENT_METHOD_LABELS,
} from "@/modules/payroll/types"

// ── Status config ─────────────────────────────────────────────────────────────

const RUN_STATUS_CFG: Record<PayrollRunStatus, { label: string; cls: string }> = {
  draft:     { label: "Draft",     cls: "bg-amber-100 text-amber-700" },
  approved:  { label: "Approved",  cls: "bg-blue-100  text-blue-700"  },
  paid:      { label: "Paid",      cls: "bg-emerald-100 text-emerald-700" },
  archived:  { label: "Archived",  cls: "bg-slate-100 text-slate-500"  },
  finalized: { label: "Finalized", cls: "bg-purple-100 text-purple-700" },
}

const ITEM_STATUS_CFG = {
  draft:    { label: "Draft",    cls: "bg-amber-100 text-amber-700"     },
  approved: { label: "Approved", cls: "bg-blue-100  text-blue-700"      },
  paid:     { label: "Paid",     cls: "bg-emerald-100 text-emerald-700" },
}

// ── Small UI atoms ────────────────────────────────────────────────────────────

function RunBadge({ status }: { status: PayrollRunStatus }) {
  const cfg = RUN_STATUS_CFG[status] ?? RUN_STATUS_CFG.draft
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${cfg.cls}`}>
      {cfg.label}
    </span>
  )
}

function ItemBadge({ status }: { status: 'draft' | 'approved' | 'paid' }) {
  const cfg = ITEM_STATUS_CFG[status] ?? ITEM_STATUS_CFG.draft
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${cfg.cls}`}>
      {cfg.label}
    </span>
  )
}

function Avatar({ name, size = "sm" }: { name: string; size?: "sm" | "md" }) {
  const initials = name.split(" ").slice(0, 2).map(w => w[0]).join("").toUpperCase()
  const cls = size === "md" ? "h-10 w-10 text-[14px]" : "h-8 w-8 text-[11px]"
  return (
    <div className={`${cls} shrink-0 rounded-full bg-[#0B1F3A] flex items-center justify-center font-bold text-white`}>
      {initials || "?"}
    </div>
  )
}

function RoleChip({ role }: { role: string }) {
  const labels: Record<string, string> = {
    instructor: "Instructor", team_leader: "TL", coordinator: "Coord.",
    branch_manager: "Manager", admin: "Admin", sales: "Sales",
    marketing: "Marketing", operations: "Ops", finance: "Finance", other: "Staff",
  }
  return (
    <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[9px] font-semibold bg-[#F1F5F9] text-[#64748B] uppercase tracking-wide">
      {labels[role] ?? role}
    </span>
  )
}

// ── KPI strip ─────────────────────────────────────────────────────────────────

function KPIStrip({ run }: { run: PayrollRunWithItems }) {
  const items    = run.items
  const currency = items[0]?.currency ?? "EGP"

  const total     = run.total_amount
  const sessions  = items.reduce((s, i) => s + i.sessions_count, 0)
  const instructors = items.filter(i => i.staff_role === 'instructor' || i.instructor_id).length
  const employees   = items.filter(i => i.staff_role !== 'instructor' && !i.instructor_id).length
  const paid      = items.filter(i => i.status === "paid").reduce((s, i) => s + i.final_amount, 0)
  const pending   = items.filter(i => i.status !== "paid").reduce((s, i) => s + i.final_amount, 0)
  const adjTotal  = items.reduce((s, i) => s + i.adjustments_total, 0)

  const kpis = [
    { label: "Total Payroll",   value: fmtCurrency(total,    currency), highlight: true },
    { label: "Instructors",     value: String(instructors),              highlight: false },
    { label: "Employees",       value: String(employees),                highlight: false },
    { label: "Paid",            value: fmtCurrency(paid,     currency), highlight: false },
    { label: "Pending",         value: fmtCurrency(pending,  currency), highlight: pending > 0 },
    { label: "Adjustments",     value: fmtCurrency(adjTotal, currency), highlight: false },
  ]

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
      {kpis.map(k => (
        <div
          key={k.label}
          className={`rounded-xl border px-3 py-3 text-center ${
            k.highlight
              ? "border-[#FF8A1F]/30 bg-[#FFF5EC]"
              : "border-[#E2E8F0] bg-white"
          }`}
        >
          <p className={`text-[17px] font-extrabold leading-none ${k.highlight ? "text-[#FF8A1F]" : "text-[#0B1F3A]"}`}>
            {k.value}
          </p>
          <p className="mt-1 text-[10px] font-medium text-[#94A3B8]">{k.label}</p>
        </div>
      ))}
    </div>
  )
}

// ── Adjustment sign helper ────────────────────────────────────────────────────

function adjSign(type: AdjustmentType, rawAmount: number): number {
  const sign = ADJUSTMENT_SIGN[type]
  return sign === -1 ? -Math.abs(rawAmount) : Math.abs(rawAmount)
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  initialPayroll:  PayrollRunWithItems | null
  branchIds:       string[]
  branches:        { id: string; name: string }[]
  initialMonth:    number
  initialYear:     number
  initialBranchId: string
  isSuperAdmin:    boolean
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function PayrollClient({
  initialPayroll, branchIds, branches, initialMonth, initialYear, initialBranchId, isSuperAdmin,
}: Props) {
  const router        = useRouter()
  const pathname      = usePathname()
  const searchParams  = useSearchParams()

  const [payroll,       setPayroll]       = useState<PayrollRunWithItems | null>(initialPayroll)
  const [month,         setMonth]         = useState(initialMonth)
  const [year,          setYear]          = useState(initialYear)
  const [branchId,      setBranchId]      = useState(initialBranchId)
  const [drawerItemId,  setDrawerItemId]  = useState<string | null>(null)
  const [drawerDetail,  setDrawerDetail]  = useState<PayrollDetailItem | null>(null)
  const [showGenModal,  setShowGenModal]  = useState(false)
  const [actionError,   setActionError]   = useState<string | null>(null)
  const [genError,      setGenError]      = useState<string | null>(null)
  const [adjType,       setAdjType]       = useState<AdjustmentType>("bonus")
  const [adjAmount,     setAdjAmount]     = useState("")
  const [adjNotes,      setAdjNotes]      = useState("")

  const [isPending,    startTransition]  = useTransition()
  const [isDrawerPending, startDrawer]   = useTransition()
  const [isAdjPending, startAdj]         = useTransition()

  const isMutable = payroll?.status === "draft" || payroll?.status === "approved"
  const isLocked  = payroll?.status === "paid" || payroll?.status === "finalized"

  // ── Navigation ──────────────────────────────────────────────────────────────

  function navigate(m: number, y: number, b: string) {
    const p = new URLSearchParams(searchParams.toString())
    p.set("month",  String(m))
    p.set("year",   String(y))
    p.set("branch", b)
    router.push(`${pathname}?${p.toString()}`)
    setPayroll(null)
    setActionError(null)
  }

  // ── Drawer ──────────────────────────────────────────────────────────────────

  async function openDrawer(item: PayrollItemRow) {
    setDrawerItemId(item.id)
    setDrawerDetail(null)
    startDrawer(async () => {
      const res = await getPayrollItemDetailAction(item.id)
      if (res.success) setDrawerDetail(res.data)
    })
  }

  function closeDrawer() {
    setDrawerItemId(null)
    setDrawerDetail(null)
    setAdjAmount("")
    setAdjNotes("")
    setAdjType("bonus")
  }

  // ── Generate ────────────────────────────────────────────────────────────────

  function handleGenerate() {
    setGenError(null)
    startTransition(async () => {
      const res = await generateUnifiedPayrollAction(month, year, branchId)
      if (!res.success) { setGenError(res.error.message); return }
      setShowGenModal(false)
      router.refresh()
    })
  }

  // ── Run actions ──────────────────────────────────────────────────────────────

  function runAction(fn: () => Promise<{ success: boolean; error?: { message: string } }>) {
    setActionError(null)
    startTransition(async () => {
      const res = await fn()
      if (!res.success) setActionError((res as any).error?.message ?? "Action failed.")
      else router.refresh()
    })
  }

  // ── Add adjustment ────────────────────────────────────────────────────────────

  function handleAddAdj() {
    const raw = parseFloat(adjAmount)
    if (!raw || raw <= 0) return
    const signed = adjSign(adjType, raw)
    startAdj(async () => {
      const res = await addPayrollAdjustmentAction(drawerItemId!, adjType, signed, adjNotes)
      if (res.success) {
        setDrawerDetail(res.data)
        setAdjAmount("")
        setAdjNotes("")
        router.refresh()
      }
    })
  }

  // ── Delete adjustment ─────────────────────────────────────────────────────────

  function handleDeleteAdj(adjId: string) {
    startAdj(async () => {
      const res = await deletePayrollAdjustmentAction(adjId)
      if (res.success) {
        setDrawerDetail(res.data)
        router.refresh()
      }
    })
  }

  // ── Export CSV ────────────────────────────────────────────────────────────────

  function handleExport() {
    if (!payroll) return
    startTransition(async () => {
      const res = await exportPayrollCSVAction(payroll.id)
      if (res.success) {
        const blob = new Blob([res.data], { type: "text/csv" })
        const url  = URL.createObjectURL(blob)
        const a    = document.createElement("a")
        a.href     = url
        a.download = `payroll-${year}-${String(month).padStart(2, "0")}.csv`
        a.click()
        URL.revokeObjectURL(url)
      }
    })
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  const multipleMonths = Array.from({ length: 12 }, (_, i) => i + 1)
  const multipleYears  = Array.from({ length: 6 }, (_, i) => new Date().getFullYear() - i)

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="bg-white border-b border-[#E2E8F0]">
        <div className="px-4 sm:px-6 py-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-[18px] font-bold text-[#0B1F3A]">Staff Payroll</h1>
              <p className="text-[12px] text-[#64748B] mt-0.5">
                {formatPayrollPeriod(month, year)}
                {payroll && <span className="ml-2"><RunBadge status={payroll.status} /></span>}
              </p>
            </div>
            {/* Staff directory link */}
            <Link
              href="/portal/team-leader/payroll/staff"
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#E2E8F0] bg-white px-3 py-1.5 text-[12px] font-medium text-[#0B1F3A] hover:bg-[#F8FAFC] transition"
            >
              <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5 text-[#64748B]">
                <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v1h8v-1zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-1a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v1h-3zM4.75 14.094A5.973 5.973 0 004 17v1H1v-1a3 3 0 013.75-2.906z" />
              </svg>
              Staff Directory
            </Link>
          </div>

          {/* ── Filters ──────────────────────────────────────────────────── */}
          <div className="mt-3 flex flex-wrap gap-2">
            {/* Branch selector */}
            {branches.length > 0 && (
              <select
                value={branchId}
                onChange={e => { setBranchId(e.target.value); navigate(month, year, e.target.value) }}
                className="rounded-lg border border-[#E2E8F0] bg-white px-3 py-1.5 text-[12px] text-[#0B1F3A] focus:outline-none focus:ring-2 focus:ring-[#FF8A1F]/40"
              >
                {branches.map(b => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            )}

            {/* Month */}
            <select
              value={month}
              onChange={e => { const m = +e.target.value; setMonth(m); navigate(m, year, branchId) }}
              className="rounded-lg border border-[#E2E8F0] bg-white px-3 py-1.5 text-[12px] text-[#0B1F3A] focus:outline-none focus:ring-2 focus:ring-[#FF8A1F]/40"
            >
              {multipleMonths.map(m => (
                <option key={m} value={m}>{MONTH_NAMES[m - 1]}</option>
              ))}
            </select>

            {/* Year */}
            <select
              value={year}
              onChange={e => { const y = +e.target.value; setYear(y); navigate(month, y, branchId) }}
              className="rounded-lg border border-[#E2E8F0] bg-white px-3 py-1.5 text-[12px] text-[#0B1F3A] focus:outline-none focus:ring-2 focus:ring-[#FF8A1F]/40"
            >
              {multipleYears.map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* ── Main ─────────────────────────────────────────────────────────────── */}
      <div className="px-4 sm:px-6 py-5 space-y-5 max-w-7xl mx-auto">

        {/* Action error */}
        {actionError && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 flex items-start gap-3">
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 text-red-500 mt-0.5 shrink-0">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            <p className="text-[13px] text-red-700 flex-1">{actionError}</p>
            <button onClick={() => setActionError(null)} className="text-red-400 hover:text-red-600">
              <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
            </button>
          </div>
        )}

        {/* No payroll yet */}
        {!payroll && (
          <div className="rounded-xl border border-dashed border-[#E2E8F0] bg-white py-16 text-center">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mx-auto h-10 w-10 text-[#94A3B8] mb-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" />
            </svg>
            <p className="text-[15px] font-semibold text-[#0B1F3A]">
              No payroll for {formatPayrollPeriod(month, year)}
            </p>
            <p className="mt-1 text-[13px] text-[#64748B]">
              Generate payroll for all enabled staff in this branch.
            </p>
            <button
              onClick={() => setShowGenModal(true)}
              className="mt-4 rounded-lg bg-[#0B1F3A] px-4 py-2 text-[13px] font-semibold text-white hover:bg-[#1a2f4a] transition"
            >
              Generate Payroll
            </button>
          </div>
        )}

        {/* KPI strip */}
        {payroll && <KPIStrip run={payroll} />}

        {/* Run action bar */}
        {payroll && (
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-[#E2E8F0] bg-white px-4 py-3">
            <span className="text-[12px] text-[#64748B] flex-1">
              {payroll.items.length} staff · {formatPayrollPeriod(month, year)}
            </span>

            {payroll.status === "draft" && (
              <>
                <button
                  disabled={isPending}
                  onClick={() => runAction(() => approvePayrollRunAction(payroll.id))}
                  className="rounded-lg bg-blue-600 px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-blue-700 disabled:opacity-50 transition"
                >
                  Approve All
                </button>
                <button
                  disabled={isPending}
                  onClick={() => runAction(async () => { const r = await archivePayrollRunAction(payroll.id); return r })}
                  className="rounded-lg border border-[#E2E8F0] px-3 py-1.5 text-[12px] font-medium text-[#64748B] hover:bg-[#F8FAFC] disabled:opacity-50 transition"
                >
                  Regenerate
                </button>
              </>
            )}

            {payroll.status === "approved" && (
              <button
                disabled={isPending}
                onClick={() => runAction(() => markPayrollPaidAction(payroll.id))}
                className="rounded-lg bg-emerald-600 px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 transition"
              >
                Mark as Paid
              </button>
            )}

            {payroll.status === "paid" && isSuperAdmin && (
              <button
                disabled={isPending}
                onClick={() => runAction(() => finalizePayrollRunAction(payroll.id))}
                className="rounded-lg bg-purple-600 px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-purple-700 disabled:opacity-50 transition"
              >
                Finalize
              </button>
            )}

            <button
              disabled={isPending}
              onClick={handleExport}
              className="rounded-lg border border-[#E2E8F0] px-3 py-1.5 text-[12px] font-medium text-[#64748B] hover:bg-[#F8FAFC] disabled:opacity-50 transition"
            >
              Export CSV
            </button>
          </div>
        )}

        {/* ── Desktop table ─────────────────────────────────────────────────── */}
        {payroll && payroll.items.length > 0 && (
          <div className="hidden md:block rounded-xl border border-[#E2E8F0] bg-white overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-[12px]">
                <thead>
                  <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                    {["Name", "Role", "Type", "Sessions", "Rate", "Session Pay", "Basic Salary", "Adjustments", "Net Pay", "Status", "Method"].map(h => (
                      <th key={h} className="px-4 py-2.5 text-left font-semibold text-[#64748B] whitespace-nowrap">{h}</th>
                    ))}
                    <th className="px-4 py-2.5 text-right font-semibold text-[#64748B]">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F1F5F9]">
                  {payroll.items.map(item => {
                    const sessionPay = item.sessions_count * item.rate_per_session
                    const payType    = (item as any).payroll_type ?? 'per_session'
                    const method     = (item as any).staff_payroll_profiles?.payment_method
                    return (
                      <tr key={item.id} className="hover:bg-[#F8FAFC] transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2.5">
                            <Avatar name={item.staff_name} />
                            <span className="font-medium text-[#0B1F3A] truncate max-w-[120px]">{item.staff_name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3"><RoleChip role={item.staff_role} /></td>
                        <td className="px-4 py-3 text-[#64748B] whitespace-nowrap">{PAYROLL_TYPE_LABELS[payType as keyof typeof PAYROLL_TYPE_LABELS] ?? payType}</td>
                        <td className="px-4 py-3 text-[#0B1F3A]">{item.sessions_count}</td>
                        <td className="px-4 py-3 text-[#0B1F3A] whitespace-nowrap">{fmtCurrency(item.rate_per_session)}</td>
                        <td className="px-4 py-3 text-[#0B1F3A] whitespace-nowrap">{fmtCurrency(sessionPay)}</td>
                        <td className="px-4 py-3 text-[#0B1F3A] whitespace-nowrap">{fmtCurrency((item as any).basic_salary ?? 0)}</td>
                        <td className={`px-4 py-3 whitespace-nowrap font-medium ${item.adjustments_total < 0 ? "text-red-600" : item.adjustments_total > 0 ? "text-emerald-600" : "text-[#94A3B8]"}`}>
                          {item.adjustments_total !== 0 ? (item.adjustments_total > 0 ? "+" : "") + fmtCurrency(item.adjustments_total) : "—"}
                        </td>
                        <td className="px-4 py-3 font-bold text-[#0B1F3A] whitespace-nowrap">{fmtCurrency(item.final_amount)}</td>
                        <td className="px-4 py-3"><ItemBadge status={item.status} /></td>
                        <td className="px-4 py-3 text-[#64748B]">
                          {method ? PAYMENT_METHOD_LABELS[method as keyof typeof PAYMENT_METHOD_LABELS] ?? method : "—"}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex justify-end gap-1.5">
                            <button
                              onClick={() => openDrawer(item)}
                              className="rounded border border-[#E2E8F0] px-2.5 py-1 text-[11px] font-medium text-[#0B1F3A] hover:bg-[#F1F5F9] transition"
                            >
                              View
                            </button>
                            {item.status === "draft" && (
                              <button
                                disabled={isPending}
                                onClick={() => runAction(() => approvePayrollItemAction(item.id))}
                                className="rounded border border-blue-200 bg-blue-50 px-2.5 py-1 text-[11px] font-medium text-blue-700 hover:bg-blue-100 disabled:opacity-50 transition"
                              >
                                Approve
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── Mobile cards ──────────────────────────────────────────────────── */}
        {payroll && payroll.items.length > 0 && (
          <div className="md:hidden space-y-3">
            {payroll.items.map(item => {
              const payType = (item as any).payroll_type ?? 'per_session'
              return (
                <div
                  key={item.id}
                  className="rounded-xl border border-[#E2E8F0] bg-white p-4 space-y-3"
                  onClick={() => openDrawer(item)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <Avatar name={item.staff_name} />
                      <div className="min-w-0">
                        <p className="font-semibold text-[14px] text-[#0B1F3A] truncate">{item.staff_name}</p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <RoleChip role={item.staff_role} />
                          <span className="text-[10px] text-[#94A3B8]">
                            {PAYROLL_TYPE_LABELS[payType as keyof typeof PAYROLL_TYPE_LABELS] ?? payType}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-[16px] font-bold text-[#0B1F3A]">{fmtCurrency(item.final_amount)}</p>
                      <ItemBadge status={item.status} />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 pt-2 border-t border-[#F1F5F9]">
                    <div className="text-center">
                      <p className="text-[11px] text-[#94A3B8]">Sessions</p>
                      <p className="text-[13px] font-semibold text-[#0B1F3A]">{item.sessions_count}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-[11px] text-[#94A3B8]">Gross</p>
                      <p className="text-[13px] font-semibold text-[#0B1F3A]">{fmtCurrency(item.gross_amount)}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-[11px] text-[#94A3B8]">Adjustments</p>
                      <p className={`text-[13px] font-semibold ${item.adjustments_total < 0 ? "text-red-600" : item.adjustments_total > 0 ? "text-emerald-600" : "text-[#94A3B8]"}`}>
                        {item.adjustments_total !== 0 ? (item.adjustments_total > 0 ? "+" : "") + fmtCurrency(item.adjustments_total) : "—"}
                      </p>
                    </div>
                  </div>

                  {item.status === "draft" && (
                    <button
                      disabled={isPending}
                      onClick={e => { e.stopPropagation(); runAction(() => approvePayrollItemAction(item.id)) }}
                      className="w-full rounded-lg bg-blue-600 py-2 text-[12px] font-semibold text-white hover:bg-blue-700 disabled:opacity-50 transition"
                    >
                      Approve
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* Empty state when payroll exists but has no items */}
        {payroll && payroll.items.length === 0 && (
          <div className="rounded-xl border border-[#E2E8F0] bg-white py-12 text-center">
            <p className="text-[14px] font-medium text-[#64748B]">No payroll items in this run.</p>
            <p className="mt-1 text-[12px] text-[#94A3B8]">Staff may not have enabled payroll profiles or sessions.</p>
          </div>
        )}
      </div>

      {/* ── Detail Drawer ─────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {drawerItemId && (
          <>
            {/* Overlay */}
            <motion.div
              key="overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-40 bg-black/30"
              onClick={closeDrawer}
            />

            {/* Desktop drawer */}
            <motion.aside
              key="drawer-desktop"
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
              className="fixed right-0 top-0 bottom-0 z-50 hidden md:flex flex-col w-[480px] bg-white shadow-2xl"
            >
              <DrawerContent
                detail={drawerDetail}
                isLoading={isDrawerPending}
                isLocked={isLocked}
                adjType={adjType} setAdjType={setAdjType}
                adjAmount={adjAmount} setAdjAmount={setAdjAmount}
                adjNotes={adjNotes} setAdjNotes={setAdjNotes}
                isAdjPending={isAdjPending}
                onAddAdj={handleAddAdj}
                onDeleteAdj={handleDeleteAdj}
                onClose={closeDrawer}
              />
            </motion.aside>

            {/* Mobile bottom sheet */}
            <motion.div
              key="drawer-mobile"
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
              className="fixed inset-x-0 bottom-0 z-50 md:hidden flex flex-col bg-white rounded-t-2xl shadow-2xl"
              style={{ maxHeight: "90vh" }}
            >
              <div className="flex justify-center pt-3 pb-1">
                <div className="h-1 w-10 rounded-full bg-[#E2E8F0]" />
              </div>
              <DrawerContent
                detail={drawerDetail}
                isLoading={isDrawerPending}
                isLocked={isLocked}
                adjType={adjType} setAdjType={setAdjType}
                adjAmount={adjAmount} setAdjAmount={setAdjAmount}
                adjNotes={adjNotes} setAdjNotes={setAdjNotes}
                isAdjPending={isAdjPending}
                onAddAdj={handleAddAdj}
                onDeleteAdj={handleDeleteAdj}
                onClose={closeDrawer}
              />
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── Generate modal ────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {showGenModal && (
          <>
            <motion.div
              key="gen-overlay"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-black/40"
              onClick={() => setShowGenModal(false)}
            />
            <motion.div
              key="gen-modal"
              initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.18 }}
              className="fixed left-1/2 top-1/2 z-50 w-[90vw] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white p-6 shadow-2xl"
            >
              <h2 className="text-[16px] font-bold text-[#0B1F3A]">Generate Payroll</h2>
              <p className="mt-2 text-[13px] text-[#64748B]">
                This will generate payroll for all enabled staff profiles in this branch for{" "}
                <strong>{formatPayrollPeriod(month, year)}</strong>.
              </p>
              <ul className="mt-3 space-y-1 text-[12px] text-[#64748B]">
                <li className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-[#FF8A1F] shrink-0" /> Session-based: counts completed sessions</li>
                <li className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-[#FF8A1F] shrink-0" /> Fixed salary: uses basic salary amount</li>
                <li className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-[#FF8A1F] shrink-0" /> Mixed: basic salary + session earnings</li>
              </ul>
              {genError && (
                <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-[12px] text-red-700">{genError}</p>
              )}
              <div className="mt-5 flex justify-end gap-3">
                <button
                  onClick={() => setShowGenModal(false)}
                  className="rounded-lg border border-[#E2E8F0] px-4 py-2 text-[13px] font-medium text-[#64748B] hover:bg-[#F8FAFC] transition"
                >
                  Cancel
                </button>
                <button
                  disabled={isPending}
                  onClick={handleGenerate}
                  className="rounded-lg bg-[#0B1F3A] px-4 py-2 text-[13px] font-semibold text-white hover:bg-[#1a2f4a] disabled:opacity-50 transition"
                >
                  {isPending ? "Generating…" : "Generate"}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}

// ── DrawerContent ─────────────────────────────────────────────────────────────

interface DrawerProps {
  detail:         PayrollDetailItem | null
  isLoading:      boolean
  isLocked:       boolean
  adjType:        AdjustmentType
  setAdjType:     (v: AdjustmentType) => void
  adjAmount:      string
  setAdjAmount:   (v: string) => void
  adjNotes:       string
  setAdjNotes:    (v: string) => void
  isAdjPending:   boolean
  onAddAdj:       () => void
  onDeleteAdj:    (id: string) => void
  onClose:        () => void
}

function DrawerContent({
  detail, isLoading, isLocked,
  adjType, setAdjType, adjAmount, setAdjAmount, adjNotes, setAdjNotes,
  isAdjPending, onAddAdj, onDeleteAdj, onClose,
}: DrawerProps) {
  if (isLoading || !detail) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#0B1F3A] border-t-transparent" />
      </div>
    )
  }

  const payType  = (detail as any).payroll_type ?? 'per_session'
  const method   = (detail as any).staff_payroll_profiles?.payment_method
  const ref      = (detail as any).staff_payroll_profiles?.payment_reference

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-start justify-between border-b border-[#E2E8F0] px-5 py-4 shrink-0">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-[#0B1F3A] flex items-center justify-center text-white font-bold text-[14px]">
            {detail.staff_name.split(" ").slice(0, 2).map(w => w[0]).join("").toUpperCase() || "?"}
          </div>
          <div>
            <p className="text-[15px] font-bold text-[#0B1F3A]">{detail.staff_name}</p>
            <div className="flex items-center gap-2 mt-0.5">
              <RoleChip role={detail.staff_role} />
              <span className="text-[10px] text-[#94A3B8]">
                {PAYROLL_TYPE_LABELS[payType as keyof typeof PAYROLL_TYPE_LABELS] ?? payType}
              </span>
              <span className={`text-[10px] font-semibold rounded-full px-2 py-0.5 ${
                detail.status === "paid"     ? "bg-emerald-100 text-emerald-700" :
                detail.status === "approved" ? "bg-blue-100 text-blue-700" :
                "bg-amber-100 text-amber-700"
              }`}>
                {detail.status}
              </span>
            </div>
          </div>
        </div>
        <button onClick={onClose} className="text-[#94A3B8] hover:text-[#0B1F3A] transition">
          <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">

        {/* Salary breakdown */}
        <section>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[#94A3B8] mb-2">Salary Breakdown</p>
          <div className="rounded-xl border border-[#E2E8F0] divide-y divide-[#F1F5F9]">
            {(payType === 'per_session' || payType === 'mixed') && (
              <>
                <Row label="Sessions" value={String(detail.sessions_count)} />
                <Row label="Rate / Session" value={fmtCurrency(detail.rate_per_session)} />
                <Row label="Session Earnings" value={fmtCurrency(detail.sessions_count * detail.rate_per_session)} />
              </>
            )}
            {(payType === 'fixed_salary' || payType === 'mixed') && (
              <Row label="Basic Salary" value={fmtCurrency((detail as any).basic_salary ?? 0)} />
            )}
            <Row label="Gross Pay" value={fmtCurrency(detail.gross_amount)} bold />
            <Row
              label="Adjustments"
              value={(detail.adjustments_total !== 0 ? (detail.adjustments_total > 0 ? "+" : "") : "") + fmtCurrency(detail.adjustments_total)}
              colored={detail.adjustments_total < 0 ? "red" : detail.adjustments_total > 0 ? "green" : undefined}
            />
            <Row label="Net Pay" value={fmtCurrency(detail.final_amount)} bold highlight />
          </div>
        </section>

        {/* Payment info */}
        {(method || ref) && (
          <section>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[#94A3B8] mb-2">Payment Info</p>
            <div className="rounded-xl border border-[#E2E8F0] divide-y divide-[#F1F5F9]">
              {method && <Row label="Method" value={PAYMENT_METHOD_LABELS[method as keyof typeof PAYMENT_METHOD_LABELS] ?? method} />}
              {ref    && <Row label="Reference" value={ref} />}
            </div>
          </section>
        )}

        {/* Session list */}
        {detail.snapshots.length > 0 && (
          <section>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[#94A3B8] mb-2">
              Sessions ({detail.snapshots.length})
            </p>
            <div className="rounded-xl border border-[#E2E8F0] divide-y divide-[#F1F5F9] max-h-52 overflow-y-auto">
              {detail.snapshots.map(s => (
                <div key={s.id} className="flex items-start justify-between px-3 py-2">
                  <div>
                    <p className="text-[12px] font-medium text-[#0B1F3A]">
                      #{s.session_number} — {s.group_name}
                    </p>
                    {s.topic && <p className="text-[11px] text-[#64748B]">{s.topic}</p>}
                    <p className="text-[10px] text-[#94A3B8]">{s.session_date}</p>
                  </div>
                  <p className="text-[12px] font-semibold text-[#0B1F3A]">{fmtCurrency(s.session_value)}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Adjustments */}
        <section>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[#94A3B8] mb-2">Adjustments</p>

          {!isLocked && (
            <div className="rounded-xl border border-[#E2E8F0] p-3 space-y-2 mb-3">
              <div className="flex gap-2">
                <select
                  value={adjType}
                  onChange={e => setAdjType(e.target.value as AdjustmentType)}
                  className="flex-1 rounded-lg border border-[#E2E8F0] px-2 py-1.5 text-[12px] focus:outline-none focus:ring-1 focus:ring-[#FF8A1F]"
                >
                  {(Object.entries(ADJUSTMENT_TYPE_LABELS) as [AdjustmentType, string][]).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
                <input
                  type="number"
                  min="0"
                  step="50"
                  placeholder="Amount"
                  value={adjAmount}
                  onChange={e => setAdjAmount(e.target.value)}
                  className="w-28 rounded-lg border border-[#E2E8F0] px-2 py-1.5 text-[12px] focus:outline-none focus:ring-1 focus:ring-[#FF8A1F]"
                />
              </div>
              <input
                type="text"
                placeholder="Notes (optional)"
                value={adjNotes}
                onChange={e => setAdjNotes(e.target.value)}
                className="w-full rounded-lg border border-[#E2E8F0] px-2 py-1.5 text-[12px] focus:outline-none focus:ring-1 focus:ring-[#FF8A1F]"
              />
              <button
                disabled={!adjAmount || parseFloat(adjAmount) <= 0 || isAdjPending}
                onClick={onAddAdj}
                className="w-full rounded-lg bg-[#0B1F3A] py-2 text-[12px] font-semibold text-white hover:bg-[#1a2f4a] disabled:opacity-40 transition"
              >
                {isAdjPending ? "Adding…" : "Add Adjustment"}
              </button>
            </div>
          )}

          {detail.adjustments.length === 0 ? (
            <p className="text-[12px] text-[#94A3B8] text-center py-3">No adjustments yet.</p>
          ) : (
            <div className="space-y-2">
              {detail.adjustments.map(adj => (
                <div key={adj.id} className="flex items-start justify-between rounded-lg border border-[#E2E8F0] px-3 py-2">
                  <div>
                    <p className="text-[12px] font-medium text-[#0B1F3A]">
                      {ADJUSTMENT_TYPE_LABELS[adj.type]}
                    </p>
                    {adj.notes && <p className="text-[11px] text-[#64748B]">{adj.notes}</p>}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-[13px] font-semibold ${Number(adj.amount) < 0 ? "text-red-600" : "text-emerald-600"}`}>
                      {Number(adj.amount) > 0 ? "+" : ""}{fmtCurrency(Number(adj.amount))}
                    </span>
                    {!isLocked && (
                      <button
                        disabled={isAdjPending}
                        onClick={() => onDeleteAdj(adj.id)}
                        className="text-[#94A3B8] hover:text-red-500 transition disabled:opacity-40"
                      >
                        <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                          <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
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

// ── Row helper ────────────────────────────────────────────────────────────────

function Row({
  label, value, bold = false, highlight = false,
  colored,
}: {
  label: string; value: string; bold?: boolean; highlight?: boolean; colored?: "red" | "green"
}) {
  const valueClass = colored === "red"
    ? "text-red-600 font-semibold"
    : colored === "green"
    ? "text-emerald-600 font-semibold"
    : highlight
    ? "text-[#FF8A1F] font-bold"
    : bold
    ? "font-semibold text-[#0B1F3A]"
    : "text-[#0B1F3A]"

  return (
    <div className={`flex items-center justify-between px-3 py-2 ${highlight ? "bg-[#FFF5EC]" : ""}`}>
      <span className="text-[12px] text-[#64748B]">{label}</span>
      <span className={`text-[13px] ${valueClass}`}>{value}</span>
    </div>
  )
}
