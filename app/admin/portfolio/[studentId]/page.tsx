import { notFound } from 'next/navigation'
import { requirePermission } from '@/modules/rbac/guards'
import { getStudentPortfolioDetail } from '@/modules/portfolio/queries'
import { archiveProject, deleteAchievement, deleteBadge } from '@/modules/portfolio/actions'
import Link from 'next/link'
import StatusBadge from '@/components/admin/StatusBadge'

interface Props {
  params: Promise<{ studentId: string }>
}

export default async function StudentPortfolioDetailPage({ params }: Props) {
  await requirePermission('manage_portfolio')
  const { studentId } = await params

  const detail = await getStudentPortfolioDetail(studentId)
  if (!detail) notFound()

  const { student_name, student_email, portfolio, projects, achievements, badges } = detail

  return (
    <div className="space-y-8">
      <div className="mb-6 flex justify-end">
        <Link
          href="/admin/portfolio"
          className="text-sm text-[#64748B] hover:text-[#0B1F3A]"
        >
          ← Back to Portfolios
        </Link>
      </div>

      {/* ── Projects ─────────────────────────────────────────────────── */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold text-[#0B1F3A]">Projects</h2>
          <div className="flex gap-2">
            <Link
              href={`/admin/portfolio/${studentId}/projects/promote`}
              className="rounded-lg border border-[#E2E8F0] px-3 py-1.5 text-xs font-medium text-[#0B1F3A] hover:bg-[#F8FAFC]"
            >
              Promote Submission
            </Link>
            <Link
              href={`/admin/portfolio/${studentId}/projects/new`}
              className="rounded-lg bg-[#FF8A1F] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#e87c18]"
            >
              + Add Project
            </Link>
          </div>
        </div>

        <div className="rounded-xl border border-[#E2E8F0] bg-white">
          {projects.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-[#64748B]">No projects yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                    <th className="px-4 py-3 text-left text-xs font-medium text-[#64748B]">Title</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-[#64748B]">Course</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-[#64748B]">Semester</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-[#64748B]">Score</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-[#64748B]">Featured</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-[#64748B]">Public</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-[#64748B]">Archived</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {projects.map((p) => (
                    <tr key={p.id} className="border-b border-[#E2E8F0] last:border-0 hover:bg-[#F8FAFC]">
                      <td className="px-4 py-3 font-medium text-[#0B1F3A]">{p.title}</td>
                      <td className="px-4 py-3 text-[#64748B]">{p.course_title ?? '—'}</td>
                      <td className="px-4 py-3 text-[#64748B]">{p.semester_name ?? '—'}</td>
                      <td className="px-4 py-3 text-center text-[#0B1F3A]">
                        {p.final_score != null ? p.final_score : '—'}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {p.is_featured ? <span className="text-[#FF8A1F]">★</span> : <span className="text-[#CBD5E1]">☆</span>}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <StatusBadge status={p.is_public ? 'active' : 'inactive'} />
                      </td>
                      <td className="px-4 py-3 text-center">
                        {p.is_archived && <span className="text-xs text-[#64748B]">Archived</span>}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          href={`/admin/portfolio/${studentId}/projects/${p.id}/edit`}
                          className="text-xs font-medium text-[#FF8A1F] hover:underline"
                        >
                          Edit
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      {/* ── Achievements ─────────────────────────────────────────────── */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold text-[#0B1F3A]">Achievements</h2>
          <Link
            href={`/admin/portfolio/${studentId}/achievements/new`}
            className="rounded-lg bg-[#FF8A1F] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#e87c18]"
          >
            + Add Achievement
          </Link>
        </div>

        <div className="rounded-xl border border-[#E2E8F0] bg-white">
          {achievements.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-[#64748B]">No achievements yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                    <th className="px-4 py-3 text-left text-xs font-medium text-[#64748B]">Title</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-[#64748B]">Type</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-[#64748B]">Date Awarded</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {achievements.map((a) => (
                    <tr key={a.id} className="border-b border-[#E2E8F0] last:border-0 hover:bg-[#F8FAFC]">
                      <td className="px-4 py-3 font-medium text-[#0B1F3A]">{a.title}</td>
                      <td className="px-4 py-3 text-[#64748B] capitalize">{a.achievement_type}</td>
                      <td className="px-4 py-3 text-[#64748B]">
                        {new Date(a.date_awarded).toLocaleDateString('en-GB')}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          href={`/admin/portfolio/${studentId}/achievements/${a.id}/edit`}
                          className="text-xs font-medium text-[#FF8A1F] hover:underline"
                        >
                          Edit
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      {/* ── Badges ───────────────────────────────────────────────────── */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold text-[#0B1F3A]">Badges</h2>
          <Link
            href={`/admin/portfolio/${studentId}/badges/new`}
            className="rounded-lg bg-[#FF8A1F] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#e87c18]"
          >
            + Award Badge
          </Link>
        </div>

        <div className="rounded-xl border border-[#E2E8F0] bg-white">
          {badges.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-[#64748B]">No badges yet.</div>
          ) : (
            <div className="flex flex-wrap gap-3 p-4">
              {badges.map((b) => (
                <div key={b.id} className="flex items-center gap-2 rounded-lg border border-[#E2E8F0] px-3 py-2">
                  {b.badge_image && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={b.badge_image} alt={b.badge_name} className="h-6 w-6 rounded-full object-cover" />
                  )}
                  <span className="text-sm font-medium text-[#0B1F3A]">{b.badge_name}</span>
                  <span className="text-xs text-[#64748B]">
                    {new Date(b.awarded_at).toLocaleDateString('en-GB')}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
