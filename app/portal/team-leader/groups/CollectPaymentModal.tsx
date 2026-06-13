'use client'

import { useState } from 'react'
import { addPayment } from '@/modules/finance/actions'
import type { GroupDetailStudent } from '@/modules/groups/modal-actions'

interface Props {
  student:   GroupDetailStudent
  onClose:   () => void
  onSuccess: () => void
}

const PAYMENT_METHODS = [
  { value: 'cash',          label: 'Cash' },
  { value: 'instapay',      label: 'Instapay' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'card',          label: 'Card' },
  { value: 'check',         label: 'Check' },
  { value: 'other',         label: 'Other' },
]

function fmtCurrency(n: number): string {
  return n.toLocaleString('en-EG', { style: 'currency', currency: 'EGP', maximumFractionDigits: 0 })
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
      <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
    </svg>
  )
}

export default function CollectPaymentModal({ student: s, onClose, onSuccess }: Props) {
  const today = new Date().toISOString().slice(0, 10)

  const [amount,    setAmount]    = useState(s.remaining_balance > 0 ? String(Math.ceil(s.remaining_balance)) : '')
  const [method,    setMethod]    = useState('cash')
  const [date,      setDate]      = useState(today)
  const [reference, setReference] = useState('')
  const [notes,     setNotes]     = useState('')
  const [loading,   setLoading]   = useState(false)
  const [error,     setError]     = useState<string | null>(null)

  // No account_id means no financial record exists — shouldn't show this modal
  if (!s.account_id) {
    return (
      <>
        <div className="fixed inset-0 z-[85] bg-black/40" onClick={onClose} />
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl text-center">
            <p className="text-[13px] font-medium text-red-600">No financial account found for this student.</p>
            <p className="mt-1 text-[11px] text-[#94A3B8]">Create a contract first before collecting payment.</p>
            <button onClick={onClose} className="mt-4 w-full rounded-xl border border-[#E2E8F0] px-4 py-2 text-[12px] text-[#64748B] hover:border-[#FF8A1F] hover:text-[#FF8A1F] transition">
              Close
            </button>
          </div>
        </div>
      </>
    )
  }

  async function handleSubmit() {
    const amt = parseFloat(amount)
    if (!amt || amt <= 0) { setError('Enter a valid amount greater than 0'); return }
    if (!date)            { setError('Select a payment date'); return }
    setLoading(true)
    setError(null)

    const result = await addPayment({
      account_id:       s.account_id!,
      student_id:       s.student_id,
      enrollment_id:    s.enrollment_id ?? undefined,
      amount:           amt,
      payment_date:     date,
      payment_method:   method as Parameters<typeof addPayment>[0]['payment_method'],
      reference_number: reference || undefined,
      notes:            notes    || undefined,
    })

    setLoading(false)
    if ('error' in result) { setError(result.error); return }
    onSuccess()
  }

  const halfBalance = s.remaining_balance > 0 ? Math.ceil(s.remaining_balance / 2) : 0
  const quickAmounts = [s.remaining_balance, halfBalance]
    .filter((v, i, a) => v > 0 && a.indexOf(v) === i)

  return (
    <>
      <div className="fixed inset-0 z-[85] bg-black/40 backdrop-blur-[1px]" onClick={onClose} />
      <div
        className="fixed inset-0 z-[90] flex items-end justify-center sm:items-center p-0 sm:p-4"
        onClick={onClose}
      >
        <div
          className="w-full max-w-md rounded-t-3xl sm:rounded-2xl bg-white shadow-2xl"
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-[#E2E8F0] px-5 py-4">
            <div>
              <h2 className="text-[15px] font-bold text-[#0B1F3A]">Collect Payment</h2>
              <p className="mt-0.5 text-[11px] text-[#94A3B8]">{s.student_name}</p>
            </div>
            <button
              onClick={onClose}
              className="rounded-lg p-1.5 text-[#94A3B8] hover:bg-[#F1F5F9] transition"
              aria-label="Close"
            >
              <CloseIcon />
            </button>
          </div>

          <div className="px-5 py-4 space-y-4">
            {/* Contract summary */}
            <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-3 space-y-1.5">
              <div className="flex items-center justify-between text-[12px]">
                <span className="text-[#94A3B8]">Total paid</span>
                <span className="font-medium text-[#0B1F3A]">{fmtCurrency(s.paid_amount)}</span>
              </div>
              <div className="flex items-center justify-between text-[12px]">
                <span className="text-[#94A3B8]">Remaining balance</span>
                <span className={`font-semibold ${s.remaining_balance > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                  {s.remaining_balance > 0 ? fmtCurrency(s.remaining_balance) : 'Settled'}
                </span>
              </div>
              {s.sessions_remaining != null && (
                <div className="flex items-center justify-between text-[12px]">
                  <span className="text-[#94A3B8]">Sessions remaining</span>
                  <span className={`font-medium ${s.sessions_remaining <= 2 ? 'text-red-600' : 'text-[#0B1F3A]'}`}>
                    {s.sessions_remaining}
                  </span>
                </div>
              )}
            </div>

            {/* Amount */}
            <div>
              <label className="mb-1.5 block text-[11px] font-semibold text-[#64748B] uppercase tracking-wide">
                Amount (EGP)
              </label>
              <input
                type="number"
                min="1"
                step="1"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                placeholder="0"
                className="w-full rounded-xl border border-[#E2E8F0] px-4 py-2.5 text-[14px] font-medium outline-none focus:border-[#FF8A1F] focus:ring-1 focus:ring-[#FF8A1F]/20"
              />
              {quickAmounts.length > 0 && (
                <div className="mt-2 flex gap-2 flex-wrap">
                  {quickAmounts.map(v => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setAmount(String(v))}
                      className="rounded-lg border border-[#E2E8F0] px-3 py-1 text-[11px] font-medium text-[#64748B] hover:border-[#FF8A1F] hover:text-[#FF8A1F] transition"
                    >
                      {fmtCurrency(v)}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Method + Date row */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1.5 block text-[11px] font-semibold text-[#64748B] uppercase tracking-wide">
                  Method
                </label>
                <select
                  value={method}
                  onChange={e => setMethod(e.target.value)}
                  className="w-full rounded-xl border border-[#E2E8F0] px-3 py-2.5 text-[12px] outline-none focus:border-[#FF8A1F]"
                >
                  {PAYMENT_METHODS.map(m => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-[11px] font-semibold text-[#64748B] uppercase tracking-wide">
                  Date
                </label>
                <input
                  type="date"
                  value={date}
                  onChange={e => setDate(e.target.value)}
                  className="w-full rounded-xl border border-[#E2E8F0] px-3 py-2.5 text-[12px] outline-none focus:border-[#FF8A1F]"
                />
              </div>
            </div>

            {/* Reference */}
            <div>
              <label className="mb-1.5 block text-[11px] font-semibold text-[#64748B] uppercase tracking-wide">
                Reference <span className="font-normal text-[#CBD5E1] normal-case">optional</span>
              </label>
              <input
                type="text"
                value={reference}
                onChange={e => setReference(e.target.value)}
                placeholder="e.g. receipt #1234"
                className="w-full rounded-xl border border-[#E2E8F0] px-4 py-2.5 text-[12px] outline-none focus:border-[#FF8A1F]"
              />
            </div>

            {error && (
              <p className="rounded-lg bg-red-50 border border-red-100 px-3 py-2 text-[12px] text-red-600">
                {error}
              </p>
            )}

            {/* Actions */}
            <div className="flex flex-col gap-2 pt-1">
              <button
                onClick={handleSubmit}
                disabled={loading}
                className="w-full rounded-xl bg-[#FF8A1F] px-4 py-3 text-[13px] font-semibold text-white hover:bg-[#e87c18] disabled:opacity-50 transition"
              >
                {loading ? 'Recording payment…' : 'Confirm Payment'}
              </button>
              <button
                onClick={onClose}
                disabled={loading}
                className="w-full rounded-xl border border-[#E2E8F0] px-4 py-2.5 text-[12px] font-medium text-[#64748B] hover:border-[#FF8A1F] hover:text-[#FF8A1F] disabled:opacity-50 transition"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
