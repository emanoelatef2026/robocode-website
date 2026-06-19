"use client"

import { useState, useTransition } from "react"
import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { AnimatePresence, motion } from "framer-motion"
import Link from "next/link"
import {
  upsertStaffPayrollProfileAction,
  toggleStaffPayrollEnabledAction,
} from "@/modules/payroll/staff-actions"
import type {
  StaffPayrollProfileRow,
  PayrollType, PaymentMethod, StaffRole,
} from "@/modules/payroll/types"
import {
  PAYROLL_TYPE_LABELS, PAYMENT_METHOD_LABELS, STAFF_ROLE_LABELS, fmtCurrency,
} from "@/modules/payroll/types"

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  initialProfiles: StaffPayrollProfileRow[]
  branchIds:       string[]
  branches:        { id: string; name: string }[]
  initialBranchId: string
}

// ── Empty form state ──────────────────────────────────────────────────────────

const EMPTY_FORM = {
  user_id:            "",
  branch_id:          "",
  role:               "instructor" as StaffRole,
  payroll_type:       "per_session" as PayrollType,
  basic_salary:       "",
  session_rate:       "",
  payment_method:     "cash" as PaymentMethod,
  payment_reference:  "",
  is_payroll_enabled: true,
  notes:              "",
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function StaffClient({ initialProfiles, branchIds, branches, initialBranchId }: Props) {
  const router       = useRouter()
  const pathname     = usePathname()
  const searchParams = useSearchParams()

  const [profiles,     setProfiles]     = useState<StaffPayrollProfileRow[]>(initialProfiles)
  const [branchId,     setBranchId]     = useState(initialBranchId)
  const [showModal,    setShowModal]    = useState(false)
  const [editProfile,  setEditProfile]  = useState<StaffPayrollProfileRow | null>(null)
  const [formError,    setFormError]    = useState<string | null>(null)
  const [actionError,  setActionError]  = useState<string | null>(null)
  const [form,         setForm]         = useState(EMPTY_FORM)

  const [isPending, startTransition] = useTransition()

  // ── Branch change ─────────────────────────────────────────────────────────

  function changeBranch(bid: string) {
    setBranchId(bid)
    const p = new URLSearchParams(searchParams.toString())
    p.set("branch", bid)
    router.push(`${pathname}?${p.toString()}`)
  }

  // ── Open modal ────────────────────────────────────────────────────────────

  function openCreate() {
    setEditProfile(null)
    setForm({ ...EMPTY_FORM, branch_id: branchId })
    setFormError(null)
    setShowModal(true)
  }

  function openEdit(profile: StaffPayrollProfileRow) {
    setEditProfile(profile)
    setForm({
      user_id:            profile.user_id,
      branch_id:          profile.branch_id,
      role:               profile.role as StaffRole,
      payroll_type:       profile.payroll_type,
      basic_salary:       String(profile.basic_salary),
      session_rate:       String(profile.session_rate),
      payment_method:     profile.payment_method,
      payment_reference:  profile.payment_reference ?? "",
      is_payroll_enabled: profile.is_payroll_enabled,
      notes:              profile.notes ?? "",
    })
    setFormError(null)
    setShowModal(true)
  }

  // ── Save ──────────────────────────────────────────────────────────────────

  function handleSave() {
    if (!form.user_id && !editProfile) {
      setFormError("User ID is required.")
      return
    }

    setFormError(null)
    startTransition(async () => {
      const res = await upsertStaffPayrollProfileAction({
        user_id:            editProfile?.user_id ?? form.user_id,
        branch_id:          editProfile?.branch_id ?? form.branch_id,
        role:               form.role,
        payroll_type:       form.payroll_type,
        basic_salary:       parseFloat(form.basic_salary) || 0,
        session_rate:       parseFloat(form.session_rate) || 0,
        payment_method:     form.payment_method,
        payment_reference:  form.payment_reference,
        is_payroll_enabled: form.is_payroll_enabled,
        notes:              form.notes,
      })

      if (!res.success) { setFormError(res.error.message); return }

      setShowModal(false)
      router.refresh()
    })
  }

  // ── Toggle enabled ────────────────────────────────────────────────────────

  function toggleEnabled(profile: StaffPayrollProfileRow) {
    startTransition(async () => {
      const res = await toggleStaffPayrollEnabledAction(profile.id, !profile.is_payroll_enabled)
      if (!res.success) setActionError(res.error.message)
      else router.refresh()
    })
  }

  // ── Field helper ──────────────────────────────────────────────────────────

  const f = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(prev => ({ ...prev, [k]: e.target.value }))

  // ── Stats ─────────────────────────────────────────────────────────────────

  const enabled  = profiles.filter(p => p.is_payroll_enabled)
  const disabled = profiles.filter(p => !p.is_payroll_enabled)
  const totalRate = profiles.reduce((s, p) => s + (p.payroll_type === 'per_session' ? 0 : p.basic_salary), 0)

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="bg-white border-b border-[#E2E8F0]">
        <div className="px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link
                href="/portal/team-leader/payroll"
                className="text-[#94A3B8] hover:text-[#0B1F3A] transition"
              >
                <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                  <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
                </svg>
              </Link>
              <div>
                <h1 className="text-[18px] font-bold text-[#0B1F3A]">Staff Directory</h1>
                <p className="text-[12px] text-[#64748B]">Payroll configuration for all staff</p>
              </div>
            </div>
            <button
              onClick={openCreate}
              className="inline-flex items-center gap-2 rounded-lg bg-[#0B1F3A] px-3 py-2 text-[13px] font-semibold text-white hover:bg-[#1a2f4a] transition"
            >
              <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
              </svg>
              Add Staff
            </button>
          </div>

          {/* Branch filter */}
          {branches.length > 0 && (
            <div className="mt-3">
              <select
                value={branchId}
                onChange={e => changeBranch(e.target.value)}
                className="rounded-lg border border-[#E2E8F0] bg-white px-3 py-1.5 text-[12px] text-[#0B1F3A] focus:outline-none focus:ring-2 focus:ring-[#FF8A1F]/40"
              >
                {branches.map(b => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* ── Content ──────────────────────────────────────────────────────────── */}
      <div className="px-4 sm:px-6 py-5 max-w-5xl mx-auto space-y-5">

        {/* Error banner */}
        {actionError && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-700 flex items-center justify-between">
            {actionError}
            <button onClick={() => setActionError(null)} className="text-red-400 hover:text-red-600">
              <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
            </button>
          </div>
        )}

        {/* KPI bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Total Staff",     value: String(profiles.length) },
            { label: "Enabled",         value: String(enabled.length) },
            { label: "Disabled",        value: String(disabled.length) },
            { label: "Fixed Payroll",   value: fmtCurrency(totalRate) },
          ].map(k => (
            <div key={k.label} className="rounded-xl border border-[#E2E8F0] bg-white px-4 py-3 text-center">
              <p className="text-[17px] font-extrabold text-[#0B1F3A]">{k.value}</p>
              <p className="text-[10px] text-[#94A3B8] mt-0.5">{k.label}</p>
            </div>
          ))}
        </div>

        {/* Empty state */}
        {profiles.length === 0 && (
          <div className="rounded-xl border border-dashed border-[#E2E8F0] bg-white py-16 text-center">
            <p className="text-[14px] font-medium text-[#64748B]">No staff profiles yet.</p>
            <p className="mt-1 text-[12px] text-[#94A3B8]">Add staff to configure payroll for each person.</p>
            <button onClick={openCreate} className="mt-4 rounded-lg bg-[#0B1F3A] px-4 py-2 text-[13px] font-semibold text-white hover:bg-[#1a2f4a] transition">
              Add Staff
            </button>
          </div>
        )}

        {/* Desktop table */}
        {profiles.length > 0 && (
          <div className="hidden md:block rounded-xl border border-[#E2E8F0] bg-white overflow-hidden">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                  {["Name", "Role", "Type", "Basic Salary", "Session Rate", "Payment Method", "Reference", "Status", "Actions"].map(h => (
                    <th key={h} className="px-4 py-2.5 text-left font-semibold text-[#64748B] whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F1F5F9]">
                {profiles.map(p => (
                  <tr key={p.id} className="hover:bg-[#F8FAFC] transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="h-7 w-7 rounded-full bg-[#0B1F3A] flex items-center justify-center text-white text-[10px] font-bold shrink-0">
                          {p.display_name.split(" ").slice(0, 2).map(w => w[0]).join("").toUpperCase() || "?"}
                        </div>
                        <span className="font-medium text-[#0B1F3A] truncate max-w-[120px]">{p.display_name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-[#64748B]">{STAFF_ROLE_LABELS[p.role as keyof typeof STAFF_ROLE_LABELS] ?? p.role}</td>
                    <td className="px-4 py-3 text-[#64748B]">{PAYROLL_TYPE_LABELS[p.payroll_type]}</td>
                    <td className="px-4 py-3 text-[#0B1F3A]">{fmtCurrency(p.basic_salary)}</td>
                    <td className="px-4 py-3 text-[#0B1F3A]">{fmtCurrency(p.session_rate)}</td>
                    <td className="px-4 py-3 text-[#64748B]">{PAYMENT_METHOD_LABELS[p.payment_method]}</td>
                    <td className="px-4 py-3 text-[#64748B] max-w-[120px] truncate">{p.payment_reference ?? "—"}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                        p.is_payroll_enabled ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"
                      }`}>
                        {p.is_payroll_enabled ? "Enabled" : "Disabled"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => openEdit(p)}
                          className="rounded border border-[#E2E8F0] px-2.5 py-1 text-[11px] font-medium text-[#0B1F3A] hover:bg-[#F1F5F9] transition"
                        >
                          Edit
                        </button>
                        <button
                          disabled={isPending}
                          onClick={() => toggleEnabled(p)}
                          className={`rounded border px-2.5 py-1 text-[11px] font-medium transition disabled:opacity-50 ${
                            p.is_payroll_enabled
                              ? "border-slate-200 text-slate-500 hover:bg-slate-50"
                              : "border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                          }`}
                        >
                          {p.is_payroll_enabled ? "Disable" : "Enable"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Mobile cards */}
        {profiles.length > 0 && (
          <div className="md:hidden space-y-3">
            {profiles.map(p => (
              <div key={p.id} className="rounded-xl border border-[#E2E8F0] bg-white p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-full bg-[#0B1F3A] flex items-center justify-center text-white text-[12px] font-bold shrink-0">
                      {p.display_name.split(" ").slice(0, 2).map(w => w[0]).join("").toUpperCase() || "?"}
                    </div>
                    <div>
                      <p className="text-[14px] font-semibold text-[#0B1F3A]">{p.display_name}</p>
                      <p className="text-[11px] text-[#64748B]">
                        {STAFF_ROLE_LABELS[p.role as keyof typeof STAFF_ROLE_LABELS] ?? p.role} · {PAYROLL_TYPE_LABELS[p.payroll_type]}
                      </p>
                    </div>
                  </div>
                  <span className={`text-[10px] font-semibold rounded-full px-2 py-0.5 ${
                    p.is_payroll_enabled ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"
                  }`}>
                    {p.is_payroll_enabled ? "Enabled" : "Disabled"}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-center pt-2 border-t border-[#F1F5F9]">
                  <div>
                    <p className="text-[10px] text-[#94A3B8]">Basic Salary</p>
                    <p className="text-[13px] font-semibold text-[#0B1F3A]">{fmtCurrency(p.basic_salary)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-[#94A3B8]">Session Rate</p>
                    <p className="text-[13px] font-semibold text-[#0B1F3A]">{fmtCurrency(p.session_rate)}</p>
                  </div>
                </div>

                {p.payment_reference && (
                  <p className="text-[11px] text-[#64748B]">
                    {PAYMENT_METHOD_LABELS[p.payment_method]} · {p.payment_reference}
                  </p>
                )}

                <div className="flex gap-2 pt-1">
                  <button
                    onClick={() => openEdit(p)}
                    className="flex-1 rounded-lg border border-[#E2E8F0] py-1.5 text-[12px] font-medium text-[#0B1F3A] hover:bg-[#F8FAFC] transition"
                  >
                    Edit
                  </button>
                  <button
                    disabled={isPending}
                    onClick={() => toggleEnabled(p)}
                    className={`flex-1 rounded-lg border py-1.5 text-[12px] font-medium transition disabled:opacity-50 ${
                      p.is_payroll_enabled
                        ? "border-slate-200 text-slate-500"
                        : "border-emerald-200 text-emerald-700"
                    }`}
                  >
                    {p.is_payroll_enabled ? "Disable" : "Enable"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Staff Modal ────────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {showModal && (
          <>
            <motion.div
              key="modal-overlay"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-black/40"
              onClick={() => setShowModal(false)}
            />
            <motion.div
              key="modal"
              initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.18 }}
              className="fixed left-1/2 top-1/2 z-50 w-[92vw] max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white shadow-2xl overflow-hidden"
              style={{ maxHeight: "92vh" }}
            >
              <div className="overflow-y-auto" style={{ maxHeight: "92vh" }}>
                {/* Header */}
                <div className="flex items-center justify-between border-b border-[#E2E8F0] px-5 py-4">
                  <h2 className="text-[16px] font-bold text-[#0B1F3A]">
                    {editProfile ? "Edit Staff Profile" : "Add Staff Profile"}
                  </h2>
                  <button onClick={() => setShowModal(false)} className="text-[#94A3B8] hover:text-[#0B1F3A] transition">
                    <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                  </button>
                </div>

                <div className="px-5 py-5 space-y-4">
                  {/* User ID (only for create) */}
                  {!editProfile && (
                    <Field label="User ID" hint="The auth.users UUID for this staff member">
                      <input
                        type="text"
                        value={form.user_id}
                        onChange={f("user_id")}
                        placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                        className={INPUT_CLS}
                      />
                    </Field>
                  )}

                  {editProfile && (
                    <div className="rounded-lg bg-[#F8FAFC] px-3 py-2 text-[12px] text-[#64748B]">
                      Editing: <strong className="text-[#0B1F3A]">{editProfile.display_name}</strong>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-3">
                    {/* Role */}
                    <Field label="Role">
                      <select value={form.role} onChange={f("role")} className={SELECT_CLS}>
                        {(Object.entries(STAFF_ROLE_LABELS) as [StaffRole, string][]).map(([k, v]) => (
                          <option key={k} value={k}>{v}</option>
                        ))}
                      </select>
                    </Field>

                    {/* Payroll Type */}
                    <Field label="Payroll Type">
                      <select value={form.payroll_type} onChange={f("payroll_type")} className={SELECT_CLS}>
                        {(Object.entries(PAYROLL_TYPE_LABELS) as [PayrollType, string][]).map(([k, v]) => (
                          <option key={k} value={k}>{v}</option>
                        ))}
                      </select>
                    </Field>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    {/* Basic salary */}
                    <Field label="Basic Salary (EGP)" hint="Monthly fixed component">
                      <input
                        type="number"
                        min="0"
                        step="100"
                        value={form.basic_salary}
                        onChange={f("basic_salary")}
                        placeholder="0"
                        disabled={form.payroll_type === "per_session"}
                        className={INPUT_CLS + (form.payroll_type === "per_session" ? " opacity-40" : "")}
                      />
                    </Field>

                    {/* Session rate */}
                    <Field label="Session Rate (EGP)" hint="Per completed session">
                      <input
                        type="number"
                        min="0"
                        step="50"
                        value={form.session_rate}
                        onChange={f("session_rate")}
                        placeholder="0"
                        disabled={form.payroll_type === "fixed_salary"}
                        className={INPUT_CLS + (form.payroll_type === "fixed_salary" ? " opacity-40" : "")}
                      />
                    </Field>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    {/* Payment method */}
                    <Field label="Payment Method">
                      <select value={form.payment_method} onChange={f("payment_method")} className={SELECT_CLS}>
                        {(Object.entries(PAYMENT_METHOD_LABELS) as [PaymentMethod, string][]).map(([k, v]) => (
                          <option key={k} value={k}>{v}</option>
                        ))}
                      </select>
                    </Field>

                    {/* Payment reference */}
                    <Field label="Payment Reference" hint="Account / phone / IBAN">
                      <input
                        type="text"
                        value={form.payment_reference}
                        onChange={f("payment_reference")}
                        placeholder={
                          form.payment_method === "instapay" ? "user@instapay" :
                          form.payment_method === "vodafone_cash" ? "010xxxxxxxx" :
                          form.payment_method === "bank_transfer" ? "IBAN / Account" :
                          "—"
                        }
                        className={INPUT_CLS}
                      />
                    </Field>
                  </div>

                  {/* Enabled toggle */}
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setForm(prev => ({ ...prev, is_payroll_enabled: !prev.is_payroll_enabled }))}
                      className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors ${
                        form.is_payroll_enabled ? "bg-emerald-500" : "bg-[#CBD5E1]"
                      }`}
                    >
                      <span className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${
                        form.is_payroll_enabled ? "translate-x-5" : "translate-x-0"
                      }`} />
                    </button>
                    <span className="text-[13px] text-[#0B1F3A]">
                      Include in payroll generation
                    </span>
                  </div>

                  {/* Notes */}
                  <Field label="Notes (optional)">
                    <textarea
                      rows={2}
                      value={form.notes}
                      onChange={f("notes")}
                      placeholder="Any additional notes…"
                      className={INPUT_CLS + " resize-none"}
                    />
                  </Field>

                  {formError && (
                    <p className="rounded-lg bg-red-50 px-3 py-2 text-[12px] text-red-700">{formError}</p>
                  )}

                  <div className="flex justify-end gap-3 pt-1">
                    <button
                      onClick={() => setShowModal(false)}
                      className="rounded-lg border border-[#E2E8F0] px-4 py-2 text-[13px] font-medium text-[#64748B] hover:bg-[#F8FAFC] transition"
                    >
                      Cancel
                    </button>
                    <button
                      disabled={isPending}
                      onClick={handleSave}
                      className="rounded-lg bg-[#0B1F3A] px-4 py-2 text-[13px] font-semibold text-white hover:bg-[#1a2f4a] disabled:opacity-50 transition"
                    >
                      {isPending ? "Saving…" : editProfile ? "Save Changes" : "Add Staff"}
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}

// ── Field wrapper ─────────────────────────────────────────────────────────────

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="block text-[12px] font-semibold text-[#0B1F3A]">{label}</label>
      {hint && <p className="text-[10px] text-[#94A3B8]">{hint}</p>}
      {children}
    </div>
  )
}

const INPUT_CLS  = "w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-[12px] text-[#0B1F3A] focus:outline-none focus:ring-2 focus:ring-[#FF8A1F]/40 placeholder:text-[#CBD5E1]"
const SELECT_CLS = "w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-[12px] text-[#0B1F3A] focus:outline-none focus:ring-2 focus:ring-[#FF8A1F]/40"
