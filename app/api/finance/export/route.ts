import { NextRequest, NextResponse }   from 'next/server'
import { getCurrentUser }              from '@/modules/rbac/guards'
import { listStudentOperations }       from '@/modules/finance/queries'
import type { StudentOpsFilters }      from '@/modules/finance/types'

export async function GET(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user || !user.permissions.includes('manage_financials')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = req.nextUrl
  const branchParam  = searchParams.get('branch')
  const branchsParam = searchParams.get('branches')
  const statusParam  = searchParams.get('status')

  // Resolve branch scope
  let requestedIds: string[] = []
  if (branchsParam) {
    requestedIds = branchsParam.split(',').map(s => s.trim()).filter(Boolean)
  } else if (branchParam) {
    requestedIds = [branchParam]
  }

  const effectiveIds =
    user.globalRole === 'super_admin'
      ? requestedIds.length > 0 ? requestedIds : []
      : requestedIds.length > 0
        ? requestedIds.filter(id => user.branchIds.includes(id))
        : user.branchIds

  if (!effectiveIds.length) {
    return NextResponse.json({ error: 'No accessible branches' }, { status: 400 })
  }

  const filters: StudentOpsFilters = {}
  if (statusParam) filters.financial_status = statusParam as any

  const rows = await listStudentOperations(effectiveIds, filters)

  const headers = [
    'Student Name', 'Student Code', 'Phone', 'Parent Name', 'Parent Phone 1', 'Parent Phone 2',
    'Branch', 'Group', 'Instructor', 'Enrollment Start Date',
    // Session contract (Sprint 44)
    'Sessions Enrolled', 'Sessions Consumed', 'Sessions Remaining',
    // Attendance
    'Total Sessions', 'Sessions Attended', 'Attendance %', 'Last Attendance', 'Consecutive Absences',
    // Finance
    'Financial Status', 'Total (EGP)', 'Paid (EGP)', 'Remaining (EGP)',
    'Installments Paid', 'Installments Remaining', 'Next Due Date', 'Days Overdue', 'Payment %',
    // Risk
    'Risk Level', 'Risk Flags',
  ]

  const escape = (v: string | number | null | undefined) => {
    if (v === null || v === undefined) return ''
    const s = String(v)
    if (s.includes(',') || s.includes('"') || s.includes('\n')) {
      return `"${s.replace(/"/g, '""')}"`
    }
    return s
  }

  const csvRows = rows.map(r => [
    r.student_name,
    r.student_code ?? '',
    r.student_phone ?? '',
    r.parent_name ?? '',
    r.parent_phone_1 ?? '',
    r.parent_phone_2 ?? '',
    r.branch_name,
    r.group_name ?? '',
    r.instructor_name ?? '',
    r.group_start_date ?? '',
    // Session contract
    r.enrolled_sessions > 0 ? r.enrolled_sessions : '',
    r.consumed_sessions > 0 ? r.consumed_sessions : '',
    r.enrolled_sessions > 0 ? r.remaining_sessions : '',
    // Attendance
    r.total_sessions,
    r.sessions_attended,
    r.attendance_pct > 0 ? `${r.attendance_pct}%` : '',
    r.last_attendance_date ?? '',
    r.consecutive_absences,
    // Finance
    r.financial_status ?? '',
    r.net_amount > 0 ? r.net_amount : '',
    r.paid_amount > 0 ? r.paid_amount : '',
    r.remaining_amount > 0 ? r.remaining_amount : '',
    r.installments_paid,
    r.installments_remaining,
    r.next_due_date ?? '',
    r.days_overdue > 0 ? r.days_overdue : '',
    r.payment_progress_pct > 0 ? `${r.payment_progress_pct}%` : '',
    r.risk_level,
    r.risk_flags.join('; '),
  ].map(escape).join(','))

  const csv  = [headers.join(','), ...csvRows].join('\n')
  const date = new Date().toISOString().slice(0, 10)

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type':        'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="student-operations-${date}.csv"`,
    },
  })
}
