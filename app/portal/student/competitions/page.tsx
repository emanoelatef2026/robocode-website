import { requirePortalRole } from '@/modules/rbac/guards'
import { createServiceClient } from '@/lib/supabase/service'
import { getStudentCompetitions } from '@/modules/student-competitions/queries'
import EmptyState from '@/components/admin/EmptyState'
import Link from 'next/link'

export default async function StudentCompetitionsPage() {
  const user = await requirePortalRole('student')

  const db = createServiceClient()
  const { data: studentRow } = await db
    .from('students').select('id').eq('user_id', user.id).maybeSingle()
  const studentId = (studentRow as any)?.id ?? null

  const competitions = studentId ? await getStudentCompetitions(studentId) : []

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div>
        <h1 className="text-base font-bold text-[#0B1F3A]">Competitions</h1>
        <p className="mt-0.5 text-[12.5px] text-[#64748B]">Every competition you&apos;ve represented Robocode in.</p>
      </div>

      {competitions.length === 0 ? (
        <EmptyState
          title="No competitions yet"
          description="Ask your team leader or instructor about upcoming competitions you could join."
        />
      ) : (
        <div className="space-y-3">
          {competitions.map(c => (
            <div key={c.id} className="ds-card p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[13.5px] font-bold text-[#0B1F3A]">{c.competition_name}</p>
                  <p className="mt-0.5 text-[11px] text-[#64748B]">
                    {[c.season, c.year].filter(Boolean).join(' ')}
                    {c.role ? ` · ${c.role}` : ''}
                    {c.team_name ? ` · ${c.team_name}` : ''}
                  </p>
                </div>
                {(c.rank || c.award) && (
                  <span className="shrink-0 rounded-full bg-[#FFFBEB] px-2.5 py-1 text-[10.5px] font-bold text-[#B45309]">
                    🎖️ {[c.award, c.rank].filter(Boolean).join(' · ')}
                  </span>
                )}
              </div>

              {c.notes && (
                <p className="mt-2.5 rounded-xl bg-[#F8FAFC] px-3 py-2 text-[11.5px] leading-relaxed text-[#475569]">
                  {c.notes}
                </p>
              )}

              <div className="mt-3 flex flex-wrap items-center gap-2">
                {c.certificate_id && (
                  <Link
                    href="/portal/student/certificates"
                    className="rounded-full border border-[#E2E8F0] px-3 py-1.5 text-[11px] font-semibold text-[#475569] transition hover:border-[#FF8A1F] hover:text-[#FF8A1F]"
                  >
                    View Certificate
                  </Link>
                )}
                {c.project_id && (
                  <Link
                    href="/portal/student/portfolio"
                    className="rounded-full border border-[#E2E8F0] px-3 py-1.5 text-[11px] font-semibold text-[#475569] transition hover:border-[#FF8A1F] hover:text-[#FF8A1F]"
                  >
                    View Project
                  </Link>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
