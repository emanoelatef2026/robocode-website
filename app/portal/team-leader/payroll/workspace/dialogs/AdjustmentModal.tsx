"use client"

import { useState } from "react"
import { AnimatePresence } from "framer-motion"
import {
  addFinanceAdjustmentAction,
  deleteFinanceAdjustmentAction,
} from "@/modules/staff-finance/actions"
import {
  ADJ_LABELS, ADJ_SIGN, ADJ_COLOR, fmtNum,
} from "@/modules/staff-finance/types"
import type { FinanceAdjType } from "@/modules/staff-finance/types"
import { Modal } from "../components/Modal"

const ADJ_TYPES: FinanceAdjType[] = [
  "bonus", "penalty", "advance", "purchase", "reimbursement", "other",
]

export interface AdjTarget {
  kind: "instructor" | "staff"
  id: string
  branchId: string
  name: string
}

interface Props {
  target: AdjTarget | null
  onClose: () => void
  onSuccess: () => void
}

export function AdjustmentModal({ target, onClose, onSuccess }: Props) {
  const [adjType,   setAdjType]   = useState<FinanceAdjType>("bonus")
  const [adjAmount, setAdjAmount] = useState("")
  const [adjDate,   setAdjDate]   = useState(new Date().toISOString().slice(0, 10))
  const [adjNotes,  setAdjNotes]  = useState("")
  const [adjBusy,   setAdjBusy]   = useState(false)
  const [adjErr,    setAdjErr]    = useState("")

  async function submit() {
    if (!target || !adjAmount || Number(adjAmount) <= 0) {
      setAdjErr("Amount must be greater than 0"); return
    }
    setAdjBusy(true); setAdjErr("")
    const result = await addFinanceAdjustmentAction({
      branch_id:        target.branchId,
      instructor_id:    target.kind === "instructor" ? target.id : undefined,
      staff_profile_id: target.kind === "staff"      ? target.id : undefined,
      type:             adjType,
      amount:           Number(adjAmount),
      adjustment_date:  adjDate,
      notes:            adjNotes,
    })
    setAdjBusy(false)
    if (!result.success) { setAdjErr(result.error.message); return }
    onSuccess()
  }

  return (
    <AnimatePresence>
      {target && (
        <Modal onClose={onClose} title={`Adjustment — ${target.name}`}>
          <div className="space-y-3">
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
            <div>
              <label className="text-[12px] font-semibold text-[#0B1F3A]">Date</label>
              <input
                type="date"
                value={adjDate}
                onChange={e => setAdjDate(e.target.value)}
                className="mt-1 w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-[#FF8A1F]/30"
              />
            </div>
            <div>
              <label className="text-[12px] font-semibold text-[#0B1F3A]">Notes (optional)</label>
              <textarea
                rows={2}
                value={adjNotes}
                onChange={e => setAdjNotes(e.target.value)}
                className="mt-1 w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-[#FF8A1F]/30 resize-none"
              />
            </div>
            {adjErr && <p className="text-[12px] text-[#EF4444]">{adjErr}</p>}
            <div className="flex gap-2 pt-1">
              <button onClick={onClose} className="flex-1 rounded-lg border border-[#E2E8F0] py-2 text-[13px] font-medium text-[#64748B] hover:bg-[#F8FAFC]">Cancel</button>
              <button onClick={submit} disabled={adjBusy} className="flex-1 rounded-lg bg-[#0B1F3A] py-2 text-[13px] font-semibold text-white hover:bg-[#1a2f4a] disabled:opacity-50">
                {adjBusy ? "Saving…" : "Save Adjustment"}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </AnimatePresence>
  )
}
