import { requirePortalRole } from '@/modules/rbac/guards'
import { getOwnPortfolioDetail } from '@/modules/portfolio/queries'
import { BADGE_EMOJIS } from '@/modules/portfolio/types'
import ToggleUploadPanel from './ToggleUploadPanel'
import ProjectCard from './ProjectCard'

export default async function StudentPortfolioPage() {
  const user   = await requirePortalRole('student')
  const detail = await getOwnPortfolioDetail(user.id)

  if (!detail) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <h1 className="text-base font-bold text-[#0B1F3A]">My Portfolio</h1>
        <div className="ds-card p-6 text-center">
          <p className="text-sm text-[#64748B]">No student record found. Contact your administrator.</p>
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
          { label: 'Approved',  value: approved,              color: 'text-[#10B981]'  },
          { label: 'Pending',   value: pending,               color: 'text-[#F59E0B]'  },
          { label: 'Avg Score', value: avgScore != null ? `${avgScore}` : '—', color: 'text-[#FF8A1F]' },
        ].map(({ label, value, color }) => (
          <div key={label} className="ds-card p-3 text-center">
            <p className={`text-xl font-bold leading-none ${color}`}>{value}</p>
            <p className="mt-1 text-[10px] text-[#64748B]">{label}</p>
          </div>
        ))}
      </div>

      {/* Badges */}
      {badges.length > 0 && (
        <div className="ds-card p-3.5">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-[#64748B]">My Badges</p>
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
          {activeProjects.map((p) => (
            <ProjectCard key={p.id} project={p} />
          ))}
        </div>
      )}
    </div>
  )
}
