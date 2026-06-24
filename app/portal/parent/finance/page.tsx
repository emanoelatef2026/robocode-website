import { requirePortalRole }       from '@/modules/rbac/guards'
import { getParentChildren }       from '@/modules/parents/parent-portal-queries'
import { getParentChildFinance }   from '@/modules/finance/queries'
import { listStudentEnrollments }  from '@/modules/enrollments/queries'
import Link                        from 'next/link'
import {
  STATUS_COLORS, STATUS_LABELS, INSTALLMENT_STATUS_COLORS, PAYMENT_METHOD_LABELS,
} from '@/modules/finance/types'
import { ENROLLMENT_STATUS_COLORS, ENROLLMENT_STATUS_LABELS } from '@/modules/enrollments/types'

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

  // Load finance + enrollments in parallel
  const [data, enrollments] = await Promise.all([
    getParentChildFinance(user.id, selected.student_id),
    listStudentEnrollments(selected.student_id),
  ])

  const activeEnrollments = enrollments.filter(e => e.status === 'ACTIVE')

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

      {/* ── Active Enrollments ─────────────────────────────────────────── */}
      {activeEnrollments.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold text-[#0B1F3A]">Current Enrollments</h2>
          <div className="space-y-3">
            {activeEnrollments.map(enroll => {
              const attendancePct = enroll.expected_sessions > 0
                ? Math.round((enroll.attendance_count / enroll.expected_sessions) * 100)
                : 0
              // Sprint 44: session package progress
              const hasSessions  = enroll.enrolled_sessions > 0
              const sessProgress = hasSessions
                ? Math.min(100, Math.round((enroll.consumed_sessions / enroll.enrolled_sessions) * 100))
                : 0

              return (
                <div key={enroll.id} className="overflow-hidden ds-card">
                  {/* Card header */}
                  <div className="bg-linear-to-br from-[#0B1F3A] to-[#1a3460] px-4 py-3 text-white">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold">
                          {enroll.group_name_snapshot ?? enroll.group_name ?? 'Unknown Group'}
                        </p>
                        {(enroll.course_name_snapshot ?? enroll.course_title) && (
                          <p className="text-xs text-white/70 mt-0.5">
                            {enroll.course_name_snapshot ?? enroll.course_title}
                          </p>
                        )}
                        {(enroll.instructor_name_snapshot ?? enroll.instructor_name) && (
                          <p className="text-[11px] text-white/50 mt-0.5">
                            {enroll.instructor_name_snapshot ?? enroll.instructor_name}
                          </p>
                        )}
                      </div>
                      <span className="shrink-0 rounded-full border border-white/20 bg-white/10 px-2 py-0.5 text-[10px] font-semibold text-white/80">
                        {ENROLLMENT_STATUS_LABELS[enroll.status]}
                      </span>
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="px-4 py-3 space-y-3">

                    {/* Session package progress (Sprint 44) */}
                    {hasSessions && (
                      <div>
                        <div className="mb-1 flex items-center justify-between text-xs">
                          <span className="text-[#64748B]">Session Package</span>
                          <span className="font-semibold text-[#0B1F3A]">
                            {enroll.consumed_sessions} / {enroll.enrolled_sessions} sessions
                            {enroll.remaining_sessions > 0 && (
                              <span className="ml-1 text-[#10B981]">({enroll.remaining_sessions} remaining)</span>
                            )}
                          </span>
                        </div>
                        <div className="h-2 w-full rounded-full bg-[#F1F5F9]">
                          <div
                            className={`h-full rounded-full ${
                              sessProgress >= 90 ? 'bg-[#EF4444]' : sessProgress >= 70 ? 'bg-[#F59E0B]' : 'bg-[#3B82F6]'
                            }`}
                            style={{ width: `${sessProgress}%` }}
                          />
                        </div>
                      </div>
                    )}

                    {/* Attendance bar */}
                    {enroll.expected_sessions > 0 && (
                      <div>
                        <div className="mb-1 flex items-center justify-between text-xs">
                          <span className="text-[#64748B]">Attendance</span>
                          <span className={`font-semibold ${
                            attendancePct >= 80 ? 'text-[#10B981]' :
                            attendancePct >= 60 ? 'text-[#F59E0B]' : 'text-[#EF4444]'
                          }`}>
                            {enroll.attendance_count} / {enroll.expected_sessions} sessions ({attendancePct}%)
                          </span>
                        </div>
                        <div className="h-2 w-full rounded-full bg-[#F1F5F9]">
                          <div
                            className={`h-full rounded-full ${
                              attendancePct >= 80 ? 'bg-[#10B981]' :
                              attendancePct >= 60 ? 'bg-[#F59E0B]' : 'bg-[#EF4444]'
                            }`}
                            style={{ width: `${Math.min(100, attendancePct)}%` }}
                          />
                        </div>
                      </div>
                    )}

                    {/* Pricing row */}
                    {enroll.net_amount > 0 && (
                      <div className="grid grid-cols-3 gap-2 border-t border-[#F1F5F9] pt-2 text-[11px]">
                        <div>
                          <p className="text-[#94A3B8]">Course Fee</p>
                          <p className="font-semibold text-[#0B1F3A]">EGP {fmt(enroll.net_amount)}</p>
                        </div>
                        {enroll.discount_amount > 0 && (
                          <div>
                            <p className="text-[#94A3B8]">Discount</p>
                            <p className="font-semibold text-[#10B981]">-EGP {fmt(enroll.discount_amount)}</p>
                          </div>
                        )}
                        <div>
                          <p className="text-[#94A3B8]">Since</p>
                          <p className="font-semibold text-[#0B1F3A]">{dateFmt(enroll.start_date)}</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* ── Finance Account ─────────────────────────────────────────────── */}
      {!data ? (
        <div className="ds-card px-6 py-12 text-center">
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
          <div className="ds-card overflow-hidden">
            <div className="bg-linear-to-br from-[#0B1F3A] to-[#1a3460] px-5 py-4 text-white">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-white/40">Payment Summary</p>
              <h1 className="mt-1 text-xl font-bold">{selected.student_name}</h1>
              <div className="mt-3 flex items-center gap-2">
                <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${
                  data.account.status === 'PAID'     ? 'border-emerald-300 bg-[#10B981]/20 text-emerald-200' :
                  data.account.status === 'OVERDUE'  ? 'border-[#FCA5A5] bg-[#EF4444]/20 text-red-200' :
                  data.account.status === 'DUE_SOON' ? 'border-amber-300 bg-[#F59E0B]/20 text-amber-200' :
                  'border-white/20 bg-white/10 text-white/70'
                }`}>
                  {STATUS_LABELS[data.account.status as keyof typeof STATUS_LABELS]}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 divide-x divide-[#E2E8F0] border-t border-[#E2E8F0]">
              {[
                { label: 'Total',     value: `EGP ${fmt(data.account.total_amount)}`,     cls: 'text-[#0B1F3A]' },
                { label: 'Discount',  value: `-EGP ${fmt(data.account.discount_amount)}`, cls: 'text-[#10B981]' },
                { label: 'Net Total', value: `EGP ${fmt(data.account.net_amount)}`,       cls: 'font-bold text-[#0B1F3A]' },
                { label: 'Paid',      value: `EGP ${fmt(data.account.paid_amount)}`,      cls: 'font-bold text-[#10B981]' },
                { label: 'Remaining', value: `EGP ${fmt(data.account.remaining_amount)}`, cls: `font-bold ${data.account.remaining_amount > 0 ? 'text-[#EF4444]' : 'text-[#10B981]'}` },
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
                  <div key={inst.id} className="flex items-center justify-between ds-card px-4 py-3">
                    <div>
                      <p className="text-sm font-semibold text-[#0B1F3A]">Installment #{inst.installment_number}</p>
                      <p className="text-[12px] text-[#64748B]">Due: {dateFmt(inst.due_date)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-[#0B1F3A]">EGP {fmt(Number(inst.amount))}</p>
                      <span className={`text-[11px] font-semibold ${INSTALLMENT_STATUS_COLORS[inst.status as keyof typeof INSTALLMENT_STATUS_COLORS] ?? ''} rounded-full px-2 py-0.5`}>
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
                  <div key={i} className="flex items-center justify-between ds-card px-4 py-3">
                    <div>
                      <p className="text-sm font-semibold text-[#10B981]">EGP {fmt(Number(p.amount))}</p>
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

          {/* Outstanding balance warning */}
          {data.account.remaining_amount > 0 && (
            <div className="rounded-xl border border-[#FDE68A] bg-[#FFFBEB] px-5 py-4">
              <p className="text-sm font-semibold text-[#92400E]">Outstanding Balance</p>
              <p className="mt-1 text-xs text-[#B45309]">
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
