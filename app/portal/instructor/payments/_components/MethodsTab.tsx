"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import type { InstructorPaymentMethods, InstructorPreferredMethod } from "@/modules/instructor-payments/types"
import { PREFERRED_METHOD_OPTIONS, validatePaymentMethodFields } from "@/modules/instructor-payments/types"
import { updateMyPaymentMethodsAction } from "@/modules/instructor-payments/actions"

function inferMethod(m: InstructorPaymentMethods): InstructorPreferredMethod {
  if (m.payment_method) return m.payment_method
  if (m.wallet_number) return 'vodafone_cash'
  if (m.instapay_number || m.payment_link) return 'instapay'
  if (m.bank_account_number) return 'bank_transfer'
  return 'cash'
}

export default function MethodsTab({ paymentMethods }: { paymentMethods: InstructorPaymentMethods }) {
  const [method, setMethod]     = useState<InstructorPreferredMethod>(inferMethod(paymentMethods))
  const [wallet, setWallet]     = useState(paymentMethods.wallet_number ?? '')
  const [instapayNo, setInstapayNo] = useState(paymentMethods.instapay_number ?? '')
  const [payLink, setPayLink]   = useState(paymentMethods.payment_link ?? '')
  const [bankAcct, setBankAcct] = useState(paymentMethods.bank_account_number ?? '')
  const [error, setError]       = useState('')
  const [success, setSuccess]   = useState(false)
  const [pending, startTransition] = useTransition()
  const router = useRouter()

  function validate(): string | null {
    return validatePaymentMethodFields({
      payment_method:      method,
      wallet_number:       wallet,
      instapay_number:     instapayNo,
      payment_link:        payLink,
      bank_account_number: bankAcct,
    })
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSuccess(false)
    const err = validate()
    if (err) { setError(err); return }
    setError('')

    startTransition(async () => {
      const res = await updateMyPaymentMethodsAction({
        payment_method:      method,
        wallet_number:       wallet,
        instapay_number:     instapayNo,
        payment_link:        payLink,
        bank_account_number: bankAcct,
      })
      if (!res.success) { setError(res.error.message); return }
      setSuccess(true)
      router.refresh()
    })
  }

  return (
    <form onSubmit={handleSubmit} className="ds-card max-w-xl space-y-4 p-4">
      <div>
        <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-[#94A3B8]">
          Preferred Payment Method
        </label>
        <select
          value={method}
          onChange={e => setMethod(e.target.value as InstructorPreferredMethod)}
          className="w-full rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2 text-[13px] text-[#374151] outline-none focus:border-[#FF8A1F] focus:bg-white transition"
        >
          {PREFERRED_METHOD_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>

      {method === 'vodafone_cash' && (
        <div>
          <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-[#94A3B8]">
            Vodafone Cash Number
          </label>
          <input
            type="text" inputMode="numeric" value={wallet}
            onChange={e => setWallet(e.target.value)}
            placeholder="01xxxxxxxxx"
            className="w-full rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2 text-[13px] text-[#374151] outline-none focus:border-[#FF8A1F] focus:bg-white transition"
          />
          <p className="mt-1 text-[11px] text-[#94A3B8]">Must be exactly 11 digits.</p>
        </div>
      )}

      {method === 'instapay' && (
        <>
          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-[#94A3B8]">
              Instapay Number <span className="text-[#EF4444]">*</span>
            </label>
            <input
              type="text" value={instapayNo}
              onChange={e => setInstapayNo(e.target.value)}
              placeholder="01xxxxxxxxx"
              className="w-full rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2 text-[13px] text-[#374151] outline-none focus:border-[#FF8A1F] focus:bg-white transition"
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-[#94A3B8]">
              Instapay Payment Link <span className="text-[#EF4444]">*</span>
            </label>
            <input
              type="url" value={payLink}
              onChange={e => setPayLink(e.target.value)}
              placeholder="https://ipn.eg/S/..."
              className="w-full rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2 text-[13px] text-[#374151] outline-none focus:border-[#FF8A1F] focus:bg-white transition"
            />
          </div>
          <p className="text-[11px] text-[#94A3B8]">Both the number and payment link are required for Instapay.</p>
        </>
      )}

      {method === 'bank_transfer' && (
        <div>
          <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-[#94A3B8]">
            Bank Account Number
          </label>
          <input
            type="text" value={bankAcct}
            onChange={e => setBankAcct(e.target.value)}
            className="w-full rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2 text-[13px] text-[#374151] outline-none focus:border-[#FF8A1F] focus:bg-white transition"
          />
        </div>
      )}

      {method === 'cash' && (
        <p className="text-[12px] text-[#64748B]">No additional details needed for cash payments.</p>
      )}

      {error && <p className="text-[12px] font-medium text-[#EF4444]">{error}</p>}
      {success && !error && <p className="text-[12px] font-medium text-[#15803D]">Payment methods updated.</p>}

      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-[#FF8A1F] px-4 py-2 text-[12px] font-semibold text-white transition hover:bg-[#e07818] disabled:cursor-not-allowed disabled:opacity-40"
      >
        {pending ? 'Saving…' : 'Save Payment Methods'}
      </button>
    </form>
  )
}
