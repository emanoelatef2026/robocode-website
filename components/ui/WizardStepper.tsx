'use client'

// Shared multi-step wizard header — extracted so the Graduation Wizard
// (Phase 2) doesn't hand-roll its own step indicator the way
// BulkCertificatesModal (Phase XXXIX) does. The next wizard to touch that
// file can swap it in without a rewrite.
export function WizardStepper({ steps, currentStep }: { steps: string[]; currentStep: number }) {
  return (
    <div className="flex border-b border-[#E2E8F0] bg-[#F8FAFC] overflow-x-auto">
      {steps.map((label, i) => {
        const n      = i + 1
        const active = currentStep === n
        const done   = currentStep > n
        return (
          <div
            key={label}
            className={[
              'flex-1 min-w-[84px] py-2.5 text-center text-[11px] font-semibold transition border-b-2 whitespace-nowrap px-1',
              active ? 'border-[#FF8A1F] text-[#FF8A1F]' : done ? 'border-transparent text-[#15803D]' : 'border-transparent text-[#94A3B8]',
            ].join(' ')}
          >
            <span className={`inline-flex h-4 w-4 items-center justify-center rounded-full mr-1 text-[9px] font-bold ${active ? 'bg-[#FF8A1F] text-white' : done ? 'bg-[#15803D] text-white' : 'bg-[#E2E8F0] text-[#94A3B8]'}`}>
              {done ? '✓' : n}
            </span>
            {label}
          </div>
        )
      })}
    </div>
  )
}
