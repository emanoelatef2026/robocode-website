"use client"

import { useState, useMemo } from "react"
import { motion } from "framer-motion"
import {
  addFinanceAdjustmentAction,
  deleteFinanceAdjustmentAction,
  updateInstructorPaymentInfoAction,
  getInstructorSessionsDetailAction,
  upsertSessionRateOverrideAction,
  removeSessionRateOverrideAction,
} from "@/modules/staff-finance/actions"
import type {
  InstructorFinanceRow, FinanceAdjType, InstructorSessionDetail,
} from "@/modules/staff-finance/types"
import {
  ADJ_LABELS, ADJ_SIGN,
  INSTRUCTOR_PAYMENT_METHOD_LABELS, OVERRIDE_REASON_LABELS,
  fmtEGP,
} from "@/modules/staff-finance/types"
import { validatePaymentMethodFields } from "@/modules/instructor-payments/types"
import { Avatar } from "../components/Avatar"
import { AdjBadge } from "../components/AdjBadge"
import { NetChip } from "../components/NetChip"
import { EmptyState } from "../components/EmptyState"
import { ModalRow } from "../components/ModalRow"
import { LoadingSpinner } from "../components/LoadingSpinner"
import { InstructorPaymentMethodsPanel } from "./InstructorPaymentMethodsPanel"

// Instructor detail drill-down modal — 6 tabs: Overview / Sessions /
// Adjustments / Payments / History / Notes

const DETAIL_TABS = [
  { id: "overview",     label: "Overview" },
  { id: "sessions",     label: "Sessions" },
  { id: "adjustments",  label: "Adjustments" },
  { id: "payments",     label: "Payments" },
  { id: "history",      label: "History" },
  { id: "notes",        label: "Notes" },
] as const

type DetailTabId = typeof DETAIL_TABS[number]["id"]

