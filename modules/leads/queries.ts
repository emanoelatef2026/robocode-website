import 'server-only'
import { createServiceClient } from '@/lib/supabase/service'
import type {
  Lead, LeadListItem, LeadKPIs, LeadTimelineEvent,
  OwnershipKPIs, AgingLead, FollowUpDueLead, OwnerWorkload, BranchTeamMember,
} from './types'
import { AGING_THRESHOLDS } from './types'
import type { PaginatedResult } from '@/types/app'

// ── Shared: resolve profile names for a set of user IDs ─────────────────────

async function resolveNames(userIds: string[]): Promise<Map<string, string>> {
  if (!userIds.length) return new Map()
  const db = createServiceClient()
  const { data } = await db
    .from('profiles')
    .select('user_id, first_name, last_name')
    .in('user_id', userIds)
  const map = new Map<string, string>()
  for (const p of (data ?? []) as any[]) {
    map.set(p.user_id, [p.first_name, p.last_name].filter(Boolean).join(' ') || 'Unknown')
  }
  return map
}

function daysAgo(isoDate: string | null): number {
  if (!isoDate) return 0
  return Math.floor((Date.now() - new Date(isoDate).getTime()) / 86_400_000)
}

// ── listLeads ────────────────────────────────────────────────────────────────

export async function listLeads({
  page     = 1,
  perPage  = 25,
  search   = '',
  branchIds,
  status,
  source,
  assignedTo,
  unassignedOnly = false,
  dateFrom,
  dateTo,
}: {
  page?:           number
  perPage?:        number
  search?:         string
  branchIds?:      string[]
  status?:         string
  source?:         string
  assignedTo?:     string
  unassignedOnly?: boolean
  dateFrom?:       string
  dateTo?:         string
} = {}): Promise<PaginatedResult<LeadListItem>> {
  const db   = createServiceClient()
  const from = (page - 1) * perPage
  const to   = from + perPage - 1

  let query = db
    .from('leads')
    .select(
      `id, child_name, parent_name, phone, whatsapp, age, source, status,
       branch_id, assigned_to, stage_entered_at, next_follow_up_at, created_at,
       branches!leads_branch_id_fkey(name)`,
      { count: 'exact' }
    )
    .order('created_at', { ascending: false })
    .range(from, to)

  if (branchIds?.length)  query = query.in('branch_id', branchIds)
  if (status)             query = query.eq('status', status)
  if (source)             query = query.eq('source', source)
  if (assignedTo)         query = query.eq('assigned_to', assignedTo)
  if (unassignedOnly)     query = query.is('assigned_to', null)
  if (dateFrom)           query = query.gte('created_at', dateFrom)
  if (dateTo)             query = query.lte('created_at', dateTo)

  if (search) {
    const q = `%${search}%`
    query = query.or(`child_name.ilike.${q},parent_name.ilike.${q},phone.ilike.${q},whatsapp.ilike.${q},email.ilike.${q}`)
  }

  const { data, count, error } = await query
  if (error) throw error

  const rows  = (data ?? []) as any[]
  const total = count ?? 0

  // Resolve owner names in one batch query
  const ownerIds = [...new Set(rows.map((r: any) => r.assigned_to).filter(Boolean))]
  const nameMap  = await resolveNames(ownerIds)

  const items: LeadListItem[] = rows.map(r => ({
    id:                r.id,
    child_name:        r.child_name,
    parent_name:       r.parent_name    ?? null,
    phone:             r.phone          ?? null,
    whatsapp:          r.whatsapp       ?? null,
    age:               r.age            ?? null,
    source:            r.source,
    status:            r.status,
    branch_id:         r.branch_id      ?? null,
    branch_name:       r.branches?.name ?? null,
    assigned_to:       r.assigned_to    ?? null,
    assigned_name:     r.assigned_to ? (nameMap.get(r.assigned_to) ?? null) : null,
    days_in_stage:     daysAgo(r.stage_entered_at),
    next_follow_up_at: r.next_follow_up_at ?? null,
    created_at:        r.created_at,
  }))

  return { data: items, total, page, perPage, totalPages: Math.ceil(total / perPage) }
}

// ── getLead ──────────────────────────────────────────────────────────────────

