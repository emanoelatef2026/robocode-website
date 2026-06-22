import { listCertificateTemplates } from '@/modules/certificates/queries'
import { requirePermission }        from '@/modules/rbac/guards'
import PageHeader                   from '@/components/admin/PageHeader'
import SearchInput                  from '@/components/admin/SearchInput'
import Pagination                   from '@/components/admin/Pagination'
import TemplatesClient              from './TemplatesClient'
import Link                         from 'next/link'

interface Props {
  searchParams: Promise<{ page?: string; q?: string }>
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
          <Link
            href="/admin/certificates"
            className="rounded-lg border border-[#E2E8F0] px-4 py-2 text-sm font-medium text-[#0B1F3A] hover:bg-[#F8FAFC]"
          >
            ← Certificates
          </Link>
        }
      />

      <div className="rounded-xl border border-[#E2E8F0] bg-white mb-0">
        <div className="flex flex-wrap items-center gap-3 border-b border-[#E2E8F0] px-4 py-3">
          <SearchInput placeholder="Search templates…" />
        </div>
      </div>

      {/* Client component handles table + modals */}
      <TemplatesClient templates={result.data} />

      {result.totalPages > 1 && (
        <div className="rounded-xl border border-[#E2E8F0] bg-white mt-0 border-t-0">
          <Pagination
            page={result.page}
            totalPages={result.totalPages}
            total={result.total}
            perPage={result.perPage}
          />
        </div>
      )}
    </div>
  )
}
