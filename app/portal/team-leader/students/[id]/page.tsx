import { requirePortalRole, requirePermission } from '@/modules/rbac/guards'
import { createServiceClient }                  from '@/lib/supabase/service'
import { notFound }                             from 'next/navigation'
import Link                                     from 'next/link'
import { evaluateActions }                      from '@/modules/actions-engine'

function fmt(n: number) {
  return new Intl.NumberFormat('en-EG', { maximumFractionDigits: 0 }).format(n)
}
function fmtDate(iso: string | null | undefined) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

interface Props { params: Promise<{ id: string }> }

export default async function TLStudentDetailPage({ params }: Props) {
  await requirePortalRole('team_leader')
  await requirePermission('manage_students')
  const { id: studentId } = await params

  const db = createServiceClient()

  // ── Load student with full profile ────────────────────────────────────────
  const { data: stuRow } = await db
    .from('students')
    .select(`
      id, student_code, branch_id, status, enrollment_date, school_grade, emergency_contact, notes,
      users!students_user_id_fkey(email, phone, profiles!profiles_user_id_fkey(first_name, last_name)),
      branches!students_branch_id_fkey(name)
    `)
    .eq('id', studentId)
    .is('deleted_at', null)
    .maybeSingle()

  if (!stuRow) notFound()

  const s      = stuRow as any
  const user   = s.users ?? {}
  const prof   = user.profiles ?? {}
  const ec     = (s.emergency_contact ?? {}) as Record<string, string>
  const fullName = [prof.first_name, prof.last_name].filter(Boolean).join(' ') || user.email || '—'

  // ── Load ALL enrollments (active + historical) ────────────────────────────
  const { data: enrollRows } = await db
    .from('student_enrollments')
    .select(`
      id, status, start_date, end_date, enrollment_type,
      enrolled_sessions, consumed_sessions, remaining_sessions,
      total_amount, discount_amount, net_amount, financial_status,
      contract_code, created_at,
      course_name_snapshot, group_name_snapshot, instructor_name_snapshot,
      groups!student_enrollments_group_id_fkey(id, name),
      group_courses!student_enrollments_group_course_id_fkey(
        courses!group_courses_course_id_fkey(title)
      )
    `)
    .eq('student_id', studentId)
    .order('created_at', { ascending: false })

  const enrollments = (enrollRows ?? []) as any[]
  const activeEnrollments = enrollments.filter(e => e.status === 'ACTIVE')

  // ── Load financial accounts linked to enrollments ─────────────────────────
  const enrollIds    = enrollments.map(e => e.id as string)
  const { data: accRows } = enrollIds.length ? await db
    .from('student_financial_accounts')
    .select('id, enrollment_id, student_id, paid_amount, remaining_amount, status, next_due_date')
    .or(`enrollment_id.in.(${enrollIds.join(',')}),student_id.eq.${studentId}`)
    : { data: [] }

  const accByEnroll = new Map<string, any>()
  const studentAcc  = (accRows ?? []) as any[]
  for (const a of studentAcc) {
    if (a.enrollment_id) accByEnroll.set(a.enrollment_id, a)
  }
  // fallback: student-level account for enrollments without one
  const fallbackAcc = studentAcc.find((a: any) => !a.enrollment_id) ?? null

  // ── Per-enrollment aggregated data ───────────────────────────────────────
  const enriched = enrollments.map(e => {
    const acc   = accByEnroll.get(e.id) ?? fallbackAcc
    const courseName = e.course_name_snapshot ?? e.group_courses?.courses?.title ?? null
    const groupName  = e.group_name_snapshot  ?? e.groups?.name ?? null

    const actions = evaluateActions({
      remaining_sessions:  Number(e.remaining_sessions ?? 0),
      enrolled_sessions:   Number(e.enrolled_sessions  ?? 0),
      remaining_balance:   acc ? Number(acc.remaining_amount) : 0,
      days_overdue:        null,
      financial_status:    e.financial_status,
      attendance_pct:      0,
      consecutive_absences: 0,
      last_attendance_days_ago: null,
      has_assignment_submissions: true,
      total_sessions:      Number(e.enrolled_sessions ?? 0),
    })

    return { ...e, acc, courseName, groupName, actions }
  })

  return (
    <div className="space-y-5">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Link href="/portal/team-leader/students" className="text-sm text-[#94A3B8] hover:text-[#FF8A1F]">← Students</Link>
          </div>
          <h1 className="mt-1 text-xl font-bold text-[#0B1F3A]">{fullName}</h1>
          <div className="mt-1 flex items-center gap-3 text-sm text-[#64748B]">
            {s.student_code && <span className="font-mono text-xs bg-[#F1F5F9] px-2 py-0.5 rounded">#{s.student_code}</span>}
            <span className={(s.branches as any)?.name}>{(s.branches as any)?.name}</span>
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold
              ${s.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
              {s.status}
            </span>
          </div>
        </div>
        <div className="flex gap-2">
          <Link
            href={`/portal/team-leader/students/${studentId}/edit`}
            className="rounded-lg border border-[#E2E8F0] px-4 py-2 text-sm font-medium text-[#64748B] hover:border-[#CBD5E1]"
          >
            Edit
          </Link>
        </div>
      </div>

      {/* ── Profile + Contact ────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-[#E2E8F0] bg-white p-4">
          <h2 className="mb-3 text-sm font-semibold text-[#0B1F3A]">Profile</h2>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-[#94A3B8]">Email</dt>
              <dd className="text-[#0B1F3A]">{user.email ?? '—'}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-[#94A3B8]">Phone</dt>
              <dd>{user.phone ? <a href={`tel:${user.phone}`} className="text-[#0B1F3A]">{user.phone}</a> : '—'}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-[#94A3B8]">Grade</dt>
              <dd className="text-[#0B1F3A]">{s.school_grade ?? '—'}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-[#94A3B8]">Enrolled</dt>
              <dd className="text-[#0B1F3A]">{fmtDate(s.enrollment_date)}</dd>
            </div>
          </dl>
        </div>

        <div className="rounded-xl border border-[#E2E8F0] bg-white p-4">
          <h2 className="mb-3 text-sm font-semibold text-[#0B1F3A]">Parent / Guardian</h2>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-[#94A3B8]">Name</dt>
              <dd className="text-[#0B1F3A]">{ec.name ?? '—'}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-[#94A3B8]">Phone 1</dt>
              <dd>{ec.phone1 ? (
                <div className="flex items-center gap-2">
                  <a href={`tel:${ec.phone1}`} className="text-[#0B1F3A]">{ec.phone1}</a>
                  <a href={`https://wa.me/${ec.phone1.replace(/\D/g,'')}`} target="_blank" rel="noopener noreferrer" className="text-[10px] text-[#25D366] border border-[#25D366]/30 rounded px-1.5 py-0.5">WA</a>
                </div>
              ) : '—'}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-[#94A3B8]">Phone 2</dt>
              <dd>{ec.phone2 ? <a href={`tel:${ec.phone2}`} className="text-[#0B1F3A]">{ec.phone2}</a> : '—'}</dd>
            </div>
          </dl>
        </div>
      </div>

      {/* ── Active Contracts ─────────────────────────────────────────────── */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold text-[#0B1F3A]">Active Contracts ({activeEnrollments.length})</h2>
        </div>

        {activeEnrollments.length === 0 ? (
          <div className="rounded-xl border border-[#E2E8F0] bg-white px-6 py-10 text-center">
            <p className="text-sm font-medium text-[#0B1F3A]">No active contracts</p>
            <p className="mt-1 text-xs text-[#94A3B8]">Use the Enrollment Wizard to create a new contract.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {enriched.filter(e => e.status === 'ACTIVE').map(e => (
              <div key={e.id} className="rounded-xl border border-[#E2E8F0] bg-white p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-[#0B1F3A]">
                        {e.courseName ?? 'Unknown Course'}
                      </p>
                      {e.contract_code && (
                        <span className="font-mono text-[10px] text-[#94A3B8] bg-[#F1F5F9] px-1.5 py-0.5 rounded">
                          {e.contract_code}
                        </span>
                      )}
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">ACTIVE</span>
                    </div>
                    <p className="mt-0.5 text-xs text-[#64748B]">
                      {[e.groupName, e.instructor_name_snapshot].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                  <p className="text-xs text-[#94A3B8] shrink-0">{fmtDate(e.start_date)}</p>
                </div>

                {/* Contract metrics */}
                <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="rounded-lg bg-[#F8FAFC] px-2 py-2">
                    <p className={`font-bold text-sm ${
                      e.enrolled_sessions > 0 && e.remaining_sessions <= 2 ? 'text-red-600' :
                      e.enrolled_sessions > 0 && e.remaining_sessions <= 5 ? 'text-amber-600' :
                      'text-[#0B1F3A]'
                    }`}>
                      {e.enrolled_sessions > 0 ? `${e.remaining_sessions}/${e.enrolled_sessions}` : '∞'}
                    </p>
                    <p className="text-[#94A3B8]">Sessions</p>
                  </div>
                  <div className="rounded-lg bg-[#F8FAFC] px-2 py-2">
                    <p className={`font-bold text-sm ${e.acc?.remaining_amount > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                      {e.acc ? (e.acc.remaining_amount > 0 ? `EGP ${fmt(e.acc.remaining_amount)}` : 'Paid') : '—'}
                    </p>
                    <p className="text-[#94A3B8]">Balance</p>
                  </div>
                  <div className="rounded-lg bg-[#F8FAFC] px-2 py-2">
                    <p className="font-bold text-sm text-[#0B1F3A]">EGP {fmt(e.net_amount)}</p>
                    <p className="text-[#94A3B8]">Contract</p>
                  </div>
                </div>

                {/* Recommended actions */}
                {e.actions.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {e.actions.map((a: any) => (
                      <span key={a.code} title={a.description} className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${a.color} ${a.textColor}`}>
                        {a.icon} {a.label}
                      </span>
                    ))}
                  </div>
                )}

                {/* Finance quick info */}
                {e.acc?.next_due_date && (
                  <p className="mt-2 text-[11px] text-[#94A3B8]">
                    Next due: <span className="font-medium text-[#64748B]">{fmtDate(e.acc.next_due_date)}</span>
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Contract History ──────────────────────────────────────────────── */}
      {enrollments.filter(e => e.status !== 'ACTIVE').length > 0 && (
        <div>
          <h2 className="mb-3 text-base font-semibold text-[#0B1F3A]">Contract History</h2>
          <div className="rounded-xl border border-[#E2E8F0] bg-white overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                  <th className="px-4 py-3 text-left text-xs font-medium text-[#64748B]">Course</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-[#64748B]">Sessions</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-[#64748B]">Contract Value</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-[#64748B]">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-[#64748B]">Period</th>
                </tr>
              </thead>
              <tbody>
                {enriched.filter(e => e.status !== 'ACTIVE').map(e => (
                  <tr key={e.id} className="border-b border-[#E2E8F0] last:border-0 hover:bg-[#F8FAFC]">
                    <td className="px-4 py-3">
                      <p className="font-medium text-[#0B1F3A]">{e.courseName ?? '—'}</p>
                      {e.groupName && <p className="text-[11px] text-[#94A3B8]">{e.groupName}</p>}
                      {e.contract_code && <p className="font-mono text-[10px] text-[#94A3B8]">{e.contract_code}</p>}
                    </td>
                    <td className="px-4 py-3 text-[#64748B]">
                      {e.enrolled_sessions > 0 ? `${e.consumed_sessions}/${e.enrolled_sessions}` : '—'}
                    </td>
                    <td className="px-4 py-3 text-[#0B1F3A]">EGP {fmt(e.net_amount)}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold
                        ${e.status === 'COMPLETED'   ? 'bg-slate-100 text-slate-600' :
                          e.status === 'TRANSFERRED' ? 'bg-blue-100 text-blue-600' :
                          e.status === 'DROPPED'     ? 'bg-red-100 text-red-600' :
                          'bg-amber-100 text-amber-700'}`}>
                        {e.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[11px] text-[#94A3B8]">
                      {fmtDate(e.start_date)} → {fmtDate(e.end_date)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Notes ────────────────────────────────────────────────────────── */}
      {s.notes && (
        <div className="rounded-xl border border-[#E2E8F0] bg-white p-4">
          <h2 className="mb-2 text-sm font-semibold text-[#0B1F3A]">Notes</h2>
          <p className="text-sm text-[#64748B] whitespace-pre-wrap">{s.notes}</p>
        </div>
      )}
    </div>
  )
}
