import { verifyCertificate } from '@/modules/certificates/queries'

interface Props {
  params: Promise<{ code: string }>
}

const TYPE_LABELS: Record<string, string> = {
  semester_completion: 'Course Completion',
  course_completion:   'Course Completion',
  competition_award:   'Competition Award',
  achievement:         'Achievement',
  custom:              'Certificate',
}

export default async function VerifyCertificatePage({ params }: Props) {
  const { code }    = await params
  const certificate = await verifyCertificate(code.toUpperCase())

  return (
    <div className="min-h-screen bg-[var(--bg)] flex flex-col items-center justify-center px-4 py-10">

      {/* Branding */}
      <div className="mb-6 text-center">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-[var(--muted)]">Robocode Academy</p>
        <h1 className="mt-1 text-base font-bold text-[var(--navy)]">Certificate Verification</h1>
      </div>

      <div className="w-full max-w-md">

        {/* ── Not found ── */}
        {!certificate ? (
          <div className="rounded-[var(--radius-xl)] border border-[var(--border)] bg-white px-8 py-10 text-center shadow-sm">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--red-soft)]">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-7 w-7 text-[var(--red-dark)]" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h2 className="text-[15px] font-semibold text-[var(--navy)]">Certificate Not Found</h2>
            <p className="mt-2 text-[13px] text-[var(--text-3)]">
              The code <span className="font-mono font-bold">{code.toUpperCase()}</span> does not exist or has been removed.
            </p>
          </div>

        /* ── Revoked ── */
        ) : certificate.status === 'revoked' ? (
          <div className="rounded-[var(--radius-xl)] border border-[#FECACA] bg-white px-8 py-10 text-center shadow-sm">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--red-soft)]">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-7 w-7 text-[var(--red-dark)]" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
              </svg>
            </div>
            <h2 className="text-[15px] font-semibold text-[var(--red-dark)]">Certificate Revoked</h2>
            <p className="mt-2 text-[13px] text-[var(--text-3)]">This certificate has been revoked and is no longer valid.</p>
            <p className="mt-3 font-mono text-xs text-[var(--muted)]">{certificate.certificate_code}</p>
          </div>

        /* ── Valid ── */
        ) : (
          <div className="rounded-[var(--radius-xl)] border border-[#A7F3D0] bg-white shadow-sm overflow-hidden">

            {/* Dark header stripe */}
            <div className="bg-gradient-to-r from-[var(--navy)] to-[var(--navy-light)] px-8 py-5 text-center">
              <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-[#10B981]/20">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-6 w-6 text-green-300" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                </svg>
              </div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-green-300">Verified Certificate</p>
            </div>

            <div className="px-6 py-5 space-y-4">

              {/* Course name — prominently shown; certificate.title is the immutable snapshot */}
              <div className="text-center">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--muted)]">Course Completed</p>
                <h2 className="mt-1 text-[17px] font-bold uppercase tracking-wide text-[var(--navy)]">
                  {certificate.title || certificate.course_title || '—'}
                </h2>
                <p className="mt-0.5 text-[11px] text-[var(--text-3)]">{TYPE_LABELS[certificate.certificate_type] ?? 'Certificate'}</p>
              </div>

              {/* Recipient name */}
              <div className="rounded-xl bg-[#FFF7ED] px-4 py-3 text-center">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--muted)] mb-0.5">Awarded To</p>
                <p className="text-[18px] font-bold text-[var(--orange-strong)]">{certificate.recipient_name}</p>
              </div>

              {/* Metadata grid */}
              <dl className="grid grid-cols-2 gap-2.5 text-[13px]">
                <div className="rounded-lg bg-[var(--bg)] px-3 py-2.5">
                  <dt className="text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)] mb-0.5">Date Issued</dt>
                  <dd className="font-semibold text-[var(--navy)]">
                    {new Date(certificate.issued_at).toLocaleDateString('en-GB', {
                      day: 'numeric', month: 'long', year: 'numeric',
                    })}
                  </dd>
                </div>

                {/* Course title shown in metadata only when it differs from the stored title snapshot */}
                {certificate.course_title && certificate.course_title !== certificate.title && (
                  <div className="rounded-lg bg-[var(--bg)] px-3 py-2.5">
                    <dt className="text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)] mb-0.5">Course</dt>
                    <dd className="font-semibold text-[var(--navy)]">{certificate.course_title}</dd>
                  </div>
                )}

                {certificate.semester_name && (
                  <div className="rounded-lg bg-[var(--bg)] px-3 py-2.5">
                    <dt className="text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)] mb-0.5">Semester</dt>
                    <dd className="font-semibold text-[var(--navy)]">{certificate.semester_name}</dd>
                  </div>
                )}

                {certificate.valid_until && (
                  <div className="rounded-lg bg-[var(--bg)] px-3 py-2.5">
                    <dt className="text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)] mb-0.5">Valid Until</dt>
                    <dd className="font-semibold text-[var(--navy)]">
                      {new Date(certificate.valid_until).toLocaleDateString('en-GB', {
                        day: 'numeric', month: 'long', year: 'numeric',
                      })}
                    </dd>
                  </div>
                )}
              </dl>

              {/* Projects completed */}
              {certificate.projects && certificate.projects.length > 0 && (
                <div className="border-t border-[var(--border)] pt-4">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--muted)] text-center mb-3">
                    Projects Completed
                  </p>
                  <ul className="space-y-1.5">
                    {certificate.projects
                      .slice()
                      .sort((a, b) => a.sort_order - b.sort_order)
                      .map((p, i) => (
                        <li key={i} className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-[var(--bg)]">
                          <span className="text-[var(--orange-strong)] font-bold text-[14px] leading-none">•</span>
                          <span className="text-[13px] font-medium text-[var(--navy)]">{p.title}</span>
                        </li>
                      ))}
                  </ul>
                </div>
              )}

              {/* Certificate number */}
              <div className="border-t border-[var(--border)] pt-3 text-center">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--muted)]">Certificate No.</p>
                <p className="mt-0.5 font-mono text-[13px] font-bold text-[var(--navy)] tracking-widest">
                  {certificate.certificate_code}
                </p>
              </div>

            </div>
          </div>
        )}
      </div>
    </div>
  )
}
