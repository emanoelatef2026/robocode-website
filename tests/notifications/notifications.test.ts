import { beforeEach,expect,it,vi } from 'vitest'
import { createMockDb } from '../helpers/mock-db'
import { createServiceClient } from '@/lib/supabase/service'
import { getNotificationFeed,getUnreadNotificationCount } from '@/modules/notifications/queries'
vi.mock('@/lib/supabase/service',()=>({createServiceClient:vi.fn()}))
beforeEach(()=>vi.clearAllMocks())
it('counts unread notifications beyond the 30-item bell page',async()=>{
  const db=createMockDb({});db.rpc.mockResolvedValue({data:48,error:null});vi.mocked(createServiceClient).mockReturnValue(db as never)
  expect(await getUnreadNotificationCount('user')).toBe(48)
  expect(db.rpc).toHaveBeenCalledWith('notification_unread_count',{p_user:'user'})
})
it('does not clear the badge when unread counting fails',async()=>{
  const db=createMockDb({});db.rpc.mockResolvedValue({data:null,error:{message:'offline'}});vi.mocked(createServiceClient).mockReturnValue(db as never)
  await expect(getUnreadNotificationCount('user')).rejects.toThrow('Unable to count')
})
it('rejects feed errors rather than claiming an empty inbox',async()=>{
  const db=createMockDb({notifications:[{data:null,error:{message:'offline'}}]});vi.mocked(createServiceClient).mockReturnValue(db as never)
  await expect(getNotificationFeed('user')).rejects.toThrow('Unable to load notifications')
})
it('rejects read-state errors rather than turning read notifications unread',async()=>{
  const db=createMockDb({notifications:[{data:[{id:'n1'}],error:null}],notification_reads:[{data:null,error:{message:'offline'}}]});vi.mocked(createServiceClient).mockReturnValue(db as never)
  await expect(getNotificationFeed('user')).rejects.toThrow('Unable to load notification read status')
})
it('returns grouping and priorities with the correct total unread count',async()=>{
  const db=createMockDb({notifications:[{data:[{id:'n1',type:'ADMIN_ACTIVITY',title:'Updated',data:{priority:'urgent',count:8,requires_action:true}}],error:null}],notification_reads:[{data:[{notification_id:'n1'}],error:null}]})
  db.rpc.mockResolvedValue({data:35,error:null});vi.mocked(createServiceClient).mockReturnValue(db as never)
  const feed=await getNotificationFeed('user')
  expect(feed.unread_count).toBe(35)
  expect(feed.notifications).toMatchObject([{is_read:true,priority:'urgent',bundle_count:8,requires_action:true}])
})
