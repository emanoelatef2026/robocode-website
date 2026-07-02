"use client"

import { useState } from "react"
import type { InstructorMonthlyPaymentSummary } from "@/modules/instructor-payments/types"
import { fmtEGP, MONTH_NAMES } from "@/modules/instructor-payments/types"
import EmptyState from "@/components/admin/EmptyState"

export default function HistoryTab({ history }: { history: InstructorMonthlyPaymentSummary[] }) {
  const [openKey, setOpenKey] = useState<string | null>(null)

  if (history.length === 0) {
    return <EmptyState title="No payment history yet" description="Your monthly earnings and payments will show up here." />
  }

  return (
    <div className="ds-card divide-y divide-[#F1F5F9]">
      {history.map(m => {
        const key = `${m.year}-${m.month}`
        const isOpen = openKey === key
        return (
          <div key={key}>
            <button
              type="button"
              onClick={() => setOpenKey(isOpen ? null : key)}
              className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition hover:bg-[#F8FAFC]"
            >
              <div>
                <p className="text-[13px] font-semibold text-[#0B1F3A]">{MONTH_NAMES[m.month - 1]} {m.year}</p>
                <p className="mt-0.5 text-[11px] text-[#64748B]">
                  Earned {fmtEGP(m.earned)} · Paid {fmtEGP(m.paid)}
                  {m.outstanding > 0 && <span className="text-[#EF4444]"> · Outstanding {fmtEGP(m.outstanding)}</span>}
                </p>
              </div>
              <svg
                viewBox="0 0 20 20" fill="currentColor"
                className={`h-4 w-4 shrink-0 text-[#94A3B8] transition-transform ${isOpen ? 'rotate-180' : ''}`}
              >
                <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
              </svg>
            </button>

            {isOpen && (
              <div className="border-t border-[#F1F5F9] bg-[#F8FAFC] px-4 py-3">
                {m.payments.length === 0 ? (
                  <p className="text-[12px] italic text-[#94A3B8]">No payments recorded this month.</p>
                ) : (
                  <div className="space-y-1.5">
                    {m.payments.map(p => (
                      <div key={p.id} className="flex items-center justify-between rounded-lg bg-white px-3 py-2 text-[12px]">
                        <div>
                          <span className="font-semibold text-[#0B1F3A]">{fmtEGP(p.amount)}</span>
                          <span className="ml-2 text-[#64748B]">{p.payment_method ?? '—'}</span>
                        </div>
                        <span className="text-[#94A3B8]">
                          {new Date(p.payment_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
