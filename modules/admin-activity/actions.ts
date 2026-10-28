'use server'
import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { requirePortalRole } from '@/modules/rbac/guards'
import { createServiceClient } from '@/lib/supabase/service'
import type { ActionResult } from '@/types/app'
export async function acknowledgeActivity(form:FormData):Promise<ActionResult<void>> {
  const user=await requirePortalRole('super_admin')
  const id=z.string().uuid().safeParse(form.get('event_id'))
  if (!id.success) return {success:false,error:{code:'VALIDATION',message:'Choose a valid activity.'}}
  const {error}=await createServiceClient().rpc('acknowledge_admin_activity',{p_actor:user.id,p_event:id.data})
  if (error) return {success:false,error:{code:'VALIDATION',message:error.code==='22023'?error.message:'Unable to acknowledge this alert.'}}
  revalidatePath('/admin/activity')
  return {success:true,data:undefined}
}
