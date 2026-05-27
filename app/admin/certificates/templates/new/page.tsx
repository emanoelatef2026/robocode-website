import { requirePermission } from '@/modules/rbac/guards'
import PageHeader from '@/components/admin/PageHeader'
import NewTemplateForm from './NewTemplateForm'

export default async function NewTemplatePage() {
  await requirePermission('manage_certificates')
  return (
    <div>
      <PageHeader title="New Certificate Template" />
      <NewTemplateForm />
    </div>
  )
}
