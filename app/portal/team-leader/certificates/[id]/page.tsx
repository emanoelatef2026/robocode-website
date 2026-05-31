import { notFound }                             from 'next/navigation'
import { requirePortalRole, requirePermission }  from '@/modules/rbac/guards'
import { getCertificateDetail }                  from '@/modules/certificates/queries'
import PageHeader                                from '@/components/admin/PageHeader'
import CertificateDetailView                     from '@/app/admin/certificates/[certificateId]/CertificateDetailView'
import Link                                      from 'next/link'

interface Props {
  params: Promise<{ id: string }>
}

export default async function TLCertificateDetailPage({ params }: Props) {
  await requirePortalRole('team_leader')
  await requirePermission('manage_certificates')

  const { id } = await params
  const certificate = await getCertificateDetail(id)
  if (!certificate) notFound()

  return (
    <div>
      <PageHeader
        title={certificate.title}
        description={`Issued to ${certificate.recipient_name}`}
        action={
          <Link
            href="/portal/team-leader/certificates"
            className="rounded-lg border border-[#E2E8F0] px-4 py-2 text-sm font-medium text-[#64748B] transition hover:border-[#CBD5E1]"
          >
            ← Certificates
          </Link>
        }
      />
      <CertificateDetailView certificate={certificate} />
    </div>
  )
}
