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
  groupId,
  grade,
}: {
  page?: number
  perPage?: number
  search?: string
  branchId?: string | string[]
  status?: string
  groupId?: string
  grade?: string
} = {}): Promise<PaginatedResult<StudentListItem>> {
  const db   = createServiceClient()
  const from = (page - 1) * perPage
  const to   = from + perPage - 1

  // If group filter: pre-query student IDs in that group
  let restrictToStudentIds: string[] | null = null
  if (groupId) {
    const { data: gsRows } = await db
      .from('group_students')
      .select('student_id')
      .eq('group_id', groupId)
      .eq('status', 'active')
    restrictToStudentIds = (gsRows ?? []).map((r: any) => r.student_id as string)
    if (restrictToStudentIds.length === 0) {
      return { data: [], total: 0, page, perPage, totalPages: 0 }
    }
  }

  let query = db
    .from('students')
    .select(
      `id, user_id, branch_id, student_code, enrollment_date, status, school_grade,
       users!students_user_id_fkey(email, profiles!profiles_user_id_fkey(first_name, last_name)),
       branches!students_branch_id_fkey(name),
       group_students!group_students_student_id_fkey(
         status,
         groups!group_students_group_id_fkey(name)
       )`,
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
  if (grade)    query = query.eq('school_grade', grade)
  if (restrictToStudentIds) query = query.in('id', restrictToStudentIds)

  if (search) {
    const q = `%${search}%`

    // Resolve user_ids via profile name, email, and phone
    const [profileHits, emailHits, phoneHits] = await Promise.all([
      db.from('profiles').select('user_id').or(`first_name.ilike.${q},last_name.ilike.${q}`),
      db.from('users').select('id').ilike('email', q),
      db.from('users').select('id').ilike('phone', q),
    ])
    const uniqueUserIds = [
      ...new Set([
        ...(profileHits.data?.map((p: any) => p.user_id) ?? []),
        ...(emailHits.data?.map((u: any) => u.id) ?? []),
        ...(phoneHits.data?.map((u: any) => u.id) ?? []),
      ]),
    ]

    // Resolve student IDs directly via student_code and parent phones (JSONB)
    const [codeHits, p1Hits, p2Hits] = await Promise.all([
      db.from('students').select('id').ilike('student_code', q).is('deleted_at', null),
      db.from('students').select('id').filter('emergency_contact->>phone1', 'ilike', q).is('deleted_at', null),
      db.from('students').select('id').filter('emergency_contact->>phone2', 'ilike', q).is('deleted_at', null),
    ])
    const uniqueStudentIds = [
      ...new Set([
        ...(codeHits.data?.map((s: any) => s.id) ?? []),
        ...(p1Hits.data?.map((s: any) => s.id) ?? []),
        ...(p2Hits.data?.map((s: any) => s.id) ?? []),
      ]),
    ]

    if (uniqueUserIds.length === 0 && uniqueStudentIds.length === 0) {
      return { data: [], total: 0, page, perPage, totalPages: 0 }
    }

    // Combine with OR: students matching by user_id OR directly by id
    if (uniqueUserIds.length > 0 && uniqueStudentIds.length > 0) {
      query = query.or(
        `user_id.in.(${uniqueUserIds.join(',')}),id.in.(${uniqueStudentIds.join(',')})`
      )
    } else if (uniqueUserIds.length > 0) {
      query = query.in('user_id', uniqueUserIds)
    } else {
      query = query.in('id', uniqueStudentIds)
    }
  }

  const { data, count, error } = await query.range(from, to)
  if (error) throw new Error(error.message)

  const items: StudentListItem[] = (data ?? []).map((row: any) => {
    // Find primary active group name
    const gsMemberships = Array.isArray(row.group_students) ? row.group_students : []
    const activeGs = gsMemberships.find((gs: any) => gs.status === 'active')
    const groupName = activeGs?.groups?.name ?? null

    return {
      id:              row.id,
      user_id:         row.user_id,
      branch_id:       row.branch_id,
      student_code:    row.student_code,
      enrollment_date: row.enrollment_date,
      status:          row.status,
      school_grade:    row.school_grade ?? null,
      user_email:      row.users?.email ?? '',
      first_name:      row.users?.profiles?.first_name ?? null,
      last_name:       row.users?.profiles?.last_name ?? null,
      branch_name:     row.branches?.name ?? '',
      group_name:      groupName,
    }
  })

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
      `*,
       users!students_user_id_fkey(email, phone, profiles!profiles_user_id_fkey(first_name, last_name, date_of_birth)),
       branches!students_branch_id_fkey(name),
       group_students!group_students_student_id_fkey(
         status,
         groups!group_students_group_id_fkey(name)
       )`
    )
    .eq('id', id)
    .single()

  if (error || !data) return null

  const row = data as any
  const ec  = (row.emergency_contact ?? {}) as Record<string, string>
  const gsMemberships = Array.isArray(row.group_students) ? row.group_students : []
  const activeGs = gsMemberships.find((gs: any) => gs.status === 'active')

  return {
    ...row,
    user_email:     row.users?.email ?? '',
    first_name:     row.users?.profiles?.first_name ?? null,
    last_name:      row.users?.profiles?.last_name ?? null,
    branch_name:    row.branches?.name ?? '',
    phone:          row.users?.phone ?? null,
    date_of_birth:  row.users?.profiles?.date_of_birth ?? null,
    parent_phone_1: ec.phone1 ?? null,
    parent_phone_2: ec.phone2 ?? null,
    group_name:     activeGs?.groups?.name ?? null,
  } as Student
}
