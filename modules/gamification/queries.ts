import 'server-only'
import { createServiceClient } from '@/lib/supabase/service'
import type { LeaderboardEntry, StudentOfWeek } from './types'
import { getLevelProgress } from './xp-service'

// ─── Group leaderboard ────────────────────────────────────────────────────────
// Returns ALL students in a group ranked by total_xp (dynamic — no table).

export async function getGroupLeaderboard(
  groupId: string,
  selfStudentId: string | null = null
): Promise<LeaderboardEntry[]> {
  const db = createServiceClient()

  // Students in group
  const { data: gsRows } = await db
    .from('group_students')
    .select('student_id')
    .eq('group_id', groupId)
    .eq('status', 'active')

  const studentIds = (gsRows ?? []).map((r: any) => r.student_id as string)
  if (studentIds.length === 0) return []

  // Fetch XP + names
  const { data: studRows } = await db
    .from('students')
    .select(
      'id, total_xp, current_level, ' +
      'users!students_user_id_fkey(profiles!profiles_user_id_fkey(first_name, last_name))'
    )
    .in('id', studentIds)
    .is('deleted_at', null)
    .order('total_xp', { ascending: false })

  // Project counts
  const { data: portRows } = await db
    .from('student_portfolios')
    .select('student_id, portfolio_projects(id, is_archived)')
    .in('student_id', studentIds)

  const projectCountMap = new Map<string, number>()
  for (const p of (portRows ?? []) as any[]) {
    const active = (p.portfolio_projects ?? []).filter((pp: any) => !pp.is_archived).length
    projectCountMap.set(p.student_id, active)
  }

  return (studRows ?? []).map((s: any, idx) => {
    const prof = s.users?.profiles
    const name = [prof?.first_name, prof?.last_name].filter(Boolean).join(' ') || 'Student'
    return {
      rank:          idx + 1,
      student_id:    s.id,
      student_name:  name,
      total_xp:      Number(s.total_xp      ?? 0),
      current_level: Number(s.current_level ?? 1),
      project_count: projectCountMap.get(s.id) ?? 0,
      is_self:       s.id === selfStudentId,
    }
  })
}

// ─── Student rank within their group ─────────────────────────────────────────

export async function getStudentGroupRank(
  studentId: string,
  groupId: string
): Promise<{ rank: number; total: number } | null> {
  const db = createServiceClient()

  const { data: gsRows } = await db
    .from('group_students')
    .select('student_id')
    .eq('group_id', groupId)
    .eq('status', 'active')

  const studentIds = (gsRows ?? []).map((r: any) => r.student_id as string)
  if (!studentIds.includes(studentId)) return null

  const { data: studRows } = await db
    .from('students')
    .select('id, total_xp')
    .in('id', studentIds)
    .is('deleted_at', null)
    .order('total_xp', { ascending: false })

  const sorted = (studRows ?? []) as any[]
  const rank   = sorted.findIndex((s) => s.id === studentId) + 1
  return rank > 0 ? { rank, total: sorted.length } : null
}

// ─── Student of the Week ──────────────────────────────────────────────────────
// Dynamically calculated — no new table.
// Weekly XP estimate = attendance_present × 25 + graded_submissions × 40 + new_projects × 100
// Uses "this calendar week" (Monday to today).

