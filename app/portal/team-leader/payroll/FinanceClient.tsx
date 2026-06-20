"use client"

import { useState, useTransition, useCallback, useMemo, useEffect } from "react"
import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { AnimatePresence, motion } from "framer-motion"
import {
  addFinanceAdjustmentAction,
  deleteFinanceAdjustmentAction,
  updateInstructorPaymentInfoAction,
  upsertStaffProfileAction,
  updateEmploymentStatusAction,
  deleteStaffProfileAction,
  searchUsersForStaffAction,
  getInstructorSessionsDetailAction,
  upsertSessionRateOverrideAction,
  removeSessionRateOverrideAction,
  updateStaffNotesAction,
  updateStaffPaymentInfoAction,
  getStaffSessionsAction,
  addStaffSessionAction,
  updateStaffSessionAction,
  deleteStaffSessionAction,
  addStaffPaymentAction,
  deleteStaffPaymentAction,
  getStaffPaymentRecordsAction,
} from "@/modules/staff-finance/actions"
import type {
  InstructorFinanceRow, StaffFinanceRow, StaffFinanceSummary,
  FinanceAdjustment, FinanceAdjType, InstructorSessionDetail, StaffSession,
  EmploymentStatus, PaymentStatus,
} from "@/modules/staff-finance/types"
import {
  ADJ_LABELS, ADJ_SIGN, ADJ_COLOR,
  INSTRUCTOR_PAYMENT_METHOD_LABELS, STAFF_PAYMENT_METHOD_LABELS, STAFF_ROLE_LABELS,
  OVERRIDE_REASON_LABELS, STAFF_SESSION_ACTIVITY_LABELS, STAFF_ACTIVITY_OPTIONS,
  EMPLOYMENT_STATUS_LABELS, EMPLOYMENT_STATUS_COLORS,
  PAYMENT_STATUS_LABELS, PAYMENT_STATUS_COLORS,
  fmtEGP, fmtNum, computeAdjTotals, computeStaffNetAmount,
} from "@/modules/staff-finance/types"

// ── Constants ─────────────────────────────────────────────────────────────────

const TABS = [
  { id: "instructors", label: "Instructors" },
  { id: "staff",       label: "Staff"       },
  { id: "summary",     label: "Summary"     },
] as const

type TabId = typeof TABS[number]["id"]

const ADJ_TYPES: FinanceAdjType[] = [
  "bonus", "penalty", "advance", "purchase", "reimbursement", "other",
]

