import { getStudent } from '@/modules/students/queries'
import { requirePermission } from '@/modules/rbac/guards'
import { createServiceClient } from '@/lib/supabase/service'
import { listBranches } from '@/modules/branches/queries'
import { listGroups } from '@/modules/groups/queries'
import { notFound } from 'next/navigation'
import StudentEditForm from './StudentEditForm'
import StatusBadge from '@/components/admin/StatusBadge'
import Link from 'next/link'

interface Props {
  params: Promise<{ id: string }>
}

async function getStudentFullHistory(studentId: string) {
  const db = createServiceClient()
  const [{ data: groups }, { data: semesters }] = await Promise.all([
    db
      .from('group_students')
      .select(`
        id, status, enrollment_type, joined_at, left_at,
        groups!group_students_group_id_fkey(
          id, name, type, code, status,
          branches!groups_branch_id_fkey(name)
        )
      `)
      .eq('student_id', studentId)
      .order('joined_at', { ascending: false }),
    db
      .from('semester_enrollments')
      .select(`
        id, status, enrolled_at, dropped_at, completed_at, notes,
        semesters!semester_enrollments_semester_id_fkey(id, name, status, start_date, end_date)
      `)
      .eq('student_id', studentId)
      .order('enrolled_at', { ascending: false }),
  ])
  return {
    groups:    (groups    ?? []) as any[],
    semesters: (semesters ?? []) as any[],
  }
}

