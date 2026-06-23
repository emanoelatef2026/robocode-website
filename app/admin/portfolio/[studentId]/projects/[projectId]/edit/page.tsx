import { notFound } from 'next/navigation'
import { requirePermission } from '@/modules/rbac/guards'
import { getPortfolioProject } from '@/modules/portfolio/queries'
import { listCourses } from '@/modules/courses/queries'
import { listSemesters } from '@/modules/semesters/queries'
import EditProjectForm from './EditProjectForm'

interface Props {
  params: Promise<{ studentId: string; projectId: string }>
}

export default async function EditProjectPage({ params }: Props) {
  await requirePermission('manage_portfolio')
  const { studentId, projectId } = await params

  const [project, coursesResult, semestersResult] = await Promise.all([
    getPortfolioProject(projectId),
    listCourses({ perPage: 200 }),
    listSemesters({ perPage: 100 }),
  ])

  if (!project || project.student_id !== studentId) notFound()

  return (
    <div>
      <EditProjectForm
        project={project}
        studentId={studentId}
        courses={coursesResult.data.map((c) => ({ id: c.id, title: c.title }))}
        semesters={semestersResult.data.map((s) => ({ id: s.id, name: s.name }))}
      />
    </div>
  )
}
