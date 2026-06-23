import { requireAuth }       from '@/modules/rbac/guards'
import { redirect }           from 'next/navigation'
import { createServiceClient } from '@/lib/supabase/service'
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
      <div className="mb-6 flex justify-end">
        <Link
          href="/admin/payroll"
          className="inline-flex items-center gap-2 rounded-lg border border-[#E2E8F0] px-4 py-2 text-sm font-medium text-[#64748B] hover:border-[#FF8A1F] hover:text-[#FF8A1F] transition"
        >
          View Payroll →
        </Link>
      </div>

      <div className="rounded-xl border border-[#E2E8F0] bg-white">
        {staff.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
            <p className="text-sm font-medium text-[#0B1F3A]">No staff members found</p>
            <p className="mt-1 text-xs text-[#94A3B8]">Staff members are managed through the Payroll page.</p>
            <Link
              href="/admin/payroll?tab=staff"
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[#FF8A1F] px-4 py-2 text-sm font-medium text-white hover:bg-[#e87c18]"
            >
              Open Payroll
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                  <th className="px-4 py-3 text-left text-xs font-medium text-[#64748B]">Name</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-[#64748B]">Role</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-[#64748B]">Branch</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-[#64748B]">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-[#64748B]">Payroll</th>
                </tr>
              </thead>
              <tbody>
                {staff.map((s) => (
                  <tr key={s.id} className="border-b border-[#E2E8F0] last:border-0 hover:bg-[#F8FAFC]">
                    <td className="px-4 py-3 font-medium text-[#0B1F3A]">{s.full_name}</td>
                    <td className="px-4 py-3 text-[#64748B] capitalize">{s.role ?? '—'}</td>
                    <td className="px-4 py-3 text-[#64748B]">{(s.branches as any)?.name ?? '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-medium capitalize
                        ${s.employment_status === 'active' ? 'bg-emerald-100 text-emerald-700' :
                          s.employment_status === 'on_leave' ? 'bg-amber-100 text-amber-700' :
                          'bg-slate-100 text-slate-600'}`}>
                        {s.employment_status ?? 'unknown'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[#64748B] capitalize">{s.payroll_type ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
