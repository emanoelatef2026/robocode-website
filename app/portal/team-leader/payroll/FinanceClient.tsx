"use client"

import { useState, useTransition, useCallback } from "react"
import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { AnimatePresence, motion } from "framer-motion"
import {
  addFinanceAdjustmentAction,
  deleteFinanceAdjustmentAction,
  updateInstructorPaymentInfoAction,
  upsertStaffProfileAction,
  toggleStaffEnabledAction,
  deleteStaffProfileAction,
  searchUsersForStaffAction,
} from "@/modules/staff-finance/actions"
import type {
  InstructorFinanceRow, StaffFinanceRow, StaffFinanceSummary, FinanceAdjustment, FinanceAdjType,
} from "@/modules/staff-finance/types"
import {
  ADJ_LABELS, ADJ_SIGN, ADJ_COLOR,
  INSTRUCTOR_PAYMENT_METHOD_LABELS, STAFF_ROLE_LABELS,
  fmtEGP, fmtNum, computeAdjTotals,
} from "@/modules/staff-finance/types"

// ── Constants ─────────────────────────────────────────────────────────────────

const TABS = [
  { id: "instructors", label: "Instructors" },
  { id: "staff",       label: "Staff" },
  { id: "summary",     label: "Summary" },
] as const

type TabId = typeof TABS[number]["id"]

const ADJ_TYPES: FinanceAdjType[] = [
  "bonus", "penalty", "advance", "purchase", "reimbursement", "other",
]

const ROLE_OPTIONS = [
  "team_leader", "coordinator", "branch_manager",
  "admin", "sales", "marketing", "operations", "finance", "other",
]

// ── Helpers ───────────────────────────────────────────────────────────────────

function Avatar({ name, size = "sm" }: { name: string; size?: "sm" | "md" }) {
  const initials = name.split(" ").slice(0, 2).map(w => w[0]).join("").toUpperCase()
  const cls = size === "md"
    ? "h-10 w-10 text-[14px]"
    : "h-8 w-8 text-[11px]"
  return (
    <div className={`${cls} shrink-0 rounded-full bg-[#0B1F3A] flex items-center justify-center font-bold text-white`}>
      {initials || "?"}
    </div>
  )
}

