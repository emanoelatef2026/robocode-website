import { notFound } from 'next/navigation'
import { requirePermission } from '@/modules/rbac/guards'
import { getCertificateTemplate } from '@/modules/certificates/queries'
import EditTemplateForm from './EditTemplateForm'

interface Props {
  params: Promise<{ templateId: string }>
}

export default async function EditTemplatePage({ params }: Props) {
  await requirePermission('manage_certificates')
  const { templateId } = await params

  const template = await getCertificateTemplate(templateId)
  if (!template) notFound()

  return (
    <div>
      <EditTemplateForm template={template} />
    </div>
  )
}
