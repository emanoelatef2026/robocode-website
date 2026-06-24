import { notFound } from 'next/navigation'
import { requirePortalRole } from '@/modules/rbac/guards'
import { getChildPortfolioDetail } from '@/modules/portfolio/queries'

interface Props {
  params: Promise<{ studentId: string }>
}

export default async function ParentChildPortfolioPage({ params }: Props) {
  const user       = await requirePortalRole('parent')
  const { studentId } = await params

  const detail = await getChildPortfolioDetail(user.id, studentId)
  if (!detail) notFound()

  const { student_name, portfolio, projects, achievements, badges } = detail
  const activeProjects = projects.filter((p) => !p.is_archived)

  return (
    <div className="mx-auto max-w-4xl space-y-10 px-4 py-8">
      <div>
        <h1 className="text-2xl font-bold text-[#0B1F3A]">{student_name}&apos;s Portfolio</h1>
        {portfolio.bio && <p className="mt-2 text-[#64748B]">{portfolio.bio}</p>}
      </div>

      {/* ── Projects ─────────────────────────────────────────────────── */}
      <section>
        <h2 className="mb-4 text-lg font-semibold text-[#0B1F3A]">
          Projects
          <span className="ml-2 text-sm font-normal text-[#64748B]">({activeProjects.length})</span>
        </h2>

        {activeProjects.length === 0 ? (
          <p className="text-sm text-[#64748B]">No projects yet.</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {activeProjects.map((p) => (
              <div key={p.id} className="ds-card p-4">
                {p.thumbnail_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={p.thumbnail_url}
                    alt={p.title}
                    className="mb-3 h-32 w-full rounded-lg object-cover"
                  />
                )}
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-semibold text-[#0B1F3A]">{p.title}</h3>
                  {p.is_featured && (
                    <span className="shrink-0 rounded-full bg-[#FF8A1F]/10 px-2 py-0.5 text-xs font-medium text-[#FF8A1F]">
                      Featured
                    </span>
                  )}
                </div>
                {p.description && (
                  <p className="mt-1 text-sm text-[#64748B] line-clamp-2">{p.description}</p>
                )}
                {p.course_title && (
                  <p className="mt-2 text-xs text-[#94A3B8]">{p.course_title}</p>
                )}
                {p.final_score != null && (
                  <p className="mt-1 text-xs font-medium text-[#0B1F3A]">Score: {p.final_score}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── Achievements ─────────────────────────────────────────────── */}
      {achievements.length > 0 && (
        <section>
          <h2 className="mb-4 text-lg font-semibold text-[#0B1F3A]">
            Achievements
            <span className="ml-2 text-sm font-normal text-[#64748B]">({achievements.length})</span>
          </h2>
          <div className="space-y-3">
            {achievements.map((a) => (
              <div key={a.id} className="flex items-start gap-3 ds-card p-4">
                {a.image_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={a.image_url} alt={a.title} className="h-10 w-10 rounded-lg object-cover" />
                )}
                <div>
                  <p className="font-medium text-[#0B1F3A]">{a.title}</p>
                  {a.description && <p className="text-sm text-[#64748B]">{a.description}</p>}
                  <p className="mt-1 text-xs text-[#94A3B8] capitalize">
                    {a.achievement_type} · {new Date(a.date_awarded).toLocaleDateString('en-GB')}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Badges ───────────────────────────────────────────────────── */}
      {badges.length > 0 && (
        <section>
          <h2 className="mb-4 text-lg font-semibold text-[#0B1F3A]">
            Badges
            <span className="ml-2 text-sm font-normal text-[#64748B]">({badges.length})</span>
          </h2>
          <div className="flex flex-wrap gap-3">
            {badges.map((b) => (
              <div key={b.id} className="flex items-center gap-2 rounded-full border border-[#E2E8F0] bg-white px-3 py-2">
                {b.badge_image && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={b.badge_image} alt={b.badge_name} className="h-5 w-5 rounded-full object-cover" />
                )}
                <span className="text-sm font-medium text-[#0B1F3A]">{b.badge_name}</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
