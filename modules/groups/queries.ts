import 'server-only'
import { createServiceClient } from '@/lib/supabase/service'
import type { Group, GroupListItem, GroupEnrollment } from './types'
import type { PaginatedResult } from '@/types/app'

export async function listGroups({
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
} = {}): Promise<PaginatedResult<GroupListItem>> {
  const db   = createServiceClient()
  const from = (page - 1) * perPage
  const to   = from + perPage - 1

  let query = db
    .from('groups')
    .select(
      `id, branch_id, name, code, type, capacity, status,
       branches!groups_branch_id_fkey(name)`,
      { count: 'exact' }
    )
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .range(from, to)

  if (branchId) {
    if (Array.isArray(branchId)) {
      query = query.in('branch_id', branchId)
    } else {
      query = query.eq('branch_id', branchId)
    }
  }
  if (status)   query = query.eq('status', status)
  if (search)   query = query.ilike('name', `%${search}%`)

  const { data, count, error } = await query
  if (error) throw new Error(error.message)

  const items: GroupListItem[] = (data ?? []).map((row: any) => ({
    id:            row.id,
    branch_id:     row.branch_id,
    name:          row.name,
    code:          row.code,
    type:          row.type,
    capacity:      row.capacity,
    status:        row.status,
    branch_name:   row.branches?.name ?? '',
    student_count: 0,
  }))

  return {
    data:       items,
    total:      count ?? 0,
    page,
    perPage,
    totalPages: Math.ceil((count ?? 0) / perPage),
  }
}

export async function getGroup(id: string): Promise<Group | null> {
  const db = createServiceClient()
  const { data, error } = await db
    .from('groups')
    .select(`*, branches!groups_branch_id_fkey(name)`)
    .eq('id', id)
    .single()

  if (error || !data) return null

  return {
    ...(data as any),
    branch_name: (data as any).branches?.name ?? '',
  } as Group
}

export async function listGroupEnrollments(groupId: string): Promise<GroupEnrollment[]> {
  const db = createServiceClient()
  const { data, error } = await db
    .from('group_students')
    .select(
      `id, group_id, student_id, enrollment_type, status, joined_at, left_at, notes,
       students!group_students_student_id_fkey(
         user_id,
         users!students_user_id_fkey(email, profiles!profiles_user_id_fkey(first_name, last_name))
       )`
    )
    .eq('group_id', groupId)
    .order('joined_at', { ascending: false })

  if (error) return []

  return (data ?? []).map((row: any) => ({
    id:              row.id,
    group_id:        row.group_id,
    student_id:      row.student_id,
    enrollment_type: row.enrollment_type as 'primary' | 'secondary',
    status:          row.status,
    joined_at:       row.joined_at,
    left_at:         row.left_at,
    notes:           row.notes,
    student_email:   row.students?.users?.email ?? '',
    first_name:      row.students?.users?.profiles?.first_name ?? null,
    last_name:       row.students?.users?.profiles?.last_name ?? null,
  })) as GroupEnrollment[]
}
