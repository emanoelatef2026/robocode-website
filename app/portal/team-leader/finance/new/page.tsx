import { requirePermission }   from '@/modules/rbac/guards'
import { createServiceClient } from '@/lib/supabase/service'
import { listGroups }          from '@/modules/groups/queries'
import NewFinanceAccountForm   from '@/app/admin/finance/new/NewFinanceAccountForm'

export default async function TLNewFinanceAccountPage() {
  const user = await requirePermission('manage_financials')
  const db   = createServiceClient()

  const branchId = user.branchIds[0]

  const [groupsRes, studentsRes, branchRes] = await Promise.all([
    listGroups({ branchId, perPage: 200 }),
    db.from('students')
      .select(`id, student_code, users!students_user_id_fkey(email, profiles!profiles_user_id_fkey(first_name, last_name))`)
      .eq('branch_id', branchId)
      .eq('status', 'active')
      .is('deleted_at', null)
      .limit(300),
    db.from('branches').select('id, name').eq('id', branchId).single(),
  ])

  const students = ((studentsRes.data ?? []) as any[]).map(s => {
    const p    = s.users?.profiles
    const name = [p?.first_name, p?.last_name].filter(Boolean).join(' ') || s.users?.email || 'Unknown'
    return { id: s.id as string, name, code: s.student_code as string | null }
  })

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-[#0B1F3A]">New Financial Account</h1>
        <p className="mt-0.5 text-sm text-[#64748B]">Create a finance account for a student in your branch.</p>
      </div>
      <NewFinanceAccountForm
        branches={[{ id: branchId, name: (branchRes.data as any)?.name ?? 'Your Branch' }]}
        groups={(groupsRes.data as any[]).map((g: any) => ({ id: g.id, name: g.name }))}
        students={students}
      />
    </div>
  )
}
