import { requirePortalRole } from '@/modules/rbac/guards'
import { createServiceClient } from '@/lib/supabase/service'
import { getGroupLeaderboard } from '@/modules/gamification/queries'
import Link from 'next/link'

export default async function StudentLeaderboardPage() {
  const user = await requirePortalRole('student')
  const db   = createServiceClient()

  // Resolve student_id + active group_id
  const { data: studentRow } = await db
    .from('students')
    .select('id')
    .eq('user_id', user.id)
    .is('deleted_at', null)
    .maybeSingle()
  const studentId = (studentRow as any)?.id ?? null

  if (!studentId) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <p className="text-sm text-[#94A3B8]">Student record not found.</p>
      </div>
    )
  }

  const { data: gsRow } = await db
    .from('group_students')
    .select('group_id, groups!group_students_group_id_fkey(name)')
    .eq('student_id', studentId)
    .eq('status', 'active')
    .order('joined_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const groupId   = (gsRow as any)?.group_id   ?? null
  const groupName = (gsRow as any)?.groups?.name ?? null

  if (!groupId) {
    return (
      <div className="mx-auto max-w-xl py-12 text-center">
        <p className="text-sm text-[#94A3B8]">You are not enrolled in a group yet. Join a group to see the leaderboard.</p>
        <Link href="/portal/student" className="mt-3 inline-block text-sm text-[#FF8A1F] hover:underline">
          ← Back to Dashboard
        </Link>
      </div>
    )
  }

  const entries = await getGroupLeaderboard(groupId, studentId)

  const top3     = entries.slice(0, 3)
  const rest     = entries.slice(3)
  const selfEntry = entries.find(e => e.is_self)

  const medalColors: Record<number, string> = {
    1: 'bg-amber-100 text-amber-700 border-amber-200',
    2: 'bg-slate-100 text-slate-600 border-slate-200',
    3: 'bg-orange-100 text-orange-700 border-orange-200',
  }

  const medalEmojis: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' }

  return (
    <div className="mx-auto max-w-xl space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[15px] font-bold text-[#0B1F3A]">Group Leaderboard</h1>
          {groupName && (
            <p className="mt-0.5 text-[11px] text-[#64748B]">{groupName}</p>
          )}
        </div>
        <Link href="/portal/student" className="text-xs text-[#FF8A1F] hover:underline">← Dashboard</Link>
      </div>

      {/* Self rank callout */}
      {selfEntry && (
        <div className="flex items-center gap-3 rounded-xl border border-[#FF8A1F]/30 bg-[#FFF7ED] px-3.5 py-2.5">
          <span className="text-sm font-bold text-[#FF8A1F]">#{selfEntry.rank}</span>
          <div className="flex-1">
            <p className="text-[12.5px] font-semibold text-[#0B1F3A]">Your Position</p>
            <p className="text-[10px] text-[#64748B]">
              {selfEntry.total_xp.toLocaleString()} XP · Level {selfEntry.current_level}
            </p>
          </div>
          <span className="text-[10px] text-[#94A3B8]">out of {entries.length}</span>
        </div>
      )}

      {/* Top 3 podium */}
      {top3.length > 0 && (
        <div className="space-y-2">
          {top3.map((entry) => (
            <div
              key={entry.student_id}
              className={`flex items-center gap-3 rounded-xl border px-3.5 py-2.5 ${
                entry.is_self
                  ? 'border-[#FF8A1F]/40 bg-[#FFF7ED]'
                  : `border ${medalColors[entry.rank] ?? 'border-[#E2E8F0] bg-white'}`
              }`}
            >
              <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm border ${medalColors[entry.rank] ?? 'bg-[#F1F5F9] border-[#E2E8F0] text-[#64748B]'}`}>
                {medalEmojis[entry.rank] ?? `#${entry.rank}`}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[12.5px] font-semibold text-[#0B1F3A]">
                  {entry.student_name}
                  {entry.is_self && <span className="ml-1.5 text-[10px] font-normal text-[#FF8A1F]">(You)</span>}
                </p>
                <p className="text-[10px] text-[#64748B]">
                  {entry.total_xp.toLocaleString()} XP · Lv.{entry.current_level} · {entry.project_count} projects
                </p>
              </div>
              <span className="shrink-0 text-xs font-bold text-[#94A3B8]">#{entry.rank}</span>
            </div>
          ))}
        </div>
      )}

      {/* Rest of leaderboard */}
      {rest.length > 0 && (
        <div className="rounded-xl border border-[#E2E8F0] bg-white overflow-hidden">
          <div className="divide-y divide-[#F1F5F9]">
            {rest.map((entry) => (
              <div
                key={entry.student_id}
                className={`flex items-center gap-3 px-3.5 py-2.5 ${entry.is_self ? 'bg-[#FFF7ED]' : ''}`}
              >
                <span className="w-5 shrink-0 text-center text-[10px] font-semibold text-[#94A3B8]">#{entry.rank}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[12.5px] font-medium text-[#0B1F3A]">
                    {entry.student_name}
                    {entry.is_self && <span className="ml-1.5 text-[10px] font-normal text-[#FF8A1F]">(You)</span>}
                  </p>
                  <p className="text-[10px] text-[#64748B]">
                    {entry.total_xp.toLocaleString()} XP · Lv.{entry.current_level}
                  </p>
                </div>
                <span className="shrink-0 text-[10px] text-[#94A3B8]">{entry.project_count} proj.</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {entries.length === 0 && (
        <div className="rounded-xl border border-dashed border-[#E2E8F0] py-10 text-center">
          <p className="text-sm text-[#94A3B8]">No students in this group yet.</p>
        </div>
      )}

      {/* XP earning tips */}
      <div className="rounded-xl border border-[#E2E8F0] bg-white p-4">
        <p className="mb-2.5 text-sm font-semibold text-[#0B1F3A]">How to earn XP</p>
        <div className="space-y-1.5 text-[11px] text-[#64748B]">
          <div className="flex justify-between"><span>✅ Attend a session</span><span className="font-semibold text-[#0B1F3A]">+25 XP</span></div>
          <div className="flex justify-between"><span>📝 Submit an assignment</span><span className="font-semibold text-[#0B1F3A]">+40 XP</span></div>
          <div className="flex justify-between"><span>🌟 Excellent grade (90%+)</span><span className="font-semibold text-[#0B1F3A]">+60 XP</span></div>
          <div className="flex justify-between"><span>🎥 Share a project video</span><span className="font-semibold text-[#0B1F3A]">+150 XP</span></div>
          <div className="flex justify-between"><span>🖼 Add a portfolio project</span><span className="font-semibold text-[#0B1F3A]">+100 XP</span></div>
          <div className="flex justify-between"><span>📜 Earn a certificate</span><span className="font-semibold text-[#0B1F3A]">+200 XP</span></div>
        </div>
      </div>
    </div>
  )
}
