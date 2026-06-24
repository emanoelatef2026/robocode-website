import { requirePortalRole } from '@/modules/rbac/guards'
import { getInstructorByUserId } from '@/modules/instructor-portal/queries'
import { listProjectsForInstructorReview } from '@/modules/portfolio/queries'
import { PROJECT_STATUS_CONFIG, BADGE_EMOJIS } from '@/modules/portfolio/types'
import Link from 'next/link'
import ProjectReviewForm from './ProjectReviewForm'

const BADGE_TYPES = [
  '🏆 Featured Project',
  '🎥 Best Project Video',
  '🎮 Best Game Project',
  '🧠 Best AI Project',
  '🤖 Best Robotics Project',
  '🌐 Best Website Project',
]

const CATEGORY_ICONS: Record<string, string> = {
  Game: '🎮', AI: '🧠', Website: '🌐', Robotics: '🤖', 'Mobile App': '📱', Other: '📁',
}

interface Props {
  searchParams: Promise<Record<string, string | undefined>>
}

export default async function InstructorPortfolioPage({ searchParams }: Props) {
  const sp     = await searchParams
  const tab    = (sp.tab ?? 'pending') as 'pending_review' | 'approved' | 'needs_improvement' | 'featured'
  const user   = await requirePortalRole('instructor')
  const instructor = await getInstructorByUserId(user.id)

  if (!instructor) {
    return (
      <div className="flex h-64 items-center justify-center text-[#64748B]">
        No instructor record found. Contact your team leader.
      </div>
    )
  }

  const projects = await listProjectsForInstructorReview(instructor.id, tab)

  const tabs: Array<{ key: typeof tab; label: string }> = [
    { key: 'pending_review',    label: 'Pending' },
    { key: 'approved',          label: 'Approved' },
    { key: 'needs_improvement', label: 'Needs Improvement' },
    { key: 'featured',          label: 'Featured' },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-[#0B1F3A]">Portfolio Review</h1>
        <p className="mt-0.5 text-sm text-[#64748B]">Review and approve student projects</p>
      </div>

      {/* Status tabs */}
      <div className="flex gap-1 ds-card p-1">
        {tabs.map((t) => (
          <Link
            key={t.key}
            href={`/portal/instructor/portfolio?tab=${t.key}`}
            className={[
              'flex-1 rounded-lg px-3 py-2 text-center text-sm font-medium transition',
              tab === t.key
                ? 'bg-[#FF8A1F] text-white'
                : 'text-[#64748B] hover:bg-[#F8FAFC]',
            ].join(' ')}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {projects.length === 0 ? (
        <div className="flex h-48 items-center justify-center rounded-xl border border-dashed border-[#E2E8F0] text-sm text-[#64748B]">
          No {tab.replace('_', ' ')} projects.
        </div>
      ) : (
        <div className="space-y-4">
          {projects.map((p) => {
            const statusCfg = p.status
              ? (PROJECT_STATUS_CONFIG[p.status] ?? PROJECT_STATUS_CONFIG.pending_review)
              : PROJECT_STATUS_CONFIG.pending_review
            return (
              <div key={p.id} className="ds-card overflow-hidden">
                <div className="flex gap-4 p-4">
                  {/* Thumbnail */}
                  {p.thumbnail_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.thumbnail_url} alt={p.title} className="h-28 w-40 shrink-0 rounded-lg object-cover" />
                  ) : (
                    <div className="flex h-28 w-40 shrink-0 items-center justify-center rounded-lg bg-[#F1F5F9] text-3xl">
                      {CATEGORY_ICONS[p.category ?? 'Other'] ?? '📁'}
                    </div>
                  )}

                  {/* Info */}
                  <div className="flex-1 min-w-0 space-y-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold text-[#0B1F3A]">{p.title}</p>
                        <p className="text-xs text-[#94A3B8]">by {p.student_name}</p>
                      </div>
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${statusCfg.cls}`}>
                        {statusCfg.label}
                      </span>
                    </div>

                    {p.description && (
                      <p className="text-sm text-[#64748B] line-clamp-2">{p.description}</p>
                    )}

                    <div className="flex flex-wrap items-center gap-2">
                      {p.category && (
                        <span className="text-xs text-[#94A3B8]">{CATEGORY_ICONS[p.category]} {p.category}</span>
                      )}
                      {p.project_url && (
                        <a href={p.project_url} target="_blank" rel="noopener noreferrer"
                          className="text-xs text-[#3B82F6] hover:underline">View Project →</a>
                      )}
                      {p.video_url && (
                        <a href={p.video_url} target="_blank" rel="noopener noreferrer"
                          className="text-xs text-[#EF4444] hover:underline">▶ Demo</a>
                      )}
                    </div>

                    {p.instructor_feedback && (
                      <p className="text-xs text-[#64748B] italic">{p.instructor_feedback}</p>
                    )}
                  </div>
                </div>

                {/* Review form */}
                {(tab === 'pending_review' || tab === 'needs_improvement') && (
                  <div className="border-t border-[#F1F5F9] px-4 py-4">
                    <ProjectReviewForm
                      projectId={p.id}
                      studentId={p.student_id}
                      currentFeedback={p.instructor_feedback}
                      currentScore={p.final_score}
                    />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
