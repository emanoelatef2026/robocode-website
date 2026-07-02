"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import type { InstructorPaymentOverview, InstructorPayoutRequest } from "@/modules/instructor-payments/types"
import { fmtEGP, PAYOUT_STATUS_LABELS, PAYOUT_STATUS_COLORS } from "@/modules/instructor-payments/types"
import { requestPayoutAction } from "@/modules/instructor-payments/actions"

interface Props {
  overview:    InstructorPaymentOverview
  openRequest: InstructorPayoutRequest | null
}

export default function PayoutRequestPanel({ overview, openRequest }: Props) {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState("")
  const router = useRouter()

  function handleRequest() {
    setError("")
    startTransition(async () => {
      const res = await requestPayoutAction()
      if (!res.success) {
        setError(res.error.message)
        return
      }
      router.refresh()
    })
  }

  if (openRequest) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-xl border border-[#E2E8F0] bg-white px-4 py-3">
        <div>
          <p className="text-[13px] font-semibold text-[#0B1F3A]">
            Payout request — {fmtEGP(openRequest.requested_amount)}
          </p>
          <p className="mt-0.5 text-[11px] text-[#64748B]">
            Submitted {new Date(openRequest.requested_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
          </p>
        </div>
        <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10.5px] font-bold ${PAYOUT_STATUS_COLORS[openRequest.status]}`}>
          {PAYOUT_STATUS_LABELS[openRequest.status]}
        </span>
      </div>
    )
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#E2E8F0] bg-white px-4 py-3">
      <div>
        <p className="text-[13px] font-semibold text-[#0B1F3A]">
          Outstanding balance: {fmtEGP(overview.outstanding)}
        </p>
        <p className="mt-0.5 text-[11px] text-[#64748B]">
          {overview.outstanding > 0
            ? 'Request a payout for your outstanding balance.'
            : 'No outstanding balance to request.'}
        </p>
        {error && <p className="mt-1 text-[11px] font-medium text-[#EF4444]">{error}</p>}
      </div>
      <button
        type="button"
        disabled={!overview.can_request_payout || pending}
        onClick={handleRequest}
        className="shrink-0 rounded-lg bg-[#FF8A1F] px-4 py-2 text-[12px] font-semibold text-white transition hover:bg-[#e07818] disabled:cursor-not-allowed disabled:opacity-40"
      >
        {pending ? 'Requesting…' : 'Request Payout'}
      </button>
    </div>
  )
}
