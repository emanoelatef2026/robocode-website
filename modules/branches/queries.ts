import 'server-only'
import { createServiceClient } from '@/lib/supabase/service'
import type { Branch, BranchListItem } from './types'
import type { PaginatedResult } from '@/types/app'

const DEFAULT_ORG = 'a0000000-0000-0000-0000-000000000001'

export async function listBranches({
  page = 1,
  perPage = 20,
  search = '',
}: {
  page?: number
  perPage?: number
  search?: string
} = {}): Promise<PaginatedResult<BranchListItem>> {
  const db = createServiceClient()
  const from = (page - 1) * perPage
  const to   = from + perPage - 1

  let query = db
    .from('branches')
    .select('id, name, slug, type, phone, location, is_active, created_at', { count: 'exact' })
    .eq('org_id', DEFAULT_ORG)
    .is('deleted_at', null)
    .order('name')
    .range(from, to)

  if (search) {
    query = query.ilike('name', `%${search}%`)
  }

  const { data, count, error } = await query
  if (error) throw new Error(error.message)

  return {
    data:       (data ?? []) as BranchListItem[],
    total:      count ?? 0,
    page,
    perPage,
    totalPages: Math.ceil((count ?? 0) / perPage),
  }
}

export async function getBranch(id: string): Promise<Branch | null> {
  const db = createServiceClient()
  const { data, error } = await db
    .from('branches')
    .select('id, name, slug, type, phone, location, timezone, is_active, deleted_at, created_at, updated_at')
    .eq('id', id)
    .eq('org_id', DEFAULT_ORG)
    .single()
  if (error) return null
  return data as Branch
}
