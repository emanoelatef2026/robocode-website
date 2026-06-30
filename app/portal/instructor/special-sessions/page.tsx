import { requirePortalRole } from '@/modules/rbac/guards'
import { getInstructorByUserId } from '@/modules/instructor-portal/queries'
import { listSpecialSessions } from '@/modules/special-sessions/queries'
import Link from 'next/link'
import EmptyState from '@/components/admin/EmptyState'
import StatusBadge from '@/components/admin/StatusBadge'

export default async function InstructorSpecialSessionsPage() {
  const user       = await requirePortalRole('instructor')
  const instructor = await getInstructorByUserId(user.id)

  if (!instructor) {
    return <EmptyState title="No instructor record found" description="Contact your team leader." />
  }

  const sessions = await listSpecialSessions({ instructorId: instructor.id })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-[18px] font-bold text-[#0B1F3A]">Special Sessions</h1>
        <Link
          href="/portal/instructor/special-sessions/new-makeup"
          className="rounded-lg bg-[#F59E0B] px-4 py-2 text-[13px] font-semibold text-white transition hover:bg-[#D97706]"
        >
          + New Makeup
        </Link>
      </div>

      {sessions.length === 0 ? (
        <EmptyState title="No special sessions yet" description="Create a makeup session to get started." />
      ) : (
        <div className="overflow-hidden ds-card">
          <div className="border-b border-[#E2E8F0] px-4 py-2.5">
            <p className="text-[12px] font-semibold text-[#0B1F3A]">{sessions.length} session{sessions.length !== 1 ? 's' : ''}</p>
          </div>

          <div className="divide-y divide-[#F1F5F9]">
            {sessions.map(s => {
              const color = s.type === 'trial'
                ? 'bg-purple-100 text-purple-700'
                : 'bg-orange-100 text-orange-700'
              const label = s.type === 'trial' ? 'Trial' : 'Makeup'

              return (
                <Link
                  key={s.id}
                  href={`/portal/instructor/special-sessions/${s.id}`}
                  className="flex items-center justify-between gap-3 px-4 py-3 transition hover:bg-[#F8FAFC]"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${color}`}>
                      {label}
                    </span>
                    <div className="min-w-0">
                      <p className="text-[13px] font-semibold text-[#0B1F3A] truncate">
                        {new Date(s.scheduled_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                        {' · '}
                        {new Date(s.scheduled_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                      <p className="text-[11px] text-[#64748B]">
                        {s.branch_name} · {s.participant_count} participant{s.participant_count !== 1 ? 's' : ''}
                      </p>
                    </div>
                  </div>
                  <StatusBadge status={s.status} dot />
                </Link>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
