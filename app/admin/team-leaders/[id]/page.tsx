import { getTeamLeader }              from '@/modules/team-leaders/queries'
import { getTeamLeaderResponsibilities, listTeamLeaders } from '@/modules/team-leaders/queries'
import { requirePermission }            from '@/modules/rbac/guards'
import { notFound }                     from 'next/navigation'
import StatusBadge                      from '@/components/admin/StatusBadge'
import Link                             from 'next/link'
import TLActionButtons                  from './TLActionButtons'

interface Props { params: Promise<{ id: string }> }

export default async function TeamLeaderDetailPage({ params }: Props) {
  await requirePermission('manage_system')
  const { id } = await params

  const [tl, responsibilities, otherTLsResult] = await Promise.all([
    getTeamLeader(id),
    getTeamLeaderResponsibilities(id),
    listTeamLeaders({ perPage: 100, status: 'active' }),
  ])

  if (!tl) notFound()

  const fullName = tl.first_name && tl.last_name
    ? `${tl.first_name} ${tl.last_name}`
    : null

  // Other active TLs (excluding this one) for the transfer wizard
  const otherTLs = otherTLsResult.data
    .filter(other => other.user_id !== id)
    .map(other => ({
      userId:     other.user_id,
      name:       other.first_name && other.last_name ? `${other.first_name} ${other.last_name}` : other.email,
      branchName: other.branch_name,
    }))
    // Deduplicate by userId (multi-branch TLs appear once per branch in the list)
    .filter((tl, idx, arr) => arr.findIndex(x => x.userId === tl.userId) === idx)

  const hasResponsibilities =
    responsibilities.leadCount > 0 ||
    responsibilities.groupCount > 0 ||
    responsibilities.studentCount > 0

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-4">
        <Link href="/admin/team-leaders" className="text-sm text-[#64748B] hover:text-[#0B1F3A]">
          ← Team Leaders
        </Link>
        <div className="flex shrink-0 items-center gap-2">
          <StatusBadge status={tl.status} />
          <Link
            href={`/admin/team-leaders/${tl.user_id}/edit`}
            className="rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm font-medium text-[#0B1F3A] transition hover:border-[#CBD5E1]"
          >
            Edit
          </Link>
        </div>
      </div>

      {/* ── Action panel ───────────────────────────────────────────────── */}
      <div className="ds-card p-4">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-[#94A3B8]">Management Actions</p>

        {/* Responsibilities summary */}
        {hasResponsibilities && (
          <div className="mb-4 grid grid-cols-3 gap-3">
            <div className="rounded-lg bg-[#F8FAFC] p-3 text-center">
              <p className="text-xl font-bold text-[#0B1F3A]">{responsibilities.leadCount}</p>
              <p className="text-[11px] text-[#64748B]">Active Leads</p>
            </div>
            <div className="rounded-lg bg-[#F8FAFC] p-3 text-center">
              <p className="text-xl font-bold text-[#0B1F3A]">{responsibilities.groupCount}</p>
              <p className="text-[11px] text-[#64748B]">Groups in Branch</p>
            </div>
            <div className="rounded-lg bg-[#F8FAFC] p-3 text-center">
              <p className="text-xl font-bold text-[#0B1F3A]">{responsibilities.studentCount}</p>
              <p className="text-[11px] text-[#64748B]">Students in Branch</p>
            </div>
          </div>
        )}

        <TLActionButtons
          userId={tl.user_id}
          status={tl.status}
          branchIds={tl.branch_ids}
          responsibilities={responsibilities}
          otherTLs={otherTLs}
        />

        <div className="mt-4 flex items-center gap-2 border-t border-[#E2E8F0] pt-3">
          <Link
            href={`/admin/team-leaders/${tl.user_id}/performance`}
            className="rounded-lg bg-[#FF8A1F] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#e87c18]"
          >
            View Performance
          </Link>
        </div>
      </div>

      {/* ── Profile ────────────────────────────────────────────────────── */}
      <div className="ds-card p-5">
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
          <div className="col-span-2">
            <dt className="text-[#64748B]">Branches</dt>
            <dd className="mt-0.5 font-medium text-[#0B1F3A]">
              {tl.branch_names.length > 0 ? tl.branch_names.join(', ') : '—'}
            </dd>
          </div>
          <div>
            <dt className="text-[#64748B]">TL Code</dt>
            <dd className="mt-0.5 font-mono font-semibold text-[#0B1F3A]">{tl.tl_code ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-[#64748B]">Phone</dt>
            <dd className="mt-0.5 font-medium text-[#0B1F3A]">{tl.phone ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-[#64748B]">Assigned at</dt>
            <dd className="mt-0.5 font-medium text-[#0B1F3A]">
              {tl.assigned_at ? new Date(tl.assigned_at).toLocaleDateString('en-GB') : '—'}
            </dd>
          </div>
        </dl>
      </div>

      {/* ── Stats row ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-4">
        <div className="ds-card p-4 text-center">
          <p className="text-2xl font-bold text-[#0B1F3A]">{tl.student_count}</p>
          <p className="mt-1 text-xs text-[#64748B]">Active Students</p>
        </div>
        <div className="ds-card p-4 text-center">
          <p className="text-2xl font-bold text-[#0B1F3A]">{tl.groups.length}</p>
          <p className="mt-1 text-xs text-[#64748B]">Active Groups</p>
        </div>
        <div className="ds-card p-4 text-center">
          <p className="text-2xl font-bold text-[#0B1F3A]">{tl.instructors.length}</p>
          <p className="mt-1 text-xs text-[#64748B]">Instructors</p>
        </div>
      </div>

      {/* ── Instructors table ──────────────────────────────────────────── */}
      {tl.instructors.length > 0 && (
        <div className="ds-card">
          <div className="border-b border-[#E2E8F0] px-4 py-3">
            <h2 className="text-sm font-semibold text-[#0B1F3A]">Instructors</h2>
          </div>
          <table className="w-full text-sm">
            <thead className="ds-table-head">
              <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                <th className="px-4 py-3 text-left text-xs font-medium text-[#64748B]">Name</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-[#64748B]">Email</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-[#64748B]">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {tl.instructors.map(ins => (
                <tr key={ins.id} className="ds-table-row">
                  <td className="px-4 py-3 font-medium text-[#0B1F3A]">
                    {ins.first_name && ins.last_name ? `${ins.first_name} ${ins.last_name}` : '—'}
                  </td>
                  <td className="px-4 py-3 text-[#64748B]">{ins.email}</td>
                  <td className="px-4 py-3"><StatusBadge status={ins.status} /></td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/admin/instructors/${ins.id}`} className="text-xs text-[#FF8A1F] hover:underline">View</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Groups table ───────────────────────────────────────────────── */}
      {tl.groups.length > 0 && (
        <div className="ds-card">
          <div className="border-b border-[#E2E8F0] px-4 py-3">
            <h2 className="text-sm font-semibold text-[#0B1F3A]">Groups</h2>
          </div>
          <table className="w-full text-sm">
            <thead className="ds-table-head">
              <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                <th className="px-4 py-3 text-left text-xs font-medium text-[#64748B]">Name</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-[#64748B]">Type</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-[#64748B]">Students</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {tl.groups.map(g => (
                <tr key={g.id} className="ds-table-row">
                  <td className="px-4 py-3 font-medium text-[#0B1F3A]">{g.name}</td>
                  <td className="px-4 py-3 capitalize text-[#64748B]">{g.type}</td>
                  <td className="px-4 py-3 text-right font-medium text-[#0B1F3A]">{g.student_count}</td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/admin/groups/${g.id}`} className="text-xs text-[#FF8A1F] hover:underline">View</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
