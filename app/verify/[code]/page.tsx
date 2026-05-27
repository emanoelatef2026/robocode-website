import { verifyCertificate } from '@/modules/certificates/queries'
import Link from 'next/link'

interface Props {
  params: Promise<{ code: string }>
}

const TYPE_LABELS: Record<string, string> = {
  semester_completion: 'Semester Completion',
  course_completion:   'Course Completion',
  competition_award:   'Competition Award',
  achievement:         'Achievement',
  custom:              'Certificate',
}

export default async function VerifyCertificatePage({ params }: Props) {
  const { code }   = await params
  const certificate = await verifyCertificate(code.toUpperCase())

  return (
    <div className="min-h-screen bg-[#F4F7FB] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="mb-8 text-center">
          <Link href="/" className="inline-block mb-4">
            <span className="text-xl font-bold text-[#0B1F3A]">Robocode Academy</span>
          </Link>
          <h1 className="text-lg font-semibold text-[#0B1F3A]">Certificate Verification</h1>
        </div>

        {!certificate ? (
          /* Not found */
          <div className="rounded-2xl border border-[#E2E8F0] bg-white p-8 text-center shadow-sm">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-50">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-8 w-8 text-red-400" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-[#0B1F3A]">Certificate Not Found</h2>
            <p className="mt-2 text-sm text-[#64748B]">
              The certificate code <strong className="font-mono">{code.toUpperCase()}</strong> does not exist or has been removed.
            </p>
          </div>
        ) : certificate.status === 'revoked' ? (
          /* Revoked */
          <div className="rounded-2xl border border-red-200 bg-white p-8 text-center shadow-sm">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-50">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-8 w-8 text-red-400" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-red-600">Certificate Revoked</h2>
            <p className="mt-2 text-sm text-[#64748B]">
              This certificate has been revoked and is no longer valid.
            </p>
            <p className="mt-3 font-mono text-xs text-[#94A3B8]">{certificate.certificate_code}</p>
          </div>
        ) : (
          /* Valid */
          <div className="rounded-2xl border border-green-200 bg-white shadow-sm overflow-hidden">
            {/* Green header stripe */}
            <div className="bg-gradient-to-r from-[#0B1F3A] to-[#1a3a6e] px-8 py-6 text-center">
              <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-green-400/20">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-7 w-7 text-green-300" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                </svg>
              </div>
              <p className="text-sm font-medium text-green-300 uppercase tracking-wider">Verified Certificate</p>
            </div>

            <div className="px-8 py-6 space-y-4">
              <div className="text-center">
                <h2 className="text-xl font-bold text-[#0B1F3A]">{certificate.title}</h2>
                <p className="mt-1 text-sm text-[#64748B]">{TYPE_LABELS[certificate.certificate_type] ?? 'Certificate'}</p>
              </div>

              <div className="rounded-xl bg-[#F8FAFC] px-4 py-3 text-center">
                <p className="text-xs text-[#94A3B8] uppercase tracking-wide mb-1">Awarded To</p>
                <p className="text-lg font-bold text-[#FF8A1F]">{certificate.recipient_name}</p>
              </div>

              <dl className="grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-lg bg-[#F8FAFC] px-3 py-2">
                  <dt className="text-xs text-[#94A3B8] uppercase tracking-wide mb-0.5">Date Issued</dt>
                  <dd className="font-medium text-[#0B1F3A]">
                    {new Date(certificate.issued_at).toLocaleDateString('en-GB', {
                      day: 'numeric', month: 'long', year: 'numeric',
                    })}
                  </dd>
                </div>

                {certificate.valid_until && (
                  <div className="rounded-lg bg-[#F8FAFC] px-3 py-2">
                    <dt className="text-xs text-[#94A3B8] uppercase tracking-wide mb-0.5">Valid Until</dt>
                    <dd className="font-medium text-[#0B1F3A]">
                      {new Date(certificate.valid_until).toLocaleDateString('en-GB', {
                        day: 'numeric', month: 'long', year: 'numeric',
                      })}
                    </dd>
                  </div>
                )}

                {certificate.course_title && (
                  <div className="rounded-lg bg-[#F8FAFC] px-3 py-2">
                    <dt className="text-xs text-[#94A3B8] uppercase tracking-wide mb-0.5">Course</dt>
                    <dd className="font-medium text-[#0B1F3A]">{certificate.course_title}</dd>
                  </div>
                )}

                {certificate.semester_name && (
                  <div className="rounded-lg bg-[#F8FAFC] px-3 py-2">
                    <dt className="text-xs text-[#94A3B8] uppercase tracking-wide mb-0.5">Semester</dt>
                    <dd className="font-medium text-[#0B1F3A]">{certificate.semester_name}</dd>
                  </div>
                )}

                {certificate.issuer_name && (
                  <div className="rounded-lg bg-[#F8FAFC] px-3 py-2">
                    <dt className="text-xs text-[#94A3B8] uppercase tracking-wide mb-0.5">Issued By</dt>
                    <dd className="font-medium text-[#0B1F3A]">{certificate.issuer_name}</dd>
                  </div>
                )}
              </dl>

              {certificate.snapshot && (
                <div className="border-t border-[#E2E8F0] pt-4">
                  <p className="text-xs text-[#94A3B8] uppercase tracking-wide text-center mb-3">
                    Scores at Time of Issuance
                  </p>
                  <div className="grid grid-cols-3 gap-2 text-center text-sm">
                    <div className="rounded-lg bg-[#F8FAFC] px-2 py-2">
                      <p className="text-xs text-[#94A3B8] mb-0.5">Attendance</p>
                      <p className="font-bold text-[#0B1F3A]">{certificate.snapshot.attendance_score}%</p>
                    </div>
                    <div className="rounded-lg bg-[#F8FAFC] px-2 py-2">
                      <p className="text-xs text-[#94A3B8] mb-0.5">Assignments</p>
                      <p className="font-bold text-[#0B1F3A]">{certificate.snapshot.assignment_score}%</p>
                    </div>
                    <div className="rounded-lg bg-[#F8FAFC] px-2 py-2">
                      <p className="text-xs text-[#94A3B8] mb-0.5">Overall</p>
                      <p className="font-bold text-[#0B1F3A]">{certificate.snapshot.overall_score}%</p>
                    </div>
                  </div>
                </div>
              )}

              <div className="border-t border-[#E2E8F0] pt-3 text-center">
                <p className="text-xs text-[#94A3B8]">Certificate No.</p>
                <p className="font-mono text-sm font-bold text-[#0B1F3A] tracking-widest mt-0.5">
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
