"use client"

import { useState } from "react"
import { AnimatePresence } from "framer-motion"
import { updateInstructorPaymentInfoAction } from "@/modules/staff-finance/actions"
import type { InstructorFinanceRow } from "@/modules/staff-finance/types"
import { INSTRUCTOR_PAYMENT_METHOD_LABELS } from "@/modules/staff-finance/types"
import { validatePaymentMethodFields } from "@/modules/instructor-payments/types"
import { Modal } from "../components/Modal"

interface Props {
  target: InstructorFinanceRow | null
  onClose: () => void
  onSuccess: () => void
}

export function InstructorPayInfoModal({ target, onClose, onSuccess }: Props) {
  const [payRate,       setPayRate]       = useState(String(target?.salary_per_session || ""))
  const [payMethod,     setPayMethod]     = useState<string>(target?.payment_method ?? "cash")
  const [payWallet,     setPayWallet]     = useState(target?.wallet_number ?? "")
  const [payInstapayNo, setPayInstapayNo] = useState(target?.instapay_number ?? "")
  const [payLink,       setPayLink]       = useState(target?.payment_link ?? "")
  const [payBank,       setPayBank]       = useState(target?.bank_account_number ?? "")
  const [payNotes,      setPayNotes]      = useState(target?.payment_notes ?? "")
  const [payBusy,       setPayBusy]       = useState(false)
  const [payErr,        setPayErr]        = useState("")

  async function submit() {
    if (!target) return
    const validationError = validatePaymentMethodFields({
      payment_method:      payMethod,
      wallet_number:       payWallet,
      instapay_number:     payInstapayNo,
      payment_link:        payLink,
      bank_account_number: payBank,
    })
    if (validationError) { setPayErr(validationError); return }
    setPayBusy(true)
    setPayErr("")
    const result = await updateInstructorPaymentInfoAction({
      instructor_id:       target.instructor_id,
      salary_per_session:  payRate ? Number(payRate) : null,
      payment_method:      payMethod || null,
      wallet_number:       payWallet     || null,
      instapay_number:     payInstapayNo || null,
      payment_link:        payLink       || null,
      bank_account_number: payBank       || null,
      payment_notes:       payNotes  || null,
    })
    setPayBusy(false)
    if (!result.success) { setPayErr(result.error.message); return }
    onSuccess()
  }

  return (
    <AnimatePresence>
      {target && (
        <Modal onClose={onClose} title={`Payment Info — ${target.display_name}`}>
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
            {payMethod === "vodafone_cash" && (
              <div>
                <label className="text-[12px] font-semibold text-[#0B1F3A]">Vodafone Cash Number <span className="text-[#EF4444]">*</span></label>
                <input
                  value={payWallet}
                  onChange={e => setPayWallet(e.target.value)}
                  placeholder="01xxxxxxxxx"
                  className="mt-1 w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-[#FF8A1F]/30"
                />
              </div>
            )}
            {payMethod === "instapay" && (
              <>
                <div>
                  <label className="text-[12px] font-semibold text-[#0B1F3A]">Instapay Number <span className="text-[#EF4444]">*</span></label>
                  <input
                    value={payInstapayNo}
                    onChange={e => setPayInstapayNo(e.target.value)}
                    placeholder="01xxxxxxxxx"
                    className="mt-1 w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-[#FF8A1F]/30"
                  />
                </div>
                <div>
                  <label className="text-[12px] font-semibold text-[#0B1F3A]">Instapay Payment Link <span className="text-[#EF4444]">*</span></label>
                  <input
                    type="url"
                    value={payLink}
                    onChange={e => setPayLink(e.target.value)}
                    placeholder="https://ipn.eg/S/..."
                    className="mt-1 w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-[#FF8A1F]/30"
                  />
                </div>
              </>
            )}
            {payMethod === "bank_transfer" && (
              <div>
                <label className="text-[12px] font-semibold text-[#0B1F3A]">Bank Account Number <span className="text-[#EF4444]">*</span></label>
                <input
                  value={payBank}
                  onChange={e => setPayBank(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-[#FF8A1F]/30"
                />
              </div>
            )}
            <div>
              <label className="text-[12px] font-semibold text-[#0B1F3A]">Notes</label>
              <textarea
                rows={2}
                value={payNotes}
                onChange={e => setPayNotes(e.target.value)}
                className="mt-1 w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-[#FF8A1F]/30 resize-none"
              />
            </div>
            {payErr && <p className="text-[12px] text-[#EF4444]">{payErr}</p>}
            <div className="flex gap-2 pt-1">
              <button onClick={onClose} className="flex-1 rounded-lg border border-[#E2E8F0] py-2 text-[13px] font-medium text-[#64748B] hover:bg-[#F8FAFC]">Cancel</button>
              <button onClick={submit} disabled={payBusy} className="flex-1 rounded-lg bg-[#0B1F3A] py-2 text-[13px] font-semibold text-white hover:bg-[#1a2f4a] disabled:opacity-50">
                {payBusy ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </AnimatePresence>
  )
}
