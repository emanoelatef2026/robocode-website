import { requirePortalRole }       from '@/modules/rbac/guards'
import { getParentChildren }       from '@/modules/parents/parent-portal-queries'
import { getParentChildFinance }   from '@/modules/finance/queries'
import Link                        from 'next/link'
import {
  STATUS_COLORS, STATUS_LABELS, INSTALLMENT_STATUS_COLORS, PAYMENT_METHOD_LABELS,
} from '@/modules/finance/types'

interface Props {
  searchParams: Promise<{ child?: string }>
}

function fmt(n: number) {
  return new Intl.NumberFormat('en-EG', { maximumFractionDigits: 0 }).format(n)
}
function dateFmt(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default async function ParentFinancePage({ searchParams }: Props) {
  const { child: childParam } = await searchParams
  const user     = await requirePortalRole('parent')
  const children = await getParentChildren(user.id)

  if (!children.length) {
    return (
      <div className="flex min-h-60 items-center justify-center">
        <p className="text-sm text-[#64748B]">No children linked to your account.</p>
      </div>
    )
  }

  const studentId = childParam ?? children[0].student_id
  const selected  = children.find(c => c.student_id === studentId) ?? children[0]
  const data      = await getParentChildFinance(user.id, selected.student_id)

  return (
    <div className="mx-auto max-w-2xl space-y-5">

      {/* Child switcher */}
      {children.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {children.map(c => (
            <Link
              key={c.student_id}
              href={`/portal/parent/finance?child=${c.student_id}`}
              className={[
                'flex items-center gap-2 rounded-full border px-3 py-1.5 text-[13px] font-medium transition-all',
                c.student_id === selected.student_id
                  ? 'border-[#FF8A1F] bg-[#FF8A1F]/10 text-[#FF8A1F]'
                  : 'border-[#E2E8F0] bg-white text-[#64748B] hover:border-[#CBD5E1]',
              ].join(' ')}
            >
              <span className={[
                'flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-bold',
                c.student_id === selected.student_id ? 'bg-[#FF8A1F] text-white' : 'bg-[#E2E8F0] text-[#64748B]',
              ].join(' ')}>
                {c.student_name.charAt(0).toUpperCase()}
              </span>
              {c.student_name}
            </Link>
          ))}
        </div>
      )}

      {/* No finance account */}
      {!data ? (
        <div className="rounded-xl border border-[#E2E8F0] bg-white px-6 py-12 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[#F1F5F9]">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-6 w-6 text-[#94A3B8]">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <p className="font-medium text-[#0B1F3A]">No financial account found</p>
          <p className="mt-1 text-sm text-[#94A3B8]">
            Contact the academy to set up a financial account for {selected.student_name}.
          </p>
        </div>
      ) : (
        <>
          {/* Financial summary card */}
          <div className="rounded-xl border border-[#E2E8F0] bg-white overflow-hidden">
            <div className="bg-gradient-to-br from-[#0B1F3A] to-[#1a3460] px-5 py-4 text-white">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-white/40">Finance Account</p>
              <h1 className="mt-1 text-xl font-bold">{selected.student_name}</h1>
              <div className="mt-3 flex items-center gap-2">
                <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${
                  data.account.status === 'PAID'     ? 'border-emerald-300 bg-emerald-500/20 text-emerald-200' :
                  data.account.status === 'OVERDUE'  ? 'border-red-300 bg-red-500/20 text-red-200' :
                  data.account.status === 'DUE_SOON' ? 'border-amber-300 bg-amber-500/20 text-amber-200' :
                  'border-white/20 bg-white/10 text-white/70'
                }`}>
                  {STATUS_LABELS[data.account.status as keyof typeof STATUS_LABELS]}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 divide-x divide-[#E2E8F0] border-t border-[#E2E8F0]">
              {[
                { label: 'Total',     value: `EGP ${fmt(data.account.total_amount)}`,     cls: 'text-[#0B1F3A]' },
                { label: 'Discount',  value: `-EGP ${fmt(data.account.discount_amount)}`, cls: 'text-emerald-600' },
                { label: 'Net Total', value: `EGP ${fmt(data.account.net_amount)}`,       cls: 'font-bold text-[#0B1F3A]' },
                { label: 'Paid',      value: `EGP ${fmt(data.account.paid_amount)}`,      cls: 'font-bold text-emerald-600' },
                { label: 'Remaining', value: `EGP ${fmt(data.account.remaining_amount)}`, cls: `font-bold ${data.account.remaining_amount > 0 ? 'text-red-500' : 'text-emerald-600'}` },
                { label: 'Next Due',  value: dateFmt(data.account.next_due_date),         cls: 'text-[#0B1F3A]' },
              ].map(({ label, value, cls }) => (
                <div key={label} className="px-4 py-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-[#94A3B8]">{label}</p>
                  <p className={`mt-0.5 text-sm ${cls}`}>{value}</p>
                </div>
              ))}
            </div>

            {/* Progress bar */}
            {data.account.net_amount > 0 && (
              <div className="border-t border-[#E2E8F0] px-5 py-3">
                <div className="flex items-center justify-between mb-1.5">
                  <p className="text-xs text-[#64748B]">Payment progress</p>
                  <p className="text-xs font-semibold text-[#0B1F3A]">
                    {Math.round((data.account.paid_amount / data.account.net_amount) * 100)}%
                  </p>
                </div>
                <div className="h-2.5 w-full overflow-hidden rounded-full bg-[#F1F5F9]">
                  <div
                    className="h-full rounded-full bg-[#FF8A1F]"
                    style={{ width: `${Math.min(100, Math.round((data.account.paid_amount / data.account.net_amount) * 100))}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Installments */}
          {data.installments.length > 0 && (
            <div>
              <h2 className="mb-3 text-sm font-semibold text-[#0B1F3A]">Installment Schedule</h2>
              <div className="space-y-2">
                {(data.installments as any[]).map((inst: any) => (
                  <div key={inst.id} className="flex items-center justify-between rounded-xl border border-[#E2E8F0] bg-white px-4 py-3">
                    <div>
                      <p className="text-sm font-semibold text-[#0B1F3A]">Installment #{inst.installment_number}</p>
                      <p className="text-[12px] text-[#64748B]">Due: {dateFmt(inst.due_date)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-[#0B1F3A]">EGP {fmt(Number(inst.amount))}</p>
                      <span className={`text-[11px] font-semibold ${
                        INSTALLMENT_STATUS_COLORS[inst.status as keyof typeof INSTALLMENT_STATUS_COLORS]
                      } rounded-full px-2 py-0.5`}>
                        {inst.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Payment history */}
          {data.payments.length > 0 && (
            <div>
              <h2 className="mb-3 text-sm font-semibold text-[#0B1F3A]">Payment History</h2>
              <div className="space-y-2">
                {(data.payments as any[]).map((p: any, i: number) => (
                  <div key={i} className="flex items-center justify-between rounded-xl border border-[#E2E8F0] bg-white px-4 py-3">
                    <div>
                      <p className="text-sm font-semibold text-emerald-600">EGP {fmt(Number(p.amount))}</p>
                      <p className="text-[12px] text-[#64748B]">{dateFmt(p.payment_date)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-[#64748B]">
                        {PAYMENT_METHOD_LABELS[p.payment_method as keyof typeof PAYMENT_METHOD_LABELS] ?? p.payment_method}
                      </p>
                      {p.reference_number && (
                        <p className="text-[11px] text-[#94A3B8]">#{p.reference_number}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Contact note */}
          {data.account.remaining_amount > 0 && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-4">
              <p className="text-sm font-semibold text-amber-800">Outstanding Balance</p>
              <p className="mt-1 text-xs text-amber-700">
                A balance of EGP {fmt(data.account.remaining_amount)} remains. Please contact the academy to arrange payment.
                {data.account.next_due_date && ` Next due date: ${dateFmt(data.account.next_due_date)}.`}
              </p>
            </div>
          )}
        </>
      )}
    </div>
  )
}
