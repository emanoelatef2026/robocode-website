"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import {
  addFinanceAdjustmentAction,
  deleteFinanceAdjustmentAction,
  updateStaffNotesAction,
  updateStaffPaymentInfoAction,
  getStaffSessionsAction,
  addStaffSessionAction,
  updateStaffSessionAction,
  deleteStaffSessionAction,
} from "@/modules/staff-finance/actions"
import type {
  StaffFinanceRow, FinanceAdjType, StaffSession,
} from "@/modules/staff-finance/types"
import {
  ADJ_LABELS, ADJ_SIGN,
  STAFF_PAYMENT_METHOD_LABELS, STAFF_ROLE_LABELS,
  STAFF_SESSION_ACTIVITY_LABELS, STAFF_ACTIVITY_OPTIONS,
  fmtEGP, computeStaffNetAmount,
} from "@/modules/staff-finance/types"
import { Avatar } from "../components/Avatar"
import { AdjBadge } from "../components/AdjBadge"
import { NetChip } from "../components/NetChip"
import { EmptyState } from "../components/EmptyState"
import { ModalRow } from "../components/ModalRow"
import { LoadingSpinner } from "../components/LoadingSpinner"

// Staff detail drill-down modal — 5 tabs: Overview / Activities /
// Adjustments / Payments / Notes

export const STAFF_DETAIL_TABS = [
  { id: "overview",    label: "Overview"    },
  { id: "sessions",    label: "Activities"  },
  { id: "adjustments", label: "Adjustments" },
  { id: "payments",    label: "Payments"    },
  { id: "notes",       label: "Notes"       },
] as const

type StaffDetailTabId = typeof STAFF_DETAIL_TABS[number]["id"]

