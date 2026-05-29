import { listStudents } from '@/modules/students/queries'
import { listBranches } from '@/modules/branches/queries'
import { listGroups } from '@/modules/groups/queries'
import { requirePermission } from '@/modules/rbac/guards'
import PageHeader from '@/components/admin/PageHeader'
import StatusBadge from '@/components/admin/StatusBadge'
import EmptyState from '@/components/admin/EmptyState'
import Pagination from '@/components/admin/Pagination'
import SearchInput from '@/components/admin/SearchInput'
import Link from 'next/link'

interface Props {
  searchParams: Promise<{
    page?: string; q?: string; branch?: string; status?: string; group?: string; grade?: string
  }>
}

const STATUSES = ['active', 'inactive', 'graduated', 'paused', 'banned']

export default async function StudentsPage({ searchParams }: Props) {
  await requirePermission('manage_students')
  const params   = await searchParams
  const page     = Number(params.page ?? 1)
  const search   = params.q ?? ''
  const branchId = params.branch
  const status   = params.status
  const groupId  = params.group
  const grade    = params.grade

  const [result, branchesResult, groupsResult] = await Promise.all([
    listStudents({ page, perPage: 20, search, branchId, status, groupId, grade }),
    listBranches({ perPage: 100 }),
    listGroups({ perPage: 200 }),
  ])

  const buildUrl = (overrides: Record<string, string | undefined>) => {
    const p: Record<string, string> = { page: '1' }
    if (search)   p.q      = search
    if (branchId) p.branch = branchId
    if (status)   p.status = status
    if (groupId)  p.group  = groupId
    if (grade)    p.grade  = grade
    Object.assign(p, overrides)
    Object.keys(p).forEach(k => (p as any)[k] === undefined && delete (p as any)[k])
    return '/admin/students?' + new URLSearchParams(p).toString()
  }

  return (
    <div>
      <PageHeader
        title="Students"
        description={`${result.total} student${result.total !== 1 ? 's' : ''}`}
        action={
          <Link
            href="/admin/students/new"
            className="inline-flex items-center gap-2 rounded-lg bg-[#FF8A1F] px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-[#e87c18]"
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
              <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" />
            </svg>
            Add Student
          </Link>
        }
      />

      <div className="rounded-xl border border-[#E2E8F0] bg-white">
        <div className="flex flex-wrap items-center gap-2 border-b border-[#E2E8F0] px-4 py-3">
          <SearchInput placeholder="Search students…" />

          <select
            value={branchId ?? ''}
            onChange={e => { window.location.href = buildUrl({ branch: e.target.value || undefined }) }}
            className="rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm text-[#0B1F3A] outline-none focus:border-[#FF8A1F]"
          >
            <option value="">All branches</option>
            {branchesResult.data.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>

          <select
            value={groupId ?? ''}
            onChange={e => { window.location.href = buildUrl({ group: e.target.value || undefined }) }}
            className="rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm text-[#0B1F3A] outline-none focus:border-[#FF8A1F]"
          >
            <option value="">All groups</option>
            {groupsResult.data.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>

          <select
            value={status ?? ''}
            onChange={e => { window.location.href = buildUrl({ status: e.target.value || undefined }) }}
            className="rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm text-[#0B1F3A] outline-none focus:border-[#FF8A1F]"
          >
            <option value="">All statuses</option>
            {STATUSES.map(s => <option key={s} value={s} className="capitalize">{s}</option>)}
          </select>

          {grade && (
            <Link href={buildUrl({ grade: undefined })} className="text-xs text-[#FF8A1F] hover:underline">
              Grade: {grade} ×
            </Link>
          )}
        </div>

        {result.data.length === 0 ? (
          <EmptyState
            title="No students found"
            description={search ? 'Try a different search term.' : 'Enroll the first student to get started.'}
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                    <th className="px-4 py-3 text-left text-xs font-medium text-[#64748B]">Name</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-[#64748B]">Email</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-[#64748B]">Branch</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-[#64748B]">Code</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-[#64748B]">Group</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-[#64748B]">Grade</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-[#64748B]">Enrolled</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-[#64748B]">Status</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {result.data.map((student) => (
                    <tr key={student.id} className="border-b border-[#E2E8F0] last:border-0 hover:bg-[#F8FAFC]">
                      <td className="px-4 py-3 font-medium text-[#0B1F3A]">
                        {student.first_name && student.last_name
                          ? `${student.first_name} ${student.last_name}`
                          : '—'}
                      </td>
                      <td className="px-4 py-3 text-[#64748B]">{student.user_email}</td>
                      <td className="px-4 py-3 text-[#64748B]">{student.branch_name}</td>
                      <td className="px-4 py-3 text-[#64748B] font-mono text-xs">{student.student_code ?? '—'}</td>
                      <td className="px-4 py-3 text-[#64748B]">{student.group_name ?? '—'}</td>
                      <td className="px-4 py-3 text-[#64748B]">
                        {student.school_grade ? (
                          <button
                            onClick={() => { window.location.href = buildUrl({ grade: student.school_grade! }) }}
                            className="text-xs text-[#FF8A1F] hover:underline"
                          >
                            {student.school_grade}
                          </button>
                        ) : '—'}
                      </td>
                      <td className="px-4 py-3 text-[#64748B]">
                        {new Date(student.enrollment_date).toLocaleDateString('en-GB')}
                      </td>
                      <td className="px-4 py-3"><StatusBadge status={student.status} /></td>
                      <td className="px-4 py-3 text-right">
                        <Link href={`/admin/students/${student.id}`} className="text-xs font-medium text-[#FF8A1F] hover:underline">
                          Edit
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={result.page} totalPages={result.totalPages} total={result.total} perPage={result.perPage} />
          </>
        )}
      </div>
    </div>
  )
}