function AdjBadge({ type, amount }: { type: FinanceAdjType; amount: number }) {
  const sign = ADJ_SIGN[type] === 1 ? "+" : "−"
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${ADJ_COLOR[type]}`}>
      {ADJ_LABELS[type]} {sign}{fmtNum(amount)}
    </span>
  )
}

function NetChip({ amount }: { amount: number }) {
  const cls = amount >= 0
    ? "bg-emerald-50 text-emerald-700"
    : "bg-red-50 text-red-600"
  return (
    <span className={`inline-flex items-center rounded-lg px-2.5 py-1 text-[13px] font-bold ${cls}`}>
      {fmtEGP(amount)}
    </span>
  )
}

// ── Date preset helpers ───────────────────────────────────────────────────────

function getPreset(preset: string): { from: string; to: string } {
  const now   = new Date()
  const today = now.toISOString().slice(0, 10)
  switch (preset) {
    case "today":
      return { from: today, to: today }
    case "last7":
      return { from: new Date(Date.now() - 6 * 86400000).toISOString().slice(0, 10), to: today }
    case "last30":
      return { from: new Date(Date.now() - 29 * 86400000).toISOString().slice(0, 10), to: today }
    case "this_month":
    default:
      return {
        from: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`,
        to:   today,
      }
  }
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  instructors:      InstructorFinanceRow[]
  staff:            StaffFinanceRow[]
  summary:          StaffFinanceSummary
  branches:         { id: string; name: string }[]
  branchIds:        string[]
  initialBranchId:  string
  initialDateFrom:  string
  initialDateTo:    string
  initialTab:       string
  isSuperAdmin:     boolean
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export default function FinanceClient({
  instructors: initialInstructors,
  staff:       initialStaff,
  summary:     initialSummary,
  branches,
  branchIds,
  initialBranchId,
  initialDateFrom,
  initialDateTo,
  initialTab,
  isSuperAdmin,
}: Props) {
  const router     = useRouter()
  const pathname   = usePathname()
  const searchP    = useSearchParams()
  const [, startT] = useTransition()

  const [activeTab,  setActiveTab]  = useState<TabId>((initialTab as TabId) ?? "instructors")
  const [dateFrom,   setDateFrom]   = useState(initialDateFrom)
  const [dateTo,     setDateTo]     = useState(initialDateTo)
  const [branchId,   setBranchId]   = useState(initialBranchId)
  const [search,     setSearch]     = useState("")

  const [instructors, setInstructors] = useState(initialInstructors)
  const [staff,       setStaff]       = useState(initialStaff)
  const [summary,     setSummary]     = useState(initialSummary)

  // ── Navigate with new params ────────────────────────────────────────────────
  const navigate = useCallback((overrides: Record<string, string>) => {
    const p = new URLSearchParams(searchP.toString())
    for (const [k, v] of Object.entries(overrides)) {
      // "all" branch means no filter → remove the param so server uses all branchIds
      if (v && !(k === "branch" && v === "all")) p.set(k, v); else p.delete(k)
    }
    startT(() => router.push(`${pathname}?${p.toString()}`))
  }, [pathname, router, searchP])

  function applyDatePreset(preset: string) {
    const { from, to } = getPreset(preset)
    setDateFrom(from)
    setDateTo(to)
    navigate({ date_from: from, date_to: to, branch: branchId })
  }

  function applyFilters() {
    navigate({ date_from: dateFrom, date_to: dateTo, branch: branchId })
  }

  // ── Drawer state ────────────────────────────────────────────────────────────
  const [drawer, setDrawer] = useState<
    | { kind: "instructor"; row: InstructorFinanceRow }
    | { kind: "staff"; row: StaffFinanceRow }
    | null
  >(null)

  // ── Adjustment modal state ──────────────────────────────────────────────────
  const [adjModal, setAdjModal] = useState<{
    kind: "instructor" | "staff"
    id: string           // instructor_id or profile_id
    branchId: string
    name: string
  } | null>(null)
  const [adjType,   setAdjType]   = useState<FinanceAdjType>("bonus")
  const [adjAmount, setAdjAmount] = useState("")
  const [adjDate,   setAdjDate]   = useState(new Date().toISOString().slice(0, 10))
  const [adjNotes,  setAdjNotes]  = useState("")
  const [adjBusy,   setAdjBusy]   = useState(false)
  const [adjErr,    setAdjErr]    = useState("")

  async function submitAdjustment() {
    if (!adjModal || !adjAmount || Number(adjAmount) <= 0) {
      setAdjErr("Amount must be greater than 0")
      return
    }
    setAdjBusy(true)
    setAdjErr("")
    const result = await addFinanceAdjustmentAction({
      branch_id:        adjModal.branchId,
      instructor_id:    adjModal.kind === "instructor" ? adjModal.id : undefined,
      staff_profile_id: adjModal.kind === "staff"      ? adjModal.id : undefined,
      type:             adjType,
      amount:           Number(adjAmount),
      adjustment_date:  adjDate,
      notes:            adjNotes,
    })
    setAdjBusy(false)
    if (!result.success) { setAdjErr(result.error.message); return }
    setAdjModal(null)
    setAdjAmount("")
    setAdjNotes("")
    applyFilters()
  }

  async function removeAdj(adjId: string) {
    await deleteFinanceAdjustmentAction(adjId)
    applyFilters()
  }

  // ── Payment info modal (instructor) ─────────────────────────────────────────
  const [payModal, setPayModal] = useState<InstructorFinanceRow | null>(null)
  const [payRate,   setPayRate]   = useState("")
  const [payMethod, setPayMethod] = useState("")
  const [payRef,    setPayRef]    = useState("")
  const [payNotes,  setPayNotes]  = useState("")
  const [payBusy,   setPayBusy]   = useState(false)
  const [payErr,    setPayErr]    = useState("")

  function openPayModal(row: InstructorFinanceRow) {
    setPayModal(row)
    setPayRate(String(row.salary_per_session || ""))
    setPayMethod(row.payment_method ?? "cash")
    setPayRef(row.instapay_number ?? "")
    setPayNotes(row.payment_notes ?? "")
    setPayErr("")
  }

  async function submitPaymentInfo() {
    if (!payModal) return
    setPayBusy(true)
    setPayErr("")
    const result = await updateInstructorPaymentInfoAction({
      instructor_id:      payModal.instructor_id,
      salary_per_session: payRate ? Number(payRate) : null,
      payment_method:     payMethod || null,
      instapay_number:    payRef    || null,
      payment_notes:      payNotes  || null,
    })
    setPayBusy(false)
    if (!result.success) { setPayErr(result.error.message); return }
    setPayModal(null)
    applyFilters()
  }

  // ── Staff modal (create/edit) ────────────────────────────────────────────────
  const [staffModal, setStaffModal] = useState<{
    mode: "create" | "edit"
    row?: StaffFinanceRow
  } | null>(null)
  const [sfUserId,   setSfUserId]   = useState("")
  const [sfUserName, setSfUserName] = useState("")
  const [sfUserQ,    setSfUserQ]    = useState("")
  const [sfUserOpts, setSfUserOpts] = useState<{ user_id: string; display_name: string; email: string }[]>([])
  const [sfRole,     setSfRole]     = useState("coordinator")
  const [sfPayType,  setSfPayType]  = useState<"fixed_salary"|"mixed"|"per_session">("fixed_salary")
  const [sfSalary,   setSfSalary]   = useState("")
  const [sfRate,     setSfRate]     = useState("")
  const [sfMethod,   setSfMethod]   = useState("cash")
  const [sfRef,      setSfRef]      = useState("")
  const [sfEnabled,  setSfEnabled]  = useState(true)
  const [sfNotes,    setSfNotes]    = useState("")
  const [sfBusy,     setSfBusy]     = useState(false)
  const [sfErr,      setSfErr]      = useState("")

  function openCreateStaff() {
    setStaffModal({ mode: "create" })
    setSfUserId(""); setSfUserName(""); setSfUserQ("")
    setSfUserOpts([])
    setSfRole("coordinator"); setSfPayType("fixed_salary")
    setSfSalary(""); setSfRate(""); setSfMethod("cash"); setSfRef("")
    setSfEnabled(true); setSfNotes(""); setSfErr("")
  }

  function openEditStaff(row: StaffFinanceRow) {
    setStaffModal({ mode: "edit", row })
    setSfUserId(row.user_id); setSfUserName(row.display_name); setSfUserQ("")
    setSfRole(row.role); setSfPayType(row.payroll_type)
    setSfSalary(String(row.basic_salary || "")); setSfRate(String(row.session_rate || ""))
    setSfMethod(row.payment_method); setSfRef(row.payment_reference ?? "")
    setSfEnabled(row.is_payroll_enabled); setSfNotes(row.notes ?? ""); setSfErr("")
  }

  async function searchUsers(q: string) {
    setSfUserQ(q)
    if (q.length < 2) { setSfUserOpts([]); return }
    const res = await searchUsersForStaffAction(branchId, q)
    if (res.success) setSfUserOpts(res.data)
  }

  async function submitStaffProfile() {
    if (staffModal?.mode === "create" && !sfUserId) {
      setSfErr("Please select a user"); return
    }
    setSfBusy(true); setSfErr("")
    const result = await upsertStaffProfileAction({
      user_id:            staffModal?.mode === "create" ? sfUserId : (staffModal?.row?.user_id ?? ""),
      branch_id:          branchId,
      role:               sfRole,
      payroll_type:       sfPayType,
      basic_salary:       Number(sfSalary)  || 0,
      session_rate:       Number(sfRate)    || 0,
      payment_method:     sfMethod,
      payment_reference:  sfRef,
      is_payroll_enabled: sfEnabled,
      notes:              sfNotes,
    })
    setSfBusy(false)
    if (!result.success) { setSfErr(result.error.message); return }
    setStaffModal(null)
    applyFilters()
  }

  async function toggleStaff(profileId: string, enabled: boolean) {
    await toggleStaffEnabledAction(profileId, enabled)
    applyFilters()
  }

  async function deleteStaff(profileId: string) {
    if (!confirm("Remove this staff profile?")) return
    await deleteStaffProfileAction(profileId)
    applyFilters()
  }

  // ── Filter bar ─────────────────────────────────────────────────────────────

  const filteredInstructors = instructors.filter(r =>
    !search || r.display_name.toLowerCase().includes(search.toLowerCase())
  )
  const filteredStaff = staff.filter(r =>
    !search || r.display_name.toLowerCase().includes(search.toLowerCase())
  )

  // ══════════════════════════════════════════════════════════════════════════════
  return (
    <div className="min-h-screen bg-[#F8FAFC]">

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div className="bg-white border-b border-[#E2E8F0] px-4 md:px-6 py-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-[20px] font-bold text-[#0B1F3A]">Payroll</h1>
            <p className="text-[12px] text-[#64748B] mt-0.5">
              Live instructor earnings & staff salaries
            </p>
          </div>
          <div className="flex items-center gap-2">
            {activeTab === "staff" && (
              <button
                onClick={openCreateStaff}
                className="flex items-center gap-1.5 rounded-lg bg-[#0B1F3A] px-3 py-2 text-[12px] font-semibold text-white hover:bg-[#1a2f4a] transition"
              >
                <span className="text-lg leading-none">+</span> Add Staff
              </button>
            )}
          </div>
        </div>

        {/* ── Tabs ───────────────────────────────────────────────────────── */}
        <div className="mt-4 flex gap-1 border-b border-[#E2E8F0]">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => { setActiveTab(tab.id); setSearch("") }}
              className={`px-4 py-2 text-[13px] font-semibold border-b-2 transition -mb-px ${
                activeTab === tab.id
                  ? "border-[#FF8A1F] text-[#FF8A1F]"
                  : "border-transparent text-[#64748B] hover:text-[#0B1F3A]"
              }`}
            >
              {tab.label}
              {tab.id === "instructors" && (
                <span className="ml-1.5 rounded-full bg-[#F1F5F9] px-1.5 py-0.5 text-[10px] font-bold text-[#64748B]">
                  {instructors.length}
                </span>
              )}
              {tab.id === "staff" && (
                <span className="ml-1.5 rounded-full bg-[#F1F5F9] px-1.5 py-0.5 text-[10px] font-bold text-[#64748B]">
                  {staff.length}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ── Filter bar ─────────────────────────────────────────────────────── */}
      {activeTab !== "summary" && (
        <div className="bg-white border-b border-[#E2E8F0] px-4 md:px-6 py-3">
          <div className="flex flex-col md:flex-row md:items-center gap-2.5">
            {/* Date presets */}
            <div className="flex gap-1.5 flex-wrap">
              {[
                { key: "today",      label: "Today" },
                { key: "last7",      label: "Last 7d" },
                { key: "this_month", label: "This Month" },
                { key: "last30",     label: "Last 30d" },
              ].map(p => (
                <button
                  key={p.key}
                  onClick={() => applyDatePreset(p.key)}
                  className="rounded-md border border-[#E2E8F0] bg-white px-2.5 py-1 text-[11px] font-medium text-[#0B1F3A] hover:bg-[#F8FAFC] transition"
                >
                  {p.label}
                </button>
              ))}
            </div>

            {/* Date range */}
            <div className="flex items-center gap-1.5">
              <input
                type="date"
                value={dateFrom}
                onChange={e => setDateFrom(e.target.value)}
                className="rounded-lg border border-[#E2E8F0] px-2.5 py-1.5 text-[12px] text-[#0B1F3A] focus:outline-none focus:ring-2 focus:ring-[#FF8A1F]/30"
              />
              <span className="text-[11px] text-[#94A3B8]">to</span>
              <input
                type="date"
                value={dateTo}
                onChange={e => setDateTo(e.target.value)}
                className="rounded-lg border border-[#E2E8F0] px-2.5 py-1.5 text-[12px] text-[#0B1F3A] focus:outline-none focus:ring-2 focus:ring-[#FF8A1F]/30"
              />
            </div>

            {/* Branch */}
            {branches.length > 1 && (
              <select
                value={branchId}
                onChange={e => setBranchId(e.target.value)}
                className="rounded-lg border border-[#E2E8F0] px-2.5 py-1.5 text-[12px] text-[#0B1F3A] focus:outline-none focus:ring-2 focus:ring-[#FF8A1F]/30"
              >
                <option value="all">All Branches</option>
                {branches.map(b => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            )}

            {/* Apply */}
            <button
              onClick={applyFilters}
              className="rounded-lg bg-[#0B1F3A] px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-[#1a2f4a] transition"
            >
              Apply
            </button>

            {/* Search */}
            <div className="relative ml-auto">
              <input
                placeholder={`Search ${activeTab}…`}
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="rounded-lg border border-[#E2E8F0] pl-8 pr-3 py-1.5 text-[12px] text-[#0B1F3A] focus:outline-none focus:ring-2 focus:ring-[#FF8A1F]/30 w-44"
              />
              <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#94A3B8]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
          </div>
        </div>
      )}

      {/* ── Content ─────────────────────────────────────────────────────────── */}
      <div className="px-4 md:px-6 py-4">
        {activeTab === "instructors" && (
          <InstructorsTab
            rows={filteredInstructors}
            onAdjust={(row) => {
              setAdjModal({ kind: "instructor", id: row.instructor_id, branchId: row.branch_id, name: row.display_name })
              setAdjType("bonus"); setAdjAmount(""); setAdjDate(new Date().toISOString().slice(0, 10)); setAdjNotes(""); setAdjErr("")
            }}
            onPayInfo={openPayModal}
            onOpenDrawer={(row) => setDrawer({ kind: "instructor", row })}
            onRemoveAdj={removeAdj}
          />
        )}
        {activeTab === "staff" && (
          <StaffTab
            rows={filteredStaff}
            onAdjust={(row) => {
              setAdjModal({ kind: "staff", id: row.profile_id, branchId: row.branch_id, name: row.display_name })
              setAdjType("bonus"); setAdjAmount(""); setAdjDate(new Date().toISOString().slice(0, 10)); setAdjNotes(""); setAdjErr("")
            }}
            onEdit={openEditStaff}
            onToggle={toggleStaff}
            onDelete={deleteStaff}
            onOpenDrawer={(row) => setDrawer({ kind: "staff", row })}
            onRemoveAdj={removeAdj}
          />
        )}
        {activeTab === "summary" && (
          <SummaryTab summary={summary} dateFrom={dateFrom} dateTo={dateTo} />
        )}
      </div>

      {/* ── Drawer ──────────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {drawer && (
          <>
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm"
              onClick={() => setDrawer(null)}
            />
            <motion.div
              key="drawer"
              initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="fixed right-0 top-0 bottom-0 z-50 w-full sm:w-[480px] bg-white shadow-2xl overflow-y-auto"
            >
              <DrawerContent
                drawer={drawer}
                onClose={() => setDrawer(null)}
                onAdjust={(kind, id, bId, name) => {
                  setAdjModal({ kind, id, branchId: bId, name })
                  setAdjType("bonus"); setAdjAmount("")
                  setAdjDate(new Date().toISOString().slice(0, 10))
                  setAdjNotes(""); setAdjErr("")
                  setDrawer(null)
                }}
                onRemoveAdj={removeAdj}
                onPayInfo={(row) => { openPayModal(row); setDrawer(null) }}
                onEditStaff={(row) => { openEditStaff(row); setDrawer(null) }}
              />
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── Adjustment modal ─────────────────────────────────────────────────── */}
      <AnimatePresence>
        {adjModal && (
          <Modal onClose={() => setAdjModal(null)} title={`Adjustment — ${adjModal.name}`}>
            <div className="space-y-3">
              {/* Type */}
              <div>
                <label className="text-[12px] font-semibold text-[#0B1F3A]">Type</label>
                <div className="mt-1.5 grid grid-cols-3 gap-1.5">
                  {ADJ_TYPES.map(t => (
                    <button
                      key={t}
                      onClick={() => setAdjType(t)}
                      className={`rounded-lg border px-2 py-1.5 text-[11px] font-semibold transition ${
                        adjType === t
                          ? "border-[#0B1F3A] bg-[#0B1F3A] text-white"
                          : "border-[#E2E8F0] text-[#64748B] hover:border-[#0B1F3A]"
                      }`}
                    >
                      {ADJ_SIGN[t] === 1 ? "+" : "−"} {ADJ_LABELS[t]}
                    </button>
                  ))}
                </div>
                <p className="mt-1.5 text-[11px] text-[#94A3B8]">
                  {ADJ_SIGN[adjType] === 1 ? "Adds to" : "Deducts from"} net amount
                </p>
              </div>
              {/* Amount */}
              <div>
                <label className="text-[12px] font-semibold text-[#0B1F3A]">Amount (EGP)</label>
                <input
                  type="number" min="0" step="50"
                  value={adjAmount}
                  onChange={e => setAdjAmount(e.target.value)}
                  placeholder="0"
                  className="mt-1 w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-[#FF8A1F]/30"
                />
              </div>
              {/* Date */}
              <div>
                <label className="text-[12px] font-semibold text-[#0B1F3A]">Date</label>
                <input
                  type="date"
                  value={adjDate}
                  onChange={e => setAdjDate(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-[#FF8A1F]/30"
                />
              </div>
              {/* Notes */}
              <div>
                <label className="text-[12px] font-semibold text-[#0B1F3A]">Notes (optional)</label>
                <textarea
                  rows={2}
                  value={adjNotes}
                  onChange={e => setAdjNotes(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-[#FF8A1F]/30 resize-none"
                />
              </div>
              {adjErr && <p className="text-[12px] text-red-600">{adjErr}</p>}
              <div className="flex gap-2 pt-1">
                <button onClick={() => setAdjModal(null)} className="flex-1 rounded-lg border border-[#E2E8F0] py-2 text-[13px] font-medium text-[#64748B] hover:bg-[#F8FAFC]">Cancel</button>
                <button onClick={submitAdjustment} disabled={adjBusy} className="flex-1 rounded-lg bg-[#0B1F3A] py-2 text-[13px] font-semibold text-white hover:bg-[#1a2f4a] disabled:opacity-50">
                  {adjBusy ? "Saving…" : "Save Adjustment"}
                </button>
              </div>
            </div>
          </Modal>
        )}
      </AnimatePresence>

      {/* ── Payment info modal ───────────────────────────────────────────────── */}
      <AnimatePresence>
        {payModal && (
          <Modal onClose={() => setPayModal(null)} title={`Payment Info — ${payModal.display_name}`}>
            <div className="space-y-3">
              <div>
                <label className="text-[12px] font-semibold text-[#0B1F3A]">Session Rate (EGP)</label>
                <input
                  type="number" min="0" step="50"
                  value={payRate}
                  onChange={e => setPayRate(e.target.value)}
                  placeholder="0"
                  className="mt-1 w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-[#FF8A1F]/30"
                />
              </div>
              <div>
                <label className="text-[12px] font-semibold text-[#0B1F3A]">Payment Method</label>
                <select
                  value={payMethod}
                  onChange={e => setPayMethod(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-[#FF8A1F]/30"
                >
                  {Object.entries(INSTRUCTOR_PAYMENT_METHOD_LABELS).map(([v, l]) => (
                    <option key={v} value={v}>{l}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[12px] font-semibold text-[#0B1F3A]">
                  {payMethod === "instapay" ? "Instapay Number" : "Payment Reference"}
                </label>
                <input
                  value={payRef}
                  onChange={e => setPayRef(e.target.value)}
                  placeholder="Account / phone / IBAN"
                  className="mt-1 w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-[#FF8A1F]/30"
                />
              </div>
              <div>
                <label className="text-[12px] font-semibold text-[#0B1F3A]">Notes</label>
                <textarea
                  rows={2}
                  value={payNotes}
                  onChange={e => setPayNotes(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-[#FF8A1F]/30 resize-none"
                />
              </div>
              {payErr && <p className="text-[12px] text-red-600">{payErr}</p>}
              <div className="flex gap-2 pt-1">
                <button onClick={() => setPayModal(null)} className="flex-1 rounded-lg border border-[#E2E8F0] py-2 text-[13px] font-medium text-[#64748B] hover:bg-[#F8FAFC]">Cancel</button>
                <button onClick={submitPaymentInfo} disabled={payBusy} className="flex-1 rounded-lg bg-[#0B1F3A] py-2 text-[13px] font-semibold text-white hover:bg-[#1a2f4a] disabled:opacity-50">
                  {payBusy ? "Saving…" : "Save"}
                </button>
              </div>
            </div>
          </Modal>
        )}
      </AnimatePresence>

      {/* ── Staff create/edit modal ──────────────────────────────────────────── */}
      <AnimatePresence>
        {staffModal && (
          <Modal
            onClose={() => setStaffModal(null)}
            title={staffModal.mode === "create" ? "Add Staff Member" : `Edit — ${staffModal.row?.display_name}`}
            wide
          >
            <div className="space-y-3">
              {staffModal.mode === "create" && (
                <div>
                  <label className="text-[12px] font-semibold text-[#0B1F3A]">Search User</label>
                  <div className="relative mt-1">
                    <input
                      placeholder="Name or email…"
                      value={sfUserQ}
                      onChange={e => searchUsers(e.target.value)}
                      className="w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-[#FF8A1F]/30"
                    />
                    {sfUserOpts.length > 0 && (
                      <div className="absolute z-10 left-0 right-0 top-full mt-1 rounded-xl border border-[#E2E8F0] bg-white shadow-xl max-h-48 overflow-y-auto">
                        {sfUserOpts.map(u => (
                          <button
                            key={u.user_id}
                            onClick={() => {
                              setSfUserId(u.user_id)
                              setSfUserName(u.display_name)
                              setSfUserQ(u.display_name)
                              setSfUserOpts([])
                            }}
                            className="flex w-full items-center gap-2 px-3 py-2.5 hover:bg-[#F8FAFC] text-left"
                          >
                            <Avatar name={u.display_name} />
                            <div>
                              <p className="text-[13px] font-medium text-[#0B1F3A]">{u.display_name}</p>
                              <p className="text-[11px] text-[#94A3B8]">{u.email}</p>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  {sfUserId && (
                    <p className="mt-1.5 text-[11px] text-emerald-600 font-medium">✓ Selected: {sfUserName}</p>
                  )}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[12px] font-semibold text-[#0B1F3A]">Role</label>
                  <select
                    value={sfRole}
                    onChange={e => setSfRole(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-[#E2E8F0] px-2.5 py-2 text-[12px] focus:outline-none focus:ring-2 focus:ring-[#FF8A1F]/30"
                  >
                    {ROLE_OPTIONS.map(r => (
                      <option key={r} value={r}>{STAFF_ROLE_LABELS[r] ?? r}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[12px] font-semibold text-[#0B1F3A]">Salary Type</label>
                  <select
                    value={sfPayType}
                    onChange={e => setSfPayType(e.target.value as any)}
                    className="mt-1 w-full rounded-lg border border-[#E2E8F0] px-2.5 py-2 text-[12px] focus:outline-none focus:ring-2 focus:ring-[#FF8A1F]/30"
                  >
                    <option value="fixed_salary">Fixed Salary</option>
                    <option value="per_session">Per Session</option>
                    <option value="mixed">Mixed</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {sfPayType !== "per_session" && (
                  <div>
                    <label className="text-[12px] font-semibold text-[#0B1F3A]">Basic Salary (EGP)</label>
                    <input
                      type="number" min="0" step="100"
                      value={sfSalary}
                      onChange={e => setSfSalary(e.target.value)}
                      placeholder="0"
                      className="mt-1 w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-[#FF8A1F]/30"
                    />
                  </div>
                )}
                {sfPayType !== "fixed_salary" && (
                  <div>
                    <label className="text-[12px] font-semibold text-[#0B1F3A]">Session Rate (EGP)</label>
                    <input
                      type="number" min="0" step="50"
                      value={sfRate}
                      onChange={e => setSfRate(e.target.value)}
                      placeholder="0"
                      className="mt-1 w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-[#FF8A1F]/30"
                    />
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[12px] font-semibold text-[#0B1F3A]">Payment Method</label>
                  <select
                    value={sfMethod}
                    onChange={e => setSfMethod(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-[#E2E8F0] px-2.5 py-2 text-[12px] focus:outline-none focus:ring-2 focus:ring-[#FF8A1F]/30"
                  >
                    {Object.entries(INSTRUCTOR_PAYMENT_METHOD_LABELS).map(([v, l]) => (
                      <option key={v} value={v}>{l}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[12px] font-semibold text-[#0B1F3A]">Reference</label>
                  <input
                    value={sfRef}
                    onChange={e => setSfRef(e.target.value)}
                    placeholder="Account / phone / IBAN"
                    className="mt-1 w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-[12px] focus:outline-none focus:ring-2 focus:ring-[#FF8A1F]/30"
                  />
                </div>
              </div>

              <div>
                <label className="text-[12px] font-semibold text-[#0B1F3A]">Notes</label>
                <textarea
                  rows={2}
                  value={sfNotes}
                  onChange={e => setSfNotes(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-[#FF8A1F]/30 resize-none"
                />
              </div>

              <label className="flex items-center gap-2 cursor-pointer">
                <div
                  onClick={() => setSfEnabled(!sfEnabled)}
                  className={`relative h-5 w-9 rounded-full transition cursor-pointer ${sfEnabled ? "bg-emerald-500" : "bg-slate-300"}`}
                >
                  <div className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${sfEnabled ? "translate-x-4" : ""}`} />
                </div>
                <span className="text-[12px] font-medium text-[#0B1F3A]">Include in payroll</span>
              </label>

              {sfErr && <p className="text-[12px] text-red-600">{sfErr}</p>}
              <div className="flex gap-2 pt-1">
                <button onClick={() => setStaffModal(null)} className="flex-1 rounded-lg border border-[#E2E8F0] py-2 text-[13px] font-medium text-[#64748B] hover:bg-[#F8FAFC]">Cancel</button>
                <button onClick={submitStaffProfile} disabled={sfBusy} className="flex-1 rounded-lg bg-[#0B1F3A] py-2 text-[13px] font-semibold text-white hover:bg-[#1a2f4a] disabled:opacity-50">
                  {sfBusy ? "Saving…" : staffModal.mode === "create" ? "Add Staff" : "Save Changes"}
                </button>
              </div>
            </div>
          </Modal>
        )}
      </AnimatePresence>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB: INSTRUCTORS
// ═══════════════════════════════════════════════════════════════════════════════

function InstructorsTab({
  rows,
  onAdjust,
  onPayInfo,
  onOpenDrawer,
  onRemoveAdj,
}: {
  rows: InstructorFinanceRow[]
  onAdjust: (row: InstructorFinanceRow) => void
  onPayInfo: (row: InstructorFinanceRow) => void
  onOpenDrawer: (row: InstructorFinanceRow) => void
  onRemoveAdj: (id: string) => void
}) {
  // KPI strip
  const totalEarnings = rows.reduce((s, r) => s + r.session_earnings, 0)
  const totalNet      = rows.reduce((s, r) => s + r.net_amount, 0)
  const totalBonus    = rows.reduce((s, r) => s + r.bonus_total, 0)
  const totalPenalty  = rows.reduce((s, r) => s + r.penalty_total, 0)
  const totalSessions = rows.reduce((s, r) => s + r.sessions_count, 0)

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
        {[
          { label: "Instructors",  value: String(rows.length),       hi: false },
          { label: "Sessions",     value: String(totalSessions),     hi: false },
          { label: "Earnings",     value: fmtEGP(totalEarnings),     hi: false },
          { label: "Bonuses",      value: fmtEGP(totalBonus),        hi: false },
          { label: "Net Payroll",  value: fmtEGP(totalNet),          hi: true  },
        ].map(k => (
          <div key={k.label} className={`rounded-xl border px-3 py-3 ${k.hi ? "border-[#FF8A1F]/30 bg-[#FFF7F0]" : "border-[#E2E8F0] bg-white"}`}>
            <p className={`text-[16px] font-extrabold ${k.hi ? "text-[#FF8A1F]" : "text-[#0B1F3A]"}`}>{k.value}</p>
            <p className="text-[10px] font-medium text-[#94A3B8] mt-0.5">{k.label}</p>
          </div>
        ))}
      </div>

      {rows.length === 0 ? (
        <EmptyState message="No instructors found for this date range and branch." />
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block">
            <div className="rounded-xl border border-[#E2E8F0] bg-white overflow-hidden">
              <table className="w-full text-[12px]">
                <thead className="bg-[#F8FAFC] border-b border-[#E2E8F0]">
                  <tr>
                    <th className="py-3 pl-4 pr-2 text-left font-semibold text-[#64748B]">Instructor</th>
                    <th className="py-3 px-2 text-right font-semibold text-[#64748B]">Sessions</th>
                    <th className="py-3 px-2 text-right font-semibold text-[#64748B]">Rate</th>
                    <th className="py-3 px-2 text-right font-semibold text-[#64748B]">Earnings</th>
                    <th className="py-3 px-2 text-right font-semibold text-[#64748B]">Adjustments</th>
                    <th className="py-3 px-2 text-right font-semibold text-[#64748B]">Net</th>
                    <th className="py-3 px-2 text-right font-semibold text-[#64748B]">Payment</th>
                    <th className="py-3 px-4 text-right font-semibold text-[#64748B]">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(row => (
                    <tr key={row.instructor_id} className="border-b border-[#F1F5F9] hover:bg-[#F8FAFC] transition">
                      <td className="py-3 pl-4 pr-2">
                        <div className="flex items-center gap-2.5">
                          <Avatar name={row.display_name} />
                          <div>
                            <button
                              onClick={() => onOpenDrawer(row)}
                              className="font-semibold text-[#0B1F3A] hover:text-[#FF8A1F] transition text-left"
                            >
                              {row.display_name}
                            </button>
                            <p className="text-[10px] text-[#94A3B8]">{row.branch_name} · {row.group_count} groups</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-2 text-right font-semibold text-[#0B1F3A]">{row.sessions_count}</td>
                      <td className="py-3 px-2 text-right text-[#64748B]">{fmtEGP(row.salary_per_session)}</td>
                      <td className="py-3 px-2 text-right font-medium text-[#0B1F3A]">{fmtEGP(row.session_earnings)}</td>
                      <td className="py-3 px-2 text-right">
                        {row.adjustments.length === 0 ? (
                          <span className="text-[#94A3B8]">—</span>
                        ) : (
                          <span className={`font-semibold ${row.adj_net >= 0 ? "text-emerald-700" : "text-red-600"}`}>
                            {row.adj_net >= 0 ? "+" : ""}{fmtEGP(row.adj_net)}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-2 text-right"><NetChip amount={row.net_amount} /></td>
                      <td className="py-3 px-2 text-right text-[11px] text-[#64748B]">
                        {row.payment_method
                          ? INSTRUCTOR_PAYMENT_METHOD_LABELS[row.payment_method as keyof typeof INSTRUCTOR_PAYMENT_METHOD_LABELS] ?? row.payment_method
                          : <span className="text-[#CBD5E1]">Not set</span>
                        }
                      </td>
                      <td className="py-3 pl-2 pr-4">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => onAdjust(row)}
                            className="rounded-lg border border-[#E2E8F0] px-2.5 py-1 text-[11px] font-medium text-[#0B1F3A] hover:bg-[#F8FAFC] transition"
                          >
                            + Adjust
                          </button>
                          <button
                            onClick={() => onPayInfo(row)}
                            className="rounded-lg border border-[#E2E8F0] px-2.5 py-1 text-[11px] font-medium text-[#64748B] hover:bg-[#F8FAFC] transition"
                          >
                            Edit
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-2">
            {rows.map(row => (
              <div key={row.instructor_id} className="rounded-xl border border-[#E2E8F0] bg-white p-3.5">
                <div className="flex items-start gap-2.5">
                  <Avatar name={row.display_name} />
                  <div className="flex-1 min-w-0">
                    <button
                      onClick={() => onOpenDrawer(row)}
                      className="font-semibold text-[#0B1F3A] hover:text-[#FF8A1F] text-[13px] transition text-left"
                    >
                      {row.display_name}
                    </button>
                    <p className="text-[11px] text-[#94A3B8]">{row.branch_name} · {row.group_count} groups</p>
                  </div>
                  <NetChip amount={row.net_amount} />
                </div>
                <div className="mt-2.5 grid grid-cols-3 gap-2">
                  {[
                    { l: "Sessions", v: String(row.sessions_count) },
                    { l: "Rate",     v: fmtEGP(row.salary_per_session) },
                    { l: "Earnings", v: fmtEGP(row.session_earnings) },
                  ].map(c => (
                    <div key={c.l} className="rounded-lg bg-[#F8FAFC] px-2 py-1.5">
                      <p className="text-[12px] font-bold text-[#0B1F3A]">{c.v}</p>
                      <p className="text-[10px] text-[#94A3B8]">{c.l}</p>
                    </div>
                  ))}
                </div>
                {row.adjustments.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {row.adjustments.map(a => (
                      <AdjBadge key={a.id} type={a.type} amount={a.amount} />
                    ))}
                  </div>
                )}
                <div className="mt-2.5 flex gap-1.5">
                  <button onClick={() => onAdjust(row)} className="flex-1 rounded-lg border border-[#E2E8F0] py-1.5 text-[11px] font-semibold text-[#0B1F3A]">+ Adjust</button>
                  <button onClick={() => onPayInfo(row)} className="flex-1 rounded-lg border border-[#E2E8F0] py-1.5 text-[11px] font-semibold text-[#64748B]">Edit Info</button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB: STAFF
// ═══════════════════════════════════════════════════════════════════════════════

function StaffTab({
  rows,
  onAdjust,
  onEdit,
  onToggle,
  onDelete,
  onOpenDrawer,
  onRemoveAdj,
}: {
  rows: StaffFinanceRow[]
  onAdjust: (row: StaffFinanceRow) => void
  onEdit: (row: StaffFinanceRow) => void
  onToggle: (id: string, enabled: boolean) => void
  onDelete: (id: string) => void
  onOpenDrawer: (row: StaffFinanceRow) => void
  onRemoveAdj: (id: string) => void
}) {
  const totalSalaries = rows.reduce((s, r) => s + r.basic_salary, 0)
  const totalNet      = rows.reduce((s, r) => s + r.net_amount, 0)
  const totalBonus    = rows.reduce((s, r) => s + r.bonus_total, 0)

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {[
          { label: "Staff",      value: String(rows.length),    hi: false },
          { label: "Salaries",   value: fmtEGP(totalSalaries), hi: false },
          { label: "Bonuses",    value: fmtEGP(totalBonus),    hi: false },
          { label: "Net Total",  value: fmtEGP(totalNet),      hi: true  },
        ].map(k => (
          <div key={k.label} className={`rounded-xl border px-3 py-3 ${k.hi ? "border-[#FF8A1F]/30 bg-[#FFF7F0]" : "border-[#E2E8F0] bg-white"}`}>
            <p className={`text-[16px] font-extrabold ${k.hi ? "text-[#FF8A1F]" : "text-[#0B1F3A]"}`}>{k.value}</p>
            <p className="text-[10px] font-medium text-[#94A3B8] mt-0.5">{k.label}</p>
          </div>
        ))}
      </div>

      {rows.length === 0 ? (
        <EmptyState message="No staff profiles yet. Click &quot;Add Staff&quot; to get started." />
      ) : (
        <>
          {/* Desktop */}
          <div className="hidden md:block">
            <div className="rounded-xl border border-[#E2E8F0] bg-white overflow-hidden">
              <table className="w-full text-[12px]">
                <thead className="bg-[#F8FAFC] border-b border-[#E2E8F0]">
                  <tr>
                    <th className="py-3 pl-4 pr-2 text-left font-semibold text-[#64748B]">Employee</th>
                    <th className="py-3 px-2 text-left font-semibold text-[#64748B]">Role</th>
                    <th className="py-3 px-2 text-right font-semibold text-[#64748B]">Salary</th>
                    <th className="py-3 px-2 text-right font-semibold text-[#64748B]">Adjustments</th>
                    <th className="py-3 px-2 text-right font-semibold text-[#64748B]">Net</th>
                    <th className="py-3 px-2 text-right font-semibold text-[#64748B]">Payment</th>
                    <th className="py-3 px-4 text-right font-semibold text-[#64748B]">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(row => (
                    <tr key={row.profile_id} className={`border-b border-[#F1F5F9] hover:bg-[#F8FAFC] transition ${!row.is_payroll_enabled ? "opacity-50" : ""}`}>
                      <td className="py-3 pl-4 pr-2">
                        <div className="flex items-center gap-2.5">
                          <Avatar name={row.display_name} />
                          <div>
                            <button
                              onClick={() => onOpenDrawer(row)}
                              className="font-semibold text-[#0B1F3A] hover:text-[#FF8A1F] transition text-left"
                            >
                              {row.display_name}
                            </button>
                            <p className="text-[10px] text-[#94A3B8]">{row.branch_name}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-2">
                        <span className="rounded-full bg-[#F1F5F9] px-2 py-0.5 text-[10px] font-semibold text-[#64748B]">
                          {STAFF_ROLE_LABELS[row.role] ?? row.role}
                        </span>
                      </td>
                      <td className="py-3 px-2 text-right font-medium text-[#0B1F3A]">{fmtEGP(row.basic_salary)}</td>
                      <td className="py-3 px-2 text-right">
                        {row.adjustments.length === 0 ? (
                          <span className="text-[#94A3B8]">—</span>
                        ) : (
                          <span className={`font-semibold ${row.adj_net >= 0 ? "text-emerald-700" : "text-red-600"}`}>
                            {row.adj_net >= 0 ? "+" : ""}{fmtEGP(row.adj_net)}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-2 text-right"><NetChip amount={row.net_amount} /></td>
                      <td className="py-3 px-2 text-right text-[11px] text-[#64748B]">
                        {INSTRUCTOR_PAYMENT_METHOD_LABELS[row.payment_method as keyof typeof INSTRUCTOR_PAYMENT_METHOD_LABELS] ?? row.payment_method}
                      </td>
                      <td className="py-3 pl-2 pr-4">
                        <div className="flex items-center justify-end gap-1.5">
                          <button onClick={() => onAdjust(row)} className="rounded-lg border border-[#E2E8F0] px-2.5 py-1 text-[11px] font-medium text-[#0B1F3A] hover:bg-[#F8FAFC]">+ Adjust</button>
                          <button onClick={() => onEdit(row)} className="rounded-lg border border-[#E2E8F0] px-2.5 py-1 text-[11px] font-medium text-[#64748B] hover:bg-[#F8FAFC]">Edit</button>
                          <button onClick={() => onToggle(row.profile_id, !row.is_payroll_enabled)} className="rounded-lg border border-[#E2E8F0] px-2.5 py-1 text-[11px] font-medium text-[#64748B] hover:bg-[#F8FAFC]">
                            {row.is_payroll_enabled ? "Disable" : "Enable"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile */}
          <div className="md:hidden space-y-2">
            {rows.map(row => (
              <div key={row.profile_id} className={`rounded-xl border border-[#E2E8F0] bg-white p-3.5 ${!row.is_payroll_enabled ? "opacity-60" : ""}`}>
                <div className="flex items-start gap-2.5">
                  <Avatar name={row.display_name} />
                  <div className="flex-1 min-w-0">
                    <button
                      onClick={() => onOpenDrawer(row)}
                      className="font-semibold text-[#0B1F3A] hover:text-[#FF8A1F] text-[13px] transition text-left"
                    >
                      {row.display_name}
                    </button>
                    <p className="text-[11px] text-[#94A3B8]">
                      {STAFF_ROLE_LABELS[row.role] ?? row.role} · {row.branch_name}
                    </p>
                  </div>
                  <NetChip amount={row.net_amount} />
                </div>
                <div className="mt-2.5 grid grid-cols-2 gap-2">
                  <div className="rounded-lg bg-[#F8FAFC] px-2 py-1.5">
                    <p className="text-[12px] font-bold text-[#0B1F3A]">{fmtEGP(row.basic_salary)}</p>
                    <p className="text-[10px] text-[#94A3B8]">Salary</p>
                  </div>
                  <div className="rounded-lg bg-[#F8FAFC] px-2 py-1.5">
                    <p className={`text-[12px] font-bold ${row.adj_net >= 0 ? "text-emerald-700" : "text-red-600"}`}>
                      {row.adj_net === 0 ? "—" : `${row.adj_net >= 0 ? "+" : ""}${fmtEGP(row.adj_net)}`}
                    </p>
                    <p className="text-[10px] text-[#94A3B8]">Adjustments</p>
                  </div>
                </div>
                <div className="mt-2.5 flex gap-1.5">
                  <button onClick={() => onAdjust(row)} className="flex-1 rounded-lg border border-[#E2E8F0] py-1.5 text-[11px] font-semibold text-[#0B1F3A]">+ Adjust</button>
                  <button onClick={() => onEdit(row)} className="flex-1 rounded-lg border border-[#E2E8F0] py-1.5 text-[11px] font-semibold text-[#64748B]">Edit</button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB: SUMMARY
// ═══════════════════════════════════════════════════════════════════════════════

function SummaryTab({
  summary, dateFrom, dateTo,
}: {
  summary: StaffFinanceSummary
  dateFrom: string
  dateTo: string
}) {
  return (
    <div className="space-y-4 max-w-2xl">
      <div className="rounded-xl border border-[#E2E8F0] bg-white p-5">
        <p className="text-[13px] font-semibold text-[#0B1F3A] mb-1">Period</p>
        <p className="text-[22px] font-extrabold text-[#0B1F3A]">
          {dateFrom} → {dateTo}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <SummaryCard label="Instructors" value={String(summary.instructor_count)} />
        <SummaryCard label="Staff"       value={String(summary.staff_count)} />
        <SummaryCard label="Session Earnings" value={fmtEGP(summary.total_session_earnings)} />
        <SummaryCard label="Staff Salaries"   value={fmtEGP(summary.total_staff_salaries)} />
        <SummaryCard label="Total Bonuses"    value={fmtEGP(summary.total_bonus)} color="emerald" />
        <SummaryCard label="Total Penalties"  value={fmtEGP(summary.total_penalty)} color="red" />
        <SummaryCard label="Total Advances"   value={fmtEGP(summary.total_advance)} color="amber" />
      </div>

      <div className="rounded-xl border border-[#FF8A1F]/30 bg-[#FFF7F0] p-4">
        <p className="text-[12px] font-semibold text-[#FF8A1F]">Total Net Payroll</p>
        <p className="text-[28px] font-extrabold text-[#0B1F3A] mt-1">{fmtEGP(summary.total_net)}</p>
        <p className="text-[11px] text-[#94A3B8] mt-0.5">{summary.currency} · {dateFrom} to {dateTo}</p>
      </div>
    </div>
  )
}

function SummaryCard({
  label, value, color,
}: {
  label: string
  value: string
  color?: "emerald" | "red" | "amber"
}) {
  const textCls = color === "emerald" ? "text-emerald-700" : color === "red" ? "text-red-600" : color === "amber" ? "text-amber-700" : "text-[#0B1F3A]"
  return (
    <div className="rounded-xl border border-[#E2E8F0] bg-white px-4 py-3">
      <p className={`text-[18px] font-extrabold ${textCls}`}>{value}</p>
      <p className="text-[11px] font-medium text-[#94A3B8] mt-0.5">{label}</p>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// DRAWER
// ═══════════════════════════════════════════════════════════════════════════════

function DrawerContent({
  drawer,
  onClose,
  onAdjust,
  onRemoveAdj,
  onPayInfo,
  onEditStaff,
}: {
  drawer: { kind: "instructor"; row: InstructorFinanceRow } | { kind: "staff"; row: StaffFinanceRow }
  onClose: () => void
  onAdjust: (kind: "instructor" | "staff", id: string, bId: string, name: string) => void
  onRemoveAdj: (id: string) => void
  onPayInfo: (row: InstructorFinanceRow) => void
  onEditStaff: (row: StaffFinanceRow) => void
}) {
  const isInstructor = drawer.kind === "instructor"
  const row          = drawer.row

  const adjList: FinanceAdjustment[] = isInstructor
    ? (row as InstructorFinanceRow).adjustments
    : (row as StaffFinanceRow).adjustments

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-[#E2E8F0]">
        <div className="flex items-center gap-3">
          <Avatar name={row.display_name} size="md" />
          <div>
            <p className="font-bold text-[#0B1F3A] text-[15px]">{row.display_name}</p>
            <p className="text-[11px] text-[#94A3B8]">
              {isInstructor
                ? `${(row as InstructorFinanceRow).branch_name} · Instructor`
                : `${(row as StaffFinanceRow).branch_name} · ${STAFF_ROLE_LABELS[(row as StaffFinanceRow).role] ?? (row as StaffFinanceRow).role}`
              }
            </p>
          </div>
        </div>
        <button onClick={onClose} className="text-[#94A3B8] hover:text-[#0B1F3A] transition">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
        {/* Earnings breakdown */}
        <div>
          <p className="text-[11px] font-bold text-[#94A3B8] uppercase tracking-wider mb-2.5">Earnings Breakdown</p>
          <div className="space-y-1.5">
            {isInstructor && (
              <>
                <DrawerRow label="Sessions" value={`${(row as InstructorFinanceRow).sessions_count} sessions × ${fmtEGP((row as InstructorFinanceRow).salary_per_session)}`} />
                <DrawerRow label="Session Earnings" value={fmtEGP((row as InstructorFinanceRow).session_earnings)} bold />
              </>
            )}
            {!isInstructor && (
              <DrawerRow label="Base Salary" value={fmtEGP((row as StaffFinanceRow).basic_salary)} bold />
            )}
            {adjList.length > 0 && (
              <DrawerRow
                label="Adjustments"
                value={`${row.adj_net >= 0 ? "+" : ""}${fmtEGP(row.adj_net)}`}
                cls={row.adj_net >= 0 ? "text-emerald-700 font-semibold" : "text-red-600 font-semibold"}
              />
            )}
            <div className="border-t border-[#E2E8F0] pt-2 mt-1">
              <DrawerRow label="Net Amount" value={fmtEGP(row.net_amount)} bold hi />
            </div>
          </div>
        </div>

        {/* Payment info */}
        <div>
          <p className="text-[11px] font-bold text-[#94A3B8] uppercase tracking-wider mb-2.5">Payment Info</p>
          <div className="space-y-1.5">
            {isInstructor ? (
              <>
                <DrawerRow
                  label="Method"
                  value={
                    (row as InstructorFinanceRow).payment_method
                      ? INSTRUCTOR_PAYMENT_METHOD_LABELS[(row as InstructorFinanceRow).payment_method!] ?? "—"
                      : "Not set"
                  }
                />
                {(row as InstructorFinanceRow).instapay_number && (
                  <DrawerRow label="Instapay" value={(row as InstructorFinanceRow).instapay_number!} />
                )}
                {(row as InstructorFinanceRow).payment_notes && (
                  <DrawerRow label="Notes" value={(row as InstructorFinanceRow).payment_notes!} />
                )}
              </>
            ) : (
              <>
                <DrawerRow label="Method" value={INSTRUCTOR_PAYMENT_METHOD_LABELS[(row as StaffFinanceRow).payment_method as keyof typeof INSTRUCTOR_PAYMENT_METHOD_LABELS] ?? (row as StaffFinanceRow).payment_method} />
                {(row as StaffFinanceRow).payment_reference && (
                  <DrawerRow label="Reference" value={(row as StaffFinanceRow).payment_reference!} />
                )}
              </>
            )}
          </div>
        </div>

        {/* Adjustments list */}
        <div>
          <div className="flex items-center justify-between mb-2.5">
            <p className="text-[11px] font-bold text-[#94A3B8] uppercase tracking-wider">
              Adjustments ({adjList.length})
            </p>
            <button
              onClick={() => {
                const id = isInstructor
                  ? (row as InstructorFinanceRow).instructor_id
                  : (row as StaffFinanceRow).profile_id
                onAdjust(drawer.kind, id, row.branch_id, row.display_name)
              }}
              className="text-[11px] font-semibold text-[#FF8A1F] hover:text-[#e07018] transition"
            >
              + Add
            </button>
          </div>
          {adjList.length === 0 ? (
            <p className="text-[12px] text-[#94A3B8] italic">No adjustments in this period.</p>
          ) : (
            <div className="space-y-1.5">
              {adjList.map(a => (
                <div key={a.id} className="flex items-center justify-between rounded-lg border border-[#E2E8F0] px-3 py-2">
                  <div className="flex items-center gap-2">
                    <AdjBadge type={a.type} amount={a.amount} />
                    {a.notes && <p className="text-[11px] text-[#64748B]">{a.notes}</p>}
                  </div>
                  <div className="flex items-center gap-2">
                    <p className="text-[10px] text-[#94A3B8]">{a.adjustment_date}</p>
                    <button
                      onClick={() => onRemoveAdj(a.id)}
                      className="text-[#CBD5E1] hover:text-red-400 transition"
                      title="Delete"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Footer actions */}
      <div className="border-t border-[#E2E8F0] px-5 py-3 flex gap-2">
        {isInstructor && (
          <button
            onClick={() => onPayInfo(row as InstructorFinanceRow)}
            className="flex-1 rounded-lg border border-[#E2E8F0] py-2 text-[12px] font-semibold text-[#0B1F3A] hover:bg-[#F8FAFC] transition"
          >
            Edit Payment Info
          </button>
        )}
        {!isInstructor && (
          <button
            onClick={() => onEditStaff(row as StaffFinanceRow)}
            className="flex-1 rounded-lg border border-[#E2E8F0] py-2 text-[12px] font-semibold text-[#0B1F3A] hover:bg-[#F8FAFC] transition"
          >
            Edit Profile
          </button>
        )}
      </div>
    </div>
  )
}

function DrawerRow({
  label, value, bold, hi, cls,
}: {
  label: string; value: string; bold?: boolean; hi?: boolean; cls?: string
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[12px] text-[#64748B]">{label}</span>
      <span className={`text-[12px] ${hi ? "text-[#FF8A1F] font-bold" : bold ? "font-semibold text-[#0B1F3A]" : "text-[#0B1F3A]"} ${cls ?? ""}`}>
        {value}
      </span>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// SHARED ATOMS
// ═══════════════════════════════════════════════════════════════════════════════

function Modal({
  onClose, title, children, wide,
}: {
  onClose: () => void
  title: string
  children: React.ReactNode
  wide?: boolean
}) {
  return (
    <>
      <motion.div
        key="modal-backdrop"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <motion.div
          key="modal-box"
          initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
          transition={{ duration: 0.18 }}
          className={`bg-white rounded-2xl shadow-2xl pointer-events-auto w-full ${wide ? "max-w-lg" : "max-w-sm"} max-h-[90vh] flex flex-col overflow-hidden`}
        >
          <div className="flex items-center justify-between px-5 py-4 border-b border-[#E2E8F0] shrink-0">
            <p className="font-bold text-[#0B1F3A] text-[15px]">{title}</p>
            <button onClick={onClose} className="text-[#94A3B8] hover:text-[#0B1F3A] transition">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="overflow-y-auto flex-1 px-5 py-4">
            {children}
          </div>
        </motion.div>
      </div>
    </>
  )
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-dashed border-[#E2E8F0] bg-white px-6 py-12 text-center">
      <p className="text-[13px] text-[#94A3B8]">{message}</p>
    </div>
  )
}
