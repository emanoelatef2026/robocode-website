import { requireAuth } from '@/modules/rbac/guards'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getDuplicateParentGroups } from '@/modules/parents/duplicates'

export default async function DuplicateParentsPage() {
  const user = await requireAuth()
  if (user.globalRole !== 'super_admin') redirect('/admin/parents')

  const groups = await getDuplicateParentGroups()

  return (
    <div className="space-y-6 p-6">
      <div>
        <div className="flex items-center gap-2 text-sm">
          <Link href="/admin/parents" className="text-[#64748B] hover:underline">Parents</Link>
          <span className="text-[#CBD5E1]">/</span>
          <span className="text-[#0B1F3A] font-medium">Possible Duplicate Accounts</span>
        </div>
        <h1 className="mt-1 text-xl font-bold text-[#0B1F3A]">Possible Duplicate Parent Accounts</h1>
        <p className="mt-1 text-sm text-[#64748B] max-w-2xl">
          Read-only report — parent portal accounts that share the same phone number. This can mean the same
          person ended up with two logins (the pre-fix bug this report exists to catch), or it can be two
          different real people who share a phone (e.g. father and mother). Nothing here is merged
          automatically — review each group and, if it&apos;s genuinely the same person, move their children
          onto one account from the Parents page (link the students to the account you keep, then archive the
          other), or use &quot;Unlink Parent&quot; / delete on the one you don&apos;t keep.
        </p>
      </div>

      {groups.length === 0 ? (
        <div className="ds-card p-6 text-sm text-[#64748B]">
          No duplicate phone numbers found across active parent accounts.
        </div>
      ) : (
        <div className="space-y-4">
          {groups.map(g => (
            <div key={g.phone} className="ds-card p-4">
              <div className="mb-3 flex items-center gap-2">
                <span className="rounded-full bg-[#FEE2E2] px-2.5 py-1 text-xs font-semibold text-[#DC2626]">
                  {g.accounts.length} accounts
                </span>
                <span className="text-sm font-mono text-[#0B1F3A]">{g.phone}</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-[11px] uppercase tracking-wide text-[#94A3B8] border-b border-[#E2E8F0]">
                      <th className="pb-2 pr-4">Name</th>
                      <th className="pb-2 pr-4">Login email</th>
                      <th className="pb-2 pr-4">Created</th>
                      <th className="pb-2">Children linked</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F1F5F9]">
                    {g.accounts.map(a => (
                      <tr key={a.parentId}>
                        <td className="py-2 pr-4 font-medium text-[#0B1F3A]">
                          <Link href={`/admin/parents/${a.parentId}`} className="hover:underline">{a.name}</Link>
                        </td>
                        <td className="py-2 pr-4 font-mono text-[12px] text-[#64748B]">{a.email}</td>
                        <td className="py-2 pr-4 text-[#64748B]">{new Date(a.createdAt).toLocaleDateString()}</td>
                        <td className="py-2 text-[#64748B]">
                          {a.children.length === 0 ? '—' : a.children.map(c => c.name).join(', ')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