export function StaffDetailModal({
  row,
  dateFrom,
  dateTo,
  onClose,
  onRefresh,
  onAdjust,
}: {
  row: StaffFinanceRow
  dateFrom: string
  dateTo: string
  onClose: () => void
  onRefresh: () => void
  onAdjust: () => void
}) {
  const [tab, setTab] = useState<StaffDetailTabId>("overview")

  // Staff sessions
  const [sessions,        setSessions]        = useState<StaffSession[] | null>(null)
  const [sessionsLoading, setSessionsLoading] = useState(false)

  // Add session form
  const [showAddSession,  setShowAddSession]  = useState(false)
  const [ssDate,          setSsDate]          = useState(new Date().toISOString().slice(0, 10))
  const [ssActivity,      setSsActivity]      = useState("custom")
  const [ssDesc,          setSsDesc]          = useState("")
  const [ssRate,          setSsRate]          = useState(String(row.session_rate || ""))
  const [ssQty,           setSsQty]           = useState("1")
  const [ssBusy,          setSsBusy]          = useState(false)
  const [ssErr,           setSsErr]           = useState("")

  // Edit session
  const [editSession,     setEditSession]     = useState<StaffSession | null>(null)
  const [esDate,          setEsDate]          = useState("")
  const [esActivity,      setEsActivity]      = useState("custom")
  const [esDesc,          setEsDesc]          = useState("")
  const [esRate,          setEsRate]          = useState("")
  const [esQty,           setEsQty]           = useState("1")
  const [esBusy,          setEsBusy]          = useState(false)
  const [esErr,           setEsErr]           = useState("")

  // Adjustment inline form
  const [showAdjForm,  setShowAdjForm]  = useState(false)
  const [adjType,      setAdjType]      = useState<FinanceAdjType>("bonus")
  const [adjAmount,    setAdjAmount]    = useState("")
  const [adjDate,      setAdjDate]      = useState(new Date().toISOString().slice(0, 10))
  const [adjNotes,     setAdjNotes]     = useState("")
  const [adjBusy,      setAdjBusy]      = useState(false)
  const [adjErr,       setAdjErr]       = useState("")

  // Payments config
  const [payBasic,     setPayBasic]     = useState(String(row.basic_salary || ""))
  const [payRate,      setPayRate]      = useState(String(row.session_rate || ""))
  const [payMethod,    setPayMethod]    = useState(row.payment_method ?? "cash")
  const [payRef,       setPayRef]       = useState(row.payment_reference ?? "")
  const [payBusy,      setPayBusy]      = useState(false)
  const [payErr,       setPayErr]       = useState("")
  const [payOk,        setPayOk]        = useState(false)

  // Notes
  const [notesText,    setNotesText]    = useState(row.notes ?? "")
  const [notesBusy,    setNotesBusy]    = useState(false)
  const [notesOk,      setNotesOk]      = useState(false)

  async function loadSessions() {
    if (sessions !== null || sessionsLoading) return
    setSessionsLoading(true)
    const res = await getStaffSessionsAction(row.profile_id, dateFrom, dateTo)
    if (res.success) setSessions(res.data)
    setSessionsLoading(false)
  }

  async function reloadSessions() {
    setSessions(null)
    setSessionsLoading(true)
    const res = await getStaffSessionsAction(row.profile_id, dateFrom, dateTo)
    if (res.success) setSessions(res.data)
    setSessionsLoading(false)
  }

  function handleTabChange(t: StaffDetailTabId) {
    setTab(t)
    if (t === "sessions") loadSessions()
  }

  // Live computed earnings from loaded sessions
  const liveSessionEarnings = sessions !== null
    ? sessions.reduce((s, r) => s + r.amount, 0)
    : row.session_earnings
  const liveNet = computeStaffNetAmount(row.payroll_type, row.basic_salary, liveSessionEarnings, row.adj_net)

  async function submitSession() {
    const rate = Number(ssRate)
    const qty  = Number(ssQty)
    if (!ssDate) { setSsErr("Date is required"); return }
    if (rate < 0) { setSsErr("Rate must be 0 or greater"); return }
    if (qty <= 0) { setSsErr("Quantity must be greater than 0"); return }
    setSsBusy(true); setSsErr("")
    const res = await addStaffSessionAction({
      staff_profile_id: row.profile_id,
      branch_id:        row.branch_id,
      session_date:     ssDate,
      activity_type:    ssActivity,
      description:      ssDesc,
      rate,
      quantity:         qty,
      notes:            "",
    })
    setSsBusy(false)
    if (!res.success) { setSsErr(res.error.message); return }
    setShowAddSession(false)
    setSsDesc(""); setSsRate(String(row.session_rate || "")); setSsQty("1"); setSsErr("")
    await reloadSessions()
    onRefresh()
  }

  function openEditSession(s: StaffSession) {
    setEditSession(s)
    setEsDate(s.session_date)
    setEsActivity(s.activity_type)
    setEsDesc(s.description ?? "")
    setEsRate(String(s.rate))
    setEsQty(String(s.quantity))
    setEsErr("")
  }

  async function saveEditSession() {
    if (!editSession) return
    const rate = Number(esRate)
    const qty  = Number(esQty)
    if (rate < 0) { setEsErr("Rate must be 0 or greater"); return }
    if (qty <= 0) { setEsErr("Quantity must be > 0"); return }
    setEsBusy(true); setEsErr("")
    const res = await updateStaffSessionAction({
      id:            editSession.id,
      session_date:  esDate,
      activity_type: esActivity,
      description:   esDesc,
      rate,
      quantity:      qty,
      notes:         editSession.notes ?? "",
    })
    setEsBusy(false)
    if (!res.success) { setEsErr(res.error.message); return }
    setEditSession(null)
    await reloadSessions()
    onRefresh()
  }

  async function handleDeleteSession(id: string) {
    if (!confirm("Remove this session entry?")) return
    await deleteStaffSessionAction(id)
    await reloadSessions()
    onRefresh()
  }

  async function submitAdj() {
    if (!adjAmount || Number(adjAmount) <= 0) { setAdjErr("Amount must be > 0"); return }
    setAdjBusy(true); setAdjErr("")
    const res = await addFinanceAdjustmentAction({
      branch_id:        row.branch_id,
      staff_profile_id: row.profile_id,
      type:             adjType,
      amount:           Number(adjAmount),
      adjustment_date:  adjDate,
      notes:            adjNotes,
    })
    setAdjBusy(false)
    if (!res.success) { setAdjErr(res.error.message); return }
    setAdjAmount(""); setAdjNotes(""); setShowAdjForm(false)
    onRefresh()
  }

  async function removeAdj(id: string) {
    await deleteFinanceAdjustmentAction(id)
    onRefresh()
  }

  async function submitPayment() {
    setPayBusy(true); setPayErr(""); setPayOk(false)
    const res = await updateStaffPaymentInfoAction({
      profile_id:        row.profile_id,
      basic_salary:      Number(payBasic) || 0,
      session_rate:      Number(payRate)  || 0,
      payment_method:    payMethod,
      payment_reference: payRef,
    })
    setPayBusy(false)
    if (!res.success) { setPayErr(res.error.message); return }
    setPayOk(true)
    onRefresh()
  }

  async function saveNotes() {
    setNotesBusy(true); setNotesOk(false)
    const res = await updateStaffNotesAction(row.profile_id, notesText)
    setNotesBusy(false)
    if (res.success) { setNotesOk(true); onRefresh() }
  }

  return (
    <>
      <motion.div
        key="staff-detail-backdrop"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center pointer-events-none sm:p-4">
        <motion.div
          key="staff-detail-modal"
          initial={{ y: 40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 40, opacity: 0 }}
          transition={{ duration: 0.22, ease: "easeOut" }}
          className="pointer-events-auto bg-white w-full h-[92vh] sm:h-auto sm:max-h-[88vh] sm:rounded-2xl sm:max-w-5xl flex flex-col overflow-hidden shadow-2xl rounded-t-2xl"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#E2E8F0] shrink-0">
            <div className="flex items-center gap-3 min-w-0">
              <Avatar name={row.display_name} size="md" />
              <div className="min-w-0">
                <p className="font-bold text-[#0B1F3A] text-[15px] truncate">{row.display_name}</p>
                <p className="text-[11px] text-[#94A3B8] truncate">
                  {row.works_all_branches ? "All Branches" : row.branch_name}
                  {row.department ? ` · ${row.department}` : ""}
                  {" · "}{STAFF_ROLE_LABELS[row.role] ?? row.role}
                  {" · "}{dateFrom} → {dateTo}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 shrink-0 ml-4">
              <NetChip amount={liveNet} />
              <button onClick={onClose} className="text-[#94A3B8] hover:text-[#0B1F3A] transition">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-[#E2E8F0] shrink-0 overflow-x-auto scrollbar-none">
            {STAFF_DETAIL_TABS.map(t => (
              <button
                key={t.id}
                onClick={() => handleTabChange(t.id)}
                className={`px-4 py-2.5 text-[12px] font-semibold border-b-2 whitespace-nowrap transition -mb-px flex items-center gap-1.5 ${
                  tab === t.id
                    ? "border-[#FF8A1F] text-[#FF8A1F]"
                    : "border-transparent text-[#64748B] hover:text-[#0B1F3A]"
                }`}
              >
                {t.label}
                {t.id === "adjustments" && row.adjustments.length > 0 && (
                  <span className="rounded-full bg-[#F1F5F9] px-1.5 py-0.5 text-[10px] font-bold text-[#64748B]">
                    {row.adjustments.length}
                  </span>
                )}
                {t.id === "sessions" && (
                  <span className="rounded-full bg-[#F1F5F9] px-1.5 py-0.5 text-[10px] font-bold text-[#64748B]">
                    {sessions !== null ? sessions.length : row.sessions_count}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto">

            {/* ── OVERVIEW ── */}
            {tab === "overview" && (
              <div className="p-5 space-y-5">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {[
                    { label: "Role",          value: STAFF_ROLE_LABELS[row.role] ?? row.role },
                    { label: "Department",    value: row.department ?? "—" },
                    { label: "Branch",        value: row.works_all_branches ? "All Branches" : row.branch_name },
                    { label: "Basic Salary",  value: fmtEGP(row.basic_salary) },
                    { label: "Activity Rate", value: fmtEGP(row.session_rate) },
                    { label: "Activities",    value: String(row.sessions_count) },
                    { label: "Total Paid",    value: fmtEGP(row.total_paid) },
                    { label: "Net Payroll",   value: fmtEGP(liveNet), hi: true },
                  ].map((k: { label: string; value: string; hi?: boolean }) => (
                    <div key={k.label} className={`rounded-xl border px-3 py-2.5 ${k.hi ? "border-[#FF8A1F]/30 bg-[#FFF7F0]" : "border-[#E2E8F0] bg-white"}`}>
                      <p className={`text-[14px] font-extrabold ${k.hi ? "text-[#FF8A1F]" : "text-[#0B1F3A]"}`}>{k.value}</p>
                      <p className="text-[10px] font-medium text-[#94A3B8] mt-0.5">{k.label}</p>
                    </div>
                  ))}
                </div>

                <div className="ds-card overflow-hidden">
                  <div className="bg-[#F8FAFC] border-b border-[#E2E8F0] px-4 py-2.5">
                    <p className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider">Earnings Breakdown</p>
                  </div>
                  <div className="px-4 py-3 space-y-2">
                    {row.basic_salary > 0 && (
                      <ModalRow label="Base Salary" right={fmtEGP(row.basic_salary)} />
                    )}
                    {liveSessionEarnings > 0 && (
                      <ModalRow label={`Activity Earnings (${row.sessions_count} activities)`} right={fmtEGP(liveSessionEarnings)} />
                    )}
                    {row.bonus_total > 0    && <ModalRow label="Bonuses"   right={`+${fmtEGP(row.bonus_total)}`}    rightCls="text-[#15803D] font-semibold" />}
                    {row.penalty_total > 0  && <ModalRow label="Penalties" right={`−${fmtEGP(row.penalty_total)}`}  rightCls="text-[#EF4444] font-semibold" />}
                    {row.advance_total > 0  && <ModalRow label="Advances"  right={`−${fmtEGP(row.advance_total)}`}  rightCls="text-[#B45309] font-semibold" />}
                    {row.purchase_total > 0 && <ModalRow label="Purchases" right={`−${fmtEGP(row.purchase_total)}`} rightCls="text-orange-700 font-semibold" />}
                    <div className="border-t border-[#E2E8F0] pt-2">
                      <ModalRow label="Net Amount" right={fmtEGP(liveNet)} rightCls="text-[#FF8A1F] font-extrabold text-[14px]" />
                    </div>
                  </div>
                </div>

                <div className="ds-card overflow-hidden">
                  <div className="bg-[#F8FAFC] border-b border-[#E2E8F0] px-4 py-2.5 flex items-center justify-between">
                    <p className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider">Payment Info</p>
                    <button onClick={() => setTab("payments")} className="text-[11px] font-semibold text-[#FF8A1F] hover:text-[#e07018]">Edit →</button>
                  </div>
                  <div className="px-4 py-3 space-y-1.5">
                    <ModalRow label="Method"    right={STAFF_PAYMENT_METHOD_LABELS[row.payment_method] ?? row.payment_method} />
                    {row.payment_reference && <ModalRow label="Reference" right={row.payment_reference} />}
                  </div>
                </div>
              </div>
            )}

            {/* ── SESSIONS ── */}
            {tab === "sessions" && (
              <div className="p-5 space-y-4">
                {/* Add session form */}
                {showAddSession ? (
                  <div className="ds-card p-4 space-y-3">
                    <p className="text-[13px] font-bold text-[#0B1F3A]">Add Session Activity</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[11px] font-semibold text-[#0B1F3A]">Date</label>
                        <input type="date" value={ssDate} onChange={e => setSsDate(e.target.value)}
                          className="mt-1 w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-[12px] focus:outline-none focus:ring-2 focus:ring-[#FF8A1F]/30" />
                      </div>
                      <div>
                        <label className="text-[11px] font-semibold text-[#0B1F3A]">Activity Type</label>
                        <select value={ssActivity} onChange={e => setSsActivity(e.target.value)}
                          className="mt-1 w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-[12px] focus:outline-none focus:ring-2 focus:ring-[#FF8A1F]/30">
                          {STAFF_ACTIVITY_OPTIONS.map(o => (
                            <option key={o.value} value={o.value}>{o.label}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-[#0B1F3A]">Description</label>
                      <input value={ssDesc} onChange={e => setSsDesc(e.target.value)} placeholder="Optional description…"
                        className="mt-1 w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-[12px] focus:outline-none focus:ring-2 focus:ring-[#FF8A1F]/30" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[11px] font-semibold text-[#0B1F3A]">Rate (EGP)</label>
                        <input type="number" min="0" step="50" value={ssRate} onChange={e => setSsRate(e.target.value)} placeholder="0"
                          className="mt-1 w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-[12px] focus:outline-none focus:ring-2 focus:ring-[#FF8A1F]/30" />
                      </div>
                      <div>
                        <label className="text-[11px] font-semibold text-[#0B1F3A]">Quantity</label>
                        <input type="number" min="0.5" step="0.5" value={ssQty} onChange={e => setSsQty(e.target.value)} placeholder="1"
                          className="mt-1 w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-[12px] focus:outline-none focus:ring-2 focus:ring-[#FF8A1F]/30" />
                      </div>
                    </div>
                    {Number(ssRate) > 0 && Number(ssQty) > 0 && (
                      <p className="text-[11px] font-semibold text-[#15803D]">
                        Amount: {fmtEGP(Number(ssRate) * Number(ssQty))}
                      </p>
                    )}
                    {ssErr && <p className="text-[11px] text-[#EF4444]">{ssErr}</p>}
                    <div className="flex gap-2">
                      <button onClick={() => { setShowAddSession(false); setSsErr("") }} className="flex-1 rounded-lg border border-[#E2E8F0] py-2 text-[12px] font-medium text-[#64748B]">Cancel</button>
                      <button onClick={submitSession} disabled={ssBusy} className="flex-1 rounded-lg bg-[#0B1F3A] py-2 text-[12px] font-semibold text-white disabled:opacity-50">
                        {ssBusy ? "Saving…" : "Add Session"}
                      </button>
                    </div>
                  </div>
                ) : (
                  <button onClick={() => setShowAddSession(true)} className="w-full rounded-xl border border-dashed border-[#E2E8F0] bg-white py-3 text-[12px] font-semibold text-[#FF8A1F] hover:bg-[#FFF7F0] transition">
                    + Add Session Activity
                  </button>
                )}

                {/* Edit session inline */}
                {editSession && (
                  <div className="rounded-xl border border-[#FF8A1F]/40 bg-[#FFF8F2] p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-[13px] font-bold text-[#0B1F3A]">Edit Session</p>
                      <button onClick={() => { setEditSession(null); setEsErr("") }} className="text-[#94A3B8] hover:text-[#0B1F3A] text-[18px] leading-none">×</button>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[11px] font-semibold text-[#0B1F3A]">Date</label>
                        <input type="date" value={esDate} onChange={e => setEsDate(e.target.value)}
                          className="mt-1 w-full ds-card px-3 py-2 text-[12px] focus:outline-none focus:ring-2 focus:ring-[#FF8A1F]/30" />
                      </div>
                      <div>
                        <label className="text-[11px] font-semibold text-[#0B1F3A]">Activity Type</label>
                        <select value={esActivity} onChange={e => setEsActivity(e.target.value)}
                          className="mt-1 w-full ds-card px-3 py-2 text-[12px] focus:outline-none focus:ring-2 focus:ring-[#FF8A1F]/30">
                          {STAFF_ACTIVITY_OPTIONS.map(o => (
                            <option key={o.value} value={o.value}>{o.label}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-[#0B1F3A]">Description</label>
                      <input value={esDesc} onChange={e => setEsDesc(e.target.value)} placeholder="Optional…"
                        className="mt-1 w-full ds-card px-3 py-2 text-[12px] focus:outline-none focus:ring-2 focus:ring-[#FF8A1F]/30" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[11px] font-semibold text-[#0B1F3A]">Rate (EGP)</label>
                        <input type="number" min="0" step="50" value={esRate} onChange={e => setEsRate(e.target.value)}
                          className="mt-1 w-full ds-card px-3 py-2 text-[12px] focus:outline-none focus:ring-2 focus:ring-[#FF8A1F]/30" />
                      </div>
                      <div>
                        <label className="text-[11px] font-semibold text-[#0B1F3A]">Quantity</label>
                        <input type="number" min="0.5" step="0.5" value={esQty} onChange={e => setEsQty(e.target.value)}
                          className="mt-1 w-full ds-card px-3 py-2 text-[12px] focus:outline-none focus:ring-2 focus:ring-[#FF8A1F]/30" />
                      </div>
                    </div>
                    {Number(esRate) > 0 && Number(esQty) > 0 && (
                      <p className="text-[11px] font-semibold text-[#15803D]">Amount: {fmtEGP(Number(esRate) * Number(esQty))}</p>
                    )}
                    {esErr && <p className="text-[11px] text-[#EF4444]">{esErr}</p>}
                    <div className="flex gap-2 pt-1">
                      <button onClick={saveEditSession} disabled={esBusy}
                        className="flex-1 rounded-lg bg-[#FF8A1F] py-2 text-[12px] font-bold text-white hover:bg-[#E07718] disabled:opacity-50 transition">
                        {esBusy ? "Saving…" : "Save Changes"}
                      </button>
                    </div>
                  </div>
                )}

                {sessionsLoading ? <LoadingSpinner /> : sessions === null ? (
                  <EmptyState message="Loading…" />
                ) : sessions.length === 0 ? (
                  <EmptyState message={`No session activities found between ${dateFrom} and ${dateTo}.`} />
                ) : (
                  <>
                    {/* Desktop table */}
                    <div className="hidden md:block ds-card overflow-hidden">
                      <table className="w-full text-[12px]">
                        <thead className="ds-table-head">
                          <tr>
                            <th className="py-2.5 pl-4 pr-2 text-left font-semibold text-[#64748B]">Date</th>
                            <th className="py-2.5 px-2 text-left font-semibold text-[#64748B]">Activity</th>
                            <th className="py-2.5 px-2 text-left font-semibold text-[#64748B]">Description</th>
                            <th className="py-2.5 px-2 text-right font-semibold text-[#64748B]">Rate</th>
                            <th className="py-2.5 px-2 text-right font-semibold text-[#64748B]">Qty</th>
                            <th className="py-2.5 px-2 text-right font-semibold text-[#64748B]">Amount</th>
                            <th className="py-2.5 pl-2 pr-4 text-center font-semibold text-[#64748B]">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {sessions.map(s => (
                            <tr key={s.id} className={`border-b border-[#F1F5F9] transition ${editSession?.id === s.id ? "bg-[#FFF8F2]" : "hover:bg-[#F8FAFC]"}`}>
                              <td className="py-2.5 pl-4 pr-2 text-[#0B1F3A] whitespace-nowrap">{s.session_date}</td>
                              <td className="py-2.5 px-2">
                                <span className="rounded-full bg-[#F1F5F9] px-2 py-0.5 text-[10px] font-semibold text-[#0B1F3A]">
                                  {STAFF_SESSION_ACTIVITY_LABELS[s.activity_type as keyof typeof STAFF_SESSION_ACTIVITY_LABELS] ?? s.activity_type}
                                </span>
                              </td>
                              <td className="py-2.5 px-2 text-[#64748B] max-w-[150px] truncate">{s.description ?? <span className="italic text-[#CBD5E1]">—</span>}</td>
                              <td className="py-2.5 px-2 text-right text-[#94A3B8]">{fmtEGP(s.rate)}</td>
                              <td className="py-2.5 px-2 text-right text-[#64748B]">{s.quantity}</td>
                              <td className="py-2.5 px-2 text-right font-semibold text-[#0B1F3A]">{fmtEGP(s.amount)}</td>
                              <td className="py-2.5 pl-2 pr-4 text-center">
                                <div className="flex items-center justify-center gap-1.5">
                                  <button onClick={() => openEditSession(s)}
                                    className={`rounded-lg px-2 py-1 text-[11px] font-semibold transition ${editSession?.id === s.id ? "bg-[#FF8A1F] text-white" : "bg-[#F1F5F9] text-[#64748B] hover:bg-[#E2E8F0]"}`}>
                                    ✎
                                  </button>
                                  <button onClick={() => handleDeleteSession(s.id)}
                                    className="rounded-lg bg-[#FEE2E2] px-2 py-1 text-[11px] font-semibold text-[#EF4444] hover:bg-[#FEE2E2] transition">
                                    ✕
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="bg-[#F8FAFC] border-t border-[#E2E8F0]">
                          <tr>
                            <td colSpan={5} className="py-2.5 pl-4 pr-2 text-[12px] font-bold text-[#0B1F3A]">
                              Total — {sessions.length} activities
                            </td>
                            <td className="py-2.5 px-2 text-right text-[12px] font-extrabold text-[#FF8A1F]">
                              {fmtEGP(liveSessionEarnings)}
                            </td>
                            <td />
                          </tr>
                        </tfoot>
                      </table>
                    </div>

                    {/* Mobile cards */}
                    <div className="md:hidden space-y-2">
                      {sessions.map(s => (
                        <div key={s.id} className="ds-card p-3">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <p className="text-[12px] font-bold text-[#0B1F3A]">{s.session_date}</p>
                              <p className="text-[11px] text-[#64748B] mt-0.5">
                                {STAFF_SESSION_ACTIVITY_LABELS[s.activity_type as keyof typeof STAFF_SESSION_ACTIVITY_LABELS] ?? s.activity_type}
                                {s.description ? ` · ${s.description}` : ""}
                              </p>
                            </div>
                            <div className="flex flex-col items-end gap-1 shrink-0">
                              <span className="text-[13px] font-bold text-[#0B1F3A]">{fmtEGP(s.amount)}</span>
                              <div className="flex gap-1">
                                <button onClick={() => openEditSession(s)} className="rounded-lg bg-[#F1F5F9] px-2 py-0.5 text-[10px] font-semibold text-[#64748B]">✎</button>
                                <button onClick={() => handleDeleteSession(s.id)} className="rounded-lg bg-[#FEE2E2] px-2 py-0.5 text-[10px] font-semibold text-[#EF4444]">✕</button>
                              </div>
                            </div>
                          </div>
                          <div className="mt-1.5 flex items-center gap-3">
                            <span className="text-[10px] text-[#94A3B8]">Rate {fmtEGP(s.rate)} × {s.quantity}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}

            {/* ── ADJUSTMENTS ── */}
            {tab === "adjustments" && (
              <div className="p-5 space-y-4">
                {showAdjForm ? (
                  <div className="ds-card p-4 space-y-3">
                    <p className="text-[13px] font-bold text-[#0B1F3A]">New Adjustment</p>
                    <div>
                      <label className="text-[11px] font-semibold text-[#0B1F3A]">Type</label>
                      <div className="mt-1.5 grid grid-cols-3 gap-1.5">
                        {(["bonus", "penalty", "advance", "purchase", "reimbursement", "other"] as FinanceAdjType[]).map(t => (
                          <button key={t} onClick={() => setAdjType(t)}
                            className={`rounded-lg border px-2 py-1.5 text-[11px] font-semibold transition ${adjType === t ? "border-[#0B1F3A] bg-[#0B1F3A] text-white" : "border-[#E2E8F0] text-[#64748B] hover:border-[#0B1F3A]"}`}>
                            {ADJ_SIGN[t] === 1 ? "+" : "−"} {ADJ_LABELS[t]}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[11px] font-semibold text-[#0B1F3A]">Amount (EGP)</label>
                        <input type="number" min="0" step="50" value={adjAmount} onChange={e => setAdjAmount(e.target.value)} placeholder="0"
                          className="mt-1 w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-[12px] focus:outline-none focus:ring-2 focus:ring-[#FF8A1F]/30" />
                      </div>
                      <div>
                        <label className="text-[11px] font-semibold text-[#0B1F3A]">Date</label>
                        <input type="date" value={adjDate} onChange={e => setAdjDate(e.target.value)}
                          className="mt-1 w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-[12px] focus:outline-none focus:ring-2 focus:ring-[#FF8A1F]/30" />
                      </div>
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-[#0B1F3A]">Notes (optional)</label>
                      <input value={adjNotes} onChange={e => setAdjNotes(e.target.value)} placeholder="Description…"
                        className="mt-1 w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-[12px] focus:outline-none focus:ring-2 focus:ring-[#FF8A1F]/30" />
                    </div>
                    {adjErr && <p className="text-[12px] text-[#EF4444]">{adjErr}</p>}
                    <div className="flex gap-2">
                      <button onClick={() => { setShowAdjForm(false); setAdjErr("") }} className="flex-1 rounded-lg border border-[#E2E8F0] py-2 text-[12px] font-medium text-[#64748B]">Cancel</button>
                      <button onClick={submitAdj} disabled={adjBusy} className="flex-1 rounded-lg bg-[#0B1F3A] py-2 text-[12px] font-semibold text-white disabled:opacity-50">
                        {adjBusy ? "Saving…" : "Save Adjustment"}
                      </button>
                    </div>
                  </div>
                ) : (
                  <button onClick={() => setShowAdjForm(true)} className="w-full rounded-xl border border-dashed border-[#E2E8F0] bg-white py-3 text-[12px] font-semibold text-[#FF8A1F] hover:bg-[#FFF7F0] transition">
                    + Add Adjustment
                  </button>
                )}

                {row.adjustments.length === 0 && !showAdjForm ? (
                  <EmptyState message="No adjustments in this period." />
                ) : (
                  <div className="space-y-2">
                    {row.adjustments.map(a => (
                      <div key={a.id} className="flex items-center gap-3 ds-card px-4 py-3">
                        <AdjBadge type={a.type} amount={a.amount} />
                        <div className="flex-1 min-w-0">
                          {a.notes && <p className="text-[12px] text-[#0B1F3A] truncate">{a.notes}</p>}
                          <p className="text-[11px] text-[#94A3B8]">{a.adjustment_date}</p>
                        </div>
                        <p className={`text-[13px] font-bold shrink-0 ${ADJ_SIGN[a.type] === 1 ? "text-[#15803D]" : "text-[#EF4444]"}`}>
                          {ADJ_SIGN[a.type] === 1 ? "+" : "−"}{fmtEGP(a.amount)}
                        </p>
                        <button onClick={() => removeAdj(a.id)} className="text-[#CBD5E1] hover:text-[#F87171] transition shrink-0">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── PAYMENTS ── */}
            {tab === "payments" && (
              <div className="p-5 space-y-4 max-w-md">
                <div className="ds-card p-4 space-y-3">
                  <p className="text-[13px] font-bold text-[#0B1F3A]">Payment Configuration</p>
                  <div>
                    <label className="text-[11px] font-semibold text-[#0B1F3A]">Base Salary (EGP)</label>
                    <input type="number" min="0" step="100" value={payBasic} onChange={e => setPayBasic(e.target.value)} placeholder="0"
                      className="mt-1 w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-[#FF8A1F]/30" />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-[#0B1F3A]">Default Activity Rate (EGP)</label>
                    <input type="number" min="0" step="50" value={payRate} onChange={e => setPayRate(e.target.value)} placeholder="0"
                      className="mt-1 w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-[#FF8A1F]/30" />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-[#0B1F3A]">Payment Method</label>
                    <select value={payMethod} onChange={e => setPayMethod(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-[#FF8A1F]/30">
                      {Object.entries(STAFF_PAYMENT_METHOD_LABELS).map(([v, l]) => (
                        <option key={v} value={v}>{l}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-[#0B1F3A]">Payment Reference</label>
                    <input value={payRef} onChange={e => setPayRef(e.target.value)} placeholder="Account / phone / IBAN"
                      className="mt-1 w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-[#FF8A1F]/30" />
                  </div>
                  {payErr && <p className="text-[12px] text-[#EF4444]">{payErr}</p>}
                  {payOk  && <p className="text-[12px] text-[#10B981] font-semibold">✓ Saved successfully</p>}
                  <button onClick={submitPayment} disabled={payBusy} className="w-full rounded-lg bg-[#0B1F3A] py-2.5 text-[13px] font-semibold text-white disabled:opacity-50 hover:bg-[#1a2f4a] transition">
                    {payBusy ? "Saving…" : "Save Payment Info"}
                  </button>
                </div>

                <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-4 space-y-2">
                  <p className="text-[11px] font-bold text-[#94A3B8] uppercase tracking-wider">Current Payroll Summary</p>
                  <ModalRow label="Base Salary"        right={fmtEGP(row.basic_salary)} />
                  <ModalRow label="Activity Earnings"  right={fmtEGP(liveSessionEarnings)} />
                  <ModalRow label="Adjustments" right={`${row.adj_net >= 0 ? "+" : ""}${fmtEGP(row.adj_net)}`} rightCls={row.adj_net >= 0 ? "text-[#15803D] font-semibold" : "text-[#EF4444] font-semibold"} />
                  <div className="border-t border-[#E2E8F0] pt-2">
                    <ModalRow label="Net Amount" right={fmtEGP(liveNet)} rightCls="text-[#FF8A1F] font-extrabold" />
                  </div>
                </div>
              </div>
            )}

            {/* ── NOTES ── */}
            {tab === "notes" && (
              <div className="p-5 space-y-4 max-w-md">
                <div className="ds-card p-4 space-y-3">
                  <p className="text-[13px] font-bold text-[#0B1F3A]">Notes</p>
                  <p className="text-[11px] text-[#94A3B8]">Visible to team leaders and admins only.</p>
                  <textarea
                    rows={6}
                    value={notesText}
                    onChange={e => setNotesText(e.target.value)}
                    placeholder="Add notes about this employee's payroll, payment preferences, or any relevant information…"
                    className="w-full rounded-lg border border-[#E2E8F0] px-3 py-2.5 text-[13px] text-[#0B1F3A] focus:outline-none focus:ring-2 focus:ring-[#FF8A1F]/30 resize-none"
                  />
                  {notesOk && <p className="text-[12px] text-[#10B981] font-semibold">✓ Notes saved</p>}
                  <button onClick={saveNotes} disabled={notesBusy} className="w-full rounded-lg bg-[#0B1F3A] py-2.5 text-[13px] font-semibold text-white disabled:opacity-50 hover:bg-[#1a2f4a] transition">
                    {notesBusy ? "Saving…" : "Save Notes"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </>
  )
}
