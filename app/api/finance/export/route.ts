import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient }       from '@/lib/supabase/service'
import { getCurrentUser }            from '@/modules/rbac/guards'
import { computePriority, computeDaysOverdue } from '@/modules/finance/types'

export async function GET(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user || !user.permissions.includes('manage_financials')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = req.nextUrl
  const branchId = searchParams.get('branch')
  const status   = searchParams.get('status')
  const db       = createServiceClient()

  let q = db
    .from('student_financial_accounts')
    .select(
      `id, status, total_amount, discount_amount, net_amount, paid_amount, remaining_amount, next_due_date,
       students!student_financial_accounts_student_id_fkey(
         student_code, emergency_contact,
         users!students_user_id_fkey(email, phone, profiles!profiles_user_id_fkey(first_name, last_name))
       ),
       branches!student_financial_accounts_branch_id_fkey(name),
       groups!student_financial_accounts_group_id_fkey(name)`
    )
    .order('status')
    .order('remaining_amount', { ascending: false })

  if (branchId) q = (q as any).eq('branch_id', branchId)
  if (status)   q = (q as any).eq('status', status)

  // Scope TLs to their branches
  if (user.globalRole !== 'super_admin' && user.branchIds.length > 0) {
    q = (q as any).in('branch_id', user.branchIds)
  }

  const { data, error } = await q.limit(2000)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const rows = (data ?? []) as any[]

  const csvHeaders = [
    'Student Name', 'Student Code', 'Email', 'Phone',
    'Parent Name', 'Parent Phone 1', 'Parent Phone 2',
    'Branch', 'Group',
    'Total (EGP)', 'Discount (EGP)', 'Net Total (EGP)',
    'Paid (EGP)', 'Remaining (EGP)',
    'Next Due Date', 'Status', 'Priority', 'Days Overdue',
  ]

  const escape = (v: string | number | null | undefined) => {
    if (v === null || v === undefined) return ''
    const s = String(v)
    if (s.includes(',') || s.includes('"') || s.includes('\n')) {
      return `"${s.replace(/"/g, '""')}"`
    }
    return s
  }

  const csvRows = rows.map(row => {
    const s   = row.students   ?? {}
    const u   = s.users        ?? {}
    const p   = u.profiles     ?? {}
    const ec  = (s.emergency_contact ?? {}) as Record<string, string>
    const prio = computePriority({ status: row.status, remaining_amount: Number(row.remaining_amount), next_due_date: row.next_due_date })
    const days = computeDaysOverdue(row.next_due_date)

    return [
      [p.first_name, p.last_name].filter(Boolean).join(' ') || u.email || '',
      s.student_code ?? '',
      u.email ?? '',
      u.phone ?? '',
      ec.name   ?? '',
      ec.phone1 ?? '',
      ec.phone2 ?? '',
      (row.branches as any)?.name ?? '',
      (row.groups   as any)?.name ?? '',
      Number(row.total_amount),
      Number(row.discount_amount),
      Number(row.net_amount),
      Number(row.paid_amount),
      Number(row.remaining_amount),
      row.next_due_date ?? '',
      row.status,
      prio,
      days,
    ].map(escape).join(',')
  })

  const csv  = [csvHeaders.join(','), ...csvRows].join('\n')
  const date = new Date().toISOString().slice(0, 10)

  return new NextResponse(csv, {
    status:  200,
    headers: {
      'Content-Type':        'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="finance-export-${date}.csv"`,
    },
  })
}
