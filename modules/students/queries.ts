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
  branchId?: string | string[]
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

  if (branchId) {
    if (Array.isArray(branchId)) {
      query = query.in('branch_id', branchId)
    } else {
      query = query.eq('branch_id', branchId)
    }
  }
  if (status)   query = query.eq('status', status)

  // Resolve search at DB level: find user_ids matching name/email, then filter students
  if (search) {
    const q = `%${search}%`
    const [{ data: profileHits }, { data: userHits }] = await Promise.all([
      db.from('profiles').select('user_id').or(`first_name.ilike.${q},last_name.ilike.${q}`),
      db.from('users').select('id').ilike('email', q),
    ])
    const matchingIds = [
      ...(profileHits?.map((p: any) => p.user_id) ?? []),
      ...(userHits?.map((u: any) => u.id) ?? []),
    ]
    const uniqueIds = [...new Set(matchingIds)]
    if (uniqueIds.length === 0) return { data: [], total: 0, page, perPage, totalPages: 0 }
    query = query.in('user_id', uniqueIds)
  }

  const { data, count, error } = await query.range(from, to)
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

  return {
    data:       items,
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
