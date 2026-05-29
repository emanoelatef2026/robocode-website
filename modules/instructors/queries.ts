import 'server-only'
import { createServiceClient } from '@/lib/supabase/service'
import type { InstructorListItem, Instructor } from './types'
import type { PaginatedResult } from '@/types/app'

export async function listInstructors({
  page = 1,
  perPage = 20,
  search = '',
  branchId,
}: {
  page?: number
  perPage?: number
  search?: string
  branchId?: string | string[]
} = {}): Promise<PaginatedResult<InstructorListItem>> {
  const db   = createServiceClient()
  const from = (page - 1) * perPage
  const to   = from + perPage - 1

  let query = db
    .from('instructors')
    .select(
      `id, user_id, branch_id, employee_id, hire_date, instructor_code, status, specializations,
       users!instructors_user_id_fkey(email, phone, profiles!profiles_user_id_fkey(first_name, last_name)),
       branches!instructors_branch_id_fkey(name)`,
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

  const items: InstructorListItem[] = (data ?? []).map((row: any) => ({
    id:              row.id,
    user_id:         row.user_id,
    branch_id:       row.branch_id,
    employee_id:     row.employee_id,
    hire_date:       row.hire_date,
    instructor_code: row.instructor_code ?? null,
    status:          row.status,
    specializations: row.specializations ?? [],
    user_email:      row.users?.email ?? '',
    first_name:      row.users?.profiles?.first_name ?? null,
    last_name:       row.users?.profiles?.last_name ?? null,
    branch_name:     row.branches?.name ?? '',
    phone:           row.users?.phone ?? null,
    group_count:     0,
  }))

  // Batch-fetch group counts from group_instructors
  const instructorIds = items.map((i) => i.id)
  if (instructorIds.length > 0) {
    const { data: giRows } = await db
      .from('group_instructors')
      .select('instructor_id')
      .in('instructor_id', instructorIds)
    const countMap: Record<string, number> = {}
    for (const r of giRows ?? []) {
      countMap[(r as any).instructor_id] = (countMap[(r as any).instructor_id] ?? 0) + 1
    }
    items.forEach((item) => { item.group_count = countMap[item.id] ?? 0 })
  }

  return {
    data:       items,
    total:      count ?? 0,
    page,
    perPage,
    totalPages: Math.ceil((count ?? 0) / perPage),
  }
}

export async function getInstructor(id: string): Promise<Instructor | null> {
  const db = createServiceClient()
  const { data, error } = await db
    .from('instructors')
    .select(
      `*, users!instructors_user_id_fkey(email, phone, profiles!profiles_user_id_fkey(first_name, last_name)),
       branches!instructors_branch_id_fkey(name)`
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
    phone:       (data as any).users?.phone ?? null,
  } as Instructor
}

export interface InstructorGroup {
  id:   string
  name: string
  type: string
  status: string
  student_count: number
}

export async function getInstructorGroups(instructorId: string): Promise<InstructorGroup[]> {
  const db = createServiceClient()

  const { data: giRows } = await db
    .from('group_instructors')
    .select('group_id, groups!group_instructors_group_id_fkey(id, name, type, status)')
    .eq('instructor_id', instructorId)

  const groupIds = (giRows ?? []).map((r: any) => r.group_id as string)

  // Also get from group_courses
  const { data: gcRows } = await db
    .from('group_courses')
    .select('group_id, groups!group_courses_group_id_fkey(id, name, type, status)')
    .eq('instructor_id', instructorId)
    .eq('status', 'active')

  const allGroupMap = new Map<string, { id: string; name: string; type: string; status: string }>()

  for (const r of [...(giRows ?? []), ...(gcRows ?? [])] as any[]) {
    const g = r.groups
    if (g && !allGroupMap.has(g.id)) {
      allGroupMap.set(g.id, { id: g.id, name: g.name, type: g.type, status: g.status })
    }
  }

  const groups = [...allGroupMap.values()]
  if (!groups.length) return []

  // Fetch student counts
  const { data: gsCounts } = await db
    .from('group_students')
    .select('group_id')
    .in('group_id', groups.map(g => g.id))
    .eq('status', 'active')

  const countByGroup: Record<string, number> = {}
  for (const gs of gsCounts ?? []) {
    const gid = (gs as any).group_id
    countByGroup[gid] = (countByGroup[gid] ?? 0) + 1
  }

  return groups.map(g => ({ ...g, student_count: countByGroup[g.id] ?? 0 }))
}
