import { listStudents } from '@/modules/students/queries'
import { listBranches } from '@/modules/branches/queries'
import { listGroups } from '@/modules/groups/queries'
import { requirePermission } from '@/modules/rbac/guards'
import PageHeader from '@/components/admin/PageHeader'
import StatusBadge from '@/components/admin/StatusBadge'
import EmptyState from '@/components/admin/EmptyState'
import Pagination from '@/components/admin/Pagination'
import SearchInput from '@/components/admin/SearchInput'
import AdminFilterSelect from '@/components/admin/AdminFilterSelect'
import Link from 'next/link'

interface Props {
  searchParams: Promise<{
    page?: string; q?: string; branch?: string; status?: string; group?: string; grade?: string
  }>
}

const STATUSES = ['active', 'inactive', 'graduated', 'paused', 'banned']

export default async function StudentsPage({ searchParams }: Props) {
  const user     = await requirePermission('manage_students')
  const params   = await searchParams
  const page     = Number(params.page ?? 1)
  const search   = params.q ?? ''
  const branchId = params.branch
  const status   = params.status
  const groupId  = params.group
  const grade    = params.grade

  // Scope branch filter: super_admin can filter freely; TLs are restricted to their own branches.
  const isSuperAdmin = user.globalRole === 'super_admin'
  const effectiveBranchFilter: string | string[] | undefined = isSuperAdmin
    ? branchId
    : (branchId && user.branchIds.includes(branchId)) ? branchId : user.branchIds

  const [result, branchesResult, groupsResult] = await Promise.all([
    listStudents({ page, perPage: 20, search, branchId: effectiveBranchFilter, status, groupId, grade }),
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
          <AdminFilterSelect param="branch"  placeholder="All branches" options={branchesResult.data.map(b => ({ value: b.id,     label: b.name }))} />
          <AdminFilterSelect param="group"   placeholder="All groups"   options={groupsResult.data.map(g  => ({ value: g.id,     label: g.name }))} />
          <AdminFilterSelect param="status"  placeholder="All statuses" options={STATUSES.map(s            => ({ value: s,        label: s }))} />
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
            {/* Mobile cards */}
            <div className="md:hidden divide-y divide-[#E2E8F0]">
              {result.data.map((student) => {
                const name = student.first_name && student.last_name
                  ? `${student.first_name} ${student.last_name}`
                  : student.user_email
                return (
                  <div key={student.id} className="px-4 py-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <Link href={`/admin/students/${student.id}`} className="block text-[15px] font-semibold text-[#0B1F3A] leading-tight">
                          {name}
                        </Link>
                        {student.student_code && (
                          <p className="mt-0.5 font-mono text-[11px] text-[#94A3B8]">{student.student_code}</p>
                        )}
                      </div>
                      <StatusBadge status={student.status} />
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-[#64748B]">
                      {student.group_name && <span>{student.group_name}</span>}
                      {student.phone && <a href={`tel:${student.phone}`} className="font-medium text-[#0B1F3A]">{student.phone}</a>}
                      {student.parent_phone_1 && <span>P1: {student.parent_phone_1}</span>}
                      {student.school_grade && (
                        <Link href={buildUrl({ grade: student.school_grade })} className="text-[#FF8A1F]">
                          Grade {student.school_grade}
                        </Link>
                      )}
                    </div>
                    <div className="mt-2 flex items-center justify-end">
                      <Link href={`/admin/students/${student.id}`} className="rounded-lg bg-[#FF8A1F]/10 px-3 py-1.5 text-[12px] font-semibold text-[#FF8A1F] min-h-9 flex items-center">
                        Edit →
                      </Link>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                    <th className="px-4 py-3 text-left text-xs font-medium text-[#64748B]">Code</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-[#64748B]">Name</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-[#64748B]">Phone</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-[#64748B]">Parent 1</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-[#64748B]">Parent 2</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-[#64748B]">Group</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-[#64748B]">Grade</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-[#64748B]">Status</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {result.data.map((student) => (
                    <tr key={student.id} className="border-b border-[#E2E8F0] last:border-0 hover:bg-[#F8FAFC]">
                      <td className="px-4 py-3">
                        {student.student_code
                          ? <Link href={`/admin/students/${student.id}`} className="font-mono text-xs font-semibold text-[#0B1F3A] hover:text-[#FF8A1F]">{student.student_code}</Link>
                          : <span className="text-xs text-[#94A3B8]">—</span>}
                      </td>
                      <td className="px-4 py-3 font-medium text-[#0B1F3A]">
                        {student.first_name && student.last_name
                          ? `${student.first_name} ${student.last_name}`
                          : student.user_email}
                      </td>
                      <td className="px-4 py-3 text-[#64748B]">{student.phone ?? '—'}</td>
                      <td className="px-4 py-3 text-[#64748B]">{student.parent_phone_1 ?? '—'}</td>
                      <td className="px-4 py-3 text-[#64748B]">{student.parent_phone_2 ?? '—'}</td>
                      <td className="px-4 py-3 text-[#64748B]">{student.group_name ?? '—'}</td>
                      <td className="px-4 py-3 text-[#64748B]">
                        {student.school_grade
                          ? <Link href={buildUrl({ grade: student.school_grade })} className="text-xs text-[#FF8A1F] hover:underline">{student.school_grade}</Link>
                          : '—'}
                      </td>
                      <td className="px-4 py-3"><StatusBadge status={student.status} /></td>
                      <td className="px-4 py-3 text-right">
                        <Link href={`/admin/students/${student.id}`} className="text-xs font-medium text-[#FF8A1F] hover:underline">Edit</Link>
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