export async function getLead(id: string): Promise<Lead | null> {
  const db = createServiceClient()
  const { data, error } = await db
    .from('leads')
    .select(`*, branches!leads_branch_id_fkey(name)`)
    .eq('id', id)
    .maybeSingle()

  if (error) throw error
  if (!data) return null

  const r = data as any
  let assigned_name: string | null = null
  if (r.assigned_to) {
    const nameMap = await resolveNames([r.assigned_to])
    assigned_name = nameMap.get(r.assigned_to) ?? null
  }

  return {
    ...r,
    branch_name:   r.branches?.name ?? null,
    assigned_name,
    days_in_stage: daysAgo(r.stage_entered_at),
  }
}

// ── getLeadTimeline ──────────────────────────────────────────────────────────

export async function getLeadTimeline(leadId: string): Promise<LeadTimelineEvent[]> {
  const db = createServiceClient()
  const { data, error } = await db
    .from('lead_timeline')
    .select('*')
    .eq('lead_id', leadId)
    .order('created_at', { ascending: false })

  if (error) throw error
  const rows = (data ?? []) as any[]

  const creatorIds = [...new Set(rows.map(r => r.created_by).filter(Boolean))]
  const nameMap    = await resolveNames(creatorIds)

  return rows.map(r => ({
    id:              r.id,
    lead_id:         r.lead_id,
    event_type:      r.event_type,
    note:            r.note ?? null,
    created_by:      r.created_by ?? null,
    created_by_name: r.created_by ? (nameMap.get(r.created_by) ?? null) : null,
    created_at:      r.created_at,
  }))
}

// ── getLeadKPIs ──────────────────────────────────────────────────────────────

export async function getLeadKPIs(branchIds: string[]): Promise<LeadKPIs> {
  const db = createServiceClient()
  let query = db.from('leads').select('status, next_follow_up_at')
  if (branchIds.length) query = query.in('branch_id', branchIds)

  const { data } = await query
  const rows     = (data ?? []) as any[]
  const todayStr = new Date().toISOString().slice(0, 10)

  let total = 0, new_leads = 0, contacted = 0, trial_booked = 0,
      trial_attended = 0, converted = 0, follow_ups_today = 0

  for (const r of rows) {
    total++
    if (r.status === 'NEW')            new_leads++
    if (r.status === 'CONTACTED')      contacted++
    if (r.status === 'TRIAL_BOOKED')   trial_booked++
    if (r.status === 'TRIAL_ATTENDED') trial_attended++
    if (r.status === 'CONVERTED')      converted++
    if (r.next_follow_up_at && r.next_follow_up_at.slice(0, 10) <= todayStr) follow_ups_today++
  }

  return {
    total, new_leads, contacted, trial_booked,
    trial_attended, converted, follow_ups_today,
    conversion_rate: total > 0 ? Math.round((converted / total) * 100) : 0,
  }
}

// ── getOwnershipKPIs ─────────────────────────────────────────────────────────

export async function getOwnershipKPIs(
  branchIds: string[],
  currentUserId: string
): Promise<OwnershipKPIs> {
  const db = createServiceClient()
  const todayStr = new Date().toISOString().slice(0, 10)
  const startOfMonth = new Date()
  startOfMonth.setDate(1)
  startOfMonth.setHours(0, 0, 0, 0)

  let base = db.from('leads').select('status, assigned_to, next_follow_up_at, updated_at')
  if (branchIds.length) base = base.in('branch_id', branchIds)
  const { data } = await base
  const rows = (data ?? []) as any[]

  let my_leads = 0, unassigned = 0, overdue_follow_ups = 0,
      converted_this_month = 0, my_total = 0, my_converted = 0

  for (const r of rows) {
    if (!r.assigned_to) unassigned++
    if (r.assigned_to === currentUserId) {
      my_leads++
      my_total++
      if (r.status === 'CONVERTED') my_converted++
    }
    if (
      r.next_follow_up_at &&
      r.next_follow_up_at.slice(0, 10) < todayStr &&
      r.status !== 'CONVERTED' && r.status !== 'LOST'
    ) overdue_follow_ups++
    if (
      r.status === 'CONVERTED' &&
      r.updated_at && new Date(r.updated_at) >= startOfMonth
    ) converted_this_month++
  }

  return {
    my_leads,
    unassigned,
    overdue_follow_ups,
    converted_this_month,
    my_conversion_rate: my_total > 0 ? Math.round((my_converted / my_total) * 100) : 0,
  }
}

