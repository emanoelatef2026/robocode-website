import { requirePermission }     from '@/modules/rbac/guards'
import { listBranches }          from '@/modules/branches/queries'
import { listGroups }            from '@/modules/groups/queries'
import { createServiceClient }   from '@/lib/supabase/service'
import NewFinanceAccountForm     from './NewFinanceAccountForm'

export default async function NewFinanceAccountPage() {
  await requirePermission('manage_financials')
  const db = createServiceClient()

  const [branchesRes, groupsRes, studentsRes] = await Promise.all([
    listBranches({ perPage: 100 }),
    listGroups({ perPage: 200 }),
    db.from('students')
      .select(`id, student_code,
        users!students_user_id_fkey(email, profiles!profiles_user_id_fkey(first_name, last_name))`)
      .eq('status', 'active')
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(500),
  ])

  const students = ((studentsRes.data ?? []) as any[]).map(s => {
    const p = s.users?.profiles
    const name = [p?.first_name, p?.last_name].filter(Boolean).join(' ') || s.users?.email || 'Unknown'
    return { id: s.id as string, name, code: s.student_code as string | null }
  })

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-[#0B1F3A]">New Financial Account</h1>
        <p className="mt-0.5 text-sm text-[#64748B]">
          Create a financial account for a student to begin tracking payments and installments.
        </p>
      </div>

      <NewFinanceAccountForm
        branches={(branchesRes.data as any[]).map((b: any) => ({ id: b.id, name: b.name }))}
        groups={(groupsRes.data as any[]).map((g: any) => ({ id: g.id, name: g.name }))}
        students={students}
      />
    </div>
  )
}
