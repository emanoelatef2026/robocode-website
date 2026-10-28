import { beforeEach,expect,it,vi } from 'vitest'
import { getSessionCookie } from '@/lib/lms-session'
import { createActivityFetch } from '@/lib/supabase/activity-fetch'
vi.mock('@/lib/lms-session',()=>({getSessionCookie:vi.fn()}))
beforeEach(()=>vi.clearAllMocks())
it('keeps concurrent users separate and overwrites spoofed actor headers',async()=>{
  vi.mocked(getSessionCookie).mockResolvedValueOnce({sub:'first'} as never).mockResolvedValueOnce({sub:'second'} as never)
  const base=vi.fn().mockResolvedValue(new Response('{}',{status:200}));const wrapped=createActivityFetch(base)
  await Promise.all([wrapped('https://example.test/rest/v1/groups',{method:'PATCH',headers:{'x-activity-actor':'spoofed'}}),wrapped('https://example.test/rest/v1/groups',{method:'POST'})])
  expect(new Headers(base.mock.calls[0][1].headers).get('x-activity-actor')).toBe('first')
  expect(new Headers(base.mock.calls[1][1].headers).get('x-activity-actor')).toBe('second')
})
it('logs failed writes without leaking passwords, request bodies or error text',async()=>{
  vi.mocked(getSessionCookie).mockResolvedValue({sub:'actor'} as never)
  const base=vi.fn().mockResolvedValueOnce(new Response('private database detail',{status:403})).mockResolvedValueOnce(new Response('',{status:201}))
  const response=await createActivityFetch(base)('https://example.test/rest/v1/users?secret=hidden',{method:'PATCH',body:'{"password":"private-password"}'})
  expect(response.status).toBe(403)
  const logged=JSON.parse(base.mock.calls[1][1].body)
  expect(logged.type).toBe('SECURITY_DENIAL');expect(logged.actor_user_id).toBe('actor')
  expect(JSON.stringify(logged)).not.toMatch(/private-password|private database|hidden/)
})
it('does not intercept reads or recursively log logger failures',async()=>{
  const base=vi.fn().mockResolvedValue(new Response('{}',{status:500}));const wrapped=createActivityFetch(base)
  await wrapped('https://example.test/rest/v1/groups');expect(getSessionCookie).not.toHaveBeenCalled()
  await wrapped('https://example.test/rest/v1/system_event_logs',{method:'POST'})
  expect(base).toHaveBeenCalledTimes(2)
})
