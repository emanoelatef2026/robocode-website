import { listCertificates, listActiveTemplates, listCertificateTemplates } from '@/modules/certificates/queries'
import { requirePermission }                      from '@/modules/rbac/guards'
import { listCourses }                            from '@/modules/courses/queries'
import { listSemesters }                          from '@/modules/semesters/queries'
import { createServiceClient }                    from '@/lib/supabase/service'
import StatusBadge                                from '@/components/admin/StatusBadge'
import EmptyState                                 from '@/components/admin/EmptyState'
import Pagination                                 from '@/components/admin/Pagination'
import SearchInput                                from '@/components/admin/SearchInput'
import FilterSelect                               from '@/components/admin/FilterSelect'
import IssueCertificateModal                      from './IssueCertificateModal'
import TemplatesModal                             from './TemplatesModal'
import Link                                       from 'next/link'

interface Props {
  searchParams: Promise<{ page?: string; q?: string; type?: string; status?: string }>
}

const TYPE_LABELS: Record<string, string> = {
  semester_completion: 'Course',
  course_completion:   'Course',
  competition_award:   'Competition',
  achievement:         'Achievement',
  custom:              'Custom',
}

export default async function CertificatesPage({ searchParams }: Props) {
  const user   = await requirePermission('manage_certificates')
  const params = await searchParams
  const page   = Number(params.page ?? 1)
  const search = params.q ?? ''
  const type   = params.type
  const status = params.status

  const branchIds = user.globalRole === 'super_admin' ? undefined : user.branchIds

  const db = createServiceClient()

  // Load list + modal data in parallel
  const [result, templates, allTemplates, coursesResult, semestersResult, studentsResult] = await Promise.all([
    listCertificates({ page, perPage: 20, search, type, status, branchIds }),
    listActiveTemplates(),
    listCertificateTemplates({ perPage: 200 }),
    listCourses({ perPage: 200 }),
    listSemesters({ perPage: 100 }),
    db
      .from('students')
      .select('id, users!students_user_id_fkey(email, profiles!profiles_user_id_fkey(first_name, last_name))')
      .is('deleted_at', null)
      .eq('status', 'active')
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
        <div className="flex gap-2">
          <TemplatesModal templates={allTemplates.data} />
          <IssueCertificateModal
            templates={templates}
            students={students}
            semesters={semestersResult.data.map(s => ({ id: s.id, name: s.name }))}
            courses={coursesResult.data.map(c => ({ id: c.id, title: c.title }))}
            successRedirect="/admin/certificates"
          />
        </div>
      </div>

      <div className="rounded-xl border border-[#E2E8F0] bg-white">
        <div className="flex flex-wrap items-center gap-3 border-b border-[#E2E8F0] px-4 py-3">
          <SearchInput placeholder="Search by title, name, or code…" />
          <FilterSelect
            name="type"
            value={type ?? ''}
            placeholder="All Types"
            options={[
              { value: 'semester_completion', label: 'Course Completion' },
              { value: 'course_completion',   label: 'Course' },
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
              { value: 'active',  label: 'Active' },
              { value: 'revoked', label: 'Revoked' },
            ]}
          />
        </div>

        {result.data.length === 0 ? (
          <EmptyState
            title="No certificates found"
            description={search ? 'Try a different search term.' : 'Issue the first certificate to get started.'}
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                    <th className="px-4 py-3 text-left text-xs font-medium text-[#64748B]">Code</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-[#64748B]">Title</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-[#64748B]">Recipient</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-[#64748B]">Type</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-[#64748B]">Context</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-[#64748B]">Issued</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-[#64748B]">Status</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {result.data.map((c) => (
                    <tr key={c.id} className="border-b border-[#E2E8F0] last:border-0 hover:bg-[#F8FAFC]">
                      <td className="px-4 py-3 font-mono text-xs text-[#0B1F3A]">{c.certificate_code}</td>
                      <td className="px-4 py-3 font-medium text-[#0B1F3A] max-w-[200px] truncate">{c.title}</td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-[#0B1F3A]">{c.recipient_name}</div>
                        <div className="text-xs text-[#64748B]">{c.student_email}</div>
                      </td>
                      <td className="px-4 py-3 text-[#64748B]">{TYPE_LABELS[c.certificate_type] ?? c.certificate_type}</td>
                      <td className="px-4 py-3 text-[#64748B]">
                        {c.course_title ?? c.semester_name ?? '—'}
                      </td>
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
                            className="text-xs font-medium text-[#64748B] hover:text-[#0B1F3A]"
                          >
                            PDF
                          </a>
                          <Link
                            href={`/admin/certificates/${c.id}`}
                            className="text-xs font-medium text-[#FF8A1F] hover:underline"
                          >
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
