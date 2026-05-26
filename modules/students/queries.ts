import 'server-only'
import { createServiceClient } from '@/lib/supabase/service'
import type { StudentListItem, Student } from './types'
import type { PaginatedResult } from '@/types/app'

export async function listStudents({
  page = 1,
  perPage = 20,
  search = '',
  branchId,
  status,
}: {
  page?: number
  perPage?: number
  search?: string
  branchId?: string
  status?: string
} = {}): Promise<PaginatedResult<StudentListItem>> {
  const db   = createServiceClient()
  const from = (page - 1) * perPage
  const to   = from + perPage - 1

  let query = db
    .from('students')
    .select(
      `id, user_id, branch_id, student_code, enrollment_date, status,
       users!students_user_id_fkey(email, profiles!profiles_user_id_fkey(first_name, last_name)),
       branches!students_branch_id_fkey(name)`,
      { count: 'exact' }
    )
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .range(from, to)

  if (branchId) query = query.eq('branch_id', branchId)
  if (status)   query = query.eq('status', status)

  const { data, count, error } = await query
  if (error) throw new Error(error.message)

  const items: StudentListItem[] = (data ?? []).map((row: any) => ({
    id:              row.id,
    user_id:         row.user_id,
    branch_id:       row.branch_id,
    student_code:    row.student_code,
    enrollment_date: row.enrollment_date,
    status:          row.status,
    user_email:      row.users?.email ?? '',
    first_name:      row.users?.profiles?.first_name ?? null,
    last_name:       row.users?.profiles?.last_name ?? null,
    branch_name:     row.branches?.name ?? '',
  }))

  const filtered = search
    ? items.filter((s) => {
        const q = search.toLowerCase()
        const full = `${s.first_name ?? ''} ${s.last_name ?? ''} ${s.user_email}`.toLowerCase()
        return full.includes(q)
      })
    : items

  return {
    data:       filtered,
    total:      count ?? 0,
    page,
    perPage,
    totalPages: Math.ceil((count ?? 0) / perPage),
  }
}

export async function getStudent(id: string): Promise<Student | null> {
  const db = createServiceClient()
  const { data, error } = await db
    .from('students')
    .select(
      `*, users!students_user_id_fkey(email, profiles!profiles_user_id_fkey(first_name, last_name)),
       branches!students_branch_id_fkey(name)`
    )
    .eq('id', id)
    .single()

  if (error || !data) return null

  return {
    ...(data as any),
    user_email:  (data as any).users?.email ?? '',
    first_name:  (data as any).users?.profiles?.first_name ?? null,
    last_name:   (data as any).users?.profiles?.last_name ?? null,
    branch_name: (data as any).branches?.name ?? '',
  } as Student
}