const MONTHS = [
  { value: 1,  label: "January"   }, { value: 2,  label: "February"  },
  { value: 3,  label: "March"     }, { value: 4,  label: "April"     },
  { value: 5,  label: "May"       }, { value: 6,  label: "June"      },
  { value: 7,  label: "July"      }, { value: 8,  label: "August"    },
  { value: 9,  label: "September" }, { value: 10, label: "October"   },
  { value: 11, label: "November"  }, { value: 12, label: "December"  },
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

// ── Date helpers ──────────────────────────────────────────────────────────────

function getMonthRange(month: number, year: number): { from: string; to: string } {
  const m   = String(month).padStart(2, "0")
  const last = new Date(year, month, 0).getDate()
  return {
    from: `${year}-${m}-01`,
    to:   `${year}-${m}-${String(last).padStart(2, "0")}`,
  }
}

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
  instructors:  initialInstructors,
  staff:        initialStaff,
  summary:      initialSummary,
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

  // Month/Year filter used by Staff + Summary tabs
  const [staffMonth, setStaffMonth] = useState(() => {
    const d = new Date(initialDateFrom)
    return isNaN(d.getTime()) ? new Date().getMonth() + 1 : d.getMonth() + 1
  })
  const [staffYear, setStaffYear] = useState(() => {
    const d = new Date(initialDateFrom)
    return isNaN(d.getTime()) ? new Date().getFullYear() : d.getFullYear()
  })

  const [instructors,  setInstructors]  = useState(initialInstructors)
  const [staff,        setStaff]        = useState(initialStaff)
  const [summary,      setSummary]      = useState(initialSummary)

  // Sync server-refreshed props into local state.
  // router.push() causes the Server Component to re-run and pass new props,
  // but useState ignores prop changes after mount — so we sync manually.
  useEffect(() => { setInstructors(initialInstructors) }, [initialInstructors])
  useEffect(() => { setStaff(initialStaff)             }, [initialStaff])
  useEffect(() => { setSummary(initialSummary)         }, [initialSummary])

  // Staff detail modal
  const [staffDetailModal, setStaffDetailModal] = useState<StaffFinanceRow | null>(null)

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

  function applyStaffMonthFilter(month: number, year: number) {
    const { from, to } = getMonthRange(month, year)
    setDateFrom(from)
    setDateTo(to)
    navigate({ date_from: from, date_to: to, branch: branchId })
  }

  // ── Instructor detail modal (drill-down) ────────────────────────────────────
  const [detailModal, setDetailModal] = useState<InstructorFinanceRow | null>(null)

  // ── Drawer state (staff only) ────────────────────────────────────────────────
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
  const [sfUserId,           setSfUserId]           = useState("")
  const [sfUserName,         setSfUserName]         = useState("")
  const [sfUserQ,            setSfUserQ]            = useState("")
  const [sfUserOpts,         setSfUserOpts]         = useState<{ user_id: string; display_name: string; email: string }[]>([])
  const [sfRole,             setSfRole]             = useState("coordinator")
  const [sfDept,             setSfDept]             = useState("")
  const [sfSalary,           setSfSalary]           = useState("")
  const [sfRate,             setSfRate]             = useState("")
  const [sfMethod,           setSfMethod]           = useState("cash")
  const [sfRef,              setSfRef]              = useState("")
  const [sfEmploymentStatus, setSfEmploymentStatus] = useState<EmploymentStatus>("active")
  const [sfWorksAllBranches, setSfWorksAllBranches] = useState(false)
  const [sfNotes,            setSfNotes]            = useState("")
  const [sfBusy,             setSfBusy]             = useState(false)
  const [sfErr,              setSfErr]              = useState("")
  // Branch for new staff — resolves UUID bug when branchId === "all"
  const [sfBranch,           setSfBranch]           = useState(() => branchId !== "all" ? branchId : branches[0]?.id ?? "")

  // Quick Payment modal (per row in Staff Payroll tab)
  const [quickPayModal, setQuickPayModal] = useState<StaffFinanceRow | null>(null)
  const [qpAmount,  setQpAmount]  = useState("")
  const [qpDate,    setQpDate]    = useState(new Date().toISOString().slice(0, 10))
  const [qpMethod,  setQpMethod]  = useState("cash")
  const [qpNotes,   setQpNotes]   = useState("")
  const [qpBusy,    setQpBusy]    = useState(false)
  const [qpErr,     setQpErr]     = useState("")

  // ── Quick Add Activity per row ──────────────────────────────────────────────
  const [quickActModal, setQuickActModal] = useState<StaffFinanceRow | null>(null)
  const [qaDate,    setQaDate]    = useState(new Date().toISOString().slice(0, 10))
  const [qaActivity,setQaActivity]= useState("teaching_session")
  const [qaDesc,    setQaDesc]    = useState("")
  const [qaRate,    setQaRate]    = useState("")
  const [qaQty,     setQaQty]     = useState("1")
  const [qaBusy,    setQaBusy]    = useState(false)
  const [qaErr,     setQaErr]     = useState("")

  function openCreateStaff() {
    setStaffModal({ mode: "create" })
    setSfUserId(""); setSfUserName(""); setSfUserQ("")
    setSfUserOpts([])
    setSfRole("coordinator"); setSfDept("")
    setSfSalary(""); setSfRate(""); setSfMethod("cash"); setSfRef("")
    setSfEmploymentStatus("active"); setSfWorksAllBranches(true)
    setSfNotes(""); setSfErr("")
    setSfBranch(branchId !== "all" ? branchId : branches[0]?.id ?? "")
  }

  function openEditStaff(row: StaffFinanceRow) {
    setStaffModal({ mode: "edit", row })
    setSfUserId(row.user_id); setSfUserName(row.display_name); setSfUserQ("")
    setSfRole(row.role); setSfDept(row.department ?? "")
    setSfSalary(String(row.basic_salary || "")); setSfRate(String(row.session_rate || ""))
    setSfMethod(row.payment_method); setSfRef(row.payment_reference ?? "")
    setSfEmploymentStatus(row.employment_status)
    setSfWorksAllBranches(row.works_all_branches)
    setSfNotes(row.notes ?? ""); setSfErr("")
    setSfBranch(row.branch_id)
  }

  async function searchUsers(q: string) {
    setSfUserQ(q)
    if (q.length < 2) { setSfUserOpts([]); return }
    // Use sfBranch (real UUID), not branchId which may be 'all'
    const res = await searchUsersForStaffAction(sfBranch, q)
    if (res.success) setSfUserOpts(res.data)
  }

  async function submitStaffProfile() {
    if (staffModal?.mode === "create" && !sfUserId) {
      setSfErr("Please select a user"); return
    }
    setSfBusy(true); setSfErr("")
    const result = await upsertStaffProfileAction({
      user_id:            staffModal?.mode === "create" ? sfUserId : (staffModal?.row?.user_id ?? ""),
      branch_id:          staffModal?.mode === "create" ? sfBranch : (staffModal?.row?.branch_id ?? sfBranch),
      role:               sfRole,
      department:         sfDept,
      payroll_type:       "mixed",
      basic_salary:       Number(sfSalary)  || 0,
      session_rate:       Number(sfRate)    || 0,
      payment_method:     sfMethod,
      payment_reference:  sfRef,
      employment_status:  sfEmploymentStatus,
      works_all_branches: sfWorksAllBranches,
      notes:              sfNotes,
    })
    setSfBusy(false)
    if (!result.success) { setSfErr(result.error.message); return }
    setStaffModal(null)
    applyFilters()
  }

  async function deleteStaff(profileId: string) {
    if (!confirm("Remove this staff profile?")) return
    await deleteStaffProfileAction(profileId)
    applyFilters()
  }

  function openQuickAct(row: StaffFinanceRow) {
    setQuickActModal(row)
    setQaDate(new Date().toISOString().slice(0, 10))
    setQaActivity("session")
    setQaDesc(""); setQaRate(String(row.session_rate || "")); setQaQty("1")
    setQaErr("")
  }

  async function submitQuickActivity() {
    if (!quickActModal) return
    const rate = Number(qaRate)
    const qty  = Number(qaQty)
    if (rate < 0) { setQaErr("Rate must be 0 or greater"); return }
    if (qty <= 0) { setQaErr("Quantity must be greater than 0"); return }
    setQaBusy(true); setQaErr("")
    const res = await addStaffSessionAction({
      staff_profile_id: quickActModal.profile_id,
      branch_id:        quickActModal.branch_id,
      session_date:     qaDate,
      activity_type:    qaActivity,
      description:      qaDesc,
      rate,
      quantity:         qty,
      notes:            "",
    })
    setQaBusy(false)
    if (!res.success) { setQaErr(res.error.message); return }
    setQuickActModal(null)
    applyFilters()
  }

  function openQuickPay(row: StaffFinanceRow) {
    setQuickPayModal(row)
    setQpAmount("")
    setQpDate(new Date().toISOString().slice(0, 10))
    setQpMethod(row.payment_method || "cash")
    setQpNotes(""); setQpErr("")
  }

  async function submitQuickPayment() {
    if (!quickPayModal) return
    const amount = Number(qpAmount)
    if (amount <= 0) { setQpErr("Amount must be greater than 0"); return }
    setQpBusy(true); setQpErr("")
    // Extract month/year from qpDate
    const [year, month] = qpDate.split("-").map(Number)
    const res = await addStaffPaymentAction({
      staff_profile_id: quickPayModal.profile_id,
      branch_id:        quickPayModal.branch_id,
      month,
      year,
      amount,
      payment_date:     qpDate,
      payment_method:   qpMethod,
      notes:            qpNotes,
    })
    setQpBusy(false)
    if (!res.success) { setQpErr(res.error.message); return }
    setQuickPayModal(null)
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
      <div className="bg-white border-b border-[#E2E8F0] px-4 md:px-6 py-3">
        <div className="flex flex-col md:flex-row md:items-center gap-2.5">

          {activeTab === "instructors" ? (
            <>
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
              <div className="flex items-center gap-1.5">
                <input
                  type="date"
                  value={dateFrom}
                  onChange={e => {
                    const v = e.target.value
                    setDateFrom(v)
                    if (v) navigate({ date_from: v, date_to: dateTo, branch: branchId })
                  }}
                  className="rounded-lg border border-[#E2E8F0] px-2.5 py-1.5 text-[12px] text-[#0B1F3A] focus:outline-none focus:ring-2 focus:ring-[#FF8A1F]/30"
                />
                <span className="text-[11px] text-[#94A3B8]">to</span>
                <input
                  type="date"
                  value={dateTo}
                  onChange={e => {
                    const v = e.target.value
                    setDateTo(v)
                    if (v) navigate({ date_from: dateFrom, date_to: v, branch: branchId })
                  }}
                  className="rounded-lg border border-[#E2E8F0] px-2.5 py-1.5 text-[12px] text-[#0B1F3A] focus:outline-none focus:ring-2 focus:ring-[#FF8A1F]/30"
                />
              </div>
            </>
          ) : (
            /* Month + Year picker for Staff and Summary tabs */
            <>
              <select
                value={staffMonth}
                onChange={e => {
                  const m = Number(e.target.value)
                  setStaffMonth(m)
                  applyStaffMonthFilter(m, staffYear)
                }}
                className="rounded-lg border border-[#E2E8F0] px-2.5 py-1.5 text-[12px] text-[#0B1F3A] focus:outline-none focus:ring-2 focus:ring-[#FF8A1F]/30"
              >
                {MONTHS.map(m => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
              <select
                value={staffYear}
                onChange={e => {
                  const y = Number(e.target.value)
                  setStaffYear(y)
                  applyStaffMonthFilter(staffMonth, y)
                }}
                className="rounded-lg border border-[#E2E8F0] px-2.5 py-1.5 text-[12px] text-[#0B1F3A] focus:outline-none focus:ring-2 focus:ring-[#FF8A1F]/30"
              >
                {[2024, 2025, 2026, 2027].map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </>
          )}

          {/* Branch — shown on all tabs */}
          {branches.length > 1 && (
            <select
              value={branchId}
              onChange={e => {
                setBranchId(e.target.value)
                if (activeTab === "instructors") {
                  navigate({ date_from: dateFrom, date_to: dateTo, branch: e.target.value })
                } else {
                  const { from, to } = getMonthRange(staffMonth, staffYear)
                  navigate({ date_from: from, date_to: to, branch: e.target.value })
                }
              }}
              className="rounded-lg border border-[#E2E8F0] px-2.5 py-1.5 text-[12px] text-[#0B1F3A] focus:outline-none focus:ring-2 focus:ring-[#FF8A1F]/30"
            >
              <option value="all">All Branches</option>
              {branches.map(b => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          )}

          {/* Search */}
          {activeTab !== "summary" && (
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
          )}
        </div>
      </div>

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
            onOpenDetail={(row) => setDetailModal(row)}
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
            onDelete={deleteStaff}
            onOpenDrawer={(row) => setDrawer({ kind: "staff", row })}
            onRemoveAdj={removeAdj}
            onOpenDetail={(row) => setStaffDetailModal(row)}
            onQuickAct={openQuickAct}
            onQuickPay={openQuickPay}
          />
        )}
        {activeTab === "summary" && (
          <SummaryTab
            summary={summary}
            dateFrom={dateFrom}
            dateTo={dateTo}
            monthLabel={`${MONTHS.find(m => m.value === staffMonth)?.label ?? ""} ${staffYear}`}
          />
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

      {/* ── Instructor Detail Modal ─────────────────────────────────────────── */}
      <AnimatePresence>
        {detailModal && (
          <InstructorDetailModal
            key={detailModal.instructor_id}
            row={detailModal}
            branchIds={branchIds}
            dateFrom={dateFrom}
            dateTo={dateTo}
            onClose={() => setDetailModal(null)}
            onRefresh={() => { setDetailModal(null); applyFilters() }}
          />
        )}
      </AnimatePresence>

      {/* ── Staff Detail Modal ───────────────────────────────────────────────── */}
      <AnimatePresence>
        {staffDetailModal && (
          <StaffDetailModal
            key={staffDetailModal.profile_id}
            row={staffDetailModal}
            dateFrom={dateFrom}
            dateTo={dateTo}
            onClose={() => setStaffDetailModal(null)}
            onRefresh={() => { setStaffDetailModal(null); applyFilters() }}
            onAdjust={() => {
              const row = staffDetailModal
              setAdjModal({ kind: "staff", id: row.profile_id, branchId: row.branch_id, name: row.display_name })
              setAdjType("bonus"); setAdjAmount(""); setAdjDate(new Date().toISOString().slice(0, 10)); setAdjNotes(""); setAdjErr("")
              setStaffDetailModal(null)
            }}
          />
        )}
      </AnimatePresence>

      {/* ── Quick Add Activity modal ─────────────────────────────────────────── */}
      <AnimatePresence>
        {quickActModal && (
          <Modal onClose={() => setQuickActModal(null)} title={`Add Activity — ${quickActModal.display_name}`}>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[12px] font-semibold text-[#0B1F3A]">Date</label>
                  <input type="date" value={qaDate} onChange={e => setQaDate(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-[#FF8A1F]/30" />
                </div>
                <div>
                  <label className="text-[12px] font-semibold text-[#0B1F3A]">Activity Type</label>
                  <select value={qaActivity} onChange={e => setQaActivity(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-[#FF8A1F]/30">
                    {STAFF_ACTIVITY_OPTIONS.map(o => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-[12px] font-semibold text-[#0B1F3A]">Description (optional)</label>
                <input value={qaDesc} onChange={e => setQaDesc(e.target.value)} placeholder="e.g. Group A camp, replace session…"
                  className="mt-1 w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-[#FF8A1F]/30" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[12px] font-semibold text-[#0B1F3A]">Rate (EGP)</label>
                  <input type="number" min="0" step="50" value={qaRate} onChange={e => setQaRate(e.target.value)} placeholder="0"
                    className="mt-1 w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-[#FF8A1F]/30" />
                </div>
                <div>
                  <label className="text-[12px] font-semibold text-[#0B1F3A]">Quantity</label>
                  <input type="number" min="0.5" step="0.5" value={qaQty} onChange={e => setQaQty(e.target.value)} placeholder="1"
                    className="mt-1 w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-[#FF8A1F]/30" />
                </div>
              </div>
              {Number(qaRate) > 0 && Number(qaQty) > 0 && (
                <p className="text-[11px] font-semibold text-emerald-700">
                  Total: {fmtEGP(Number(qaRate) * Number(qaQty))}
                </p>
              )}
              {qaErr && <p className="text-[12px] text-red-600">{qaErr}</p>}
              <div className="flex gap-2 pt-1">
                <button onClick={() => setQuickActModal(null)} className="flex-1 rounded-lg border border-[#E2E8F0] py-2 text-[13px] font-medium text-[#64748B] hover:bg-[#F8FAFC]">Cancel</button>
                <button onClick={submitQuickActivity} disabled={qaBusy} className="flex-1 rounded-lg bg-[#0B1F3A] py-2 text-[13px] font-semibold text-white hover:bg-[#1a2f4a] disabled:opacity-50">
                  {qaBusy ? "Saving…" : "Add Activity"}
                </button>
              </div>
            </div>
          </Modal>
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

      {/* ── Quick Payment modal ─────────────────────────────────────────────── */}
      <AnimatePresence>
        {quickPayModal && (
          <Modal onClose={() => setQuickPayModal(null)} title={`Record Payment — ${quickPayModal.display_name}`}>
            <div className="space-y-3">
              <div className="rounded-lg bg-[#F8FAFC] border border-[#E2E8F0] px-3 py-2 text-[12px]">
                <span className="text-[#64748B]">Net this month: </span>
                <span className="font-bold text-[#0B1F3A]">{fmtEGP(quickPayModal.net_amount)}</span>
                {quickPayModal.total_paid > 0 && (
                  <>
                    <span className="text-[#64748B] ml-3">Paid: </span>
                    <span className="font-semibold text-emerald-700">{fmtEGP(quickPayModal.total_paid)}</span>
                    <span className="text-[#64748B] ml-3">Remaining: </span>
                    <span className="font-semibold text-red-600">{fmtEGP(quickPayModal.remaining)}</span>
                  </>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[12px] font-semibold text-[#0B1F3A]">Amount (EGP)</label>
                  <input type="number" min="0" step="100" value={qpAmount} onChange={e => setQpAmount(e.target.value)} placeholder="0"
                    className="mt-1 w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-[#FF8A1F]/30" />
                </div>
                <div>
                  <label className="text-[12px] font-semibold text-[#0B1F3A]">Payment Date</label>
                  <input type="date" value={qpDate} onChange={e => setQpDate(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-[#FF8A1F]/30" />
                </div>
              </div>
              <div>
                <label className="text-[12px] font-semibold text-[#0B1F3A]">Method</label>
                <select value={qpMethod} onChange={e => setQpMethod(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-[#FF8A1F]/30">
                  {Object.entries(STAFF_PAYMENT_METHOD_LABELS).map(([v, l]) => (
                    <option key={v} value={v}>{l}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[12px] font-semibold text-[#0B1F3A]">Notes (optional)</label>
                <input value={qpNotes} onChange={e => setQpNotes(e.target.value)} placeholder="Reference, receipt no…"
                  className="mt-1 w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-[#FF8A1F]/30" />
              </div>
              {qpErr && <p className="text-[12px] text-red-600">{qpErr}</p>}
              <div className="flex gap-2 pt-1">
                <button onClick={() => setQuickPayModal(null)} className="flex-1 rounded-lg border border-[#E2E8F0] py-2 text-[13px] font-medium text-[#64748B] hover:bg-[#F8FAFC]">Cancel</button>
                <button onClick={submitQuickPayment} disabled={qpBusy} className="flex-1 rounded-lg bg-emerald-600 py-2 text-[13px] font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">
                  {qpBusy ? "Saving…" : "Record Payment"}
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

              {/* Branch selector — shown in both create and edit mode */}
              {branches.length > 0 && (
                <div>
                  <label className="text-[12px] font-semibold text-[#0B1F3A]">Branch</label>
                  <select
                    value={sfWorksAllBranches ? "__all__" : sfBranch}
                    onChange={e => {
                      if (e.target.value === "__all__") {
                        setSfWorksAllBranches(true)
                        // Keep sfBranch as the first real branch (required FK in DB)
                        if (!sfBranch) setSfBranch(branches[0]?.id ?? "")
                      } else {
                        setSfWorksAllBranches(false)
                        setSfBranch(e.target.value)
                      }
                    }}
                    className="mt-1 w-full rounded-lg border border-[#E2E8F0] px-2.5 py-2 text-[12px] focus:outline-none focus:ring-2 focus:ring-[#FF8A1F]/30"
                  >
                    <option value="__all__">🌐 All Branches</option>
                    {branches.map(b => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                  {sfWorksAllBranches && (
                    <p className="mt-1 text-[11px] text-[#64748B]">
                      Home branch: <span className="font-medium">{branches.find(b => b.id === sfBranch)?.name ?? "—"}</span>
                    </p>
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
                  <label className="text-[12px] font-semibold text-[#0B1F3A]">Department</label>
                  <input
                    value={sfDept}
                    onChange={e => setSfDept(e.target.value)}
                    placeholder="e.g. Operations, HR, Finance…"
                    className="mt-1 w-full rounded-lg border border-[#E2E8F0] px-2.5 py-2 text-[12px] focus:outline-none focus:ring-2 focus:ring-[#FF8A1F]/30"
                  />
                </div>
              </div>

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

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[12px] font-semibold text-[#0B1F3A]">Payment Method</label>
                  <select
                    value={sfMethod}
                    onChange={e => setSfMethod(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-[#E2E8F0] px-2.5 py-2 text-[12px] focus:outline-none focus:ring-2 focus:ring-[#FF8A1F]/30"
                  >
                    {Object.entries(STAFF_PAYMENT_METHOD_LABELS).map(([v, l]) => (
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

              <div>
                <label className="text-[12px] font-semibold text-[#0B1F3A]">Employment Status</label>
                <select
                  value={sfEmploymentStatus}
                  onChange={e => setSfEmploymentStatus(e.target.value as EmploymentStatus)}
                  className="mt-1 w-full rounded-lg border border-[#E2E8F0] px-2.5 py-2 text-[12px] focus:outline-none focus:ring-2 focus:ring-[#FF8A1F]/30"
                >
                  <option value="active">Active</option>
                  <option value="on_leave">On Leave</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>

              {sfErr && <p className="text-[12px] text-red-600">{sfErr}</p>}
              <div className="flex gap-2 pt-1">
                {staffModal.mode === "edit" && staffModal.row && (
                  <button
                    onClick={() => { setStaffModal(null); deleteStaff(staffModal.row!.profile_id) }}
                    disabled={sfBusy}
                    className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[12px] font-semibold text-red-600 hover:bg-red-100 transition disabled:opacity-50"
                  >
                    Delete
                  </button>
                )}
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
  onOpenDetail,
  onRemoveAdj,
}: {
  rows: InstructorFinanceRow[]
  onAdjust: (row: InstructorFinanceRow) => void
  onPayInfo: (row: InstructorFinanceRow) => void
  onOpenDrawer: (row: InstructorFinanceRow) => void
  onOpenDetail: (row: InstructorFinanceRow) => void
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
                            onClick={() => onOpenDetail(row)}
                            className="rounded-lg border border-[#FF8A1F]/40 bg-[#FFF7F0] px-2.5 py-1 text-[11px] font-semibold text-[#FF8A1F] hover:bg-[#FFE8CC] transition"
                          >
                            View
                          </button>
                          <button
                            onClick={() => onAdjust(row)}
                            className="rounded-lg border border-[#E2E8F0] px-2.5 py-1 text-[11px] font-medium text-[#0B1F3A] hover:bg-[#F8FAFC] transition"
                          >
                            + Adj
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
                  <button onClick={() => onOpenDetail(row)} className="flex-1 rounded-lg border border-[#FF8A1F]/40 bg-[#FFF7F0] py-1.5 text-[11px] font-semibold text-[#FF8A1F]">View</button>
                  <button onClick={() => onAdjust(row)} className="flex-1 rounded-lg border border-[#E2E8F0] py-1.5 text-[11px] font-semibold text-[#0B1F3A]">+ Adj</button>
                  <button onClick={() => onPayInfo(row)} className="flex-1 rounded-lg border border-[#E2E8F0] py-1.5 text-[11px] font-semibold text-[#64748B]">Edit</button>
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
  onDelete,
  onOpenDrawer,
  onRemoveAdj,
  onOpenDetail,
  onQuickAct,
  onQuickPay,
}: {
  rows: StaffFinanceRow[]
  onAdjust: (row: StaffFinanceRow) => void
  onEdit: (row: StaffFinanceRow) => void
  onDelete: (id: string) => void
  onOpenDrawer: (row: StaffFinanceRow) => void
  onRemoveAdj: (id: string) => void
  onOpenDetail: (row: StaffFinanceRow) => void
  onQuickAct: (row: StaffFinanceRow) => void
  onQuickPay: (row: StaffFinanceRow) => void
}) {
  const totalSalaries        = rows.reduce((s, r) => s + r.basic_salary, 0)
  const totalActivityEarnings= rows.reduce((s, r) => s + r.session_earnings, 0)
  const totalNet             = rows.reduce((s, r) => s + r.net_amount, 0)
  const totalPaid            = rows.reduce((s, r) => s + r.total_paid, 0)
  const totalRemaining       = rows.reduce((s, r) => s + r.remaining, 0)
  const totalActivities      = rows.reduce((s, r) => s + r.sessions_count, 0)

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
        {[
          { label: "Staff",             value: String(rows.length),           hi: false },
          { label: "Salaries",          value: fmtEGP(totalSalaries),         hi: false },
          { label: "Activities",        value: fmtEGP(totalActivityEarnings), hi: false },
          { label: "Net Total",         value: fmtEGP(totalNet),              hi: true  },
          { label: "Paid",              value: fmtEGP(totalPaid),             hi: false },
          { label: "Remaining",         value: fmtEGP(totalRemaining),        hi: false },
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
                    <th className="py-3 pl-4 pr-2 text-left font-semibold text-[#64748B]">Name</th>
                    <th className="py-3 px-2 text-left font-semibold text-[#64748B]">Role</th>
                    <th className="py-3 px-2 text-left font-semibold text-[#64748B]">Department</th>
                    <th className="py-3 px-2 text-left font-semibold text-[#64748B]">Branch</th>
                    <th className="py-3 px-2 text-right font-semibold text-[#64748B]">Basic Salary</th>
                    <th className="py-3 px-2 text-right font-semibold text-[#64748B]">Activities</th>
                    <th className="py-3 px-2 text-right font-semibold text-[#64748B]">Adjustments</th>
                    <th className="py-3 px-2 text-right font-semibold text-[#64748B]">Paid</th>
                    <th className="py-3 px-2 text-right font-semibold text-[#64748B]">Remaining</th>
                    <th className="py-3 px-2 text-right font-semibold text-[#64748B]">Net Total</th>
                    <th className="py-3 px-2 text-center font-semibold text-[#64748B]">Status</th>
                    <th className="py-3 px-4 text-right font-semibold text-[#64748B]">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(row => (
                    <tr key={row.profile_id} className={`border-b border-[#F1F5F9] hover:bg-[#F8FAFC] transition ${row.employment_status === "inactive" ? "opacity-50" : ""}`}>
                      <td className="py-3 pl-4 pr-2">
                        <div className="flex items-center gap-2.5">
                          <Avatar name={row.display_name} />
                          <button
                            onClick={() => onOpenDetail(row)}
                            className="font-semibold text-[#0B1F3A] hover:text-[#FF8A1F] transition text-left"
                          >
                            {row.display_name}
                          </button>
                        </div>
                      </td>
                      <td className="py-3 px-2">
                        <span className="rounded-full bg-[#F1F5F9] px-2 py-0.5 text-[10px] font-semibold text-[#64748B]">
                          {STAFF_ROLE_LABELS[row.role] ?? row.role}
                        </span>
                      </td>
                      <td className="py-3 px-2 text-[11px] text-[#64748B]">
                        {row.department ?? <span className="text-[#CBD5E1]">—</span>}
                      </td>
                      <td className="py-3 px-2 text-[11px] text-[#64748B]">
                        {row.works_all_branches ? "All Branches" : row.branch_name}
                      </td>
                      <td className="py-3 px-2 text-right font-medium text-[#0B1F3A]">
                        {row.basic_salary > 0 ? fmtEGP(row.basic_salary) : <span className="text-[#CBD5E1]">—</span>}
                      </td>
                      <td className="py-3 px-2 text-right">
                        {row.session_earnings > 0 ? (
                          <span className="font-medium text-[#0B1F3A]">{fmtEGP(row.session_earnings)}</span>
                        ) : (
                          <span className="text-[#CBD5E1]">—</span>
                        )}
                      </td>
                      <td className="py-3 px-2 text-right">
                        {row.adjustments.length === 0 ? (
                          <span className="text-[#94A3B8]">—</span>
                        ) : (
                          <span className={`font-semibold ${row.adj_net >= 0 ? "text-emerald-700" : "text-red-600"}`}>
                            {row.adj_net >= 0 ? "+" : ""}{fmtEGP(row.adj_net)}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-2 text-right font-medium text-emerald-700">
                        {row.total_paid > 0 ? fmtEGP(row.total_paid) : <span className="text-[#CBD5E1]">—</span>}
                      </td>
                      <td className="py-3 px-2 text-right">
                        {row.remaining > 0 ? (
                          <span className="font-medium text-red-600">{fmtEGP(row.remaining)}</span>
                        ) : (
                          <span className="text-[#CBD5E1]">—</span>
                        )}
                      </td>
                      <td className="py-3 px-2 text-right"><NetChip amount={row.net_amount} /></td>
                      <td className="py-3 px-2 text-center">
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${PAYMENT_STATUS_COLORS[row.payment_status]}`}>
                          {PAYMENT_STATUS_LABELS[row.payment_status]}
                        </span>
                      </td>
                      <td className="py-3 pl-2 pr-4">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => onOpenDetail(row)}
                            className="rounded-lg border border-[#FF8A1F]/40 bg-[#FFF7F0] px-2.5 py-1 text-[11px] font-semibold text-[#FF8A1F] hover:bg-[#FFE8CC] transition"
                          >
                            View
                          </button>
                          <button
                            onClick={() => onQuickPay(row)}
                            className="rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 hover:bg-emerald-100 transition"
                          >
                            + Pay
                          </button>
                          <button onClick={() => onEdit(row)} className="rounded-lg border border-[#E2E8F0] px-2.5 py-1 text-[11px] font-medium text-[#64748B] hover:bg-[#F8FAFC]">Edit</button>
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
              <div key={row.profile_id} className={`rounded-xl border border-[#E2E8F0] bg-white p-3.5 ${row.employment_status === "inactive" ? "opacity-60" : ""}`}>
                <div className="flex items-start gap-2.5">
                  <Avatar name={row.display_name} />
                  <div className="flex-1 min-w-0">
                    <button
                      onClick={() => onOpenDetail(row)}
                      className="font-semibold text-[#0B1F3A] hover:text-[#FF8A1F] text-[13px] transition text-left"
                    >
                      {row.display_name}
                    </button>
                    <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                      <span className="text-[11px] text-[#94A3B8]">{STAFF_ROLE_LABELS[row.role] ?? row.role} · {row.branch_name}</span>
                      <span className={`rounded-full px-1.5 py-0 text-[10px] font-semibold ${PAYMENT_STATUS_COLORS[row.payment_status]}`}>
                        {PAYMENT_STATUS_LABELS[row.payment_status]}
                      </span>
                    </div>
                  </div>
                  <NetChip amount={row.net_amount} />
                </div>
                <div className="mt-2.5 grid grid-cols-3 gap-2">
                  <div className="rounded-lg bg-[#F8FAFC] px-2 py-1.5">
                    <p className="text-[12px] font-bold text-[#0B1F3A]">
                      {row.basic_salary > 0 ? fmtEGP(row.basic_salary) : "—"}
                    </p>
                    <p className="text-[10px] text-[#94A3B8]">Salary</p>
                  </div>
                  <div className="rounded-lg bg-[#F8FAFC] px-2 py-1.5">
                    <p className="text-[12px] font-bold text-emerald-700">
                      {row.total_paid > 0 ? fmtEGP(row.total_paid) : "—"}
                    </p>
                    <p className="text-[10px] text-[#94A3B8]">Paid</p>
                  </div>
                  <div className="rounded-lg bg-[#F8FAFC] px-2 py-1.5">
                    <p className={`text-[12px] font-bold ${row.remaining > 0 ? "text-red-600" : "text-[#CBD5E1]"}`}>
                      {row.remaining > 0 ? fmtEGP(row.remaining) : "—"}
                    </p>
                    <p className="text-[10px] text-[#94A3B8]">Remaining</p>
                  </div>
                </div>
                <div className="mt-2.5 flex gap-1.5">
                  <button onClick={() => onOpenDetail(row)} className="flex-1 rounded-lg border border-[#FF8A1F]/40 bg-[#FFF7F0] py-1.5 text-[11px] font-semibold text-[#FF8A1F]">View</button>
                  <button onClick={() => onQuickPay(row)} className="flex-1 rounded-lg border border-emerald-200 bg-emerald-50 py-1.5 text-[11px] font-semibold text-emerald-700">+ Pay</button>
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
  summary, dateFrom, dateTo, monthLabel,
}: {
  summary: StaffFinanceSummary
  dateFrom: string
  dateTo: string
  monthLabel: string
}) {
  return (
    <div className="space-y-4 max-w-2xl">
      <div className="rounded-xl border border-[#E2E8F0] bg-white p-5">
        <p className="text-[13px] font-semibold text-[#0B1F3A] mb-1">Period</p>
        <p className="text-[22px] font-extrabold text-[#0B1F3A]">{monthLabel}</p>
        <p className="text-[11px] text-[#94A3B8] mt-1">{dateFrom} → {dateTo}</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <SummaryCard label="Instructors"           value={String(summary.instructor_count)} />
        <SummaryCard label="Staff"                 value={String(summary.staff_count)} />
        <SummaryCard label="Instructor Sessions"   value={fmtEGP(summary.total_session_earnings)} />
        <SummaryCard label="Staff Salaries"        value={fmtEGP(summary.total_staff_salaries)} />
        <SummaryCard label="Staff Sessions"        value={fmtEGP(summary.total_staff_session_earnings)} />
        <SummaryCard label="Total Bonuses"         value={fmtEGP(summary.total_bonus)} color="emerald" />
        <SummaryCard label="Total Penalties"       value={fmtEGP(summary.total_penalty)} color="red" />
        <SummaryCard label="Total Advances"        value={fmtEGP(summary.total_advance)} color="amber" />
      </div>

      <div className="rounded-xl border border-[#FF8A1F]/30 bg-[#FFF7F0] p-4">
        <p className="text-[12px] font-semibold text-[#FF8A1F]">Grand Total Net Payroll</p>
        <p className="text-[28px] font-extrabold text-[#0B1F3A] mt-1">{fmtEGP(summary.total_net)}</p>
        <p className="text-[11px] text-[#94A3B8] mt-0.5">{summary.currency} · {monthLabel}</p>
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
                <DrawerRow label="Method" value={STAFF_PAYMENT_METHOD_LABELS[(row as StaffFinanceRow).payment_method] ?? (row as StaffFinanceRow).payment_method} />
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

// ═══════════════════════════════════════════════════════════════════════════════
// INSTRUCTOR DETAIL MODAL — 6 tabs: Overview / Sessions / Adjustments /
//                                    Payments / History / Notes
// ═══════════════════════════════════════════════════════════════════════════════

const DETAIL_TABS = [
  { id: "overview",     label: "Overview" },
  { id: "sessions",     label: "Sessions" },
  { id: "adjustments",  label: "Adjustments" },
  { id: "payments",     label: "Payments" },
  { id: "history",      label: "History" },
  { id: "notes",        label: "Notes" },
] as const

type DetailTabId = typeof DETAIL_TABS[number]["id"]

function InstructorDetailModal({
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
  const [payRef,    setPayRef]    = useState(row.instapay_number ?? "")
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
    setPayBusy(true); setPayErr(""); setPayOk(false)
    const res = await updateInstructorPaymentInfoAction({
      instructor_id: row.instructor_id,
      salary_per_session: payRate ? Number(payRate) : null,
      payment_method: payMethod || null,
      instapay_number: payRef || null,
      payment_notes: payNotes || null,
    })
    setPayBusy(false)
    if (!res.success) { setPayErr(res.error.message); return }
    setPayOk(true)
    onRefresh()
  }

  async function saveNotes() {
    setNotesBusy(true); setNotesOk(false)
    const res = await updateInstructorPaymentInfoAction({
      instructor_id: row.instructor_id,
      salary_per_session: row.salary_per_session || null,
      payment_method: row.payment_method || null,
      instapay_number: row.instapay_number || null,
      payment_notes: notesText || null,
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
                <div className="rounded-xl border border-[#E2E8F0] bg-white overflow-hidden">
                  <div className="bg-[#F8FAFC] border-b border-[#E2E8F0] px-4 py-2.5">
                    <p className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider">Earnings Breakdown</p>
                  </div>
                  <div className="px-4 py-3 space-y-2">
                    <ModalRow label="Session Earnings" value={`${row.sessions_count} sessions × ${fmtEGP(row.salary_per_session)}`} right={fmtEGP(row.session_earnings)} />
                    {row.bonus_total > 0    && <ModalRow label="Bonuses"    right={`+${fmtEGP(row.bonus_total)}`}    rightCls="text-emerald-700 font-semibold" />}
                    {row.penalty_total > 0  && <ModalRow label="Penalties"  right={`−${fmtEGP(row.penalty_total)}`}  rightCls="text-red-600 font-semibold" />}
                    {row.advance_total > 0  && <ModalRow label="Advances"   right={`−${fmtEGP(row.advance_total)}`}  rightCls="text-amber-700 font-semibold" />}
                    {row.purchase_total > 0 && <ModalRow label="Purchases"  right={`−${fmtEGP(row.purchase_total)}`} rightCls="text-orange-700 font-semibold" />}
                    {row.other_total > 0    && <ModalRow label="Other"      right={`+${fmtEGP(row.other_total)}`}    rightCls="text-slate-700 font-semibold" />}
                    <div className="border-t border-[#E2E8F0] pt-2">
                      <ModalRow label="Net Amount" right={fmtEGP(row.net_amount)} rightCls="text-[#FF8A1F] font-extrabold text-[14px]" />
                    </div>
                  </div>
                </div>

                {/* Payment info */}
                <div className="rounded-xl border border-[#E2E8F0] bg-white overflow-hidden">
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
                    {row.instapay_number && <ModalRow label="Reference" right={row.instapay_number} />}
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
                              className="mt-1 w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-[12px] focus:outline-none focus:ring-2 focus:ring-[#FF8A1F]/30" />
                          </div>
                        </div>
                        <div>
                          <label className="text-[11px] font-semibold text-[#0B1F3A]">Reason</label>
                          <select value={editRateReason} onChange={e => setEditRateReason(e.target.value)}
                            className="mt-1 w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-[12px] focus:outline-none focus:ring-2 focus:ring-[#FF8A1F]/30">
                            {(Object.entries(OVERRIDE_REASON_LABELS) as [string, string][]).map(([k, v]) => (
                              <option key={k} value={k}>{v}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="text-[11px] font-semibold text-[#0B1F3A]">Notes (optional)</label>
                          <input type="text" value={editRateNotes} onChange={e => setEditRateNotes(e.target.value)}
                            placeholder="e.g. online group contract"
                            className="mt-1 w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-[12px] focus:outline-none focus:ring-2 focus:ring-[#FF8A1F]/30" />
                        </div>
                        {editRateErr && <p className="text-[11px] text-red-600">{editRateErr}</p>}
                        <div className="flex gap-2 pt-1">
                          <button onClick={saveEditRate} disabled={editRateBusy}
                            className="flex-1 rounded-lg bg-[#FF8A1F] py-2 text-[12px] font-bold text-white hover:bg-[#E07718] disabled:opacity-50 transition">
                            {editRateBusy ? "Saving…" : "Save Override"}
                          </button>
                          {editRateSession.override_id && (
                            <button onClick={() => handleRemoveOverride(editRateSession!)} disabled={editRateBusy}
                              className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[11px] font-semibold text-red-600 hover:bg-red-100 transition">
                              Remove Override
                            </button>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Session table – desktop */}
                    <div className="hidden md:block rounded-xl border border-[#E2E8F0] bg-white overflow-x-auto">
                      <table className="w-full text-[12px] min-w-[900px]">
                        <thead className="bg-[#F8FAFC] border-b border-[#E2E8F0]">
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
                                    <span className={`font-semibold ${s.attendance_pct >= 75 ? "text-emerald-700" : s.attendance_pct >= 50 ? "text-amber-700" : "text-red-600"}`}>
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
                        <div key={s.schedule_id} className="rounded-xl border border-[#E2E8F0] bg-white p-3">
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
                              <span className={`text-[11px] font-semibold ${s.attendance_pct >= 75 ? "text-emerald-700" : s.attendance_pct >= 50 ? "text-amber-700" : "text-red-600"}`}>
                                {s.attendance_pct}%
                              </span>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Group summary */}
                    {groupSummary.length > 1 && (
                      <div className="rounded-xl border border-[#E2E8F0] bg-white overflow-hidden">
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
                  <div className="rounded-xl border border-[#E2E8F0] bg-white p-4 space-y-3">
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
                    {adjErr && <p className="text-[12px] text-red-600">{adjErr}</p>}
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
                      <div key={a.id} className="flex items-center gap-3 rounded-xl border border-[#E2E8F0] bg-white px-4 py-3">
                        <AdjBadge type={a.type} amount={a.amount} />
                        <div className="flex-1 min-w-0">
                          {a.notes && <p className="text-[12px] text-[#0B1F3A] truncate">{a.notes}</p>}
                          <p className="text-[11px] text-[#94A3B8]">{a.adjustment_date}</p>
                        </div>
                        <p className={`text-[13px] font-bold shrink-0 ${ADJ_SIGN[a.type] === 1 ? "text-emerald-700" : "text-red-600"}`}>
                          {ADJ_SIGN[a.type] === 1 ? "+" : "−"}{fmtEGP(a.amount)}
                        </p>
                        <button onClick={() => removeAdj(a.id)} className="text-[#CBD5E1] hover:text-red-400 transition shrink-0">
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
                <div className="rounded-xl border border-[#E2E8F0] bg-white p-4 space-y-3">
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
                  <div>
                    <label className="text-[11px] font-semibold text-[#0B1F3A]">
                      {payMethod === "instapay" ? "Instapay Number" : "Payment Reference"}
                    </label>
                    <input value={payRef} onChange={e => setPayRef(e.target.value)} placeholder="Account / phone / IBAN"
                      className="mt-1 w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-[#FF8A1F]/30" />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-[#0B1F3A]">Notes</label>
                    <textarea rows={2} value={payNotes} onChange={e => setPayNotes(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-[#FF8A1F]/30 resize-none" />
                  </div>
                  {payErr && <p className="text-[12px] text-red-600">{payErr}</p>}
                  {payOk  && <p className="text-[12px] text-emerald-600 font-semibold">✓ Saved successfully</p>}
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
                  <ModalRow label="Adjustments"    right={`${row.adj_net >= 0 ? "+" : ""}${fmtEGP(row.adj_net)}`} rightCls={row.adj_net >= 0 ? "text-emerald-700 font-semibold" : "text-red-600 font-semibold"} />
                  <div className="border-t border-[#E2E8F0] pt-2">
                    <ModalRow label="Net Amount" right={fmtEGP(row.net_amount)} rightCls="text-[#FF8A1F] font-extrabold" />
                  </div>
                </div>
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
                  <div className="rounded-xl border border-[#E2E8F0] bg-white overflow-hidden">
                    <table className="w-full text-[12px]">
                      <thead className="bg-[#F8FAFC] border-b border-[#E2E8F0]">
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
                                <span className={h.adj >= 0 ? "text-emerald-700 font-semibold" : "text-red-600 font-semibold"}>
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
                <div className="rounded-xl border border-[#E2E8F0] bg-white p-4 space-y-3">
                  <p className="text-[13px] font-bold text-[#0B1F3A]">Notes</p>
                  <p className="text-[11px] text-[#94A3B8]">Visible to team leaders and admins only.</p>
                  <textarea
                    rows={6}
                    value={notesText}
                    onChange={e => setNotesText(e.target.value)}
                    placeholder="Add notes about this instructor's payroll, payment preferences, or any relevant information…"
                    className="w-full rounded-lg border border-[#E2E8F0] px-3 py-2.5 text-[13px] text-[#0B1F3A] focus:outline-none focus:ring-2 focus:ring-[#FF8A1F]/30 resize-none"
                  />
                  {notesOk && <p className="text-[12px] text-emerald-600 font-semibold">✓ Notes saved</p>}
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

// ═══════════════════════════════════════════════════════════════════════════════
// STAFF DETAIL MODAL — 6 tabs: Overview / Sessions / Adjustments /
//                               Payments / History / Notes
// ═══════════════════════════════════════════════════════════════════════════════

const STAFF_DETAIL_TABS = [
  { id: "overview",    label: "Overview"    },
  { id: "sessions",    label: "Activities"  },
  { id: "adjustments", label: "Adjustments" },
  { id: "payments",    label: "Payments"    },
  { id: "notes",       label: "Notes"       },
] as const

type StaffDetailTabId = typeof STAFF_DETAIL_TABS[number]["id"]

function StaffDetailModal({
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
                  ].map((k: any) => (
                    <div key={k.label} className={`rounded-xl border px-3 py-2.5 ${k.hi ? "border-[#FF8A1F]/30 bg-[#FFF7F0]" : "border-[#E2E8F0] bg-white"}`}>
                      <p className={`text-[14px] font-extrabold ${k.hi ? "text-[#FF8A1F]" : "text-[#0B1F3A]"}`}>{k.value}</p>
                      <p className="text-[10px] font-medium text-[#94A3B8] mt-0.5">{k.label}</p>
                    </div>
                  ))}
                </div>

                <div className="rounded-xl border border-[#E2E8F0] bg-white overflow-hidden">
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
                    {row.bonus_total > 0    && <ModalRow label="Bonuses"   right={`+${fmtEGP(row.bonus_total)}`}    rightCls="text-emerald-700 font-semibold" />}
                    {row.penalty_total > 0  && <ModalRow label="Penalties" right={`−${fmtEGP(row.penalty_total)}`}  rightCls="text-red-600 font-semibold" />}
                    {row.advance_total > 0  && <ModalRow label="Advances"  right={`−${fmtEGP(row.advance_total)}`}  rightCls="text-amber-700 font-semibold" />}
                    {row.purchase_total > 0 && <ModalRow label="Purchases" right={`−${fmtEGP(row.purchase_total)}`} rightCls="text-orange-700 font-semibold" />}
                    <div className="border-t border-[#E2E8F0] pt-2">
                      <ModalRow label="Net Amount" right={fmtEGP(liveNet)} rightCls="text-[#FF8A1F] font-extrabold text-[14px]" />
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border border-[#E2E8F0] bg-white overflow-hidden">
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
                  <div className="rounded-xl border border-[#E2E8F0] bg-white p-4 space-y-3">
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
                      <p className="text-[11px] font-semibold text-emerald-700">
                        Amount: {fmtEGP(Number(ssRate) * Number(ssQty))}
                      </p>
                    )}
                    {ssErr && <p className="text-[11px] text-red-600">{ssErr}</p>}
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
                          className="mt-1 w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-[12px] focus:outline-none focus:ring-2 focus:ring-[#FF8A1F]/30" />
                      </div>
                      <div>
                        <label className="text-[11px] font-semibold text-[#0B1F3A]">Activity Type</label>
                        <select value={esActivity} onChange={e => setEsActivity(e.target.value)}
                          className="mt-1 w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-[12px] focus:outline-none focus:ring-2 focus:ring-[#FF8A1F]/30">
                          {STAFF_ACTIVITY_OPTIONS.map(o => (
                            <option key={o.value} value={o.value}>{o.label}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-[#0B1F3A]">Description</label>
                      <input value={esDesc} onChange={e => setEsDesc(e.target.value)} placeholder="Optional…"
                        className="mt-1 w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-[12px] focus:outline-none focus:ring-2 focus:ring-[#FF8A1F]/30" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[11px] font-semibold text-[#0B1F3A]">Rate (EGP)</label>
                        <input type="number" min="0" step="50" value={esRate} onChange={e => setEsRate(e.target.value)}
                          className="mt-1 w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-[12px] focus:outline-none focus:ring-2 focus:ring-[#FF8A1F]/30" />
                      </div>
                      <div>
                        <label className="text-[11px] font-semibold text-[#0B1F3A]">Quantity</label>
                        <input type="number" min="0.5" step="0.5" value={esQty} onChange={e => setEsQty(e.target.value)}
                          className="mt-1 w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-[12px] focus:outline-none focus:ring-2 focus:ring-[#FF8A1F]/30" />
                      </div>
                    </div>
                    {Number(esRate) > 0 && Number(esQty) > 0 && (
                      <p className="text-[11px] font-semibold text-emerald-700">Amount: {fmtEGP(Number(esRate) * Number(esQty))}</p>
                    )}
                    {esErr && <p className="text-[11px] text-red-600">{esErr}</p>}
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
                    <div className="hidden md:block rounded-xl border border-[#E2E8F0] bg-white overflow-hidden">
                      <table className="w-full text-[12px]">
                        <thead className="bg-[#F8FAFC] border-b border-[#E2E8F0]">
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
                                    className="rounded-lg bg-red-50 px-2 py-1 text-[11px] font-semibold text-red-500 hover:bg-red-100 transition">
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
                        <div key={s.id} className="rounded-xl border border-[#E2E8F0] bg-white p-3">
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
                                <button onClick={() => handleDeleteSession(s.id)} className="rounded-lg bg-red-50 px-2 py-0.5 text-[10px] font-semibold text-red-500">✕</button>
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
                  <div className="rounded-xl border border-[#E2E8F0] bg-white p-4 space-y-3">
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
                    {adjErr && <p className="text-[12px] text-red-600">{adjErr}</p>}
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
                      <div key={a.id} className="flex items-center gap-3 rounded-xl border border-[#E2E8F0] bg-white px-4 py-3">
                        <AdjBadge type={a.type} amount={a.amount} />
                        <div className="flex-1 min-w-0">
                          {a.notes && <p className="text-[12px] text-[#0B1F3A] truncate">{a.notes}</p>}
                          <p className="text-[11px] text-[#94A3B8]">{a.adjustment_date}</p>
                        </div>
                        <p className={`text-[13px] font-bold shrink-0 ${ADJ_SIGN[a.type] === 1 ? "text-emerald-700" : "text-red-600"}`}>
                          {ADJ_SIGN[a.type] === 1 ? "+" : "−"}{fmtEGP(a.amount)}
                        </p>
                        <button onClick={() => removeAdj(a.id)} className="text-[#CBD5E1] hover:text-red-400 transition shrink-0">
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
                <div className="rounded-xl border border-[#E2E8F0] bg-white p-4 space-y-3">
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
                  {payErr && <p className="text-[12px] text-red-600">{payErr}</p>}
                  {payOk  && <p className="text-[12px] text-emerald-600 font-semibold">✓ Saved successfully</p>}
                  <button onClick={submitPayment} disabled={payBusy} className="w-full rounded-lg bg-[#0B1F3A] py-2.5 text-[13px] font-semibold text-white disabled:opacity-50 hover:bg-[#1a2f4a] transition">
                    {payBusy ? "Saving…" : "Save Payment Info"}
                  </button>
                </div>

                <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-4 space-y-2">
                  <p className="text-[11px] font-bold text-[#94A3B8] uppercase tracking-wider">Current Payroll Summary</p>
                  <ModalRow label="Base Salary"        right={fmtEGP(row.basic_salary)} />
                  <ModalRow label="Activity Earnings"  right={fmtEGP(liveSessionEarnings)} />
                  <ModalRow label="Adjustments" right={`${row.adj_net >= 0 ? "+" : ""}${fmtEGP(row.adj_net)}`} rightCls={row.adj_net >= 0 ? "text-emerald-700 font-semibold" : "text-red-600 font-semibold"} />
                  <div className="border-t border-[#E2E8F0] pt-2">
                    <ModalRow label="Net Amount" right={fmtEGP(liveNet)} rightCls="text-[#FF8A1F] font-extrabold" />
                  </div>
                </div>
              </div>
            )}

            {/* ── NOTES ── */}
            {tab === "notes" && (
              <div className="p-5 space-y-4 max-w-md">
                <div className="rounded-xl border border-[#E2E8F0] bg-white p-4 space-y-3">
                  <p className="text-[13px] font-bold text-[#0B1F3A]">Notes</p>
                  <p className="text-[11px] text-[#94A3B8]">Visible to team leaders and admins only.</p>
                  <textarea
                    rows={6}
                    value={notesText}
                    onChange={e => setNotesText(e.target.value)}
                    placeholder="Add notes about this staff member's payroll, payment preferences, or any relevant information…"
                    className="w-full rounded-lg border border-[#E2E8F0] px-3 py-2.5 text-[13px] text-[#0B1F3A] focus:outline-none focus:ring-2 focus:ring-[#FF8A1F]/30 resize-none"
                  />
                  {notesOk && <p className="text-[12px] text-emerald-600 font-semibold">✓ Notes saved</p>}
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

// ── Modal helper rows ─────────────────────────────────────────────────────────

function ModalRow({ label, value, right, rightCls }: { label: string; value?: string; right?: string; rightCls?: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[12px] text-[#64748B]">{label}</span>
      <span className={`text-[12px] text-[#0B1F3A] ${rightCls ?? ""}`}>{right ?? value ?? "—"}</span>
    </div>
  )
}

// ── Loading spinner ───────────────────────────────────────────────────────────

function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center py-16">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#E2E8F0] border-t-[#FF8A1F]" />
    </div>
  )
}