export async function getStudentOfTheWeek(groupId: string): Promise<StudentOfWeek | null> {
  const db = createServiceClient()

  // Week boundaries (Monday 00:00 UTC → now)
  const now     = new Date()
  const day     = now.getUTCDay()  // 0 = Sun
  const mondayOffset = day === 0 ? 6 : day - 1
  const monday  = new Date(now)
  monday.setUTCDate(now.getUTCDate() - mondayOffset)
  monday.setUTCHours(0, 0, 0, 0)
  const weekStart = monday.toISOString()

  // Students in group
  const { data: gsRows } = await db
    .from('group_students')
    .select('student_id')
    .eq('group_id', groupId)
    .eq('status', 'active')

  const studentIds = (gsRows ?? []).map((r: any) => r.student_id as string)
  if (studentIds.length === 0) return null

  // Attendance this week
  const { data: attRows } = await db
    .from('attendance_records')
    .select('student_id, status')
    .in('student_id', studentIds)
    .in('status', ['present', 'late'])
    .is('invalidated_at', null)
    .gte('recorded_at', weekStart)

  // Graded submissions this week
  const { data: subRows } = await db
    .from('submissions')
    .select('student_id')
    .in('student_id', studentIds)
    .eq('status', 'graded')
    .gte('updated_at', weekStart)

  // New portfolio projects this week
  let projRows: any[] = []
  if (studentIds.length > 0) {
    const { data: portRows } = await db
      .from('student_portfolios')
      .select('id, student_id')
      .in('student_id', studentIds)
    const portIdToStudent = new Map((portRows ?? []).map((p: any) => [p.id as string, p.student_id as string]))
    if (portIdToStudent.size > 0) {
      const { data: pp } = await db
        .from('portfolio_projects')
        .select('portfolio_id')
        .in('portfolio_id', [...portIdToStudent.keys()])
        .eq('is_archived', false)
        .gte('created_at', weekStart)
      projRows = (pp ?? []).map((p: any) => ({ student_id: portIdToStudent.get(p.portfolio_id) }))
    }
  }

  // Tally weekly XP per student
  const xpMap = new Map<string, number>()
  for (const sid of studentIds) xpMap.set(sid, 0)
  for (const a of (attRows ?? []) as any[]) xpMap.set(a.student_id, (xpMap.get(a.student_id) ?? 0) + 25)
  for (const s of (subRows ?? []) as any[])  xpMap.set(s.student_id, (xpMap.get(s.student_id) ?? 0) + 40)
  for (const p of projRows as any[])          xpMap.set(p.student_id, (xpMap.get(p.student_id) ?? 0) + 100)

  // Find winner
  let winnerId   = ''
  let winnerXp   = 0
  for (const [sid, xp] of xpMap) {
    if (xp > winnerXp) { winnerId = sid; winnerXp = xp }
  }
  if (!winnerId || winnerXp === 0) return null

  // Fetch name + group name
  const { data: studRow } = await db
    .from('students')
    .select('users!students_user_id_fkey(profiles!profiles_user_id_fkey(first_name, last_name))')
    .eq('id', winnerId)
    .maybeSingle()
  const prof = (studRow as any)?.users?.profiles
  const name = [prof?.first_name, prof?.last_name].filter(Boolean).join(' ') || 'Student'

  const { data: groupRow } = await db
    .from('groups')
    .select('name')
    .eq('id', groupId)
    .maybeSingle()

  return {
    student_id:   winnerId,
    student_name: name,
    weekly_xp:    winnerXp,
    group_id:     groupId,
    group_name:   (groupRow as any)?.name ?? '',
  }
}

// ─── XP-based student summary for analytics ──────────────────────────────────
// Returns top N students by XP across given branch(es).

export async function getTopStudentsByXP(
  branchIds: string[],
  limit = 10
): Promise<{ student_id: string; student_name: string; total_xp: number; current_level: number }[]> {
  if (!branchIds.length) return []
  const db = createServiceClient()

  const { data } = await db
    .from('students')
    .select(
      'id, total_xp, current_level, ' +
      'users!students_user_id_fkey(profiles!profiles_user_id_fkey(first_name, last_name))'
    )
    .in('branch_id', branchIds)
    .is('deleted_at', null)
    .eq('status', 'active')
    .order('total_xp', { ascending: false })
    .limit(limit)

  return (data ?? []).map((s: any) => {
    const prof = s.users?.profiles
    return {
      student_id:    s.id,
      student_name:  [prof?.first_name, prof?.last_name].filter(Boolean).join(' ') || 'Student',
      total_xp:      Number(s.total_xp      ?? 0),
      current_level: Number(s.current_level ?? 1),
    }
  })
}
