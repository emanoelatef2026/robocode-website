'use server'

import { createServiceClient } from '@/lib/supabase/service'
import { requirePermission } from '@/modules/rbac/guards'
import { loadRegistrationContacts, searchRegistrationContacts } from './registration'
import type { ParentSearchResult } from './registration'
import type { ActionResult } from '@/types/app'

export async function searchExistingGuardians(query: string): Promise<ActionResult<ParentSearchResult[]>> {
  const user = await requirePermission('manage_students')
  if (typeof query !== 'string' || query.trim().length < 2 || query.length > 100) {
    return { success: true, data: [] }
  }
  try {
    const rows = await loadRegistrationContacts(createServiceClient(), user)
    return { success: true, data: searchRegistrationContacts(rows, query) }
  } catch {
    return { success: false, error: { code: 'LOOKUP_FAILED', message: 'Could not search guardians. Please try again.' } }
  }
}
