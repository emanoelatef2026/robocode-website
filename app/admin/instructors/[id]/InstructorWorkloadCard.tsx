import { createServiceClient }         from '@/lib/supabase/service'
import { getInstructorRatingSummary }   from '@/modules/feedback/queries'

interface WorkloadData {
  activeGroups:      number
  activeStudents:    number
  sessionsThisMonth: number
  attendancePct:     number | null
  avgRating:         number | null
  healthScore:       number
  alerts:            string[]
}

async function getInstructorWorkload(
  instructorId: string,
  userId:       string
): Promise<WorkloadData> {
  const db         = createServiceClient()
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()

  // Get group_course IDs for this instructor
  const [giRes, gcRes] = await Promise.all([
    db.from('group_instructors').select('group_id').eq('instructor_id', instructorId),
    db.from('group_courses').select('id, group_id').eq('instructor_id', instructorId).eq('status', 'active'),
  ])

  const giGroupIds = (giRes.data ?? []).map((r: any) => r.group_id as string)
  const gcRows     = (gcRes.data ?? []) as any[]
  const gcIds      = gcRows.map(r => r.id as string)
  const gcGroupIds = gcRows.map(r => r.group_id as string)
  const allGroupIds = [...new Set([...giGroupIds, ...gcGroupIds])]

  // Active groups
  let activeGroups = 0
  if (allGroupIds.length > 0) {
    const { count } = await db.from('groups')
      .select('id', { count: 'exact', head: true })
      .in('id', allGroupIds)
      .eq('status', 'active')
      .is('deleted_at', null)
    activeGroups = count ?? 0
  }

  // Active students across those groups
  let activeStudents = 0
  if (allGroupIds.length > 0) {
    const { count } = await db.from('group_students')
      .select('student_id', { count: 'exact', head: true })
      .in('group_id', allGroupIds)
      .eq('status', 'active')
    activeStudents = count ?? 0
  }

  // Sessions this month
  let sessionsThisMonth = 0
  if (gcIds.length > 0) {
    const { count } = await db.from('schedules')
      .select('id', { count: 'exact', head: true })
      .in('group_course_id', gcIds)
      .gte('scheduled_at', monthStart)
      .neq('status', 'cancelled')
    sessionsThisMonth = count ?? 0
  }

  // Attendance rate (sessions this month with recorded_by = this user)
  let attendancePct: number | null = null
  if (gcIds.length > 0) {
    const { data: schedRows } = await db.from('schedules')
      .select('id')
      .in('group_course_id', gcIds)
      .gte('scheduled_at', monthStart)
      .neq('status', 'cancelled')

    const schedIds = (schedRows ?? []).map((s: any) => s.id as string)
    if (schedIds.length > 0) {
      const { data: attRows } = await db.from('attendance_records')
        .select('status')
        .in('schedule_id', schedIds)

      const total   = (attRows ?? []).length
      const present = (attRows ?? []).filter(r => (r as any).status === 'present' || (r as any).status === 'late').length
      attendancePct = total > 0 ? Math.round((present / total) * 100) : null
    }
  }

  // Rating from student feedback
  const ratingSummary = await getInstructorRatingSummary(instructorId)
  const avgRating     = ratingSummary?.avg_overall ?? null

  // Health score (0–100)
  let score = 0
  if (activeGroups > 0)                              score += 25
  if (sessionsThisMonth > 0)                         score += 25
  if (attendancePct !== null && attendancePct >= 75) score += 25
  if (avgRating !== null && avgRating >= 3.5)        score += 25

  // Alerts
  const alerts: string[] = []
  if (activeGroups === 0)                              alerts.push('No active groups')
  if (sessionsThisMonth === 0 && activeGroups > 0)     alerts.push('No sessions recorded this month')
  if (attendancePct !== null && attendancePct < 70)    alerts.push('Low attendance rate')
  if (avgRating !== null && avgRating < 3)             alerts.push('Low student rating')

  return { activeGroups, activeStudents, sessionsThisMonth, attendancePct, avgRating, healthScore: score, alerts }
}

function ScorePill({ score }: { score: number }) {
  const cls =
    score >= 75 ? 'bg-[#E7F8EE] text-[#15803D]' :
    score >= 50 ? 'bg-[#FFFBEB] text-[#B45309]' :
                  'bg-[#FEE2E2] text-[#DC2626]'
  const label =
    score >= 75 ? 'Healthy' :
    score >= 50 ? 'Needs Attention' :
                  'Critical'
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${cls}`}>
      {score}/100 · {label}
    </span>
  )
}

interface Props {
  instructorId: string
  userId:       string
}

export default async function InstructorWorkloadCard({ instructorId, userId }: Props) {
  const w = await getInstructorWorkload(instructorId, userId)

  return (
    <div className="ds-card p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[#0B1F3A]">Workload & Performance</h3>
        <ScorePill score={w.healthScore} />
      </div>

      {/* KPI grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {[
          { label: 'Active Groups',        value: w.activeGroups },
          { label: 'Active Students',      value: w.activeStudents },
          { label: 'Sessions This Month',  value: w.sessionsThisMonth },
          { label: 'Attendance Rate',      value: w.attendancePct !== null ? `${w.attendancePct}%` : '—' },
          { label: 'Student Rating',       value: w.avgRating !== null ? `${w.avgRating}/5` : '—' },
        ].map(({ label, value }) => (
          <div key={label} className="rounded-lg bg-[#F8FAFC] px-3 py-2.5">
            <p className="text-lg font-bold text-[#0B1F3A]">{value}</p>
            <p className="text-[11px] text-[#64748B]">{label}</p>
          </div>
        ))}
      </div>

      {/* Alerts */}
      {w.alerts.length > 0 && (
        <div className="mt-4 space-y-1.5">
          {w.alerts.map(alert => (
            <div key={alert} className="flex items-center gap-2 rounded-lg bg-[#FFFBEB] px-3 py-2 text-xs font-medium text-[#B45309]">
              <svg viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5 shrink-0">
                <path d="M8.982 1.566a1.13 1.13 0 00-1.96 0L.165 13.233c-.457.778.091 1.767.98 1.767h13.713c.889 0 1.438-.99.98-1.767L8.982 1.566zM8 5c.535 0 .954.462.9.995l-.35 3.507a.552.552 0 01-1.1 0L7.1 5.995A.905.905 0 018 5zm.002 6a1 1 0 110 2 1 1 0 010-2z" />
              </svg>
              {alert}
            </div>
          ))}
        </div>
      )}

      {w.alerts.length === 0 && (
        <div className="mt-4 rounded-lg bg-[#E7F8EE] px-3 py-2 text-xs font-medium text-[#15803D]">
          All performance indicators are healthy.
        </div>
      )}
    </div>
  )
}
