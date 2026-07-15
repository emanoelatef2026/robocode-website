import { requirePortalRole } from '@/modules/rbac/guards'
import { getParentChildren, getChildCompetitions } from '@/modules/parents/parent-portal-queries'
import Link from 'next/link'
import ChildSelector from '@/components/portal/parent/ChildSelector'
import NoChildrenLinked from '@/components/portal/parent/NoChildrenLinked'
import EmptyState from '@/components/admin/EmptyState'

interface Props {
  searchParams: Promise<{ child?: string }>
}

export default async function ParentCompetitionsPage({ searchParams }: Props) {
  const { child } = await searchParams
  const user      = await requirePortalRole('parent')

  const children = await getParentChildren(user.id)
  if (!children.length) {
    return <NoChildrenLinked />
  }

  const studentId  = child ?? children[0].student_id
  const selected   = children.find(c => c.student_id === studentId) ?? children[0]
  const childParam = `?child=${selected.student_id}`

  const competitions = await getChildCompetitions(user.id, selected.student_id)

  return (
    <div className="mx-auto max-w-2xl space-y-5">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-[#0B1F3A]">Competitions</h1>
          <p className="mt-0.5 text-sm text-[#64748B]">
            Every competition {selected.student_name} has represented Robocode in
          </p>
        </div>
        <Link href={`/portal/parent${childParam}`} className="text-[13px] text-[#FF8A1F] hover:underline">
          ← Dashboard
        </Link>
      </div>

      {/* Child switcher */}
      <ChildSelector
        linkedChildren={children}
        selectedId={selected.student_id}
        hrefFor={(id) => `/portal/parent/competitions?child=${id}`}
      />

      {competitions.length === 0 ? (
        <EmptyState
          title="No competitions yet"
          description={`${selected.student_name} hasn't been entered into a competition yet. Ask the academy about upcoming opportunities.`}
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
                    href={`/portal/parent/certificates${childParam}`}
                    className="rounded-full border border-[#E2E8F0] px-3 py-1.5 text-[11px] font-semibold text-[#475569] transition hover:border-[#FF8A1F] hover:text-[#FF8A1F]"
                  >
                    View Certificate
                  </Link>
                )}
                {c.project_id && (
                  <Link
                    href={`/portal/parent/portfolio${childParam}`}
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
