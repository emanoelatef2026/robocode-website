import { requirePortalRole, requirePermission } from '@/modules/rbac/guards'
import { listCertificates, listActiveTemplates } from '@/modules/certificates/queries'
import { listCourses }                           from '@/modules/courses/queries'
import { listSemesters }                         from '@/modules/semesters/queries'
import { createServiceClient }                   from '@/lib/supabase/service'
import StatusBadge                               from '@/components/admin/StatusBadge'
import EmptyState                                from '@/components/admin/EmptyState'
import Pagination                                from '@/components/admin/Pagination'
import SearchInput                               from '@/components/admin/SearchInput'
import FilterSelect                              from '@/components/admin/FilterSelect'
import IssueCertificateModal                     from '@/app/admin/certificates/IssueCertificateModal'
import Link                                      from 'next/link'

interface Props {
  searchParams: Promise<{ page?: string; q?: string; type?: string; status?: string }>
}

const TYPE_LABELS: Record<string, string> = {
  semester_completion: 'Course Completion',
  course_completion:   'Course Completion',
  competition_award:   'Competition',
  achievement:         'Achievement',
  custom:              'Custom',
}

export default async function TLCertificatesPage({ searchParams }: Props) {
  const user = await requirePortalRole('team_leader')
  await requirePermission('manage_certificates')

  const params = await searchParams
  const page   = Number(params.page ?? 1)
  const search = params.q ?? ''
  const type   = params.type
  const status = params.status

  const db = createServiceClient()

  // Load list + modal data in parallel
  const [result, templates, coursesResult, semestersResult, studentsResult] = await Promise.all([
    listCertificates({ page, perPage: 20, search, type, status, branchIds: user.branchIds }),
    listActiveTemplates(),
    listCourses({ perPage: 200 }),
    listSemesters({ perPage: 100 }),
    db
      .from('students')
      .select('id, users!students_user_id_fkey(email, profiles!profiles_user_id_fkey(first_name, last_name))')
      .is('deleted_at', null)
      .eq('status', 'active')
      .in('branch_id', user.branchIds)
      .order('id'),
  ])

  const students = ((studentsResult.data ?? []) as any[]).map(row => {
    const profile = row.users?.profiles
    return {
      id:    row.id,
      name:  [profile?.first_name, profile?.last_name].filter(Boolean).join(' ') || row.users?.email || '—',
      email: row.users?.email ?? '',
    }
  })

  return (
    <div>
      <div className="mb-6 flex justify-end">
        <IssueCertificateModal
          templates={templates}
          students={students}
          semesters={semestersResult.data.map(s => ({ id: s.id, name: s.name }))}
          courses={coursesResult.data.map(c => ({ id: c.id, title: c.title }))}
          triggerClassName="inline-flex items-center gap-1.5 rounded-lg bg-[#FF8A1F] px-3 py-1.5 text-[12px] font-medium text-white transition hover:bg-[#e87c18]"
          successRedirect="/portal/team-leader/certificates"
        />
      </div>

      <div className="rounded-xl border border-[#E2E8F0] bg-white">
        <div className="border-b border-[#E2E8F0] px-3 py-2 space-y-1.5 sm:px-4 sm:py-3 sm:space-y-0 sm:flex sm:flex-wrap sm:items-center sm:gap-2">
          <SearchInput placeholder="Search by title, name, or code…" />
          <div className="flex gap-2 overflow-x-auto no-scrollbar sm:contents">
            <FilterSelect
              name="type"
              value={type ?? ''}
              placeholder="All Types"
              options={[
                { value: 'course_completion',   label: 'Course Completion' },
                { value: 'competition_award',   label: 'Competition' },
                { value: 'achievement',         label: 'Achievement' },
                { value: 'custom',              label: 'Custom' },
              ]}
            />
            <FilterSelect
              name="status"
              value={status ?? ''}
              placeholder="All Statuses"
              options={[
                { value: 'active',  label: 'Active'  },
                { value: 'revoked', label: 'Revoked' },
              ]}
            />
          </div>
        </div>

        {result.data.length === 0 ? (
          <EmptyState
            title="No certificates found"
            description={search ? 'Try a different search term.' : 'Issue the first certificate to get started.'}
          />
        ) : (
          <>
            {/* ── Mobile cards ── */}
            <div className="md:hidden divide-y divide-[#E2E8F0]">
              {result.data.map(c => (
                <div key={c.id} className="px-4 py-3.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-[14px] font-semibold text-[#0B1F3A] leading-tight truncate">{c.title}</p>
                      <p className="mt-0.5 text-[12px] font-medium text-[#0B1F3A]">{c.recipient_name}</p>
                      {c.student_email && <p className="text-[11px] text-[#94A3B8] truncate">{c.student_email}</p>}
                    </div>
                    <StatusBadge status={c.status === 'active' ? 'active' : 'inactive'} />
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-[11px] text-[#64748B]">
                      <span className="font-mono bg-[#F8FAFC] px-1.5 py-0.5 rounded">{c.certificate_code}</span>
                      <span>{TYPE_LABELS[c.certificate_type] ?? c.certificate_type}</span>
                      <span>{new Date(c.issued_at).toLocaleDateString('en-GB')}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <a
                        href={`/api/certificates/${c.certificate_code}/pdf`}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-lg border border-[#E2E8F0] px-2.5 py-1.5 text-[11px] font-medium text-[#64748B]"
                      >
                        PDF
                      </a>
                      <Link
                        href={`/portal/team-leader/certificates/${c.id}`}
                        className="rounded-lg bg-[#FF8A1F]/10 px-3 py-1.5 text-[12px] font-semibold text-[#FF8A1F]"
                      >
                        View →
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* ── Desktop table ── */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                    <th className="px-4 py-3 text-left text-xs font-medium text-[#64748B]">Code</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-[#64748B]">Title</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-[#64748B]">Recipient</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-[#64748B]">Type</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-[#64748B]">Issued</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-[#64748B]">Status</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {result.data.map(c => (
                    <tr key={c.id} className="border-b border-[#E2E8F0] last:border-0 hover:bg-[#F8FAFC]">
                      <td className="px-4 py-3 font-mono text-xs text-[#0B1F3A]">{c.certificate_code}</td>
                      <td className="px-4 py-3 font-medium text-[#0B1F3A] max-w-45 truncate">{c.title}</td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-[#0B1F3A]">{c.recipient_name}</p>
                        <p className="text-xs text-[#64748B]">{c.student_email}</p>
                      </td>
                      <td className="px-4 py-3 text-[#64748B]">{TYPE_LABELS[c.certificate_type] ?? c.certificate_type}</td>
                      <td className="px-4 py-3 text-[#64748B]">
                        {new Date(c.issued_at).toLocaleDateString('en-GB')}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={c.status === 'active' ? 'active' : 'inactive'} />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <a
                            href={`/api/certificates/${c.certificate_code}/pdf`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs text-[#64748B] hover:text-[#0B1F3A]"
                          >
                            PDF
                          </a>
                          <Link href={`/portal/team-leader/certificates/${c.id}`} className="text-xs font-medium text-[#FF8A1F] hover:underline">
                            View
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={result.page} totalPages={result.totalPages} total={result.total} perPage={result.perPage} />
          </>
        )}
      </div>
    </div>
  )
}
