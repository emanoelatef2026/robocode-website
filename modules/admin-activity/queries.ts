import 'server-only'
import { createServiceClient } from '@/lib/supabase/service'
import { requirePortalRole } from '@/modules/rbac/guards'
import { z } from 'zod'
import { ACTIVITY_CATEGORIES, ACTIVITY_PRIORITIES, type ActivityFeed } from './types'

export const activityFilters = z.object({
  category:z.enum(ACTIVITY_CATEGORIES).optional().catch(undefined),
  priority:z.enum(ACTIVITY_PRIORITIES).optional().catch(undefined),
  state:z.enum(['pending','resolved']).optional().catch(undefined),
  q:z.string().trim().max(100).optional().catch(undefined),
  page:z.coerce.number().int().min(1).max(2001).default(1).catch(1),
  event:z.string().uuid().optional().catch(undefined),
})
export async function getAdminActivity(filters:z.input<typeof activityFilters>):Promise<ActivityFeed> {
  const user = await requirePortalRole('super_admin')
  const f = activityFilters.parse(filters)
  const {data,error} = await createServiceClient().rpc('admin_activity_feed',{
    p_actor:user.id,p_category:f.category ?? null,p_priority:f.priority ?? null,p_state:f.state ?? null,
    p_search:f.q || null,p_offset:(f.page-1)*50,p_event:f.event ?? null,
  })
  if (error || !data) throw new Error('Unable to load activity. Please retry.')
  return data as ActivityFeed
}
