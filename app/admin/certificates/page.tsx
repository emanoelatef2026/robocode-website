import { listCertificates } from '@/modules/certificates/queries'
import { requirePermission } from '@/modules/rbac/guards'
import PageHeader from '@/components/admin/PageHeader'
import StatusBadge from '@/components/admin/StatusBadge'
import EmptyState from '@/components/admin/EmptyState'
import Pagination from '@/components/admin/Pagination'
import SearchInput from '@/components/admin/SearchInput'
import FilterSelect from '@/components/admin/FilterSelect'
import Link from 'next/link'

interface Props {
  searchParams: Promise<{ page?: string; q?: string; type?: string; status?: string }>
}

const TYPE_LABELS: Record<string, string> = {
  semester_completion: 'Semester',
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
  const result = await listCertificates({ page, perPage: 20, search, type, status, branchIds })

  return (
    <div>
      <PageHeader
        title="Certificates"
        description={`${result.total} certificate${result.total !== 1 ? 's' : ''}`}
        action={
          <div className="flex gap-2">
            <Link
              href="/admin/certificates/templates"
              className="inline-flex items-center gap-2 rounded-lg border border-[#E2E8F0] bg-white px-4 py-2 text-sm font-medium text-[#0B1F3A] shadow-sm transition hover:bg-[#F8FAFC]"
            >
              Templates
            </Link>
            <Link
              href="/admin/certificates/new"
              className="inline-flex items-center gap-2 rounded-lg bg-[#FF8A1F] px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-[#e87c18]"
            >
              <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" />
              </svg>
              Issue Certificate
            </Link>
          </div>
        }
      />

      <div className="rounded-xl border border-[#E2E8F0] bg-white">
        <div className="flex flex-wrap items-center gap-3 border-b border-[#E2E8F0] px-4 py-3">
          <SearchInput placeholder="Search by title, name, or code…" />
          <FilterSelect
            name="type"
            value={type ?? ''}
            placeholder="All Types"
            options={[
              { value: 'semester_completion', label: 'Semester' },
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
