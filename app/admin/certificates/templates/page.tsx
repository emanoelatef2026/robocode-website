import { listCertificateTemplates } from '@/modules/certificates/queries'
import { requirePermission } from '@/modules/rbac/guards'
import PageHeader from '@/components/admin/PageHeader'
import StatusBadge from '@/components/admin/StatusBadge'
import EmptyState from '@/components/admin/EmptyState'
import Pagination from '@/components/admin/Pagination'
import SearchInput from '@/components/admin/SearchInput'
import Link from 'next/link'

interface Props {
  searchParams: Promise<{ page?: string; q?: string }>
}

const TYPE_LABELS: Record<string, string> = {
  semester_completion: 'Semester Completion',
  course_completion:   'Course Completion',
  competition_award:   'Competition Award',
  achievement:         'Achievement',
  custom:              'Custom',
}

export default async function CertificateTemplatesPage({ searchParams }: Props) {
  await requirePermission('manage_certificates')
  const params = await searchParams
  const page   = Number(params.page ?? 1)
  const search = params.q ?? ''

  const result = await listCertificateTemplates({ page, perPage: 20, search })

  return (
    <div>
      <PageHeader
        title="Certificate Templates"
        description={`${result.total} template${result.total !== 1 ? 's' : ''}`}
        action={
          <div className="flex gap-2">
            <Link
              href="/admin/certificates"
              className="rounded-lg border border-[#E2E8F0] px-4 py-2 text-sm font-medium text-[#0B1F3A] hover:bg-[#F8FAFC]"
            >
              ← Certificates
            </Link>
            <Link
              href="/admin/certificates/templates/new"
              className="inline-flex items-center gap-2 rounded-lg bg-[#FF8A1F] px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-[#e87c18]"
            >
              <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" />
              </svg>
              New Template
            </Link>
          </div>
        }
      />

      <div className="rounded-xl border border-[#E2E8F0] bg-white">
        <div className="flex flex-wrap items-center gap-3 border-b border-[#E2E8F0] px-4 py-3">
          <SearchInput placeholder="Search templates…" />
        </div>

        {result.data.length === 0 ? (
          <EmptyState
            title="No templates yet"
            description={search ? 'Try a different search term.' : 'Create your first certificate template.'}
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                    <th className="px-4 py-3 text-left text-xs font-medium text-[#64748B]">Name</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-[#64748B]">Type</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-[#64748B]">Branch</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-[#64748B]">Status</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {result.data.map((t) => (
                    <tr key={t.id} className="border-b border-[#E2E8F0] last:border-0 hover:bg-[#F8FAFC]">
                      <td className="px-4 py-3 font-medium text-[#0B1F3A]">{t.name}</td>
                      <td className="px-4 py-3 text-[#64748B]">{TYPE_LABELS[t.certificate_type] ?? t.certificate_type}</td>
                      <td className="px-4 py-3 text-[#64748B]">{t.branch_name ?? 'Global'}</td>
                      <td className="px-4 py-3">
                        <StatusBadge status={t.is_active ? 'active' : 'inactive'} />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          href={`/admin/certificates/templates/${t.id}/edit`}
                          className="text-xs font-medium text-[#FF8A1F] hover:underline"
                        >
                          Edit
                        </Link>
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
