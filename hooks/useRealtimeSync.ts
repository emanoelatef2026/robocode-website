'use client'
import { useEffect, useRef, useCallback, useState } from 'react'
import { createSupabaseBrowserClient as createClient } from '@/lib/supabase/client'

// ── Realtime table targets ─────────────────────────────────────────────────────

export type RealtimeTable =
  | 'finance_payments'
  | 'attendance_records'
  | 'student_enrollments'
  | 'collection_activities'
  | 'parent_messages'
  | 'payment_promises'
  | 'student_timeline_events'
  | 'operational_tasks'
  | 'notification_queue'

// ── Connection state ────────────────────────────────────────────────────────────

export type RealtimeStatus = 'connecting' | 'connected' | 'disconnected' | 'error'

// ── useRealtimeSync ────────────────────────────────────────────────────────────
//
// Sprint 52 stability fixes:
//   - STABLE channel names (no Date.now() suffix — prevents channel leaks)
//   - Deduplication via Map (only one channel per table)
//   - Proper cleanup via useRef tracking
//   - Reconnect detection via onSubscribe callback
//   - Heartbeat via periodic null-change polling (optional)
//   - Branch filter applied client-side (Supabase realtime IN not supported)
//
// Usage:
//   const { status } = useRealtimeSync(
//     ['finance_payments'], branchIds, () => router.refresh()
//   )

export function useRealtimeSync(
  tables:    RealtimeTable[],
  branchIds: string[],
  onUpdate:  () => void,
  opts: {
    enabled?:     boolean   // default true
    debounceMs?:  number    // default 800ms
    heartbeatMs?: number    // 0 = disabled (default)
  } = {}
): { status: RealtimeStatus; unsubscribe: () => void } {
  const { enabled = true, debounceMs = 800, heartbeatMs = 0 } = opts

  // Create client once — stable ref, never re-instantiated
  const supabaseRef   = useRef(createClient())
  const channelMap    = useRef<Map<string, ReturnType<typeof supabaseRef.current.channel>>>(new Map())
  const debounceRef   = useRef<NodeJS.Timeout | null>(null)
  const heartbeatRef  = useRef<NodeJS.Timeout | null>(null)
  const mountedRef    = useRef(true)
  const [status, setStatus] = useState<RealtimeStatus>('connecting')

  // Stable debounced callback — recreates only when onUpdate identity changes
  const debouncedUpdate = useCallback(() => {
    if (!mountedRef.current) return
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      if (mountedRef.current) onUpdate()
    }, debounceMs)
  }, [onUpdate, debounceMs])

  const unsubscribe = useCallback(() => {
    const supabase = supabaseRef.current
    channelMap.current.forEach(ch => {
      try { supabase.removeChannel(ch) } catch { /* ignore */ }
    })
    channelMap.current.clear()
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (heartbeatRef.current) clearInterval(heartbeatRef.current)
    setStatus('disconnected')
  }, [])

  // Stable key for dependency tracking — avoid re-subscribing on identity changes
  const tablesKey    = tables.slice().sort().join(',')
  const branchIdsKey = branchIds.slice().sort().join(',')

  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  useEffect(() => {
    if (!enabled || !tables.length) {
      unsubscribe()
      return
    }

    const supabase = supabaseRef.current

    // Remove channels that are no longer needed
    const desired = new Set(tables as string[])
    channelMap.current.forEach((ch, tbl) => {
      if (!desired.has(tbl)) {
        try { supabase.removeChannel(ch) } catch { /* ignore */ }
        channelMap.current.delete(tbl)
      }
    })

    // Add channels for tables not yet subscribed
    let connectedCount = 0
    for (const table of tables) {
      if (channelMap.current.has(table)) continue  // already subscribed — SKIP (dedup)

      // Stable channel name: no timestamp — prevents leaks on re-render
      const channelName = `rt:${table}:${branchIdsKey}`

      const ch = supabase
        .channel(channelName)
        .on(
          'postgres_changes' as any,
          { event: '*', schema: 'public', table },
          (payload: any) => {
            if (!mountedRef.current) return

            // Client-side branch filter
            if (branchIds.length) {
              const recBranch = payload?.new?.branch_id ?? payload?.old?.branch_id
              if (recBranch && !branchIds.includes(recBranch)) return
            }
            debouncedUpdate()
          }
        )
        .subscribe((st: string) => {
          if (!mountedRef.current) return
          if (st === 'SUBSCRIBED') {
            connectedCount++
            if (connectedCount >= tables.length) setStatus('connected')
          } else if (st === 'CHANNEL_ERROR' || st === 'TIMED_OUT') {
            setStatus('error')
          } else if (st === 'CLOSED') {
            setStatus('disconnected')
          }
        })

      channelMap.current.set(table, ch)
    }

    setStatus('connecting')

    // Optional heartbeat — detects stale subscriptions
    if (heartbeatMs > 0) {
      if (heartbeatRef.current) clearInterval(heartbeatRef.current)
      heartbeatRef.current = setInterval(() => {
        if (!mountedRef.current) return
        // Verify channels are still alive
        let allAlive = true
        channelMap.current.forEach(ch => {
          if ((ch as any).state === 'closed' || (ch as any).state === 'errored') {
            allAlive = false
          }
        })
        if (!allAlive) setStatus('error')
      }, heartbeatMs)
    }

    // Cleanup: do NOT call unsubscribe() on effect cleanup — that would remove
    // channels we want to keep across re-renders. Only remove on explicit unmount.
    return () => {
      if (heartbeatRef.current) clearInterval(heartbeatRef.current)
      // Channels are kept alive — cleared only on full unsubscribe
    }
  // Intentionally stable deps: only re-subscribe when tables or branchIds actually change
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, tablesKey, branchIdsKey, debouncedUpdate])

  // Final cleanup on unmount
  useEffect(() => {
    return unsubscribe
  }, [unsubscribe])

  return { status, unsubscribe }
}

// ── Simplified single-table hook ──────────────────────────────────────────────

export function useTableRealtime(
  table:    RealtimeTable,
  onUpdate: () => void
): RealtimeStatus {
  const { status } = useRealtimeSync([table], [], onUpdate)
  return status
}

// ── Status badge helper ────────────────────────────────────────────────────────

export function realtimeStatusBadge(status: RealtimeStatus): {
  label: string; color: string; text: string
} {
  return status === 'connected'    ? { label: 'Live',         color: 'bg-emerald-100', text: 'text-emerald-700' }
       : status === 'connecting'   ? { label: 'Connecting…',  color: 'bg-amber-100',   text: 'text-amber-700'   }
       : status === 'disconnected' ? { label: 'Offline',      color: 'bg-slate-100',   text: 'text-slate-600'   }
       :                             { label: 'Error',         color: 'bg-red-100',     text: 'text-red-700'     }
}
