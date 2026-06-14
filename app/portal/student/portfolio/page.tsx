import { requirePortalRole } from '@/modules/rbac/guards'
import { getOwnPortfolioDetail } from '@/modules/portfolio/queries'
import { PROJECT_STATUS_CONFIG, BADGE_EMOJIS } from '@/modules/portfolio/types'
import ToggleUploadPanel from './ToggleUploadPanel'

const CATEGORY_ICONS: Record<string, string> = {
  Game: '🎮', AI: '🧠', Website: '🌐', Robotics: '🤖',
  'Mobile App': '📱', Other: '📁',
}

export default async function StudentPortfolioPage() {
  const user   = await requirePortalRole('student')
  const detail = await getOwnPortfolioDetail(user.id)

  if (!detail) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <h1 className="text-base font-bold text-[#0B1F3A]">My Portfolio</h1>
        <div className="rounded-xl border border-[#E2E8F0] bg-white p-6 text-center">
          <p className="text-sm text-[#94A3B8]">No student record found. Contact your administrator.</p>
        </div>
      </div>
    )
  }

  const { projects, badges } = detail
  const activeProjects  = projects.filter((p) => !p.is_archived)
  const approved        = activeProjects.filter((p) => p.status === 'approved' || p.status === 'featured').length
  const pending         = activeProjects.filter((p) => p.status === 'pending_review').length
  const gradedProjects  = activeProjects.filter((p) => p.final_score != null)
  const avgScore        = gradedProjects.length > 0
    ? Math.round(gradedProjects.reduce((sum, p) => sum + (p.final_score ?? 0), 0) / gradedProjects.length)
    : null

  return (
    <div className="mx-auto max-w-3xl space-y-3">
      <div>
        <h1 className="text-base font-bold text-[#0B1F3A]">My Portfolio</h1>
        <p className="text-xs text-[#64748B]">Showcase your best work</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-2">
        {[
          { label: 'Uploaded',  value: activeProjects.length, color: 'text-[#0B1F3A]' },
          { label: 'Approved',  value: approved,              color: 'text-green-600'  },
          { label: 'Pending',   value: pending,               color: 'text-amber-600'  },
          { label: 'Avg Score', value: avgScore != null ? `${avgScore}` : '—', color: 'text-[#FF8A1F]' },
        ].map(({ label, value, color }) => (
          <div key={label} className="rounded-xl border border-[#E2E8F0] bg-white p-3 text-center">
            <p className={`text-xl font-bold leading-none ${color}`}>{value}</p>
            <p className="mt-1 text-[10px] text-[#94A3B8]">{label}</p>
          </div>
        ))}
      </div>

      {/* Badges */}
      {badges.length > 0 && (
        <div className="rounded-xl border border-[#E2E8F0] bg-white p-3.5">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-[#94A3B8]">My Badges</p>
          <div className="flex flex-wrap gap-2">
            {badges.map((b) => (
              <div key={b.id} className="flex items-center gap-1.5 rounded-full border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-1 text-xs font-medium text-[#0B1F3A]">
                <span>{BADGE_EMOJIS[b.badge_name] ?? '🏅'}</span>
                {b.badge_name}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Upload form (collapsible) */}
      <ToggleUploadPanel />

      {/* Projects grid */}
      {activeProjects.length === 0 ? (
        <div className="flex h-40 items-center justify-center rounded-xl border border-dashed border-[#E2E8F0] text-sm text-[#64748B]">
          No projects yet. Upload your first project above.
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {activeProjects.map((p) => {
            const statusCfg = p.status
              ? (PROJECT_STATUS_CONFIG[p.status] ?? PROJECT_STATUS_CONFIG.pending_review)
              : PROJECT_STATUS_CONFIG.pending_review
            return (
              <div key={p.id} className="rounded-xl border border-[#E2E8F0] bg-white overflow-hidden">
                {p.thumbnail_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.thumbnail_url} alt={p.title} className="h-32 w-full object-cover" />
                ) : (
                  <div className="flex h-32 items-center justify-center bg-[#F1F5F9] text-3xl">
                    {CATEGORY_ICONS[p.category ?? 'Other'] ?? '📁'}
                  </div>
                )}
                <div className="p-3.5 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-sm font-semibold text-[#0B1F3A] leading-tight">{p.title}</h3>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${statusCfg.cls}`}>
                      {statusCfg.label}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 flex-wrap">
                    {p.category && (
                      <span className="rounded-full bg-[#F1F5F9] px-2 py-0.5 text-[10px] text-[#64748B]">
                        {CATEGORY_ICONS[p.category]} {p.category}
                      </span>
                    )}
                    {p.final_score != null && (
                      <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-medium text-green-700">
                        Score: {p.final_score}
                      </span>
                    )}
                  </div>

                  {p.description && (
                    <p className="text-xs text-[#64748B] line-clamp-2">{p.description}</p>
                  )}

                  {p.instructor_feedback && (
                    <div className="rounded-lg bg-[#F8FAFC] px-3 py-2 text-xs text-[#64748B]">
                      <span className="font-medium text-[#0B1F3A]">Feedback:</span> {p.instructor_feedback}
                    </div>
                  )}

                  <div className="flex items-center gap-3 flex-wrap pt-0.5">
                    {p.project_url && (
                      <a
                        href={p.project_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-xs text-[#3B82F6] hover:underline"
                      >
                        <svg viewBox="0 0 20 20" fill="currentColor" className="h-3 w-3">
                          <path d="M11 3a1 1 0 100 2h2.586l-6.293 6.293a1 1 0 101.414 1.414L15 6.414V9a1 1 0 102 0V4a1 1 0 00-1-1h-5z" />
                          <path d="M5 5a2 2 0 00-2 2v8a2 2 0 002 2h8a2 2 0 002-2v-3a1 1 0 10-2 0v3H5V7h3a1 1 0 000-2H5z" />
                        </svg>
                        View Project
                      </a>
                    )}
                    {p.video_url && (
                      <a
                        href={p.video_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-xs text-red-500 hover:underline"
                      >
                        ▶ Demo
                      </a>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
