import Link from 'next/link'

export default function MissingPaymentInfoBanner() {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-[#FDE68A] bg-[#FFFBEB] px-4 py-3">
      <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5 shrink-0 text-[#B45309]">
        <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 6a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 6zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
      </svg>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-semibold text-[#92400E]">Payment info incomplete</p>
        <p className="text-[12px] text-[#B45309]">
          Add your preferred payment method so we can pay you correctly.
        </p>
      </div>
      <Link
        href="/portal/instructor/payments?tab=methods"
        className="shrink-0 rounded-lg bg-[#B45309] px-3 py-1.5 text-[12px] font-semibold text-white transition hover:bg-[#92400E]"
      >
        Add now
      </Link>
    </div>
  )
}
