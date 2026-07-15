import { requirePortalRole }       from '@/modules/rbac/guards'
import { getParentChildren }       from '@/modules/parents/parent-portal-queries'
import { getParentChildFinance }   from '@/modules/finance/queries'
import { listStudentEnrollments }  from '@/modules/enrollments/queries'
import ChildSelector               from '@/components/portal/parent/ChildSelector'
import NoChildrenLinked            from '@/components/portal/parent/NoChildrenLinked'
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
    return <NoChildrenLinked />
  }

  const studentId = childParam ?? children[0].student_id
  const selected  = children.find(c => c.student_id === studentId) ?? children[0]

  // Load finance + enrollments in parallel
  const [accounts, enrollments] = await Promise.all([
    getParentChildFinance(user.id, selected.student_id),
    listStudentEnrollments(user.id, selected.student_id),
  ])

  // Label each account with the enrollment it belongs to, when known, so a
  // family with 2+ concurrent courses can tell which balance is which.
  const enrollmentById = new Map(enrollments.map(e => [e.id, e]))

  const activeEnrollments = enrollments.filter(e => e.status === 'ACTIVE')

  return (
    <div className="mx-auto max-w-3xl space-y-5">

      {/* Child switcher */}
      <ChildSelector
        linkedChildren={children}
        selectedId={selected.student_id}
        hrefFor={(id) => `/portal/parent/finance?child=${id}`}
      />

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
                          <p className="text-[#64748B]">Course Fee</p>
                          <p className="font-semibold text-[#0B1F3A]">EGP {fmt(enroll.net_amount)}</p>
                        </div>
                        {enroll.discount_amount > 0 && (
                          <div>
                            <p className="text-[#64748B]">Discount</p>
                            <p className="font-semibold text-[#10B981]">-EGP {fmt(enroll.discount_amount)}</p>
                          </div>
                        )}
                        <div>
                          <p className="text-[#64748B]">Since</p>
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

      {/* ── Finance Accounts ────────────────────────────────────────────── */}
      {/* A family with 2+ concurrent enrollments may have 2+ accounts — one
          card per account, not one card total. `accounts === null` means
          access was denied (not linked, or can_view_financials is off);
          `[]` means the link is valid but no account exists yet. These are
          different situations and must not share one message. */}
      {accounts === null ? (
        <div className="ds-card px-6 py-12 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[#F1F5F9]">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-6 w-6 text-[#64748B]">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <p className="font-medium text-[#0B1F3A]">Financial access restricted</p>
          <p className="mt-1 text-sm text-[#64748B]">
            You don&apos;t have permission to view {selected.student_name}&apos;s financial information. Contact the academy if you believe this is incorrect.
          </p>
        </div>
      ) : accounts.length === 0 ? (
        <div className="ds-card px-6 py-12 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[#F1F5F9]">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-6 w-6 text-[#64748B]">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <p className="font-medium text-[#0B1F3A]">No financial account found</p>
          <p className="mt-1 text-sm text-[#64748B]">
            Contact the academy to set up a financial account for {selected.student_name}.
          </p>
        </div>
      ) : (
        accounts.map(({ enrollment_id, account, installments, payments }) => {
          const enrollment = enrollment_id ? enrollmentById.get(enrollment_id) : undefined
          const label = enrollment
            ? (enrollment.group_name_snapshot ?? enrollment.group_name ?? enrollment.course_name_snapshot ?? enrollment.course_title)
            : null

          return (
            <div key={account.id} className="space-y-3">
              {/* Financial summary card */}
              <div className="ds-card overflow-hidden">
                <div className="bg-linear-to-br from-[#0B1F3A] to-[#1a3460] px-5 py-4 text-white">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-white/40">
                    {label ?? 'Payment Summary'}
                  </p>
                  <h1 className="mt-1 text-xl font-bold">{selected.student_name}</h1>
                  <div className="mt-3 flex items-center gap-2">
                    <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${
                      account.status === 'PAID'     ? 'border-emerald-300 bg-[#10B981]/20 text-emerald-200' :
                      account.status === 'OVERDUE'  ? 'border-[#FCA5A5] bg-[#EF4444]/20 text-red-200' :
                      account.status === 'DUE_SOON' ? 'border-amber-300 bg-[#F59E0B]/20 text-amber-200' :
                      'border-white/20 bg-white/10 text-white/70'
                    }`}>
                      {STATUS_LABELS[account.status as keyof typeof STATUS_LABELS]}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 border-t border-[#E2E8F0]">
                  {(() => {
                    const items = [
                      { label: 'Total',     value: `EGP ${fmt(account.total_amount)}`,     cls: 'text-[#0B1F3A]' },
                      { label: 'Discount',  value: `-EGP ${fmt(account.discount_amount)}`, cls: 'text-[#10B981]' },
                      { label: 'Net Total', value: `EGP ${fmt(account.net_amount)}`,       cls: 'font-bold text-[#0B1F3A]' },
                      { label: 'Paid',      value: `EGP ${fmt(account.paid_amount)}`,      cls: 'font-bold text-[#10B981]' },
                      { label: 'Remaining', value: `EGP ${fmt(account.remaining_amount)}`, cls: `font-bold ${account.remaining_amount > 0 ? 'text-[#EF4444]' : 'text-[#10B981]'}` },
                      { label: 'Next Due',  value: dateFmt(account.next_due_date),         cls: 'text-[#0B1F3A]' },
                    ]
                    return items.map(({ label: itemLabel, value, cls }, i) => (
                      <div
                        key={itemLabel}
                        className={[
                          'px-4 py-3 border-[#E2E8F0]',
                          i % 2 === 0 ? 'border-r' : '',
                          i < items.length - 2 ? 'border-b' : '',
                        ].join(' ')}
                      >
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-[#64748B]">{itemLabel}</p>
                        <p className={`mt-0.5 text-sm ${cls}`}>{value}</p>
                      </div>
                    ))
                  })()}
                </div>

                {/* Progress bar */}
                {account.net_amount > 0 && (
                  <div className="border-t border-[#E2E8F0] px-5 py-3">
                    <div className="flex items-center justify-between mb-1.5">
                      <p className="text-xs text-[#64748B]">Payment progress</p>
                      <p className="text-xs font-semibold text-[#0B1F3A]">
                        {Math.round((account.paid_amount / account.net_amount) * 100)}%
                      </p>
                    </div>
                    <div className="h-2.5 w-full overflow-hidden rounded-full bg-[#F1F5F9]">
                      <div
                        className="h-full rounded-full bg-[#FF8A1F]"
                        style={{ width: `${Math.min(100, Math.round((account.paid_amount / account.net_amount) * 100))}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Installments */}
              {installments.length > 0 && (
                <div>
                  <h2 className="mb-3 text-sm font-semibold text-[#0B1F3A]">Installment Schedule</h2>
                  <div className="space-y-2">
                    {(installments as any[]).map((inst: any) => (
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
              {payments.length > 0 && (
                <div>
                  <h2 className="mb-3 text-sm font-semibold text-[#0B1F3A]">Payment History</h2>
                  <div className="space-y-2">
                    {(payments as any[]).map((p: any, i: number) => (
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
                            <p className="text-[11px] text-[#64748B]">#{p.reference_number}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Outstanding balance warning */}
              {account.remaining_amount > 0 && (
                <div className="rounded-xl border border-[#FDE68A] bg-[#FFFBEB] px-5 py-4">
                  <p className="text-sm font-semibold text-[#92400E]">Outstanding Balance</p>
                  <p className="mt-1 text-xs text-[#B45309]">
                    A balance of EGP {fmt(account.remaining_amount)} remains. Please contact the academy to arrange payment.
                    {account.next_due_date && ` Next due date: ${dateFmt(account.next_due_date)}.`}
                  </p>
                </div>
              )}
            </div>
          )
        })
      )}
    </div>
  )
}