// ── getAgingLeads ────────────────────────────────────────────────────────────

export async function getAgingLeads(branchIds: string[]): Promise<AgingLead[]> {
  const db = createServiceClient()
  const alertStatuses = Object.keys(AGING_THRESHOLDS)

  let query = db
    .from('leads')
    .select('id, child_name, status, assigned_to, phone, stage_entered_at')
    .in('status', alertStatuses)
    .not('stage_entered_at', 'is', null)
    .order('stage_entered_at', { ascending: true })

  if (branchIds.length) query = query.in('branch_id', branchIds)

  const { data } = await query
  const rows = (data ?? []) as any[]

  // Filter to only those past their threshold
  const aging = rows.filter(r => {
    const threshold = AGING_THRESHOLDS[r.status as keyof typeof AGING_THRESHOLDS]
    if (!threshold) return false
    return daysAgo(r.stage_entered_at) > threshold
  })

  const ownerIds = [...new Set(aging.map(r => r.assigned_to).filter(Boolean))]
  const nameMap  = await resolveNames(ownerIds)

  return aging.map(r => ({
    id:            r.id,
    child_name:    r.child_name,
    status:        r.status,
    assigned_to:   r.assigned_to ?? null,
    assigned_name: r.assigned_to ? (nameMap.get(r.assigned_to) ?? 'Unknown') : null,
    days_in_stage: daysAgo(r.stage_entered_at),
    phone:         r.phone ?? null,
  })).slice(0, 20) // cap at 20 for dashboard
}

// ── getFollowUpsDue ──────────────────────────────────────────────────────────

export async function getFollowUpsDue(branchIds: string[]): Promise<FollowUpDueLead[]> {
  const db = createServiceClient()
  const todayStr = new Date().toISOString().slice(0, 10)

  let query = db
    .from('leads')
    .select('id, child_name, phone, assigned_to, next_follow_up_at, status')
    .lte('next_follow_up_at', `${todayStr}T23:59:59Z`)
    .not('next_follow_up_at', 'is', null)
    .not('status', 'in', '("CONVERTED","LOST")')
    .order('next_follow_up_at', { ascending: true })

  if (branchIds.length) query = query.in('branch_id', branchIds)

  const { data } = await query
  const rows = (data ?? []) as any[]

  const ownerIds = [...new Set(rows.map(r => r.assigned_to).filter(Boolean))]
  const nameMap  = await resolveNames(ownerIds)

  return rows.map(r => ({
    id:               r.id,
    child_name:       r.child_name,
    phone:            r.phone ?? null,
    assigned_to:      r.assigned_to ?? null,
    assigned_name:    r.assigned_to ? (nameMap.get(r.assigned_to) ?? null) : null,
    next_follow_up_at: r.next_follow_up_at,
    status:           r.status,
    days_overdue:     daysAgo(r.next_follow_up_at),
  })).slice(0, 15) // cap for dashboard widget
}

// ── getWorkloadDistribution ──────────────────────────────────────────────────

export async function getWorkloadDistribution(branchIds: string[]): Promise<OwnerWorkload[]> {
  const db = createServiceClient()

  let query = db.from('leads').select('assigned_to, status')
  if (branchIds.length) query = query.in('branch_id', branchIds)

  const { data } = await query
  const rows = (data ?? []) as any[]

  // Group by assigned_to
  const map = new Map<string | null, { total: number; converted: number }>()
  for (const r of rows) {
    const key = r.assigned_to ?? null
    if (!map.has(key)) map.set(key, { total: 0, converted: 0 })
    const entry = map.get(key)!
    entry.total++
    if (r.status === 'CONVERTED') entry.converted++
    // active = not CONVERTED / LOST
    if (r.status !== 'CONVERTED' && r.status !== 'LOST') {
      // count separately via total - (converted + lost)
    }
  }

  // Active count = total - converted - lost per owner
  const activeMap = new Map<string | null, number>()
  for (const r of rows) {
    const key = r.assigned_to ?? null
    if (r.status !== 'CONVERTED' && r.status !== 'LOST') {
      activeMap.set(key, (activeMap.get(key) ?? 0) + 1)
    }
  }

  const ownerIds = [...map.keys()].filter((k): k is string => k !== null)
  const nameMap  = await resolveNames(ownerIds)

  const result: OwnerWorkload[] = []
  for (const [userId, stats] of map) {
    result.push({
      user_id:         userId,
      name:            userId ? (nameMap.get(userId) ?? 'Unknown') : 'Unassigned',
      total:           stats.total,
      active:          activeMap.get(userId) ?? 0,
      converted:       stats.converted,
      conversion_rate: stats.total > 0
        ? Math.round((stats.converted / stats.total) * 100) : 0,
    })
  }

  return result.sort((a, b) => b.total - a.total)
}

