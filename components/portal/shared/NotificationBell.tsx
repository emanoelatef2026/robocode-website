'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { fetchNotificationFeed, markNotificationRead, markAllNotificationsRead } from '@/modules/notifications/actions'
import type { Notification } from '@/modules/notifications/types'

const TYPE_ICON: Record<string, string> = {
  SESSION_STARTING:        '📅',
  NEW_STUDENT:             '👤',
  HOMEWORK_NEEDS_GRADING:  '📝',
  TEAM_LEADER_NOTE:        '💬',
  STUDENT_PROJECT:         '🎯',
  STUDENT_VIDEO:           '🎥',
  ANNOUNCEMENT:            '📢',
  // Student domain (Sprint 2) — shared by student + parent portals
  EVALUATION_PUBLISHED:    '📊',
  STUDENT_NOTE_SHARED:     '📌',
  PARENT_NOTE_SHARED:      '📌',
  ACHIEVEMENT_EARNED:      '🏅',
  COMPETITION_RESULT:      '🎖️',
}

function timeAgo(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (diff < 60)       return 'Just now'
  if (diff < 3600)     return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400)    return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

interface Props {
  initialUnreadCount: number
}

const CACHE_TTL_MS = 60_000

export default function NotificationBell({ initialUnreadCount }: Props) {
  const [open,         setOpen]         = useState(false)
  const [unread,       setUnread]       = useState(initialUnreadCount)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading,      setLoading]      = useState(false)
  const dropdownRef   = useRef<HTMLDivElement>(null)
  const lastFetchedAt = useRef<number | null>(null)

  const openDropdown = useCallback(async () => {
    if (open) { setOpen(false); return }
    setOpen(true)
    const now   = Date.now()
    const stale = lastFetchedAt.current === null || (now - lastFetchedAt.current) > CACHE_TTL_MS
    if (stale) {
      setLoading(true)
      try {
        const feed = await fetchNotificationFeed()
        setNotifications(feed.notifications)
        setUnread(feed.unread_count)
        lastFetchedAt.current = now
      } finally {
        setLoading(false)
      }
    }
  }, [open])

  const handleRead = useCallback(async (n: Notification) => {
    if (!n.is_read) {
      await markNotificationRead(n.id)
      setNotifications((prev) =>
        prev.map((x) => x.id === n.id ? { ...x, is_read: true } : x)
      )
      setUnread((u) => Math.max(0, u - 1))
    }
    if (n.href) window.location.href = n.href
  }, [])

  const handleMarkAll = useCallback(async () => {
    await markAllNotificationsRead()
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })))
    setUnread(0)
  }, [])

  // Close on outside click
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (!dropdownRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell button */}
      <button
        onClick={openDropdown}
        className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] border border-[#E2E8F0] bg-white transition hover:border-[#94A3B8]"
        aria-label="Notifications"
      >
        <svg viewBox="0 0 20 20" fill="currentColor" className="h-[17px] w-[17px] text-[#64748B]">
          <path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-2.83-2h5.66A3 3 0 0110 18z" />
        </svg>
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#EF4444] px-0.5 text-[9px] font-bold text-white">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute right-0 top-[calc(100%+8px)] z-50 w-[320px] overflow-hidden rounded-xl border border-[#E2E8F0] bg-white shadow-lg">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-[#F1F5F9] px-4 py-3">
            <span className="text-sm font-semibold text-[#0B1F3A]">Notifications</span>
            {unread > 0 && (
              <button
                onClick={handleMarkAll}
                className="text-xs text-[#FF8A1F] hover:underline"
              >
                Mark all read
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-[380px] overflow-y-auto">
            {loading ? (
              <div className="space-y-3 p-4">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="flex gap-3">
                    <div className="h-8 w-8 shrink-0 animate-pulse rounded-full bg-[#F1F5F9]" />
                    <div className="flex-1 space-y-1.5">
                      <div className="h-3 w-3/4 animate-pulse rounded bg-[#F1F5F9]" />
                      <div className="h-2.5 w-1/2 animate-pulse rounded bg-[#F1F5F9]" />
                    </div>
                  </div>
                ))}
              </div>
            ) : notifications.length === 0 ? (
              <p className="py-10 text-center text-sm text-[#94A3B8]">No notifications yet</p>
            ) : (
              <div className="divide-y divide-[#F8FAFC]">
                {notifications.map((n) => (
                  <button
                    key={n.id}
                    onClick={() => handleRead(n)}
                    className={`flex w-full items-start gap-3 px-4 py-3 text-left transition hover:bg-[#F8FAFC] ${
                      !n.is_read ? 'bg-[#FFFBEB]' : ''
                    }`}
                  >
                    <span className="mt-0.5 text-[18px] shrink-0">{TYPE_ICON[n.type] ?? '🔔'}</span>
                    <div className="min-w-0 flex-1">
                      <p className={`text-xs leading-tight ${!n.is_read ? 'font-semibold text-[#0B1F3A]' : 'text-[#0B1F3A]'}`}>
                        {n.title}
                      </p>
                      {n.body && (
                        <p className="mt-0.5 truncate text-[11px] text-[#64748B]">{n.body}</p>
                      )}
                      <p className="mt-1 text-[10px] text-[#94A3B8]">{timeAgo(n.created_at)}</p>
                    </div>
                    {!n.is_read && (
                      <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[#FF8A1F]" />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
