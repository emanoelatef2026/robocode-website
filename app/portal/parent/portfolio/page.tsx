import { requirePortalRole } from '@/modules/rbac/guards'
import { getParentChildren } from '@/modules/parents/parent-portal-queries'
import { getChildPortfolioDetail } from '@/modules/portfolio/queries'
import Link from 'next/link'

interface Props {
  searchParams: Promise<{ child?: string }>
}

export default async function ParentPortfolioPage({ searchParams }: Props) {
  const { child } = await searchParams
  const user      = await requirePortalRole('parent')

  const children = await getParentChildren(user.id)

  if (!children.length) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <p className="text-sm text-[#94A3B8]">No children linked to this account.</p>
      </div>
    )
  }

  const studentId = child ?? children[0].student_id
  const selected  = children.find(c => c.student_id === studentId) ?? children[0]
  const childParam = `?child=${selected.student_id}`

  const detail = await getChildPortfolioDetail(user.id, selected.student_id)

  return (
    <div className="mx-auto max-w-4xl space-y-10">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-[#0B1F3A]">
            {selected.student_name}&apos;s Portfolio
          </h1>
          {detail?.portfolio.bio && (
            <p className="mt-1 text-sm text-[#64748B]">{detail.portfolio.bio}</p>
          )}
        </div>
        <Link href={`/portal/parent${childParam}`} className="text-[13px] text-[#FF8A1F] hover:underline">
          ← Dashboard
        </Link>
      </div>

      {!detail ? (
        <div className="rounded-xl border border-[#E2E8F0] bg-white px-6 py-12 text-center">
          <p className="text-sm text-[#64748B]">No portfolio data found.</p>
        </div>
      ) : (
        <>
          {/* Projects */}
          <section>
            <h2 className="mb-4 text-[15px] font-semibold text-[#0B1F3A]">
              Projects
              <span className="ml-2 text-sm font-normal text-[#64748B]">
                ({detail.projects.filter(p => !p.is_archived).length})
              </span>
            </h2>

            {detail.projects.filter(p => !p.is_archived).length === 0 ? (
              <p className="text-sm text-[#64748B]">No projects yet.</p>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {detail.projects
                  .filter(p => !p.is_archived)
                  .map(p => (
                    <div key={p.id} className="rounded-xl border border-[#E2E8F0] bg-white p-4">
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
                          <span className="shrink-0 rounded-full bg-[#FF8A1F]/10 px-2 py-0.5 text-[11px] font-medium text-[#FF8A1F]">
                            Featured
                          </span>
                        )}
                      </div>
                      {p.description && (
                        <p className="mt-1 text-[13px] text-[#64748B] line-clamp-2">{p.description}</p>
                      )}
                      <div className="mt-2 flex flex-wrap gap-3 text-[12px] text-[#94A3B8]">
                        {p.course_title  && <span>{p.course_title}</span>}
                        {p.semester_name && <span>{p.semester_name}</span>}
                        {p.final_score != null && (
                          <span className="font-semibold text-[#0B1F3A]">Score: {p.final_score}</span>
                        )}
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </section>

          {/* Achievements */}
          {detail.achievements.length > 0 && (
            <section>
              <h2 className="mb-4 text-[15px] font-semibold text-[#0B1F3A]">
                Achievements
                <span className="ml-2 text-sm font-normal text-[#64748B]">({detail.achievements.length})</span>
              </h2>
              <div className="space-y-3">
                {detail.achievements.map(a => (
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

          {/* Badges */}
          {detail.badges.length > 0 && (
            <section>
              <h2 className="mb-4 text-[15px] font-semibold text-[#0B1F3A]">
                Badges
                <span className="ml-2 text-sm font-normal text-[#64748B]">({detail.badges.length})</span>
              </h2>
              <div className="flex flex-wrap gap-3">
                {detail.badges.map(b => (
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
        </>
      )}
    </div>
  )
}
