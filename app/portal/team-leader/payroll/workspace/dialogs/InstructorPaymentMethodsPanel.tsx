"use client"

import { useState, useEffect } from "react"
import { getInstructorPaymentMethodsAction } from "@/modules/instructor-payments/actions"
import type { InstructorPaymentMethods } from "@/modules/instructor-payments/types"
import { PREFERRED_METHOD_LABELS } from "@/modules/instructor-payments/types"
import { ModalRow } from "../components/ModalRow"

// Read-only view of the instructor's payment info. Sourced from the
// instructors table (single source of truth, shared with the instructor's
// own "My Payments" portal and the admin instructor form).

export function InstructorPaymentMethodsPanel({ instructorId, refreshKey }: { instructorId: string; refreshKey?: number }) {
  const [methods, setMethods] = useState<InstructorPaymentMethods | null>(null)
  const [copied,  setCopied]  = useState(false)

  useEffect(() => {
    let cancelled = false
    getInstructorPaymentMethodsAction(instructorId).then(res => {
      if (!cancelled && res.success) setMethods(res.data)
    })
    return () => { cancelled = true }
  }, [instructorId, refreshKey])

  function copyLink() {
    if (!methods?.payment_link) return
    navigator.clipboard.writeText(methods.payment_link)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="rounded-xl border border-[#E2E8F0] bg-white p-4 space-y-3">
      <p className="text-[11px] font-bold text-[#94A3B8] uppercase tracking-wider">Payment Methods</p>
      {methods === null ? (
        <p className="text-[12px] text-[#94A3B8]">Loading…</p>
      ) : (
        <div className="space-y-1.5">
          <ModalRow label="Preferred" right={methods.payment_method ? PREFERRED_METHOD_LABELS[methods.payment_method] : "—"} />
          {methods.wallet_number       && <ModalRow label="Vodafone Cash" right={methods.wallet_number} />}
          {methods.instapay_number     && <ModalRow label="Instapay Number" right={methods.instapay_number} />}
          {methods.payment_link        && (
            <div className="flex items-center justify-between gap-2">
              <span className="text-[12px] text-[#64748B]">Instapay Link</span>
              <div className="flex items-center gap-1.5 min-w-0">
                <a
                  href={methods.payment_link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="truncate text-[12px] text-[#FF8A1F] hover:underline max-w-[140px]"
                  title={methods.payment_link}
                >
                  {methods.payment_link}
                </a>
                <button
                  onClick={copyLink}
                  title="Copy link"
                  className="shrink-0 rounded-md border border-[#E2E8F0] px-1.5 py-0.5 text-[10px] font-semibold text-[#64748B] hover:bg-[#F8FAFC]"
                >
                  {copied ? "✓" : "Copy"}
                </button>
              </div>
            </div>
          )}
          {methods.bank_account_number && <ModalRow label="Bank Account" right={methods.bank_account_number} />}
          {methods.payment_method === "instapay" && (!methods.instapay_number || !methods.payment_link) && (
            <p className="pt-1 text-[11px] font-semibold text-[#B45309]">
              ⚠ Instapay is incomplete — both number and link are required.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
