"use client"

import { useState } from "react"
import { AnimatePresence } from "framer-motion"
import { addStaffSessionAction } from "@/modules/staff-finance/actions"
import type { StaffFinanceRow } from "@/modules/staff-finance/types"
import { STAFF_ACTIVITY_OPTIONS, fmtEGP } from "@/modules/staff-finance/types"
import { Modal } from "../components/Modal"

interface Props {
  target: StaffFinanceRow | null
  onClose: () => void
  onSuccess: () => void
}

export function QuickActModal({ target, onClose, onSuccess }: Props) {
  const [qaDate,     setQaDate]     = useState(new Date().toISOString().slice(0, 10))
  const [qaActivity, setQaActivity] = useState("session")
  const [qaDesc,     setQaDesc]     = useState("")
  const [qaRate,     setQaRate]     = useState(String(target?.session_rate || ""))
  const [qaQty,      setQaQty]      = useState("1")
  const [qaBusy,     setQaBusy]     = useState(false)
  const [qaErr,      setQaErr]      = useState("")

  async function submit() {
    if (!target) return
    const rate = Number(qaRate)
    const qty  = Number(qaQty)
    if (rate < 0) { setQaErr("Rate must be 0 or greater"); return }
    if (qty <= 0) { setQaErr("Quantity must be greater than 0"); return }
    setQaBusy(true); setQaErr("")
    const res = await addStaffSessionAction({
      staff_profile_id: target.profile_id,
      branch_id:        target.branch_id,
      session_date:     qaDate,
      activity_type:    qaActivity,
      description:      qaDesc,
      rate,
      quantity:         qty,
      notes:            "",
    })
    setQaBusy(false)
    if (!res.success) { setQaErr(res.error.message); return }
    onSuccess()
  }

  return (
    <AnimatePresence>
      {target && (
        <Modal onClose={onClose} title={`Add Activity — ${target.display_name}`}>
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
              <p className="text-[11px] font-semibold text-[#15803D]">
                Total: {fmtEGP(Number(qaRate) * Number(qaQty))}
              </p>
            )}
            {qaErr && <p className="text-[12px] text-[#EF4444]">{qaErr}</p>}
            <div className="flex gap-2 pt-1">
              <button onClick={onClose} className="flex-1 rounded-lg border border-[#E2E8F0] py-2 text-[13px] font-medium text-[#64748B] hover:bg-[#F8FAFC]">Cancel</button>
              <button onClick={submit} disabled={qaBusy} className="flex-1 rounded-lg bg-[#0B1F3A] py-2 text-[13px] font-semibold text-white hover:bg-[#1a2f4a] disabled:opacity-50">
                {qaBusy ? "Saving…" : "Add Activity"}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </AnimatePresence>
  )
}
