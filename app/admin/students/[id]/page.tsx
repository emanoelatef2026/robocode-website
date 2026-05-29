import { getStudent } from '@/modules/students/queries'
import { requirePermission } from '@/modules/rbac/guards'
import { createServiceClient } from '@/lib/supabase/service'
import { notFound } from 'next/navigation'
import StudentEditForm from './StudentEditForm'
import StatusBadge from '@/components/admin/StatusBadge'
import Link from 'next/link'

interface Props {
  params: Promise<{ id: string }>
}

async function getStudentGroupHistory(studentId: string) {
  const db = createServiceClient()
  const { data } = await db
    .from('group_students')
    .select(`
      id, status, enrollment_type, joined_at, left_at,
      groups!group_students_group_id_fkey(name, type, code)
    `)
    .eq('student_id', studentId)
    .order('joined_at', { ascending: false })
  return (data ?? []) as any[]
}

export default async function StudentEditPage({ params }: Props) {
  await requirePermission('manage_students')
  const { id } = await params
  const [student, history] = await Promise.all([
    getStudent(id),
    getStudentGroupHistory(id),
  ])
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

      {/* Group history */}
      {history.length > 0 && (
        <div className="mt-6 rounded-xl border border-[#E2E8F0] bg-white">
          <div className="border-b border-[#E2E8F0] px-5 py-3">
            <p className="text-sm font-semibold text-[#0B1F3A]">Group History</p>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                <th className="px-4 py-2.5 text-left text-xs font-medium text-[#64748B]">Group</th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-[#64748B]">Type</th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-[#64748B]">Status</th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-[#64748B]">Joined</th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-[#64748B]">Left</th>
              </tr>
            </thead>
            <tbody>
              {history.map((h: any) => (
                <tr key={h.id} className="border-b border-[#E2E8F0] last:border-0">
                  <td className="px-4 py-2.5 font-medium text-[#0B1F3A]">
                    {h.groups?.name ?? '—'}
                    {h.groups?.code && <span className="ml-1.5 font-mono text-xs text-[#94A3B8]">{h.groups.code}</span>}
                  </td>
                  <td className="px-4 py-2.5 capitalize text-[#64748B]">{h.groups?.type ?? '—'}</td>
                  <td className="px-4 py-2.5"><StatusBadge status={h.status} /></td>
                  <td className="px-4 py-2.5 text-[#64748B]">
                    {new Date(h.joined_at).toLocaleDateString('en-GB')}
                  </td>
                  <td className="px-4 py-2.5 text-[#64748B]">
                    {h.left_at ? new Date(h.left_at).toLocaleDateString('en-GB') : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
