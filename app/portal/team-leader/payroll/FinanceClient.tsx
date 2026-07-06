"use client"

import { useState, useEffect } from "react"
import { AnimatePresence, motion } from "framer-motion"
import {
  deleteFinanceAdjustmentAction,
  deleteStaffProfileAction,
} from "@/modules/staff-finance/actions"
import type {
  InstructorFinanceRow, StaffFinanceRow, StaffFinanceSummary,
} from "@/modules/staff-finance/types"
import { MONTHS, getMonthRange } from "@/modules/finance/shared/date"
import { filterBySearchText } from "@/modules/finance/shared/filters"
import { InstructorsTab } from "./workspace/components/InstructorsTab"
import { StaffTab } from "./workspace/components/StaffTab"
import { SummaryTab } from "./workspace/components/SummaryTab"
import { DrawerContent } from "./workspace/components/DrawerContent"
import { QuickActModal } from "./workspace/dialogs/QuickActModal"
import { QuickPayModal } from "./workspace/dialogs/QuickPayModal"
import { AdjustmentModal, type AdjTarget } from "./workspace/dialogs/AdjustmentModal"
import { InstructorPayInfoModal } from "./workspace/dialogs/InstructorPayInfoModal"
import { StaffFormModal } from "./workspace/dialogs/StaffFormModal"
import { InstructorDetailModal } from "./workspace/dialogs/InstructorDetailModal"
import { StaffDetailModal } from "./workspace/dialogs/StaffDetailModal"
import { useFinanceFilters } from "./workspace/hooks/useFinanceFilters"
import { TABS, type TabId } from "./workspace/types"

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
  const [activeTab,  setActiveTab]  = useState<TabId>((initialTab as TabId) ?? "instructors")

  const {
    dateFrom, setDateFrom,
    dateTo,   setDateTo,
    branchId, setBranchId,
    search,   setSearch,
    staffMonth, setStaffMonth,
    staffYear,  setStaffYear,
    navigate,
    applyDatePreset,
    applyFilters,
    applyStaffMonthFilter,
  } = useFinanceFilters({ initialDateFrom, initialDateTo, initialBranchId })

  const [instructors,  setInstructors]  = useState(initialInstructors)
  const [staff,        setStaff]        = useState(initialStaff)
  const [summary,      setSummary]      = useState(initialSummary)

  // Sync server-refreshed props into local state.
  // router.push() causes the Server Component to re-run and pass new props,
  // but useState ignores prop changes after mount — so we sync manually.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setInstructors(initialInstructors) }, [initialInstructors])
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setStaff(initialStaff)             }, [initialStaff])
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setSummary(initialSummary)         }, [initialSummary])

  // Staff detail modal
  const [staffDetailModal, setStaffDetailModal] = useState<StaffFinanceRow | null>(null)

  // ── Instructor detail modal (drill-down) ────────────────────────────────────
  const [detailModal, setDetailModal] = useState<InstructorFinanceRow | null>(null)

  // ── Drawer state (staff only) ────────────────────────────────────────────────
  const [drawer, setDrawer] = useState<
    | { kind: "instructor"; row: InstructorFinanceRow }
    | { kind: "staff"; row: StaffFinanceRow }
    | null
  >(null)

  // ── Adjustment modal state ──────────────────────────────────────────────────
  const [adjModal, setAdjModal] = useState<AdjTarget | null>(null)

  async function removeAdj(adjId: string) {
    await deleteFinanceAdjustmentAction(adjId)
    applyFilters()
  }

  // ── Payment info modal (instructor) ─────────────────────────────────────────
  const [payModal, setPayModal] = useState<InstructorFinanceRow | null>(null)

  function openPayModal(row: InstructorFinanceRow) {
    setPayModal(row)
  }

  // ── Staff modal (create/edit) ────────────────────────────────────────────────
  const [staffModal, setStaffModal] = useState<{
    mode: "create" | "edit"
    row?: StaffFinanceRow
  } | null>(null)

  // Quick Payment modal (per row in Staff Payroll tab)
  const [quickPayModal, setQuickPayModal] = useState<StaffFinanceRow | null>(null)

  // ── Quick Add Activity per row ──────────────────────────────────────────────
  const [quickActModal, setQuickActModal] = useState<StaffFinanceRow | null>(null)

  function openCreateStaff() {
    setStaffModal({ mode: "create" })
  }

  function openEditStaff(row: StaffFinanceRow) {
    setStaffModal({ mode: "edit", row })
  }

  async function deleteStaff(profileId: string) {
    if (!confirm("Remove this staff profile?")) return
    await deleteStaffProfileAction(profileId)
    applyFilters()
  }

  function openQuickAct(row: StaffFinanceRow) {
    setQuickActModal(row)
  }

  function openQuickPay(row: StaffFinanceRow) {
    setQuickPayModal(row)
  }

  // ── Filter bar ─────────────────────────────────────────────────────────────

  const filteredInstructors = filterBySearchText(instructors, search, r => r.display_name)
  const filteredStaff       = filterBySearchText(staff, search, r => r.display_name)

  // ══════════════════════════════════════════════════════════════════════════════
  return (
    <div className="min-h-screen bg-[#F8FAFC]">

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div className="bg-white border-b border-[#E2E8F0] px-4 md:px-6 py-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-2">
            {activeTab === "staff" && (
              <button
                onClick={openCreateStaff}
                className="flex items-center gap-1.5 rounded-lg bg-[#0B1F3A] px-3 py-2 text-[12px] font-semibold text-white hover:bg-[#1a2f4a] transition"
              >
                <span className="text-lg leading-none">+</span> Add Employee
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
                placeholder={`Search ${TABS.find(t => t.id === activeTab)?.label.toLowerCase() ?? activeTab}…`}
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
              setStaffDetailModal(null)
            }}
          />
        )}
      </AnimatePresence>

      {/* ── Quick Add Activity modal ─────────────────────────────────────────── */}
      <QuickActModal
        key={quickActModal?.profile_id ?? "none"}
        target={quickActModal}
        onClose={() => setQuickActModal(null)}
        onSuccess={() => { setQuickActModal(null); applyFilters() }}
      />

      {/* ── Adjustment modal ─────────────────────────────────────────────────── */}
      <AdjustmentModal
        key={adjModal ? `${adjModal.kind}-${adjModal.id}` : "none"}
        target={adjModal}
        onClose={() => setAdjModal(null)}
        onSuccess={() => { setAdjModal(null); applyFilters() }}
      />

      {/* ── Payment info modal ───────────────────────────────────────────────── */}
      <InstructorPayInfoModal
        key={payModal?.instructor_id ?? "none"}
        target={payModal}
        onClose={() => setPayModal(null)}
        onSuccess={() => { setPayModal(null); applyFilters() }}
      />

      {/* ── Quick Payment modal ─────────────────────────────────────────────── */}
      <QuickPayModal
        key={quickPayModal?.profile_id ?? "none"}
        target={quickPayModal}
        onClose={() => setQuickPayModal(null)}
        onSuccess={() => { setQuickPayModal(null); applyFilters() }}
      />

      {/* ── Staff create/edit modal ──────────────────────────────────────────── */}
      <StaffFormModal
        key={staffModal ? (staffModal.row?.profile_id ?? "create") : "none"}
        staffModal={staffModal}
        branches={branches}
        defaultBranchId={branchId}
        onClose={() => setStaffModal(null)}
        onSuccess={() => { setStaffModal(null); applyFilters() }}
        onDelete={(id) => deleteStaff(id)}
      />
    </div>
  )
}
