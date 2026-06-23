import { requirePermission } from '@/modules/rbac/guards'
import NewTemplateForm from './NewTemplateForm'

export default async function NewTemplatePage() {
  await requirePermission('manage_certificates')
  return (
    <div>
      <NewTemplateForm />
    </div>
  )
}
