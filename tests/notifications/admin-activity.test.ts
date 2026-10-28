import { beforeEach,expect,it,vi } from 'vitest'
import { createServiceClient } from '@/lib/supabase/service'
import { requirePortalRole } from '@/modules/rbac/guards'
import { getAdminActivity,activityFilters } from '@/modules/admin-activity/queries'
import { acknowledgeActivity } from '@/modules/admin-activity/actions'
vi.mock('@/lib/supabase/service',()=>({createServiceClient:vi.fn()}))
vi.mock('@/modules/rbac/guards',()=>({requirePortalRole:vi.fn()}))
const rpc=vi.fn()
beforeEach(()=>{vi.clearAllMocks();vi.mocked(createServiceClient).mockReturnValue({rpc} as never);vi.mocked(requirePortalRole).mockResolvedValue({id:'verified-admin'} as never)})
it('requires the super-admin guard before reading and passes the server identity',async()=>{
  rpc.mockResolvedValue({data:{events:[],total:0},error:null})
  await getAdminActivity({category:'finance',priority:'urgent',page:2})
  expect(requirePortalRole).toHaveBeenCalledWith('super_admin')
  expect(rpc).toHaveBeenCalledWith('admin_activity_feed',expect.objectContaining({p_actor:'verified-admin',p_category:'finance',p_priority:'urgent',p_offset:50}))
})
it('does not query when the portal guard rejects a non-admin',async()=>{
  vi.mocked(requirePortalRole).mockRejectedValue(new Error('Forbidden'))
  await expect(getAdminActivity({})).rejects.toThrow('Forbidden')
  expect(rpc).not.toHaveBeenCalled()
})
it('validates filters and bounds pagination before a query',()=>{
  expect(activityFilters.parse({category:'injected',page:-50})).toMatchObject({category:undefined,page:1})
})
it('preserves a business request when acknowledgement is rejected',async()=>{
  rpc.mockResolvedValue({data:null,error:{code:'22023',message:'Review the actual participation request.'}})
  const form=new FormData();form.set('event_id','11111111-1111-4111-8111-111111111111')
  expect(await acknowledgeActivity(form)).toMatchObject({success:false,error:{message:'Review the actual participation request.'}})
})
