import { getStudent } from '@/modules/students/queries'
import { requirePermission } from '@/modules/rbac/guards'
import { notFound } from 'next/navigation'
import StudentEditForm from './StudentEditForm'
import Link from 'next/link'

interface Props {
  params: Promise<{ id: string }>
}

export default async function StudentEditPage({ params }: Props) {
  await requirePermission('manage_students')
  const { id } = await params
  const student = await getStudent(id)
  if (!student) notFound()

  return (
    <div className="mx-auto max-w-xl">
      <div className="mb-6">
        <Link href="/admin/students" className="text-sm text-[#64748B] hover:text-[#0B1F3A]">
          ← Students
        </Link>
        <h1 className="mt-2 text-xl font-semibold text-[#0B1F3A]">
          {student.first_name && student.last_name
            ? `${student.first_name} ${student.last_name}`
            : student.user_email}
        </h1>
        <p className="text-sm text-[#64748B]">{student.user_email} · {student.branch_name}</p>
      </div>
      <StudentEditForm student={student} />
    </div>
  )
}