// ── getLeadsBySource ─────────────────────────────────────────────────────────

export async function getLeadsBySource(branchIds: string[]): Promise<{ source: string; count: number }[]> {
  const db = createServiceClient()
  let query = db.from('leads').select('source')
  if (branchIds.length) query = query.in('branch_id', branchIds)

  const { data } = await query
  const map: Record<string, number> = {}
  for (const r of (data ?? []) as any[]) {
    map[r.source] = (map[r.source] ?? 0) + 1
  }
  return Object.entries(map)
    .map(([source, count]) => ({ source, count }))
    .sort((a, b) => b.count - a.count)
}

// ── getBranchTeamMembers ─────────────────────────────────────────────────────

export async function getBranchTeamMembers(branchIds: string[]): Promise<BranchTeamMember[]> {
  if (!branchIds.length) return []
  const db = createServiceClient()

  const { data: roleRows } = await db
    .from('user_roles')
    .select('user_id, roles!user_roles_role_id_fkey(name)')
    .in('branch_id', branchIds)

  const tlUserIds = (roleRows ?? [])
    .filter((r: any) => r.roles?.name === 'team_leader')
    .map((r: any) => r.user_id as string)

  if (!tlUserIds.length) return []

  const nameMap = await resolveNames([...new Set(tlUserIds)])
  return [...new Set(tlUserIds)].map(id => ({
    user_id: id,
    name:    nameMap.get(id) ?? 'Unknown',
  })).sort((a, b) => a.name.localeCompare(b.name))
}

// ── getAvgDaysToConvert ──────────────────────────────────────────────────────

export async function getAvgDaysToConvert(branchIds: string[]): Promise<{
  overall:   number | null
  by_source: { source: string; avg_days: number; count: number }[]
}> {
  const db = createServiceClient()
  let query = db.from('leads').select('source, created_at, stage_entered_at').eq('status', 'CONVERTED')
  if (branchIds.length) query = query.in('branch_id', branchIds)

  const { data } = await query
  const rows = ((data ?? []) as any[]).filter(r => r.stage_entered_at && r.created_at)

  if (!rows.length) return { overall: null, by_source: [] }

  const msPerDay = 86_400_000
  const allDays  = rows.map(r =>
    (new Date(r.stage_entered_at).getTime() - new Date(r.created_at).getTime()) / msPerDay
  )
  const overall = Math.round(allDays.reduce((a, b) => a + b, 0) / allDays.length)

  const bySource = new Map<string, number[]>()
  rows.forEach((r, i) => {
    if (!bySource.has(r.source)) bySource.set(r.source, [])
    bySource.get(r.source)!.push(allDays[i])
  })

  const by_source = [...bySource.entries()]
    .map(([source, arr]) => ({
      source,
      avg_days: Math.round(arr.reduce((a, b) => a + b, 0) / arr.length),
      count:    arr.length,
    }))
    .sort((a, b) => a.avg_days - b.avg_days)

  return { overall, by_source }
}

// ── checkDuplicateLead ───────────────────────────────────────────────────────

export async function checkDuplicateLead(phone?: string, whatsapp?: string, email?: string): Promise<string | null> {
  if (!phone && !whatsapp && !email) return null
  const db = createServiceClient()

  const conditions: string[] = []
  if (phone)    conditions.push(`phone.eq.${phone}`)
  if (whatsapp) conditions.push(`whatsapp.eq.${whatsapp}`)
  if (email)    conditions.push(`email.eq.${email}`)

  const { data } = await db
    .from('leads')
    .select('id, child_name')
    .or(conditions.join(','))
    .limit(1)
    .maybeSingle()

  return (data as any)?.id ?? null
}