export default async function StudentDetailPage({ params }: Props) {
  const user    = await requirePermission('manage_students')
  const { id }  = await params

  const student = await getStudent(id)
  if (!student) notFound()

  // Branches accessible to this user (for branch transfer)
  const branchFilter = user.globalRole === 'super_admin' ? undefined : user.branchIds
  const [history, branchesResult, groupsResult] = await Promise.all([
    getStudentFullHistory(id),
    listBranches({ perPage: 100, ...(branchFilter ? {} : {}) }),
    listGroups({ branchId: student.branch_id, perPage: 300, status: 'active' }),
  ])

  const currentGroups  = history.groups.filter((h: any) => h.status === 'active')
  const previousGroups = history.groups.filter((h: any) => h.status !== 'active')
  const activeGroupIds = new Set(currentGroups.map((h: any) => h.groups?.id).filter(Boolean))
  const availableGroups = groupsResult.data.filter((g) => !activeGroupIds.has(g.id))

  const displayName = student.first_name && student.last_name
    ? `${student.first_name} ${student.last_name}`
    : student.user_email

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6">
        <Link href="/admin/students" className="text-sm text-[#64748B] hover:text-[#0B1F3A]">
          ← Students
        </Link>
        <h1 className="mt-2 text-xl font-semibold text-[#0B1F3A]">{displayName}</h1>
        <p className="text-sm text-[#64748B]">{student.user_email} · {student.branch_name}</p>
      </div>

      <StudentEditForm
        student={student}
        branches={branchesResult.data}
        availableGroups={availableGroups}
        currentGroups={currentGroups}
      />

      {/* ── Current Group Assignments ─────────────────────────────────────── */}
      <div className="mt-6 rounded-xl border border-[#E2E8F0] bg-white">
        <div className="flex items-center justify-between border-b border-[#E2E8F0] px-5 py-3">
          <p className="text-sm font-semibold text-[#0B1F3A]">
            Current Groups
            <span className="ml-2 rounded-full bg-[#F1F5F9] px-2 py-0.5 text-xs font-normal text-[#64748B]">
              {currentGroups.length}
            </span>
          </p>
        </div>
        {currentGroups.length === 0 ? (
          <p className="px-5 py-4 text-sm text-[#94A3B8]">Not enrolled in any group.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                <th className="px-4 py-2.5 text-left text-xs font-medium text-[#64748B]">Group</th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-[#64748B]">Branch</th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-[#64748B]">Type</th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-[#64748B]">Enrollment</th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-[#64748B]">Joined</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {currentGroups.map((h: any) => (
                <tr key={h.id} className="border-b border-[#E2E8F0] last:border-0">
                  <td className="px-4 py-2.5 font-medium text-[#0B1F3A]">
                    {h.groups?.name ?? '—'}
                    {h.groups?.code && <span className="ml-1.5 font-mono text-xs text-[#94A3B8]">{h.groups.code}</span>}
                  </td>
                  <td className="px-4 py-2.5 text-[#64748B]">{h.groups?.branches?.name ?? '—'}</td>
                  <td className="px-4 py-2.5 capitalize text-[#64748B]">{h.groups?.type ?? '—'}</td>
                  <td className="px-4 py-2.5">
                    <span className={[
                      'inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium capitalize',
                      h.enrollment_type === 'primary' ? 'bg-blue-50 text-blue-700' : 'bg-purple-50 text-purple-700',
                    ].join(' ')}>
                      {h.enrollment_type}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-[#64748B]">
                    {new Date(h.joined_at).toLocaleDateString('en-GB')}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    {h.groups?.id && (
                      <Link href={`/admin/groups/${h.groups.id}`} className="text-xs font-medium text-[#FF8A1F] hover:underline">
                        Open group
                      </Link>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Previous Groups ───────────────────────────────────────────────── */}
      {previousGroups.length > 0 && (
        <div className="mt-5 rounded-xl border border-[#E2E8F0] bg-white">
          <div className="border-b border-[#E2E8F0] px-5 py-3">
            <p className="text-sm font-semibold text-[#0B1F3A]">
              Group History
              <span className="ml-2 rounded-full bg-[#F1F5F9] px-2 py-0.5 text-xs font-normal text-[#64748B]">{previousGroups.length}</span>
            </p>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                <th className="px-4 py-2.5 text-left text-xs font-medium text-[#64748B]">Group</th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-[#64748B]">Type</th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-[#64748B]">Enrollment</th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-[#64748B]">Status</th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-[#64748B]">Joined</th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-[#64748B]">Left</th>
              </tr>
            </thead>
            <tbody>
              {previousGroups.map((h: any) => (
                <tr key={h.id} className="border-b border-[#E2E8F0] last:border-0">
                  <td className="px-4 py-2.5 font-medium text-[#0B1F3A]">
                    {h.groups?.name ?? '—'}
                    {h.groups?.code && <span className="ml-1.5 font-mono text-xs text-[#94A3B8]">{h.groups.code}</span>}
                  </td>
                  <td className="px-4 py-2.5 capitalize text-[#64748B]">{h.groups?.type ?? '—'}</td>
                  <td className="px-4 py-2.5">
                    <span className={['inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium capitalize', h.enrollment_type === 'primary' ? 'bg-blue-50 text-blue-700' : 'bg-purple-50 text-purple-700'].join(' ')}>
                      {h.enrollment_type}
                    </span>
                  </td>
                  <td className="px-4 py-2.5"><StatusBadge status={h.status} /></td>
                  <td className="px-4 py-2.5 text-[#64748B]">{new Date(h.joined_at).toLocaleDateString('en-GB')}</td>
                  <td className="px-4 py-2.5 text-[#64748B]">{h.left_at ? new Date(h.left_at).toLocaleDateString('en-GB') : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Semester History ──────────────────────────────────────────────── */}
      {history.semesters.length > 0 && (
        <div className="mt-5 rounded-xl border border-[#E2E8F0] bg-white">
          <div className="border-b border-[#E2E8F0] px-5 py-3">
            <p className="text-sm font-semibold text-[#0B1F3A]">
              Semester History
              <span className="ml-2 rounded-full bg-[#F1F5F9] px-2 py-0.5 text-xs font-normal text-[#64748B]">{history.semesters.length}</span>
            </p>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                <th className="px-4 py-2.5 text-left text-xs font-medium text-[#64748B]">Semester</th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-[#64748B]">Dates</th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-[#64748B]">Enrolled</th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-[#64748B]">Status</th>
              </tr>
            </thead>
            <tbody>
              {history.semesters.map((se: any) => (
                <tr key={se.id} className="border-b border-[#E2E8F0] last:border-0">
                  <td className="px-4 py-2.5 font-medium text-[#0B1F3A]">{se.semesters?.name ?? '—'}</td>
                  <td className="px-4 py-2.5 text-[#64748B]">
                    {se.semesters?.start_date
                      ? `${new Date(se.semesters.start_date).toLocaleDateString('en-GB')} – ${new Date(se.semesters.end_date).toLocaleDateString('en-GB')}`
                      : '—'}
                  </td>
                  <td className="px-4 py-2.5 text-[#64748B]">
                    {se.enrolled_at ? new Date(se.enrolled_at).toLocaleDateString('en-GB') : '—'}
                  </td>
                  <td className="px-4 py-2.5"><StatusBadge status={se.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