export function InstructorDetailModal({
  row,
  branchIds,
  dateFrom,
  dateTo,
  onClose,
  onRefresh,
}: {
  row: InstructorFinanceRow
  branchIds: string[]
  dateFrom: string
  dateTo: string
  onClose: () => void
  onRefresh: () => void
}) {
  const [tab, setTab] = useState<DetailTabId>("overview")

  // Sessions lazy load
  const [sessions, setSessions] = useState<InstructorSessionDetail[] | null>(null)
  const [sessionsLoading, setSessionsLoading] = useState(false)

  // Adjustment inline form
  const [showAdjForm, setShowAdjForm] = useState(false)
  const [adjType,   setAdjType]   = useState<FinanceAdjType>("bonus")
  const [adjAmount, setAdjAmount] = useState("")
  const [adjDate,   setAdjDate]   = useState(new Date().toISOString().slice(0, 10))
  const [adjNotes,  setAdjNotes]  = useState("")
  const [adjBusy,   setAdjBusy]   = useState(false)
  const [adjErr,    setAdjErr]    = useState("")

  // Payments inline form
  const [payRate,   setPayRate]   = useState(String(row.salary_per_session || ""))
  const [payMethod, setPayMethod] = useState<string>(row.payment_method ?? "cash")
  const [payWallet, setPayWallet] = useState(row.wallet_number ?? "")
  const [payInstapayNo, setPayInstapayNo] = useState(row.instapay_number ?? "")
  const [payLink,   setPayLink]   = useState(row.payment_link ?? "")
  const [payBank,   setPayBank]   = useState(row.bank_account_number ?? "")
  const [payNotes,  setPayNotes]  = useState(row.payment_notes ?? "")
  const [payBusy,   setPayBusy]   = useState(false)
  const [payErr,    setPayErr]    = useState("")
  const [payOk,     setPayOk]     = useState(false)

  // Notes
  const [notesText, setNotesText] = useState(row.payment_notes ?? "")
  const [notesBusy, setNotesBusy] = useState(false)
  const [notesOk,   setNotesOk]   = useState(false)

  // Edit rate per session
  const [editRateSession, setEditRateSession] = useState<InstructorSessionDetail | null>(null)
  const [editRateValue,   setEditRateValue]   = useState("")
  const [editRateReason,  setEditRateReason]  = useState<string>("online_session")
  const [editRateNotes,   setEditRateNotes]   = useState("")
  const [editRateBusy,    setEditRateBusy]    = useState(false)
  const [editRateErr,     setEditRateErr]     = useState("")

  async function loadSessions() {
    if (sessions !== null || sessionsLoading) return
    setSessionsLoading(true)
    const res = await getInstructorSessionsDetailAction(row.instructor_id, branchIds, dateFrom, dateTo)
    if (res.success) setSessions(res.data)
    setSessionsLoading(false)
  }

  async function reloadSessions() {
    setSessions(null)
    setSessionsLoading(true)
    const res = await getInstructorSessionsDetailAction(row.instructor_id, branchIds, dateFrom, dateTo)
    if (res.success) setSessions(res.data)
    setSessionsLoading(false)
  }

  async function saveEditRate() {
    if (!editRateSession) return
    const rate = parseFloat(editRateValue)
    if (isNaN(rate) || rate < 0) { setEditRateErr("Enter a valid rate (0 or greater)"); return }
    setEditRateBusy(true)
    setEditRateErr("")
    const res = await upsertSessionRateOverrideAction({
      schedule_id:   editRateSession.schedule_id,
      instructor_id: row.instructor_id,
      override_rate: rate,
      reason:        editRateReason,
      notes:         editRateNotes,
    })
    setEditRateBusy(false)
    if (!res.success) { setEditRateErr(res.error?.message ?? "Failed to save override"); return }
    setEditRateSession(null)
    await reloadSessions()
  }

  async function handleRemoveOverride(s: InstructorSessionDetail) {
    if (!s.override_id) return
    const res = await removeSessionRateOverrideAction(s.override_id)
    if (res.success) await reloadSessions()
  }

  function handleTabChange(t: DetailTabId) {
    setTab(t)
    if (t === "sessions" || t === "history") loadSessions()
  }

  // Group summary (derived from sessions)
  const groupSummary = useMemo(() => {
    if (!sessions) return []
    const map = new Map<string, { name: string; count: number; earnings: number }>()
    for (const s of sessions) {
      if (!map.has(s.group_id)) map.set(s.group_id, { name: s.group_name, count: 0, earnings: 0 })
      const e = map.get(s.group_id)!
      e.count++
      e.earnings += s.session_amount
    }
    return [...map.values()].sort((a, b) => b.earnings - a.earnings)
  }, [sessions])

  // Monthly history (derived from sessions + row.adjustments)
  const monthlyHistory = useMemo(() => {
    if (!sessions) return []
    const sMap = new Map<string, { sessions: number; earnings: number }>()
    for (const s of sessions) {
      const m = s.scheduled_at.slice(0, 7)
      if (!sMap.has(m)) sMap.set(m, { sessions: 0, earnings: 0 })
      const e = sMap.get(m)!
      e.sessions++
      e.earnings += s.session_amount
    }
    const adjByMonth = new Map<string, number>()
    for (const a of row.adjustments) {
      const m = a.adjustment_date.slice(0, 7)
      adjByMonth.set(m, (adjByMonth.get(m) ?? 0) + a.amount * ADJ_SIGN[a.type])
    }
    return [...sMap.entries()]
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([month, e]) => {
        const adj = adjByMonth.get(month) ?? 0
        return { month, sessions: e.sessions, earnings: e.earnings, adj, net: e.earnings + adj }
      })
  }, [sessions, row.adjustments])

  async function submitAdj() {
    if (!adjAmount || Number(adjAmount) <= 0) { setAdjErr("Amount must be > 0"); return }
    setAdjBusy(true); setAdjErr("")
    const res = await addFinanceAdjustmentAction({
      branch_id: row.branch_id,
      instructor_id: row.instructor_id,
      type: adjType,
      amount: Number(adjAmount),
      adjustment_date: adjDate,
      notes: adjNotes,
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
    const validationError = validatePaymentMethodFields({
      payment_method:      payMethod,
      wallet_number:       payWallet,
      instapay_number:     payInstapayNo,
      payment_link:        payLink,
      bank_account_number: payBank,
    })
    if (validationError) { setPayErr(validationError); setPayOk(false); return }
    setPayBusy(true); setPayErr(""); setPayOk(false)
    const res = await updateInstructorPaymentInfoAction({
      instructor_id:       row.instructor_id,
      salary_per_session:  payRate ? Number(payRate) : null,
      payment_method:      payMethod || null,
      wallet_number:       payWallet     || null,
      instapay_number:     payInstapayNo || null,
      payment_link:        payLink       || null,
      bank_account_number: payBank       || null,
      payment_notes:       payNotes || null,
    })
    setPayBusy(false)
    if (!res.success) { setPayErr(res.error.message); return }
    setPayOk(true)
    onRefresh()
  }

  async function saveNotes() {
    setNotesBusy(true); setNotesOk(false)
    const res = await updateInstructorPaymentInfoAction({
      instructor_id:       row.instructor_id,
      salary_per_session:  row.salary_per_session || null,
      payment_method:      row.payment_method || null,
      wallet_number:       row.wallet_number || null,
      instapay_number:     row.instapay_number || null,
      payment_link:        row.payment_link || null,
      bank_account_number: row.bank_account_number || null,
      payment_notes:       notesText || null,
    })
    setNotesBusy(false)
    if (res.success) { setNotesOk(true); onRefresh() }
  }

  return (
    <>
      {/* Backdrop */}
      <motion.div
        key="detail-backdrop"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center pointer-events-none sm:p-4">
        <motion.div
          key="detail-modal"
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
                  {row.branch_name} · Instructor · {dateFrom} → {dateTo}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 shrink-0 ml-4">
              <NetChip amount={row.net_amount} />
              <button onClick={onClose} className="text-[#94A3B8] hover:text-[#0B1F3A] transition">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-[#E2E8F0] shrink-0 overflow-x-auto scrollbar-none">
            {DETAIL_TABS.map(t => (
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
                {/* KPI strip */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {[
                    { label: "Sessions",    value: String(row.sessions_count),            hi: false },
                    { label: "Groups",      value: String(row.group_count),               hi: false },
                    { label: "Session Rate",value: fmtEGP(row.salary_per_session),        hi: false },
                    { label: "Earnings",    value: fmtEGP(row.session_earnings),          hi: false },
                    { label: "Bonuses",     value: fmtEGP(row.bonus_total),               hi: false },
                    { label: "Penalties",   value: fmtEGP(row.penalty_total),             hi: false },
                    { label: "Advances",    value: fmtEGP(row.advance_total),             hi: false },
                    { label: "Net Amount",  value: fmtEGP(row.net_amount),                hi: true  },
                  ].map(k => (
                    <div key={k.label} className={`rounded-xl border px-3 py-2.5 ${k.hi ? "border-[#FF8A1F]/30 bg-[#FFF7F0]" : "border-[#E2E8F0] bg-white"}`}>
                      <p className={`text-[15px] font-extrabold ${k.hi ? "text-[#FF8A1F]" : "text-[#0B1F3A]"}`}>{k.value}</p>
                      <p className="text-[10px] font-medium text-[#94A3B8] mt-0.5">{k.label}</p>
                    </div>
                  ))}
                </div>

                {/* Earnings breakdown */}
                <div className="ds-card overflow-hidden">
                  <div className="bg-[#F8FAFC] border-b border-[#E2E8F0] px-4 py-2.5">
                    <p className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider">Earnings Breakdown</p>
                  </div>
                  <div className="px-4 py-3 space-y-2">
                    <ModalRow label="Session Earnings" value={`${row.sessions_count} sessions × ${fmtEGP(row.salary_per_session)}`} right={fmtEGP(row.session_earnings)} />
                    {row.bonus_total > 0    && <ModalRow label="Bonuses"    right={`+${fmtEGP(row.bonus_total)}`}    rightCls="text-[#15803D] font-semibold" />}
                    {row.penalty_total > 0  && <ModalRow label="Penalties"  right={`−${fmtEGP(row.penalty_total)}`}  rightCls="text-[#EF4444] font-semibold" />}
                    {row.advance_total > 0  && <ModalRow label="Advances"   right={`−${fmtEGP(row.advance_total)}`}  rightCls="text-[#B45309] font-semibold" />}
                    {row.purchase_total > 0 && <ModalRow label="Purchases"  right={`−${fmtEGP(row.purchase_total)}`} rightCls="text-orange-700 font-semibold" />}
                    {row.other_total > 0    && <ModalRow label="Other"      right={`+${fmtEGP(row.other_total)}`}    rightCls="text-[#334155] font-semibold" />}
                    <div className="border-t border-[#E2E8F0] pt-2">
                      <ModalRow label="Net Amount" right={fmtEGP(row.net_amount)} rightCls="text-[#FF8A1F] font-extrabold text-[14px]" />
                    </div>
                  </div>
                </div>

                {/* Payment info */}
                <div className="ds-card overflow-hidden">
                  <div className="bg-[#F8FAFC] border-b border-[#E2E8F0] px-4 py-2.5 flex items-center justify-between">
                    <p className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider">Payment Info</p>
                    <button onClick={() => setTab("payments")} className="text-[11px] font-semibold text-[#FF8A1F] hover:text-[#e07018]">Edit →</button>
                  </div>
                  <div className="px-4 py-3 space-y-1.5">
                    <ModalRow label="Method" right={
                      row.payment_method
                        ? (INSTRUCTOR_PAYMENT_METHOD_LABELS[row.payment_method] ?? row.payment_method)
                        : "Not set"
                    } />
                    {row.wallet_number       && <ModalRow label="Vodafone Cash" right={row.wallet_number} />}
                    {row.instapay_number     && <ModalRow label="Instapay Number" right={row.instapay_number} />}
                    {row.payment_link        && <ModalRow label="Instapay Link" right={row.payment_link} />}
                    {row.bank_account_number && <ModalRow label="Bank Account" right={row.bank_account_number} />}
                  </div>
                </div>
              </div>
            )}

            {/* ── SESSIONS ── */}
            {tab === "sessions" && (
              <div className="p-5 space-y-5">
                {sessionsLoading ? (
                  <LoadingSpinner />
                ) : sessions === null ? (
                  <EmptyState message="Loading…" />
                ) : sessions.length === 0 ? (
                  <EmptyState message={`No completed sessions found between ${dateFrom} and ${dateTo}.`} />
                ) : (
                  <>
                    {/* Edit Rate inline panel */}
                    {editRateSession && (
                      <div className="rounded-xl border border-[#FF8A1F]/40 bg-[#FFF8F2] p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <p className="text-[13px] font-bold text-[#0B1F3A]">
                            Edit Rate — {new Date(editRateSession.scheduled_at).toLocaleDateString("en-EG", { day: "2-digit", month: "short" })} · {editRateSession.group_name}
                          </p>
                          <button onClick={() => { setEditRateSession(null); setEditRateErr("") }}
                            className="text-[#94A3B8] hover:text-[#0B1F3A] transition text-[18px] leading-none">×</button>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="text-[11px] font-semibold text-[#64748B]">Current Rate</label>
                            <p className="mt-0.5 text-[13px] font-bold text-[#0B1F3A]">{fmtEGP(editRateSession.final_rate)}</p>
                            {editRateSession.override_rate !== null && (
                              <p className="text-[10px] text-[#FF8A1F]">Override active</p>
                            )}
                            {editRateSession.override_rate === null && editRateSession.group_rate !== null && (
                              <p className="text-[10px] text-[#64748B]">Group rate</p>
                            )}
                            {editRateSession.override_rate === null && editRateSession.group_rate === null && (
                              <p className="text-[10px] text-[#94A3B8]">Instructor default</p>
                            )}
                          </div>
                          <div>
                            <label className="text-[11px] font-semibold text-[#0B1F3A]">New Rate (EGP)</label>
                            <input type="number" min="0" step="50"
                              value={editRateValue}
                              onChange={e => setEditRateValue(e.target.value)}
                              placeholder={String(editRateSession.final_rate)}
                              className="mt-1 w-full ds-card px-3 py-2 text-[12px] focus:outline-none focus:ring-2 focus:ring-[#FF8A1F]/30" />
                          </div>
                        </div>
                        <div>
                          <label className="text-[11px] font-semibold text-[#0B1F3A]">Reason</label>
                          <select value={editRateReason} onChange={e => setEditRateReason(e.target.value)}
                            className="mt-1 w-full ds-card px-3 py-2 text-[12px] focus:outline-none focus:ring-2 focus:ring-[#FF8A1F]/30">
                            {(Object.entries(OVERRIDE_REASON_LABELS) as [string, string][]).map(([k, v]) => (
                              <option key={k} value={k}>{v}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="text-[11px] font-semibold text-[#0B1F3A]">Notes (optional)</label>
                          <input type="text" value={editRateNotes} onChange={e => setEditRateNotes(e.target.value)}
                            placeholder="e.g. online group contract"
                            className="mt-1 w-full ds-card px-3 py-2 text-[12px] focus:outline-none focus:ring-2 focus:ring-[#FF8A1F]/30" />
                        </div>
                        {editRateErr && <p className="text-[11px] text-[#EF4444]">{editRateErr}</p>}
                        <div className="flex gap-2 pt-1">
                          <button onClick={saveEditRate} disabled={editRateBusy}
                            className="flex-1 rounded-lg bg-[#FF8A1F] py-2 text-[12px] font-bold text-white hover:bg-[#E07718] disabled:opacity-50 transition">
                            {editRateBusy ? "Saving…" : "Save Override"}
                          </button>
                          {editRateSession.override_id && (
                            <button onClick={() => handleRemoveOverride(editRateSession!)} disabled={editRateBusy}
                              className="rounded-lg border border-[#FECACA] bg-[#FEE2E2] px-3 py-2 text-[11px] font-semibold text-[#EF4444] hover:bg-[#FEE2E2] transition">
                              Remove Override
                            </button>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Session table – desktop */}
                    <div className="hidden md:block ds-card overflow-x-auto">
                      <table className="w-full text-[12px] min-w-[900px]">
                        <thead className="ds-table-head">
                          <tr>
                            <th className="py-2.5 pl-4 pr-2 text-left font-semibold text-[#64748B] whitespace-nowrap">Date</th>
                            <th className="py-2.5 px-2 text-left font-semibold text-[#64748B]">Group</th>
                            <th className="py-2.5 px-2 text-left font-semibold text-[#64748B]">Course</th>
                            <th className="py-2.5 px-2 text-left font-semibold text-[#64748B]">Topic</th>
                            <th className="py-2.5 px-2 text-right font-semibold text-[#64748B]">Students</th>
                            <th className="py-2.5 px-2 text-right font-semibold text-[#64748B]">Att%</th>
                            <th className="py-2.5 px-2 text-right font-semibold text-[#64748B] whitespace-nowrap">Base Rate</th>
                            <th className="py-2.5 px-2 text-right font-semibold text-[#64748B] whitespace-nowrap">Override</th>
                            <th className="py-2.5 px-2 text-right font-semibold text-[#64748B] whitespace-nowrap">Final Rate</th>
                            <th className="py-2.5 px-2 text-right font-semibold text-[#64748B]">Amount</th>
                            <th className="py-2.5 pl-2 pr-4 text-center font-semibold text-[#64748B]">Edit</th>
                          </tr>
                        </thead>
                        <tbody>
                          {sessions.map(s => {
                            const isEditing = editRateSession?.schedule_id === s.schedule_id
                            return (
                              <tr key={s.schedule_id}
                                className={`border-b border-[#F1F5F9] transition ${isEditing ? "bg-[#FFF8F2]" : "hover:bg-[#F8FAFC]"}`}>
                                <td className="py-2.5 pl-4 pr-2 text-[#0B1F3A] whitespace-nowrap">
                                  {new Date(s.scheduled_at).toLocaleDateString("en-EG", { day: "2-digit", month: "short" })}
                                </td>
                                <td className="py-2.5 px-2">
                                  <span className="rounded-full bg-[#F1F5F9] px-2 py-0.5 text-[10px] font-semibold text-[#0B1F3A]">{s.group_name}</span>
                                </td>
                                <td className="py-2.5 px-2 text-[#64748B] max-w-[110px] truncate">{s.course_name}</td>
                                <td className="py-2.5 px-2 text-[#94A3B8] max-w-[110px] truncate">
                                  {s.topic ?? <span className="italic text-[#CBD5E1]">—</span>}
                                </td>
                                <td className="py-2.5 px-2 text-right text-[#64748B]">
                                  {s.students_total > 0 ? `${s.students_present}/${s.students_total}` : <span className="text-[#CBD5E1]">—</span>}
                                </td>
                                <td className="py-2.5 px-2 text-right">
                                  {s.students_total > 0 ? (
                                    <span className={`font-semibold ${s.attendance_pct >= 75 ? "text-[#15803D]" : s.attendance_pct >= 50 ? "text-[#B45309]" : "text-[#EF4444]"}`}>
                                      {s.attendance_pct}%
                                    </span>
                                  ) : <span className="text-[#CBD5E1]">—</span>}
                                </td>
                                <td className="py-2.5 px-2 text-right text-[#94A3B8]">
                                  {fmtEGP(s.base_rate)}
                                </td>
                                <td className="py-2.5 px-2 text-right">
                                  {s.override_rate !== null ? (
                                    <span className="font-semibold text-[#FF8A1F]">{fmtEGP(s.override_rate)}</span>
                                  ) : s.group_rate !== null ? (
                                    <span className="text-[#64748B]">{fmtEGP(s.group_rate)}</span>
                                  ) : (
                                    <span className="text-[#CBD5E1] italic">—</span>
                                  )}
                                </td>
                                <td className="py-2.5 px-2 text-right font-semibold text-[#0B1F3A]">
                                  {fmtEGP(s.final_rate)}
                                </td>
                                <td className="py-2.5 px-2 text-right font-semibold text-[#0B1F3A]">
                                  {fmtEGP(s.session_amount)}
                                </td>
                                <td className="py-2.5 pl-2 pr-4 text-center">
                                  <button
                                    onClick={() => {
                                      if (isEditing) { setEditRateSession(null); setEditRateErr(""); return }
                                      setEditRateSession(s)
                                      setEditRateValue(String(s.final_rate))
                                      setEditRateReason(s.override_reason ?? "online_session")
                                      setEditRateNotes("")
                                      setEditRateErr("")
                                    }}
                                    className={`rounded-lg px-2 py-1 text-[11px] font-semibold transition ${isEditing ? "bg-[#FF8A1F] text-white" : "bg-[#F1F5F9] text-[#64748B] hover:bg-[#E2E8F0]"}`}
                                    title="Edit session rate">
                                    {isEditing ? "✕" : "✎"}
                                  </button>
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                        <tfoot className="bg-[#F8FAFC] border-t border-[#E2E8F0]">
                          <tr>
                            <td colSpan={9} className="py-2.5 pl-4 pr-2 text-[12px] font-bold text-[#0B1F3A]">
                              Total — {sessions.length} sessions
                            </td>
                            <td className="py-2.5 px-2 text-right text-[12px] font-extrabold text-[#FF8A1F]">
                              {fmtEGP(sessions.reduce((acc, r) => acc + r.session_amount, 0))}
                            </td>
                            <td />
                          </tr>
                        </tfoot>
                      </table>
                    </div>

                    {/* Session cards – mobile */}
                    <div className="md:hidden space-y-2">
                      {sessions.map(s => (
                        <div key={s.schedule_id} className="ds-card p-3">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <p className="text-[12px] font-bold text-[#0B1F3A]">
                                {new Date(s.scheduled_at).toLocaleDateString("en-EG", { day: "2-digit", month: "short", year: "numeric" })}
                              </p>
                              <p className="text-[11px] text-[#64748B] mt-0.5">{s.group_name} · {s.course_name}</p>
                              {s.topic && <p className="text-[11px] text-[#94A3B8] mt-0.5 truncate">{s.topic}</p>}
                            </div>
                            <div className="flex flex-col items-end gap-1 shrink-0">
                              <span className="text-[13px] font-bold text-[#0B1F3A]">{fmtEGP(s.session_amount)}</span>
                              <button
                                onClick={() => {
                                  const isEditing = editRateSession?.schedule_id === s.schedule_id
                                  if (isEditing) { setEditRateSession(null); setEditRateErr(""); return }
                                  setEditRateSession(s)
                                  setEditRateValue(String(s.final_rate))
                                  setEditRateReason(s.override_reason ?? "online_session")
                                  setEditRateNotes("")
                                  setEditRateErr("")
                                }}
                                className="rounded-lg bg-[#F1F5F9] px-2 py-0.5 text-[10px] font-semibold text-[#64748B] hover:bg-[#E2E8F0] transition">
                                ✎ Rate
                              </button>
                            </div>
                          </div>
                          {/* Rate hierarchy line */}
                          <div className="mt-2 flex items-center gap-2 flex-wrap">
                            <span className="text-[10px] text-[#94A3B8]">Base {fmtEGP(s.base_rate)}</span>
                            {s.group_rate !== null && (
                              <span className="text-[10px] text-[#64748B]">→ Group {fmtEGP(s.group_rate)}</span>
                            )}
                            {s.override_rate !== null && (
                              <span className="text-[10px] font-semibold text-[#FF8A1F]">→ Override {fmtEGP(s.override_rate)}</span>
                            )}
                          </div>
                          {s.students_total > 0 && (
                            <div className="mt-1.5 flex items-center gap-3">
                              <span className="text-[11px] text-[#64748B]">{s.students_present}/{s.students_total} present</span>
                              <span className={`text-[11px] font-semibold ${s.attendance_pct >= 75 ? "text-[#15803D]" : s.attendance_pct >= 50 ? "text-[#B45309]" : "text-[#EF4444]"}`}>
                                {s.attendance_pct}%
                              </span>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Group summary */}
                    {groupSummary.length > 1 && (
                      <div className="ds-card overflow-hidden">
                        <div className="bg-[#F8FAFC] border-b border-[#E2E8F0] px-4 py-2.5">
                          <p className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider">Group Summary</p>
                        </div>
                        <table className="w-full text-[12px]">
                          <thead className="border-b border-[#F1F5F9]">
                            <tr>
                              <th className="py-2 pl-4 pr-2 text-left font-semibold text-[#64748B]">Group</th>
                              <th className="py-2 px-2 text-right font-semibold text-[#64748B]">Sessions</th>
                              <th className="py-2 px-2 text-right font-semibold text-[#64748B]">Avg Rate</th>
                              <th className="py-2 pl-2 pr-4 text-right font-semibold text-[#64748B]">Earnings</th>
                            </tr>
                          </thead>
                          <tbody>
                            {groupSummary.map((g, i) => (
                              <tr key={i} className="border-b border-[#F8FAFC]">
                                <td className="py-2 pl-4 pr-2 font-medium text-[#0B1F3A]">{g.name}</td>
                                <td className="py-2 px-2 text-right text-[#64748B]">{g.count}</td>
                                <td className="py-2 px-2 text-right text-[#64748B]">{fmtEGP(g.count > 0 ? g.earnings / g.count : 0)}</td>
                                <td className="py-2 pl-2 pr-4 text-right font-semibold text-[#0B1F3A]">{fmtEGP(g.earnings)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* ── ADJUSTMENTS ── */}
            {tab === "adjustments" && (
              <div className="p-5 space-y-4">
                {/* Add form */}
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

                {/* Adjustments list */}
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
                    <label className="text-[11px] font-semibold text-[#0B1F3A]">Session Rate (EGP)</label>
                    <input type="number" min="0" step="50" value={payRate} onChange={e => setPayRate(e.target.value)} placeholder="0"
                      className="mt-1 w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-[#FF8A1F]/30" />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-[#0B1F3A]">Payment Method</label>
                    <select value={payMethod} onChange={e => setPayMethod(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-[#FF8A1F]/30">
                      {Object.entries(INSTRUCTOR_PAYMENT_METHOD_LABELS).map(([v, l]) => (
                        <option key={v} value={v}>{l}</option>
                      ))}
                    </select>
                  </div>
                  {payMethod === "vodafone_cash" && (
                    <div>
                      <label className="text-[11px] font-semibold text-[#0B1F3A]">Vodafone Cash Number <span className="text-[#EF4444]">*</span></label>
                      <input value={payWallet} onChange={e => setPayWallet(e.target.value)} placeholder="01xxxxxxxxx"
                        className="mt-1 w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-[#FF8A1F]/30" />
                    </div>
                  )}
                  {payMethod === "instapay" && (
                    <>
                      <div>
                        <label className="text-[11px] font-semibold text-[#0B1F3A]">Instapay Number <span className="text-[#EF4444]">*</span></label>
                        <input value={payInstapayNo} onChange={e => setPayInstapayNo(e.target.value)} placeholder="01xxxxxxxxx"
                          className="mt-1 w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-[#FF8A1F]/30" />
                      </div>
                      <div>
                        <label className="text-[11px] font-semibold text-[#0B1F3A]">Instapay Payment Link <span className="text-[#EF4444]">*</span></label>
                        <input type="url" value={payLink} onChange={e => setPayLink(e.target.value)} placeholder="https://ipn.eg/S/..."
                          className="mt-1 w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-[#FF8A1F]/30" />
                      </div>
                    </>
                  )}
                  {payMethod === "bank_transfer" && (
                    <div>
                      <label className="text-[11px] font-semibold text-[#0B1F3A]">Bank Account Number <span className="text-[#EF4444]">*</span></label>
                      <input value={payBank} onChange={e => setPayBank(e.target.value)}
                        className="mt-1 w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-[#FF8A1F]/30" />
                    </div>
                  )}
                  <div>
                    <label className="text-[11px] font-semibold text-[#0B1F3A]">Notes</label>
                    <textarea rows={2} value={payNotes} onChange={e => setPayNotes(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-[#FF8A1F]/30 resize-none" />
                  </div>
                  {payErr && <p className="text-[12px] text-[#EF4444]">{payErr}</p>}
                  {payOk  && <p className="text-[12px] text-[#10B981] font-semibold">✓ Saved successfully</p>}
                  <button onClick={submitPayment} disabled={payBusy} className="w-full rounded-lg bg-[#0B1F3A] py-2.5 text-[13px] font-semibold text-white disabled:opacity-50 hover:bg-[#1a2f4a] transition">
                    {payBusy ? "Saving…" : "Save Payment Info"}
                  </button>
                </div>

                {/* Current summary */}
                <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-4 space-y-2">
                  <p className="text-[11px] font-bold text-[#94A3B8] uppercase tracking-wider">Current Payroll Summary</p>
                  <ModalRow label="Sessions"       right={String(row.sessions_count)} />
                  <ModalRow label="Rate/session"   right={fmtEGP(row.salary_per_session)} />
                  <ModalRow label="Total Earnings" right={fmtEGP(row.session_earnings)} />
                  <ModalRow label="Adjustments"    right={`${row.adj_net >= 0 ? "+" : ""}${fmtEGP(row.adj_net)}`} rightCls={row.adj_net >= 0 ? "text-[#15803D] font-semibold" : "text-[#EF4444] font-semibold"} />
                  <div className="border-t border-[#E2E8F0] pt-2">
                    <ModalRow label="Net Amount" right={fmtEGP(row.net_amount)} rightCls="text-[#FF8A1F] font-extrabold" />
                  </div>
                </div>

                <InstructorPaymentMethodsPanel instructorId={row.instructor_id} refreshKey={payOk ? 1 : 0} />
              </div>
            )}

            {/* ── HISTORY ── */}
            {tab === "history" && (
              <div className="p-5 space-y-4">
                {sessionsLoading ? (
                  <LoadingSpinner />
                ) : monthlyHistory.length === 0 ? (
                  <EmptyState message="No session data available for history view." />
                ) : (
                  <div className="ds-card overflow-hidden">
                    <table className="w-full text-[12px]">
                      <thead className="ds-table-head">
                        <tr>
                          <th className="py-2.5 pl-4 pr-2 text-left font-semibold text-[#64748B]">Month</th>
                          <th className="py-2.5 px-2 text-right font-semibold text-[#64748B]">Sessions</th>
                          <th className="py-2.5 px-2 text-right font-semibold text-[#64748B]">Earnings</th>
                          <th className="py-2.5 px-2 text-right font-semibold text-[#64748B]">Adjustments</th>
                          <th className="py-2.5 pl-2 pr-4 text-right font-semibold text-[#64748B]">Net</th>
                        </tr>
                      </thead>
                      <tbody>
                        {monthlyHistory.map(h => (
                          <tr key={h.month} className="border-b border-[#F1F5F9] hover:bg-[#F8FAFC] transition">
                            <td className="py-2.5 pl-4 pr-2 font-semibold text-[#0B1F3A]">
                              {new Date(h.month + "-01").toLocaleDateString("en-EG", { month: "long", year: "numeric" })}
                            </td>
                            <td className="py-2.5 px-2 text-right text-[#64748B]">{h.sessions}</td>
                            <td className="py-2.5 px-2 text-right text-[#0B1F3A]">{fmtEGP(h.earnings)}</td>
                            <td className="py-2.5 px-2 text-right">
                              {h.adj === 0 ? (
                                <span className="text-[#CBD5E1]">—</span>
                              ) : (
                                <span className={h.adj >= 0 ? "text-[#15803D] font-semibold" : "text-[#EF4444] font-semibold"}>
                                  {h.adj >= 0 ? "+" : ""}{fmtEGP(h.adj)}
                                </span>
                              )}
                            </td>
                            <td className="py-2.5 pl-2 pr-4 text-right font-bold text-[#0B1F3A]">{fmtEGP(h.net)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
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
                    placeholder="Add notes about this instructor's payroll, payment preferences, or any relevant information…"
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
