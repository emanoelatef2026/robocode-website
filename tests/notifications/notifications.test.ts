import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createMockDb, type MockResult } from '../helpers/mock-db'

vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: vi.fn(),
}))

import { createServiceClient } from '@/lib/supabase/service'
import { getNotificationFeed, getUnreadNotificationCount } from '@/modules/notifications/queries'

const USER_ID = 'user-001'

const mockDb = (queues: Record<string, MockResult[]>) => {
  const db = createMockDb(queues)
  ;(createServiceClient as ReturnType<typeof vi.fn>).mockReturnValue(db)
  return db
}

describe('Notification queries', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('TEST 3 — getUnreadNotificationCount returns correct unread count', async () => {
    mockDb({
      notifications:      [{ data: null, error: null }],  // count=3 via head
      notification_reads: [{ data: null, error: null }],  // count=1 via head
    })

    // Override to return counts via a custom mock
    const countDb = {
      from: vi.fn((table: string) => {
        const makeCount = (count: number) => {
          const c: any = {}
          const methods = ['select', 'eq', 'in', 'order', 'limit', 'gte', 'lte', 'not', 'filter']
          for (const m of methods) c[m] = () => c
          c.then = (r: any) => Promise.resolve({ count, data: null, error: null }).then(r)
          c.single      = () => Promise.resolve({ count, data: null, error: null })
          c.maybeSingle = () => Promise.resolve({ count, data: null, error: null })
          return c
        }
        if (table === 'notifications')      return makeCount(5)
        if (table === 'notification_reads') return makeCount(2)
        return makeCount(0)
      }),
      rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
    }
    ;(createServiceClient as ReturnType<typeof vi.fn>).mockReturnValue(countDb)

    const count = await getUnreadNotificationCount(USER_ID)
    expect(count).toBe(3) // 5 total - 2 read = 3 unread
  })

  it('TEST 3b — returns 0 when no notifications exist', async () => {
    const countDb = {
      from: vi.fn((table: string) => {
        const c: any = {}
        const methods = ['select', 'eq', 'in', 'order', 'limit', 'gte', 'lte', 'not', 'filter']
        for (const m of methods) c[m] = () => c
        c.then = (r: any) => Promise.resolve({ count: 0, data: null, error: null }).then(r)
        c.single      = () => Promise.resolve({ count: 0, data: null, error: null })
        c.maybeSingle = () => Promise.resolve({ count: 0, data: null, error: null })
        return c
      }),
      rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
    }
    ;(createServiceClient as ReturnType<typeof vi.fn>).mockReturnValue(countDb)

    const count = await getUnreadNotificationCount(USER_ID)
    expect(count).toBe(0)
  })

  it('TEST 4 — getNotificationFeed correctly marks read notifications', async () => {
    const notifRows = [
      { id: 'n1', type: 'SESSION_STARTING', title: 'Session soon', body: null, href: '/portal', created_at: new Date().toISOString() },
      { id: 'n2', type: 'HOMEWORK_NEEDS_GRADING', title: 'Grade homework', body: 'You have 3 pending', href: '/portal/instructor/homework', created_at: new Date().toISOString() },
    ]

    let callCount = 0
    const feedDb = {
      from: vi.fn((table: string) => {
        callCount++
        const c: any = {}
        const methods = ['select', 'eq', 'in', 'order', 'limit', 'gte', 'lte', 'not', 'filter']
        for (const m of methods) c[m] = () => c
        // call 1: notifications → rows
        if (callCount === 1) {
          c.then = (r: any) => Promise.resolve({ data: notifRows, error: null }).then(r)
        }
        // call 2: notification_reads → only n1 is read
        else if (callCount === 2) {
          c.then = (r: any) => Promise.resolve({ data: [{ notification_id: 'n1' }], error: null }).then(r)
        } else {
          c.then = (r: any) => Promise.resolve({ data: [], error: null }).then(r)
        }
        c.single      = () => Promise.resolve({ data: null, error: null })
        c.maybeSingle = () => Promise.resolve({ data: null, error: null })
        return c
      }),
      rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
    }
    ;(createServiceClient as ReturnType<typeof vi.fn>).mockReturnValue(feedDb)

    const feed = await getNotificationFeed(USER_ID)

    expect(feed.notifications).toHaveLength(2)
    expect(feed.notifications.find((n) => n.id === 'n1')?.is_read).toBe(true)
    expect(feed.notifications.find((n) => n.id === 'n2')?.is_read).toBe(false)
    expect(feed.unread_count).toBe(1)
  })
})
