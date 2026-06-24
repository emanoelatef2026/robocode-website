import { requireAuth }       from '@/modules/rbac/guards'
import { redirect }           from 'next/navigation'
import { createServiceClient } from '@/lib/supabase/service'
import PageHeader              from '@/components/admin/PageHeader'
import EmptyState              from '@/components/admin/EmptyState'
import Link from 'next/link'

async function getStaffList() {
  const db = createServiceClient()
  const { data } = await db
    .from('staff_members')
    .select('id, full_name, role, branch_id, employment_status, payroll_type, created_at, branches(name)')
    .order('full_name')
  return (data ?? []) as any[]
}

export default async function AdminStaffPage() {
  const user = await requireAuth()
  if (user.globalRole !== 'super_admin') redirect('/admin')

  const staff = await getStaffList()

  return (
    <div>
      <PageHeader
        title="Staff"
        description="All non-instructor staff members across branches"
        action={
          <Link href="/admin/payroll" className="ds-btn-ghost text-[12px]">
            View Payroll →
          </Link>
        }
      />

      {staff.length === 0 ? (
        <EmptyState
          title="No staff members"
          description="Staff members are managed through the Payroll page."
          action={
            <Link href="/admin/payroll?tab=staff" className="ds-btn-orange">
              Open Payroll
            </Link>
          }
        />
      ) : (
        <div className="ds-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="ds-table-head">
                <tr>
                  <th>Name</th>
                  <th>Role</th>
                  <th>Branch</th>
                  <th>Status</th>
                  <th>Payroll</th>
                </tr>
              </thead>
              <tbody>
                {staff.map((s) => (
                  <tr key={s.id} className="ds-table-row">
                    <td className="font-semibold text-[#0B1F3A]">{s.full_name}</td>
                    <td className="text-[#64748B] capitalize">{s.role ?? '—'}</td>
                    <td className="text-[#64748B]">{(s.branches as any)?.name ?? '—'}</td>
                    <td>
                      <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[10.5px] font-bold capitalize
                        ${s.employment_status === 'active' ? 'bg-[#E7F8EE] text-[#15803D]' :
                          s.employment_status === 'on_leave' ? 'bg-[#FFFBEB] text-[#B45309]' :
                          'bg-[#F1F5F9] text-[#475569]'}`}>
                        {s.employment_status ?? 'unknown'}
                      </span>
                    </td>
                    <td className="text-[#64748B] capitalize">{s.payroll_type ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
