import React from 'react'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import NotificationBell from '@/components/portal/shared/NotificationBell'
import { fetchNotificationFeed, markAllNotificationsRead, markNotificationRead } from '@/modules/notifications/actions'
import type { NotificationFeed } from '@/modules/notifications/types'

vi.mock('@/modules/notifications/actions', () => ({
  fetchNotificationFeed: vi.fn(), markNotificationRead: vi.fn(), markAllNotificationsRead: vi.fn(),
}))

const feed: NotificationFeed = {
  notifications: [{ id: 'request-1', type: 'SESSION_PARTICIPATION_REQUESTED',
    title: 'Teaching participation approval requested', body: 'Instructor requested participation in Group — session #1.',
    href: null, created_at: new Date().toISOString(), is_read: false }], unread_count: 1,
}
const tick = async (ms = 30_000) => { await act(async () => { vi.advanceTimersByTime(ms) }) }

describe('Notification bell staff refresh', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' })
    vi.mocked(fetchNotificationFeed).mockResolvedValue(feed)
    vi.mocked(markAllNotificationsRead).mockResolvedValue(undefined)
    vi.mocked(markNotificationRead).mockResolvedValue(undefined)
  })
  afterEach(() => { cleanup(); vi.useRealTimers() })

  it('updates the staff badge without opening the bell and exposes the request', async () => {
    render(<NotificationBell initialUnreadCount={0} autoRefresh />)
    await tick()
    expect(screen.getByRole('button', { name: 'Notifications' }).textContent).toBe('1')
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Notifications' })) })
    expect(screen.getByText(feed.notifications[0].title)).toBeTruthy()
    expect(fetchNotificationFeed).toHaveBeenCalledTimes(1)
  })

  it('does not poll other portals by default', async () => {
    render(<NotificationBell initialUnreadCount={2} />)
    await tick(90_000)
    expect(fetchNotificationFeed).not.toHaveBeenCalled()
  })

  it('pauses while hidden and refreshes when the user returns', async () => {
    render(<NotificationBell initialUnreadCount={0} autoRefresh />)
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' })
    await tick()
    expect(fetchNotificationFeed).not.toHaveBeenCalled()
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' })
    await act(async () => { document.dispatchEvent(new Event('visibilitychange')) })
    expect(fetchNotificationFeed).toHaveBeenCalledTimes(1)
    await act(async () => { window.dispatchEvent(new Event('focus')) })
    expect(fetchNotificationFeed).toHaveBeenCalledTimes(2)
  })

  it('keeps the existing badge after a transient background failure', async () => {
    vi.mocked(fetchNotificationFeed).mockRejectedValueOnce(new Error('offline'))
    render(<NotificationBell initialUnreadCount={3} autoRefresh />)
    await tick()
    expect(screen.getByRole('button', { name: 'Notifications' }).textContent).toBe('3')
    await tick()
    expect(screen.getByRole('button', { name: 'Notifications' }).textContent).toBe('1')
  })

  it('shows a retry action when opening fails', async () => {
    vi.mocked(fetchNotificationFeed).mockRejectedValueOnce(new Error('offline'))
    render(<NotificationBell initialUnreadCount={1} />)
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Notifications' })) })
    expect(screen.getByRole('alert').textContent).toContain('Unable to load')
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Retry' })) })
    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.getByText(feed.notifications[0].title)).toBeTruthy()
  })

  it('deduplicates overlapping refreshes and removes timers on unmount', async () => {
    let resolve!: (value: NotificationFeed) => void
    vi.mocked(fetchNotificationFeed).mockImplementationOnce(() => new Promise((r) => { resolve = r }))
    const { unmount } = render(<NotificationBell initialUnreadCount={0} autoRefresh />)
    await tick(90_000)
    await act(async () => { window.dispatchEvent(new Event('focus')) })
    expect(fetchNotificationFeed).toHaveBeenCalledTimes(1)
    unmount()
    await act(async () => { resolve(feed) })
    await tick(90_000)
    expect(fetchNotificationFeed).toHaveBeenCalledTimes(1)
  })

  it('does not resurrect unread notifications from a stale poll after mark-all', async () => {
    render(<NotificationBell initialUnreadCount={1} autoRefresh />)
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Notifications' })) })
    let resolve!: (value: NotificationFeed) => void
    vi.mocked(fetchNotificationFeed).mockImplementationOnce(() => new Promise((r) => { resolve = r }))
    await tick()
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Mark all read' })) })
    await act(async () => { resolve(feed) })
    expect(screen.getByRole('button', { name: 'Notifications' }).textContent).toBe('')
    expect(screen.queryByRole('button', { name: 'Mark all read' })).toBeNull()
  })
})
