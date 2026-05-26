import 'server-only'
import { createServiceClient } from '@/lib/supabase/service'
import type { Parent, ParentListItem, ParentChild } from './types'
import type { PaginatedResult } from '@/types/app'

export async function listParents({
  page = 1,
  perPage = 20,
  search = '',
}: {
  page?: number
  perPage?: number
  search?: string
} = {}): Promise<PaginatedResult<ParentListItem>> {
  const db   = createServiceClient()
  const from = (page - 1) * perPage
  const to   = from + perPage - 1

  const { data, count, error } = await db
    .from('parents')
    .select(
      `id, user_id, created_at,
       users!parents_user_id_fkey(email, profiles!profiles_user_id_fkey(first_name, last_name))`,
      { count: 'exact' }
    )
    .order('created_at', { ascending: false })
    .range(from, to)

  if (error) throw new Error(error.message)

  const items: ParentListItem[] = (data ?? []).map((row: any) => ({
    id:             row.id,
    user_id:        row.user_id,
    created_at:     row.created_at,
    user_email:     row.users?.email ?? '',
    first_name:     row.users?.profiles?.first_name ?? null,
    last_name:      row.users?.profiles?.last_name ?? null,
    children_count: 0,
  }))

  const filtered = search
    ? items.filter((p) => {
        const q = search.toLowerCase()
        const full = `${p.first_name ?? ''} ${p.last_name ?? ''} ${p.user_email}`.toLowerCase()
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

export async function getParent(id: string): Promise<Parent | null> {
  const db = createServiceClient()

  const { data, error } = await db
    .from('parents')
    .select(
      `id, user_id, created_at,
       users!parents_user_id_fkey(email, profiles!profiles_user_id_fkey(first_name, last_name)),
       parent_students(
         student_id, relationship, is_primary,
         students(
           user_id,
           users!students_user_id_fkey(email, profiles!profiles_user_id_fkey(first_name, last_name)),
           branches!students_branch_id_fkey(name)
         )
       )`
    )
    .eq('id', id)
    .single()

  if (error || !data) return null

  const children: ParentChild[] = ((data as any).parent_students ?? []).map((ps: any) => ({
    student_id:         ps.student_id,
    relationship:       ps.relationship,
    is_primary:         ps.is_primary,
    student_first_name: ps.students?.users?.profiles?.first_name ?? null,
    student_last_name:  ps.students?.users?.profiles?.last_name ?? null,
    student_email:      ps.students?.users?.email ?? '',
    branch_name:        ps.students?.branches?.name ?? '',
  }))

  return {
    id:          (data as any).id,
    user_id:     (data as any).user_id,
    created_at:  (data as any).created_at,
    user_email:  (data as any).users?.email ?? '',
    first_name:  (data as any).users?.profiles?.first_name ?? null,
    last_name:   (data as any).users?.profiles?.last_name ?? null,
    children,
  }
}
