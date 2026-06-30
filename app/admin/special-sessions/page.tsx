import { requireAuth }          from '@/modules/rbac/guards'
import { listSpecialSessions }  from '@/modules/special-sessions/queries'
import Link                     from 'next/link'
import EmptyState               from '@/components/admin/EmptyState'
import StatusBadge              from '@/components/admin/StatusBadge'

interface Props {
  searchParams: Promise<{ type?: string; branch?: string }>
}

export default async function AdminSpecialSessionsPage({ searchParams }: Props) {
  await requireAuth()
  const sp = await searchParams

  const typeFilter = (sp.type === 'trial' || sp.type === 'makeup') ? sp.type : undefined

  const sessions = await listSpecialSessions({
    type:  typeFilter,
    limit: 200,
  })

  const trialCount  = sessions.filter(s => s.type === 'trial').length
  const makeupCount = sessions.filter(s => s.type === 'makeup').length

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[18px] font-bold text-[#0B1F3A]">Special Sessions</h1>
          <p className="text-[12px] text-[#64748B] mt-0.5">
            {trialCount} trial · {makeupCount} makeup
          </p>
        </div>
      </div>

      {/* Type filter tabs */}
      <div className="flex gap-2">
        {[
          { label: 'All',    href: '/admin/special-sessions',              active: !typeFilter },
          { label: '🟣 Trial',  href: '/admin/special-sessions?type=trial',  active: typeFilter === 'trial' },
          { label: '🟠 Makeup', href: '/admin/special-sessions?type=makeup', active: typeFilter === 'makeup' },
        ].map(t => (
          <Link
            key={t.label}
            href={t.href}
            className={`rounded-full border px-3 py-1 text-[12px] font-semibold transition ${
              t.active
                ? 'border-[#FF8A1F] bg-[#FF8A1F]/10 text-[#FF8A1F]'
                : 'border-[#E2E8F0] text-[#64748B] hover:border-[#CBD5E1]'
            }`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {sessions.length === 0 ? (
        <EmptyState title="No special sessions" description="Trial and makeup sessions created by team leaders will appear here." />
      ) : (
        <div className="overflow-hidden ds-card">
          <div className="border-b border-[#E2E8F0] px-4 py-2.5">
            <p className="text-[12px] font-semibold text-[#0B1F3A]">
              {sessions.length} session{sessions.length !== 1 ? 's' : ''}
            </p>
          </div>

          <div className="divide-y divide-[#F1F5F9]">
            {sessions.map(s => {
              const isTrialType = s.type === 'trial'
              const color = isTrialType ? 'bg-purple-100 text-purple-700' : 'bg-orange-100 text-orange-700'
              const label = isTrialType ? '🟣 Trial' : '🟠 Makeup'

              return (
                <div
                  key={s.id}
                  className="flex items-center justify-between gap-3 px-4 py-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${color}`}>
                      {label}
                    </span>
                    <div className="min-w-0">
                      <p className="text-[13px] font-semibold text-[#0B1F3A] truncate">
                        {new Date(s.scheduled_at).toLocaleDateString('en-GB', {
                          day: 'numeric', month: 'short', year: 'numeric',
                        })}
                        {' · '}
                        {new Date(s.scheduled_at).toLocaleTimeString('en-US', {
                          hour: '2-digit', minute: '2-digit',
                        })}
                      </p>
                      <p className="text-[11px] text-[#64748B] truncate">
                        {s.instructor_name ?? 'Unassigned'} · {s.branch_name} · {s.participant_count} participant{s.participant_count !== 1 ? 's' : ''}
                      </p>
                    </div>
                  </div>
                  <StatusBadge status={s.status} dot />
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
