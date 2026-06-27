"use client"

import { useState } from "react"
import { AnimatePresence } from "framer-motion"
import {
  upsertStaffProfileAction,
  deleteStaffProfileAction,
  searchUsersForStaffAction,
} from "@/modules/staff-finance/actions"
import type { StaffFinanceRow, EmploymentStatus } from "@/modules/staff-finance/types"
import { STAFF_ROLE_LABELS, STAFF_PAYMENT_METHOD_LABELS } from "@/modules/staff-finance/types"
import { Modal } from "../components/Modal"
import { Avatar } from "../components/Avatar"
import { ROLE_OPTIONS } from "../types"

interface Props {
  staffModal: { mode: "create" | "edit"; row?: StaffFinanceRow } | null
  branches: { id: string; name: string }[]
  defaultBranchId: string
  onClose: () => void
  onSuccess: () => void
  onDelete: (id: string) => void
}

export function StaffFormModal({
  staffModal,
  branches,
  defaultBranchId,
  onClose,
  onSuccess,
  onDelete,
}: Props) {
  const row = staffModal?.row

  const [sfUserId,           setSfUserId]           = useState(row?.user_id ?? "")
  const [sfUserName,         setSfUserName]         = useState(row?.display_name ?? "")
  const [sfUserQ,            setSfUserQ]            = useState("")
  const [sfUserOpts,         setSfUserOpts]         = useState<{ user_id: string; display_name: string; email: string }[]>([])
  const [sfRole,             setSfRole]             = useState(row?.role ?? "coordinator")
  const [sfDept,             setSfDept]             = useState(row?.department ?? "")
  const [sfSalary,           setSfSalary]           = useState(String(row?.basic_salary || ""))
  const [sfRate,             setSfRate]             = useState(String(row?.session_rate || ""))
  const [sfMethod,           setSfMethod]           = useState(row?.payment_method ?? "cash")
  const [sfRef,              setSfRef]              = useState(row?.payment_reference ?? "")
  const [sfEmploymentStatus, setSfEmploymentStatus] = useState<EmploymentStatus>(row?.employment_status ?? "active")
  const [sfWorksAllBranches, setSfWorksAllBranches] = useState(row?.works_all_branches ?? true)
  const [sfNotes,            setSfNotes]            = useState(row?.notes ?? "")
  const [sfBusy,             setSfBusy]             = useState(false)
  const [sfErr,              setSfErr]              = useState("")
  const [sfBranch,           setSfBranch]           = useState(row?.branch_id ?? (defaultBranchId !== "all" ? defaultBranchId : branches[0]?.id ?? ""))

  async function searchUsers(q: string) {
    setSfUserQ(q)
    if (q.length < 2) { setSfUserOpts([]); return }
    const res = await searchUsersForStaffAction(sfBranch, q)
    if (res.success) setSfUserOpts(res.data)
  }

  async function submit() {
    if (staffModal?.mode === "create" && !sfUserId) {
      setSfErr("Please select a user"); return
    }
    setSfBusy(true); setSfErr("")
    const result = await upsertStaffProfileAction({
      user_id:            staffModal?.mode === "create" ? sfUserId : (row?.user_id ?? ""),
      branch_id:          staffModal?.mode === "create" ? sfBranch : (row?.branch_id ?? sfBranch),
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
    onSuccess()
  }

  return (
    <AnimatePresence>
      {staffModal && (
        <Modal
          onClose={onClose}
          title={staffModal.mode === "create" ? "Add Staff Member" : `Edit — ${row?.display_name}`}
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
                    <div className="absolute z-10 left-0 right-0 top-full mt-1 ds-card shadow-xl max-h-48 overflow-y-auto">
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
                  <p className="mt-1.5 text-[11px] text-[#10B981] font-medium">✓ Selected: {sfUserName}</p>
                )}
              </div>
            )}

            {branches.length > 0 && (
              <div>
                <label className="text-[12px] font-semibold text-[#0B1F3A]">Branch</label>
                <select
                  value={sfWorksAllBranches ? "__all__" : sfBranch}
                  onChange={e => {
                    if (e.target.value === "__all__") {
                      setSfWorksAllBranches(true)
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

            {sfErr && <p className="text-[12px] text-[#EF4444]">{sfErr}</p>}
            <div className="flex gap-2 pt-1">
              {staffModal.mode === "edit" && row && (
                <button
                  onClick={() => { onDelete(row.profile_id) }}
                  disabled={sfBusy}
                  className="rounded-lg border border-[#FECACA] bg-[#FEE2E2] px-3 py-2 text-[12px] font-semibold text-[#EF4444] hover:bg-[#FEE2E2] transition disabled:opacity-50"
                >
                  Delete
                </button>
              )}
              <button onClick={onClose} className="flex-1 rounded-lg border border-[#E2E8F0] py-2 text-[13px] font-medium text-[#64748B] hover:bg-[#F8FAFC]">Cancel</button>
              <button onClick={submit} disabled={sfBusy} className="flex-1 rounded-lg bg-[#0B1F3A] py-2 text-[13px] font-semibold text-white hover:bg-[#1a2f4a] disabled:opacity-50">
                {sfBusy ? "Saving…" : staffModal.mode === "create" ? "Add Staff" : "Save Changes"}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </AnimatePresence>
  )
}
