import { requirePortalRole }    from '@/modules/rbac/guards'
import { getParentChildren }   from '@/modules/parents/parent-portal-queries'
import { getChildPortfolioDetail } from '@/modules/portfolio/queries'
import { PROJECT_STATUS_CONFIG }   from '@/modules/portfolio/types'
import Link                    from 'next/link'

interface Props {
  searchParams: Promise<{ child?: string }>
}

const CATEGORY_COLORS: Record<string, string> = {
  Game:       'bg-purple-100  text-purple-700',
  AI:         'bg-indigo-100  text-indigo-700',
  Website:    'bg-blue-100    text-blue-700',
  Robotics:   'bg-teal-100    text-teal-700',
  'Mobile App': 'bg-pink-100  text-pink-700',
  Other:      'bg-gray-100    text-gray-600',
}

export default async function ParentPortfolioPage({ searchParams }: Props) {
  const { child } = await searchParams
  const user      = await requirePortalRole('parent')

  const children = await getParentChildren(user.id)

  if (!children.length) {
    return (
      <div className="flex min-h-100 items-center justify-center">
        <p className="text-sm text-[#94A3B8]">No children linked to this account.</p>
      </div>
    )
  }

  const studentId  = child ?? children[0].student_id
  const selected   = children.find(c => c.student_id === studentId) ?? children[0]
  const childParam = `?child=${selected.student_id}`

  const detail = await getChildPortfolioDetail(user.id, selected.student_id)

  const activeProjects = detail?.projects.filter(p => !p.is_archived) ?? []

  return (
    <div className="mx-auto max-w-4xl space-y-8">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-[#0B1F3A]">
            {selected.student_name}&apos;s Portfolio
          </h1>
          {detail?.portfolio.bio && (
            <p className="mt-1 text-sm text-[#64748B]">{detail.portfolio.bio}</p>
          )}
          <p className="mt-0.5 text-sm text-[#94A3B8]">{activeProjects.length} project{activeProjects.length !== 1 ? 's' : ''}</p>
        </div>
        <Link href={`/portal/parent${childParam}`} className="text-[13px] text-[#FF8A1F] hover:underline">
          ← Dashboard
        </Link>
      </div>

      {!detail || activeProjects.length === 0 ? (
        <div className="rounded-xl border border-[#E2E8F0] bg-white px-6 py-12 text-center">
          <p className="text-sm text-[#64748B]">No portfolio projects yet.</p>
        </div>
      ) : (
        <section>
          <div className="grid gap-5 sm:grid-cols-2">
            {activeProjects.map(p => {
              const statusCfg = PROJECT_STATUS_CONFIG[p.status ?? 'pending_review'] ?? { label: p.status ?? '—', cls: 'bg-gray-100 text-gray-600' }
              const catCls    = CATEGORY_COLORS[p.category ?? 'Other'] ?? CATEGORY_COLORS.Other

              return (
                <div key={p.id} className="rounded-xl border border-[#E2E8F0] bg-white overflow-hidden">
                  {p.thumbnail_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={p.thumbnail_url}
                      alt={p.title}
                      className="h-36 w-full object-cover"
                    />
                  )}
                  <div className="p-4 space-y-3">
                    {/* Title + status */}
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-semibold text-[#0B1F3A] leading-snug">{p.title}</h3>
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${statusCfg.cls}`}>
                        {statusCfg.label}
                      </span>
                    </div>

                    {/* Category + course */}
                    <div className="flex flex-wrap gap-1.5">
                      {p.category && (
                        <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${catCls}`}>
                          {p.category}
                        </span>
                      )}
                      {p.course_title && (
                        <span className="rounded-full bg-[#F1F5F9] px-2 py-0.5 text-[11px] text-[#64748B]">
                          {p.course_title}
                        </span>
                      )}
                    </div>

                    {p.description && (
                      <p className="text-[13px] text-[#64748B] line-clamp-2">{p.description}</p>
                    )}

                    {/* Score */}
                    {p.final_score != null && (
                      <p className="text-[13px] font-semibold text-[#0B1F3A]">
                        Score: {p.final_score}
                      </p>
                    )}

                    {/* Links */}
                    {(p.project_url || p.video_url) && (
                      <div className="flex flex-wrap gap-2">
                        {p.project_url && (
                          <a
                            href={p.project_url}
                            target="_blank"
                            rel="noreferrer"
                            className="rounded-lg border border-[#E2E8F0] px-3 py-1.5 text-[12px] font-medium text-[#0B1F3A] hover:bg-[#F8FAFC]"
                          >
                            Project Link ↗
                          </a>
                        )}
                        {p.video_url && (
                          <a
                            href={p.video_url}
                            target="_blank"
                            rel="noreferrer"
                            className="rounded-lg border border-[#E2E8F0] px-3 py-1.5 text-[12px] font-medium text-[#0B1F3A] hover:bg-[#F8FAFC]"
                          >
                            Video ↗
                          </a>
                        )}
                      </div>
                    )}

                    {/* Instructor review feedback */}
                    {p.instructor_feedback && (
                      <div className="rounded-lg bg-[#F8FAFC] border border-[#F1F5F9] px-3 py-2.5">
                        <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-[#94A3B8]">
                          Instructor Review
                        </p>
                        <p className="text-[13px] text-[#64748B] whitespace-pre-wrap leading-relaxed">
                          {p.instructor_feedback}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* Badges */}
      {(detail?.badges.length ?? 0) > 0 && (
        <section>
          <h2 className="mb-3 text-[15px] font-semibold text-[#0B1F3A]">
            Badges
            <span className="ml-2 text-sm font-normal text-[#64748B]">({detail!.badges.length})</span>
          </h2>
          <div className="flex flex-wrap gap-3">
            {detail!.badges.map(b => (
              <div key={b.id} className="flex items-center gap-2 rounded-full border border-[#E2E8F0] bg-white px-3 py-2">
                {b.badge_image && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={b.badge_image} alt={b.badge_name} className="h-5 w-5 rounded-full object-cover" />
                )}
                <span className="text-[13px] font-medium text-[#0B1F3A]">{b.badge_name}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Achievements */}
      {(detail?.achievements.length ?? 0) > 0 && (
        <section>
          <h2 className="mb-3 text-[15px] font-semibold text-[#0B1F3A]">
            Achievements
            <span className="ml-2 text-sm font-normal text-[#64748B]">({detail!.achievements.length})</span>
          </h2>
          <div className="space-y-3">
            {detail!.achievements.map(a => (
              <div key={a.id} className="flex items-start gap-3 rounded-xl border border-[#E2E8F0] bg-white p-4">
                {a.image_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={a.image_url} alt={a.title} className="h-10 w-10 rounded-lg object-cover" />
                )}
                <div>
                  <p className="font-medium text-[#0B1F3A]">{a.title}</p>
                  {a.description && <p className="text-[13px] text-[#64748B]">{a.description}</p>}
                  <p className="mt-1 text-[11px] text-[#94A3B8] capitalize">
                    {a.achievement_type} · {new Date(a.date_awarded).toLocaleDateString('en-GB')}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
