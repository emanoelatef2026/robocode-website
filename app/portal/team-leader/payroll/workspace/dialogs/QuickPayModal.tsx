"use client"

import { useState } from "react"
import { AnimatePresence } from "framer-motion"
import { addStaffPaymentAction } from "@/modules/staff-finance/actions"
import type { StaffFinanceRow } from "@/modules/staff-finance/types"
import { STAFF_PAYMENT_METHOD_LABELS, fmtEGP } from "@/modules/staff-finance/types"
import { Modal } from "../components/Modal"

interface Props {
  target: StaffFinanceRow | null
  onClose: () => void
  onSuccess: () => void
}

export function QuickPayModal({ target, onClose, onSuccess }: Props) {
  const [qpAmount, setQpAmount] = useState("")
  const [qpDate,   setQpDate]   = useState(new Date().toISOString().slice(0, 10))
  const [qpMethod, setQpMethod] = useState(target?.payment_method || "cash")
  const [qpNotes,  setQpNotes]  = useState("")
  const [qpBusy,   setQpBusy]   = useState(false)
  const [qpErr,    setQpErr]    = useState("")

  async function submit() {
    if (!target) return
    const amount = Number(qpAmount)
    if (amount <= 0) { setQpErr("Amount must be greater than 0"); return }
    setQpBusy(true); setQpErr("")
    const [year, month] = qpDate.split("-").map(Number)
    const res = await addStaffPaymentAction({
      staff_profile_id: target.profile_id,
      branch_id:        target.branch_id,
      month,
      year,
      amount,
      payment_date:   qpDate,
      payment_method: qpMethod,
      notes:          qpNotes,
    })
    setQpBusy(false)
    if (!res.success) { setQpErr(res.error.message); return }
    onSuccess()
  }

  return (
    <AnimatePresence>
      {target && (
        <Modal onClose={onClose} title={`Record Payment — ${target.display_name}`}>
          <div className="space-y-3">
            <div className="rounded-lg bg-[#F8FAFC] border border-[#E2E8F0] px-3 py-2 text-[12px]">
              <span className="text-[#64748B]">Net this month: </span>
              <span className="font-bold text-[#0B1F3A]">{fmtEGP(target.net_amount)}</span>
              {target.total_paid > 0 && (
                <>
                  <span className="text-[#64748B] ml-3">Paid: </span>
                  <span className="font-semibold text-[#15803D]">{fmtEGP(target.total_paid)}</span>
                  <span className="text-[#64748B] ml-3">Remaining: </span>
                  <span className="font-semibold text-[#EF4444]">{fmtEGP(target.remaining)}</span>
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
            {qpErr && <p className="text-[12px] text-[#EF4444]">{qpErr}</p>}
            <div className="flex gap-2 pt-1">
              <button onClick={onClose} className="flex-1 rounded-lg border border-[#E2E8F0] py-2 text-[13px] font-medium text-[#64748B] hover:bg-[#F8FAFC]">Cancel</button>
              <button onClick={submit} disabled={qpBusy} className="flex-1 rounded-lg bg-[#059669] py-2 text-[13px] font-semibold text-white hover:bg-[#047857] disabled:opacity-50">
                {qpBusy ? "Saving…" : "Record Payment"}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </AnimatePresence>
  )
}
