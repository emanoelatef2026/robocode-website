import { requirePortalRole }          from '@/modules/rbac/guards'
import { getParentChildren }          from '@/modules/parents/parent-portal-queries'
import { getChildSessionsProgress }   from '@/modules/parents/parent-portal-queries'
import { getChildCertificates }       from '@/modules/certificates/queries'
import Link                           from 'next/link'
import ChildSelector                  from '@/components/portal/parent/ChildSelector'
import NoChildrenLinked               from '@/components/portal/parent/NoChildrenLinked'

interface Props {
  searchParams: Promise<{ child?: string }>
}

const TYPE_LABELS: Record<string, string> = {
  semester_completion: 'Course Completion',
  course_completion:   'Course Completion',
  competition_award:   'Competition Award',
  achievement:         'Achievement',
  custom:              'Certificate',
}

export default async function ParentCertificatesPage({ searchParams }: Props) {
  const { child } = await searchParams
  const user      = await requirePortalRole('parent')

  const children = await getParentChildren(user.id)

  if (!children.length) {
    return <NoChildrenLinked />
  }

  const studentId  = child ?? children[0].student_id
  const selected   = children.find(c => c.student_id === studentId) ?? children[0]
  const childParam = `?child=${selected.student_id}`

  const [certificates, sessions] = await Promise.all([
    getChildCertificates(user.id, selected.student_id),
    getChildSessionsProgress(user.id, selected.student_id),
  ])

  const completedS    = sessions?.completed_sessions ?? 0
  const totalS        = sessions?.total_sessions     ?? 0
  const progressPct   = totalS > 0 ? Math.round((completedS / totalS) * 100) : 0
  const hasCerts      = certificates.length > 0
  const isEligible    = totalS > 0 && completedS >= totalS

  return (
    <div className="mx-auto max-w-3xl space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-[#0B1F3A]">Certificates</h1>
          <p className="mt-0.5 text-sm text-[#64748B]">
            {selected.student_name} · {certificates.length} certificate{certificates.length !== 1 ? 's' : ''}
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
        hrefFor={(id) => `/portal/parent/certificates?child=${id}`}
      />

      {/* Eligibility block */}
      <div className="ds-card p-5 space-y-3">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-[#64748B]">Certificate Eligibility</p>

        <div className="flex items-center justify-between text-sm">
          <span className="text-[#64748B]">Completed Sessions</span>
          <span className="font-bold text-[#0B1F3A]">{completedS} / {totalS}</span>
        </div>
        <div className="h-2.5 overflow-hidden rounded-full bg-[#F1F5F9]">
          <div
            className={`h-full rounded-full ${progressPct >= 100 ? 'bg-[#10B981]' : progressPct >= 75 ? 'bg-yellow-500' : 'bg-[#FF8A1F]'}`}
            style={{ width: `${Math.min(100, progressPct)}%` }}
          />
        </div>

        <div className="flex items-center justify-between">
          <p className="text-[12px] text-[#64748B]">
            Certificates are issued after course completion.
          </p>
          {hasCerts ? (
            <span className="rounded-full bg-[#E7F8EE] px-2.5 py-0.5 text-[12px] font-semibold text-[#15803D]">
              Certificate Issued
            </span>
          ) : isEligible ? (
            <span className="rounded-full bg-[#EFF6FF] px-2.5 py-0.5 text-[12px] font-semibold text-[#1D4ED8]">
              Eligible
            </span>
          ) : (
            <span className="rounded-full bg-[#F3F4F6] px-2.5 py-0.5 text-[12px] font-medium text-[#6B7280]">
              Not Eligible Yet
            </span>
          )}
        </div>
      </div>

      {/* Certificates list */}
      {certificates.length === 0 ? (
        <div className="ds-card px-6 py-12 text-center">
          <p className="text-sm text-[#64748B]">No certificates yet.</p>
          <p className="mt-1 text-xs text-[#64748B]">
            Certificates are issued after course completion.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {certificates.map(c => (
            <div
              key={c.id}
              className={`rounded-xl border bg-white p-4 ${
                c.status === 'revoked' ? 'border-[#FECACA] opacity-60' : 'border-[#E2E8F0]'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-[14px] font-semibold text-[#0B1F3A] leading-tight">{c.title}</h3>
                    {c.status === 'revoked' && (
                      <span className="shrink-0 rounded-full bg-[#FEE2E2] px-2 py-0.5 text-[11px] font-medium text-[#EF4444]">
                        Revoked
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-[12px] text-[#64748B]">
                    {TYPE_LABELS[c.certificate_type] ?? c.certificate_type}
                    {c.course_title && ` · ${c.course_title}`}
                  </p>
                  <p className="mt-1 text-[11px] text-[#64748B]">
                    Issued {new Date(c.issued_at).toLocaleDateString('en-GB')}
                    {' · '}
                    <span className="font-mono">{c.certificate_code}</span>
                  </p>
                </div>

                {/* Active badge on desktop right */}
                {c.status === 'active' && (
                  <div className="hidden sm:flex shrink-0 gap-2">
                    <a
                      href={`/verify/${c.certificate_code}`}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-lg border border-[#E2E8F0] px-3 py-1.5 text-[12px] font-medium text-[#0B1F3A] hover:bg-[#F8FAFC]"
                    >
                      Verify
                    </a>
                    <a
                      href={`/api/certificates/${c.certificate_code}/pdf`}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-lg bg-[#FF8A1F] px-3 py-1.5 text-[12px] font-medium text-white hover:bg-[#e87c18]"
                    >
                      Download PDF
                    </a>
                  </div>
                )}
              </div>

              {/* Mobile buttons — full-width row below content */}
              {c.status === 'active' && (
                <div className="mt-3 flex gap-2 sm:hidden">
                  <a
                    href={`/verify/${c.certificate_code}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex min-h-11 flex-1 items-center justify-center rounded-lg border border-[#E2E8F0] text-center text-[12px] font-medium text-[#0B1F3A]"
                  >
                    Verify
                  </a>
                  <a
                    href={`/api/certificates/${c.certificate_code}/pdf`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex min-h-11 flex-1 items-center justify-center rounded-lg bg-[#FF8A1F] text-center text-[12px] font-medium text-white"
                  >
                    Download PDF
                  </a>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
