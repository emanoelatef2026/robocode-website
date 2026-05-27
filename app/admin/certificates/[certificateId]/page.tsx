import { notFound } from 'next/navigation'
import { requirePermission } from '@/modules/rbac/guards'
import { getCertificateDetail } from '@/modules/certificates/queries'
import PageHeader from '@/components/admin/PageHeader'
import CertificateDetailView from './CertificateDetailView'
import Link from 'next/link'

interface Props {
  params: Promise<{ certificateId: string }>
}

export default async function CertificateDetailPage({ params }: Props) {
  await requirePermission('manage_certificates')
  const { certificateId } = await params

  const certificate = await getCertificateDetail(certificateId)
  if (!certificate) notFound()

  return (
    <div>
      <PageHeader
        title={certificate.title}
        description={`Issued to ${certificate.recipient_name}`}
        action={
          <Link href="/admin/certificates" className="text-sm text-[#64748B] hover:text-[#0B1F3A]">
            ← Back to Certificates
          </Link>
        }
      />
      <CertificateDetailView certificate={certificate} />
    </div>
  )
}
