import { requireAuth }          from '@/modules/rbac/guards'
import { createServiceClient }  from '@/lib/supabase/service'
import NewLeadForm               from '@/app/portal/team-leader/leads/new/NewLeadForm'
import Link                      from 'next/link'

export default async function AdminNewLeadPage() {
  await requireAuth()
  const db = createServiceClient()

  const { data: branches } = await db
    .from('branches')
    .select('id, name')
    .order('name')

  return (
    <div>
      <div className="mb-6">
        <Link href="/admin/leads" className="text-sm text-[#64748B] hover:text-[#0B1F3A]">
          ← Leads
        </Link>
      </div>
      <div className="max-w-2xl">
        <NewLeadForm branches={branches ?? []} redirectBase="/admin/leads" />
      </div>
    </div>
  )
}
