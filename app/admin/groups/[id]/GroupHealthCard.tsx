/**
 * Group Health Card
 * 0–100 score with color-coded status and per-criterion breakdown.
 * Shows exact reasons for score deductions.
 */

import { createServiceClient }        from '@/lib/supabase/service'
import { getInstructorRatingSummary } from '@/modules/feedback/queries'
import Link                           from 'next/link'

// ── Types ─────────────────────────────────────────────────────────────────────

type HealthStatus = 'green' | 'yellow' | 'red'

interface HealthFactor {
  label:   string
  passed:  boolean
  points:  number
  earned:  number
  reason?: string
}

interface GroupHealthResult {
  score:    number
  status:   HealthStatus
  factors:  HealthFactor[]
  // Raw data
  hasInstructor:   boolean
  hasCourse:       boolean
  studentCount:    number
  capacity:        number | null
  attendanceRate:  number | null
  lastSessionDays: number | null
  certReadyCount:  number
  certTotalCount:  number
  avgRating:       number | null
}

function statusLabel(status: HealthStatus) {
  return status === 'green' ? 'Healthy' : status === 'yellow' ? 'Needs Attention' : 'Critical'
}
function statusColor(status: HealthStatus) {
  return {
    green:  { badge: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-500', ring: 'text-emerald-600' },
    yellow: { badge: 'bg-amber-100 text-amber-700',     dot: 'bg-amber-500',   ring: 'text-amber-600'  },
    red:    { badge: 'bg-red-100 text-red-700',         dot: 'bg-red-500',     ring: 'text-red-600'    },
  }[status]
}

// ── Data fetcher ──────────────────────────────────────────────────────────────

async function computeGroupHealth(
  groupId:  string,
  capacity: number | null
): Promise<GroupHealthResult> {
  const db          = createServiceClient()
  const thirtyDays  = new Date(Date.now() - 30 * 86400000).toISOString()
  const fourteenDays = new Date(Date.now() - 14 * 86400000).toISOString()

  const [giRes, gcRes, gsRes] = await Promise.all([
    db.from('group_instructors').select('instructor_id').eq('group_id', groupId).limit(1),
    db.from('group_courses').select('id, course_id, instructor_id').eq('group_id', groupId).eq('status', 'active').maybeSingle(),
    db.from('group_students').select('student_id', { count: 'exact' }).eq('group_id', groupId).eq('status', 'active'),
  ])

  const hasInstructor = (giRes.data?.length ?? 0) > 0 || !!(gcRes.data as any)?.instructor_id
  const hasCourse     = !!gcRes.data
  const gcRow         = gcRes.data as any
  const studentCount  = gsRes.count ?? 0

  let attendanceRate: number | null  = null
  let lastSessionDays: number | null = null
  let certReadyCount  = 0
  let certTotalCount  = 0
  let avgRating: number | null = null

  if (gcRow?.id) {
    // Sessions last 30 days
    const { data: recentScheds } = await db.from('schedules')
      .select('id, scheduled_at')
      .eq('group_course_id', gcRow.id)
      .gte('scheduled_at', thirtyDays)
      .neq('status', 'cancelled')
      .lte('scheduled_at', new Date().toISOString())
      .order('scheduled_at', { ascending: false })

    const schedRows = (recentScheds ?? []) as any[]

    if (schedRows.length > 0) {
      // Last session age
      const latestDate = new Date(schedRows[0].scheduled_at)
      lastSessionDays = Math.floor((Date.now() - latestDate.getTime()) / 86400000)

      // Attendance rate
      const schedIds = schedRows.map(s => s.id as string)
      const { data: attRows } = await db.from('attendance_records').select('status').in('schedule_id', schedIds)
      const total   = (attRows ?? []).length
      const present = (attRows ?? []).filter(r => (r as any).status === 'present' || (r as any).status === 'late').length
      attendanceRate = total > 0 ? Math.round((present / total) * 100) : null
    }

    // Certificate readiness (from student_course_progress)
    const studentIds = ((gsRes.data ?? []) as any[]).map(r => r.student_id as string)
    if (studentIds.length > 0 && gcRow.course_id) {
      const { data: progRows } = await db.from('student_course_progress')
        .select('completion_percentage, attendance_score')
        .in('student_id', studentIds)
        .eq('course_id', gcRow.course_id)
      const rows = (progRows ?? []) as any[]
      certTotalCount = rows.length
      certReadyCount = rows.filter(r =>
        Number(r.completion_percentage) >= 70 && Number(r.attendance_score) >= 75
      ).length
    }

    // Instructor rating
    if (gcRow.instructor_id) {
      const rating = await getInstructorRatingSummary(gcRow.instructor_id)
      avgRating = rating?.avg_overall ?? null
    }
  }

  // ── Score engine ──────────────────────────────────────────────────────────
  const factors: HealthFactor[] = [
    {
      label:   'Instructor assigned',
      passed:  hasInstructor,
      points:  25,
      earned:  hasInstructor ? 25 : 0,
      reason:  hasInstructor ? undefined : 'No instructor assigned — group cannot become active',
    },
    {
      label:   'Active course',
      passed:  hasCourse,
      points:  20,
      earned:  hasCourse ? 20 : 0,
      reason:  hasCourse ? undefined : 'No active course — sessions cannot be scheduled',
    },
    {
      label:   'Has enrolled students',
      passed:  studentCount > 0,
      points:  10,
      earned:  studentCount > 0 ? 10 : 0,
      reason:  studentCount === 0 ? 'No students enrolled' : undefined,
    },
    {
      label:   'Session in last 14 days',
      passed:  lastSessionDays !== null && lastSessionDays <= 14,
      points:  15,
      earned:  lastSessionDays !== null && lastSessionDays <= 14 ? 15
             : lastSessionDays !== null && lastSessionDays <= 30 ? 7 : 0,
      reason:  lastSessionDays === null
        ? 'No sessions recorded yet'
        : lastSessionDays > 14 ? `Last session was ${lastSessionDays} days ago` : undefined,
    },
    {
      label:   `Attendance ≥ 75%${attendanceRate !== null ? ` (${attendanceRate}%)` : ''}`,
      passed:  attendanceRate !== null && attendanceRate >= 75,
      points:  20,
      earned:  attendanceRate === null ? 0
             : attendanceRate >= 75 ? 20
             : attendanceRate >= 60 ? 10 : 0,
      reason:  attendanceRate === null ? 'No attendance data'
             : attendanceRate < 75 ? `Attendance rate is ${attendanceRate}% (target: 75%)` : undefined,
    },
    {
      label:   `Rating ≥ 3.5${avgRating !== null ? ` (${avgRating}/5)` : ''}`,
      passed:  avgRating !== null && avgRating >= 3.5,
      points:  10,
      earned:  avgRating === null ? 0 : avgRating >= 3.5 ? 10 : avgRating >= 3 ? 5 : 0,
      reason:  avgRating === null ? 'No student ratings yet'
             : avgRating < 3.5 ? `Student rating ${avgRating}/5 (target: 3.5)` : undefined,
    },
  ]

  const score  = factors.reduce((sum, f) => sum + f.earned, 0)
  const status: HealthStatus = score >= 75 ? 'green' : score >= 50 ? 'yellow' : 'red'

  return {
    score, status, factors,
    hasInstructor, hasCourse, studentCount, capacity,
    attendanceRate, lastSessionDays,
    certReadyCount, certTotalCount, avgRating,
  }
}

// ── Components ────────────────────────────────────────────────────────────────

function FactorRow({ factor }: { factor: HealthFactor }) {
  const pct = Math.round((factor.earned / factor.points) * 100)
  return (
    <div className={`flex items-start gap-2.5 rounded-lg px-3 py-2.5 ${factor.passed ? 'bg-emerald-50' : pct > 0 ? 'bg-amber-50' : 'bg-red-50'}`}>
      <span className={`mt-0.5 text-sm font-bold ${factor.passed ? 'text-emerald-500' : pct > 0 ? 'text-amber-500' : 'text-red-500'}`}>
        {factor.passed ? '✓' : pct > 0 ? '~' : '✗'}
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <p className={`text-xs font-medium ${factor.passed ? 'text-emerald-700' : pct > 0 ? 'text-amber-700' : 'text-red-700'}`}>
            {factor.label}
          </p>
          <span className="text-[11px] font-semibold text-[#64748B] shrink-0">
            {factor.earned}/{factor.points}
          </span>
        </div>
        {factor.reason && (
          <p className="mt-0.5 text-[11px] text-[#94A3B8]">{factor.reason}</p>
        )}
      </div>
    </div>
  )
}

// ── Export ────────────────────────────────────────────────────────────────────

interface Props {
  groupId:  string
  capacity: number | null
}

export default async function GroupHealthCard({ groupId, capacity }: Props) {
  const h = await computeGroupHealth(groupId, capacity)
  const c = statusColor(h.status)

  const fillPct = h.capacity
    ? Math.min(100, Math.round((h.studentCount / h.capacity) * 100))
    : null

  const failedFactors = h.factors.filter(f => !f.passed && f.earned < f.points)

  return (
    <div className="rounded-xl border border-[#E2E8F0] bg-white p-5">
      {/* ── Header ──────────────────────────────────────────────────── */}
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-[#0B1F3A]">Group Health</h3>
          <span className={`mt-1 inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${c.badge}`}>
            {statusLabel(h.status)}
          </span>
        </div>
        <div className="text-right shrink-0">
          <p className={`text-3xl font-bold ${c.ring}`}>{h.score}</p>
          <p className="text-[11px] text-[#94A3B8]">/ 100</p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="mb-4 h-2 rounded-full bg-[#F1F5F9]">
        <div
          className={`h-2 rounded-full transition-all ${h.status === 'green' ? 'bg-emerald-500' : h.status === 'yellow' ? 'bg-amber-500' : 'bg-red-500'}`}
          style={{ width: `${h.score}%` }}
        />
      </div>

      {/* ── Factors ─────────────────────────────────────────────────── */}
      <div className="space-y-1.5">
        {h.factors.map(f => <FactorRow key={f.label} factor={f} />)}
      </div>

      {/* ── Capacity bar ────────────────────────────────────────────── */}
      {h.capacity !== null && (
        <div className="mt-4 border-t border-[#E2E8F0] pt-3">
          <div className="flex justify-between text-[11px] text-[#64748B] mb-1">
            <span>Enrollment</span>
            <span>{h.studentCount} / {h.capacity} ({fillPct}%)</span>
          </div>
          <div className="h-1.5 rounded-full bg-[#F1F5F9]">
            <div
              className={`h-1.5 rounded-full ${(fillPct ?? 0) >= 90 ? 'bg-emerald-400' : (fillPct ?? 0) >= 50 ? 'bg-[#FF8A1F]' : 'bg-slate-300'}`}
              style={{ width: `${fillPct ?? 0}%` }}
            />
          </div>
        </div>
      )}

      {/* ── Cert readiness ──────────────────────────────────────────── */}
      {h.certTotalCount > 0 && (
        <div className="mt-3 border-t border-[#E2E8F0] pt-3">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-[#94A3B8]">Cert Readiness</p>
          <div className="mt-1 flex items-center gap-2">
            <div className="flex-1 h-1.5 rounded-full bg-[#F1F5F9]">
              <div
                className="h-1.5 rounded-full bg-sky-400"
                style={{ width: `${Math.round((h.certReadyCount / h.certTotalCount) * 100)}%` }}
              />
            </div>
            <span className="text-xs font-medium text-[#0B1F3A]">
              {h.certReadyCount}/{h.certTotalCount}
            </span>
          </div>
        </div>
      )}

      {/* ── All clear message ────────────────────────────────────────── */}
      {failedFactors.length === 0 && (
        <div className="mt-4 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700">
          All health indicators are passing.
        </div>
      )}
    </div>
  )
}
