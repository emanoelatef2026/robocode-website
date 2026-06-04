import { requirePermission }   from '@/modules/rbac/guards'
import { createServiceClient } from '@/lib/supabase/service'
import { listGroups }          from '@/modules/groups/queries'
import NewFinanceAccountForm   from '@/app/admin/finance/new/NewFinanceAccountForm'

export default async function TLNewFinanceAccountPage() {
  const user = await requirePermission('manage_financials')
  const db   = createServiceClient()

  const branchIds = user.branchIds
  if (!branchIds.length) {
    return (
      <div className="mx-auto max-w-2xl space-y-5">
        <div>
          <h1 className="text-xl font-semibold text-[#0B1F3A]">New Financial Account</h1>
        </div>
        <div className="rounded-xl border border-[#E2E8F0] bg-white px-6 py-12 text-center">
          <p className="text-sm font-medium text-[#0B1F3A]">No branch assigned</p>
          <p className="mt-1 text-xs text-[#94A3B8]">Contact your administrator to assign a branch to your account.</p>
        </div>
      </div>
    )
  }

  const [groupsRes, studentsRes, branchesRes] = await Promise.all([
    listGroups({ branchId: branchIds, perPage: 500 }),
    db.from('students')
      .select(`id, student_code, branch_id, users!students_user_id_fkey(email, profiles!profiles_user_id_fkey(first_name, last_name))`)
      .in('branch_id', branchIds)
      .eq('status', 'active')
      .is('deleted_at', null)
      .limit(500),
    db.from('branches').select('id, name').in('id', branchIds).order('name'),
  ])

  const students = ((studentsRes.data ?? []) as any[]).map(s => {
    const p    = s.users?.profiles
    const name = [p?.first_name, p?.last_name].filter(Boolean).join(' ') || s.users?.email || 'Unknown'
    return {
      id:        s.id as string,
      name,
      code:      s.student_code as string | null,
      branch_id: s.branch_id as string,
    }
  })

  const groups = ((groupsRes.data ?? []) as any[]).map((g: any) => ({
    id:        g.id as string,
    name:      g.name as string,
    branch_id: g.branch_id as string,
  }))

  const branches = ((branchesRes.data ?? []) as any[]).map((b: any) => ({
    id:   b.id as string,
    name: b.name as string,
  }))

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-[#0B1F3A]">New Financial Account</h1>
        <p className="mt-0.5 text-sm text-[#64748B]">Create a finance account for a student in your branch.</p>
      </div>
      <NewFinanceAccountForm
        branches={branches}
        groups={groups}
        students={students}
        successRedirect="/portal/team-leader/finance"
      />
    </div>
  )
}
