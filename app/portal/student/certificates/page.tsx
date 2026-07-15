import { requirePortalRole } from '@/modules/rbac/guards'
import { getOwnCertificates } from '@/modules/certificates/queries'
import { getCertificateEligibility } from '@/modules/student-portal/queries'

const TYPE_LABELS: Record<string, string> = {
  course_completion:   'Course Completion',
  competition_award:   'Competition Award',
  achievement:         'Achievement',
  custom:              'Certificate',
}

export default async function StudentCertificatesPage() {
  const user         = await requirePortalRole('student')
  const [certificates, eligibilityList] = await Promise.all([
    getOwnCertificates(user.id),
    getCertificateEligibility(user.id),
  ])

  return (
    <div className="mx-auto max-w-3xl space-y-3">
      <div>
        <h1 className="text-base font-bold text-[#0B1F3A]">Certificates</h1>
        <p className="text-xs text-[#64748B]">
          {certificates.length} certificate{certificates.length !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Eligibility cards — one per active course, since a student may be
          concurrently enrolled in more than one and each has its own
          eligibility, independent of the others. */}
      {eligibilityList.length > 0 && (
        <div className="space-y-2.5">
          {eligibilityList.map((eligibility, i) => (
            <div
              key={`${eligibility.group_name ?? ''}-${eligibility.course_title ?? ''}-${i}`}
              className={`rounded-xl border p-4 ${eligibility.is_eligible ? 'border-[#A7F3D0] bg-[#E7F8EE]' : 'border-[#E2E8F0] bg-white'}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-[#64748B]">Certificate Status</p>
                  {eligibility.is_eligible ? (
                    <>
                      <p className="mt-1 text-sm font-bold text-[#15803D]">✓ Eligible for Certificate</p>
                      <p className="mt-0.5 text-xs text-[#10B981]">
                        {eligibility.consumed_sessions} / {eligibility.enrolled_sessions} sessions consumed
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="mt-1 text-sm font-semibold text-[#0B1F3A]">Not Yet Eligible</p>
                      <p className="mt-0.5 text-xs text-[#64748B]">
                        {eligibility.consumed_sessions} / {eligibility.enrolled_sessions} sessions consumed
                        {eligibility.sessions_remaining > 0 && (
                          <> · <span className="font-medium">{eligibility.sessions_remaining} more needed</span></>
                        )}
                      </p>
                    </>
                  )}
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-xl font-bold text-[#0B1F3A]">
                    {eligibility.enrolled_sessions > 0
                      ? `${Math.round((eligibility.consumed_sessions / eligibility.enrolled_sessions) * 100)}%`
                      : '—'}
                  </p>
                  <p className="text-[10px] text-[#64748B]">progress</p>
                </div>
              </div>

              {eligibility.enrolled_sessions > 0 && (
                <div className="mt-3">
                  <div className="h-2 overflow-hidden rounded-full bg-white/60">
                    <div
                      className={`h-full rounded-full transition-all ${eligibility.is_eligible ? 'bg-[#10B981]' : 'bg-[#FF8A1F]'}`}
                      style={{ width: `${Math.min(100, Math.round((eligibility.consumed_sessions / eligibility.enrolled_sessions) * 100))}%` }}
                    />
                  </div>
                </div>
              )}

              {eligibility.course_title && (
                <p className="mt-2 text-[10px] text-[#64748B]">
                  {eligibility.course_title}{eligibility.group_name ? ` · ${eligibility.group_name}` : ''}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Certificate list */}
      {certificates.length === 0 ? (
        <div className="ds-card px-5 py-10 text-center">
          <p className="text-sm text-[#64748B]">No certificates yet. Complete your sessions to become eligible.</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {certificates.map((c) => (
            <div
              key={c.id}
              className={`rounded-xl border bg-white p-4 ${
                c.status === 'revoked' ? 'border-[#FECACA] opacity-60' : 'border-[#E2E8F0]'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-[14px] font-semibold text-[#0B1F3A] leading-tight">{c.title}</h3>
                    {c.status === 'revoked' && (
                      <span className="shrink-0 rounded-full bg-[#FEE2E2] px-2 py-0.5 text-[11px] font-medium text-[#EF4444]">Revoked</span>
                    )}
                  </div>
                  <p className="mt-0.5 text-[12px] text-[#64748B]">
                    {TYPE_LABELS[c.certificate_type] ?? c.certificate_type}
                    {c.course_title && ` · ${c.course_title}`}
                  </p>
                  <p className="mt-1 text-[11px] text-[#64748B]">
                    Issued {new Date(c.issued_at).toLocaleDateString('en-GB')} · <span className="font-mono">{c.certificate_code}</span>
                  </p>
                </div>

                {/* Desktop: stacked buttons on right */}
                {c.status === 'active' && (
                  <div className="hidden sm:flex shrink-0 flex-col gap-1.5">
                    <a
                      href={`/verify/${c.certificate_code}`}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-lg border border-[#E2E8F0] px-3 py-1.5 text-[12px] font-medium text-[#0B1F3A] hover:bg-[#F8FAFC] text-center"
                    >
                      Verify
                    </a>
                    <a
                      href={`/api/certificates/${c.certificate_code}/pdf`}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-lg bg-[#FF8A1F] px-3 py-1.5 text-[12px] font-medium text-white hover:bg-[#e87c18] text-center"
                    >
                      Download PDF
                    </a>
                  </div>
                )}
              </div>

              {/* Mobile: full-width buttons below content */}
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
