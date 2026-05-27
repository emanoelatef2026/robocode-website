import { requirePortalRole } from '@/modules/rbac/guards'
import { getOwnCertificates } from '@/modules/certificates/queries'

const TYPE_LABELS: Record<string, string> = {
  semester_completion: 'Semester Completion',
  course_completion:   'Course Completion',
  competition_award:   'Competition Award',
  achievement:         'Achievement',
  custom:              'Certificate',
}

export default async function StudentCertificatesPage() {
  const user         = await requirePortalRole('student')
  const certificates = await getOwnCertificates(user.id)

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#0B1F3A]">My Certificates</h1>
        <p className="mt-1 text-sm text-[#64748B]">{certificates.length} certificate{certificates.length !== 1 ? 's' : ''}</p>
      </div>

      {certificates.length === 0 ? (
        <div className="rounded-xl border border-[#E2E8F0] bg-white px-6 py-12 text-center">
          <p className="text-sm text-[#64748B]">No certificates yet. Complete courses and semesters to earn certificates.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {certificates.map((c) => (
            <div
              key={c.id}
              className={`rounded-xl border bg-white p-4 flex items-start justify-between gap-4 ${
                c.status === 'revoked' ? 'border-red-200 opacity-60' : 'border-[#E2E8F0]'
              }`}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-semibold text-[#0B1F3A] truncate">{c.title}</h3>
                  {c.status === 'revoked' && (
                    <span className="shrink-0 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-600">Revoked</span>
                  )}
                </div>
                <p className="mt-0.5 text-sm text-[#64748B]">
                  {TYPE_LABELS[c.certificate_type] ?? c.certificate_type}
                  {c.course_title && ` · ${c.course_title}`}
                  {c.semester_name && ` · ${c.semester_name}`}
                </p>
                <p className="mt-1 text-xs text-[#94A3B8]">
                  Issued {new Date(c.issued_at).toLocaleDateString('en-GB')} · <span className="font-mono">{c.certificate_code}</span>
                </p>
              </div>

              {c.status === 'active' && (
                <div className="flex shrink-0 gap-2">
                  <a
                    href={`/verify/${c.certificate_code}`}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-lg border border-[#E2E8F0] px-3 py-1.5 text-xs font-medium text-[#0B1F3A] hover:bg-[#F8FAFC]"
                  >
                    Verify
                  </a>
                  <a
                    href={`/api/certificates/${c.certificate_code}/pdf`}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-lg bg-[#FF8A1F] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#e87c18]"
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
