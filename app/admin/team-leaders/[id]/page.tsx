import { getTeamLeader } from '@/modules/team-leaders/queries'
import { requirePermission } from '@/modules/rbac/guards'
import { notFound } from 'next/navigation'
import StatusBadge from '@/components/admin/StatusBadge'
import Link from 'next/link'
import DeactivateTeamLeaderButton from './DeactivateTeamLeaderButton'

interface Props { params: Promise<{ id: string }> }

export default async function TeamLeaderDetailPage({ params }: Props) {
  await requirePermission('manage_system')
  const { id } = await params
  const tl = await getTeamLeader(id)
  if (!tl) notFound()

  const fullName = tl.first_name && tl.last_name
    ? `${tl.first_name} ${tl.last_name}`
    : null

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <Link href="/admin/team-leaders" className="text-sm text-[#64748B] hover:text-[#0B1F3A]">
            ← Team Leaders
          </Link>
          <h1 className="mt-2 text-xl font-semibold text-[#0B1F3A]">
            {fullName ?? tl.email}
          </h1>
          <p className="mt-1 text-sm text-[#64748B]">
            {tl.email} · {tl.branch_name ?? '—'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <StatusBadge status={tl.status} />
          <Link
            href={`/admin/team-leaders/${tl.user_id}/edit`}
            className="rounded-lg border border-[#E2E8F0] px-4 py-2 text-sm font-medium text-[#0B1F3A] transition hover:border-[#CBD5E1]"
          >
            Edit
          </Link>
          {tl.status === 'active' && (
            <DeactivateTeamLeaderButton userId={tl.user_id} />
          )}
        </div>
      </div>

      {/* Info card */}
      <div className="rounded-xl border border-[#E2E8F0] bg-white p-6">
        <h2 className="mb-4 text-sm font-semibold text-[#0B1F3A]">Profile</h2>
        <dl className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <dt className="text-[#64748B]">First name</dt>
            <dd className="mt-0.5 font-medium text-[#0B1F3A]">{tl.first_name ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-[#64748B]">Last name</dt>
            <dd className="mt-0.5 font-medium text-[#0B1F3A]">{tl.last_name ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-[#64748B]">Email</dt>
            <dd className="mt-0.5 font-medium text-[#0B1F3A]">{tl.email}</dd>
          </div>
          <div>
            <dt className="text-[#64748B]">Branch</dt>
            <dd className="mt-0.5 font-medium text-[#0B1F3A]">{tl.branch_name ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-[#64748B]">Status</dt>
            <dd className="mt-0.5"><StatusBadge status={tl.status} /></dd>
          </div>
          <div>
            <dt className="text-[#64748B]">Assigned at</dt>
            <dd className="mt-0.5 font-medium text-[#0B1F3A]">
              {tl.assigned_at ? new Date(tl.assigned_at).toLocaleDateString() : '—'}
            </dd>
          </div>
        </dl>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-xl border border-[#E2E8F0] bg-white p-4 text-center">
          <p className="text-2xl font-bold text-[#0B1F3A]">{tl.student_count}</p>
          <p className="mt-1 text-xs text-[#64748B]">Active Students</p>
        </div>
        <div className="rounded-xl border border-[#E2E8F0] bg-white p-4 text-center">
          <p className="text-2xl font-bold text-[#0B1F3A]">{tl.groups.length}</p>
          <p className="mt-1 text-xs text-[#64748B]">Active Groups</p>
        </div>
        <div className="rounded-xl border border-[#E2E8F0] bg-white p-4 text-center">
          <p className="text-2xl font-bold text-[#0B1F3A]">{tl.instructors.length}</p>
          <p className="mt-1 text-xs text-[#64748B]">Instructors</p>
        </div>
      </div>

      {/* Instructors */}
      {tl.instructors.length > 0 && (
        <div className="rounded-xl border border-[#E2E8F0] bg-white">
          <div className="border-b border-[#E2E8F0] px-4 py-3">
            <h2 className="text-sm font-semibold text-[#0B1F3A]">Instructors</h2>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                <th className="px-4 py-3 text-left text-xs font-medium text-[#64748B]">Name</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-[#64748B]">Email</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-[#64748B]">Status</th>
              </tr>
            </thead>
            <tbody>
              {tl.instructors.map((ins) => (
                <tr key={ins.id} className="border-b border-[#E2E8F0] last:border-0">
                  <td className="px-4 py-3 font-medium text-[#0B1F3A]">
                    {ins.first_name && ins.last_name ? `${ins.first_name} ${ins.last_name}` : '—'}
                  </td>
                  <td className="px-4 py-3 text-[#64748B]">{ins.email}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={ins.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Groups */}
      {tl.groups.length > 0 && (
        <div className="rounded-xl border border-[#E2E8F0] bg-white">
          <div className="border-b border-[#E2E8F0] px-4 py-3">
            <h2 className="text-sm font-semibold text-[#0B1F3A]">Groups</h2>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                <th className="px-4 py-3 text-left text-xs font-medium text-[#64748B]">Name</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-[#64748B]">Type</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-[#64748B]">Students</th>
              </tr>
            </thead>
            <tbody>
              {tl.groups.map((g) => (
                <tr key={g.id} className="border-b border-[#E2E8F0] last:border-0">
                  <td className="px-4 py-3 font-medium text-[#0B1F3A]">{g.name}</td>
                  <td className="px-4 py-3 capitalize text-[#64748B]">{g.type}</td>
                  <td className="px-4 py-3 text-right font-medium text-[#0B1F3A]">{g.student_count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
