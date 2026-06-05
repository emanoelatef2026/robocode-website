import { requirePortalRole }     from '@/modules/rbac/guards'
import {
  getTLKPIs,
  getTodaysClasses,
  getTodayAttendanceSummary,
  getWorkQueues,
}                                 from '@/modules/tl-dashboard/queries'
import { getTLMessageCounts }    from '@/modules/parent-messages/queries'
import { getDashboardFinanceSummary } from '@/modules/finance/queries'
import { getOpenTasks, getTaskCounts } from '@/modules/tasks/queries'
import { TASK_TYPE_CONFIG, TASK_SEVERITY_CONFIG } from '@/modules/tasks/types'
import Link                       from 'next/link'

function fmt(n: number) {
  return new Intl.NumberFormat('en-EG', { maximumFractionDigits: 0 }).format(n)
}

// ── Work Queue Row ─────────────────────────────────────────────────────────────

function QueueRow({
  name, code, value, sub, phone, href, groupName,
}: {
  name: string; code: string | null; value: string; sub: string | null
  phone: string | null; href: string; groupName: string | null
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 hover:bg-[#F8FAFC] border-b border-[#F1F5F9] last:border-0">
      <div className="min-w-0 flex-1">
        <Link href={href} className="block text-[13px] font-medium text-[#0B1F3A] hover:text-[#FF8A1F] leading-tight">
          {name}
        </Link>
        <p className="text-[11px] text-[#94A3B8] truncate">
          {[code && `#${code}`, groupName].filter(Boolean).join(' · ')}
        </p>
      </div>
      <div className="shrink-0 text-right">
        <p className="text-[13px] font-semibold text-[#0B1F3A]">{value}</p>
        {sub && <p className="text-[10px] text-[#94A3B8]">{sub}</p>}
      </div>
      {phone && (
        <a
          href={`https://wa.me/${phone.replace(/\D/g, '')}`}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-1 text-[10px] font-semibold text-emerald-600 hover:bg-emerald-100"
        >
          WA
        </a>
      )}
    </div>
  )
}

// ── Work Queue Card ────────────────────────────────────────────────────────────

function WorkQueue({
  title, count, items, viewHref, emptyText, accent = 'border-[#E2E8F0]',
}: {
  title: string; count: number
  items: { student_id: string; student_name: string; student_code: string | null; group_name: string | null; parent_phone_1: string | null; value: string; sub: string | null; href: string }[]
  viewHref?: string
  emptyText: string
  accent?: string
}) {
  return (
    <div className={`rounded-xl border bg-white overflow-hidden ${accent}`}>
      <div className={`flex items-center justify-between px-4 py-3 border-b ${accent}`}>
        <div className="flex items-center gap-2">
          <p className="text-[13px] font-semibold text-[#0B1F3A]">{title}</p>
          {count > 0 && (
            <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-[#FF8A1F] px-1.5 text-[10px] font-bold text-white">
              {count}
            </span>
          )}
        </div>
        {viewHref && count > 0 && (
          <Link href={viewHref} className="text-[11px] font-medium text-[#FF8A1F] hover:underline">
            View all →
          </Link>
        )}
      </div>
      {items.length === 0 ? (
        <p className="px-4 py-6 text-center text-[12px] text-[#94A3B8]">{emptyText}</p>
      ) : (
        <div>
          {items.map(item => (
            <QueueRow
              key={item.student_id + item.value}
              name={item.student_name}
              code={item.student_code}
              value={item.value}
              sub={item.sub}
              phone={item.parent_phone_1}
              href={item.href}
              groupName={item.group_name}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default async function TLDashboardPage() {
  const user = await requirePortalRole('team_leader')

  if (!user.branchIds.length) {
    return (
      <div className="flex h-64 items-center justify-center text-[#64748B]">
        No branch assigned. Contact a super admin.
      </div>
    )
  }

  const branchIds = user.branchIds

  const [kpis, todaysClasses, todayAtt, msgCounts, finSummary, queues, openTasks, taskCounts] = await Promise.all([
    getTLKPIs(branchIds),
    getTodaysClasses(branchIds),
    getTodayAttendanceSummary(branchIds),
    getTLMessageCounts(branchIds),
    getDashboardFinanceSummary(branchIds),
    getWorkQueues(branchIds),
    getOpenTasks(branchIds, { limit: 10 }),
    getTaskCounts(branchIds),
  ])

  const totalWorkItems =
    queues.collect_today.length +
    queues.renew_urgent.length +
    queues.attendance_risks.length +
    queues.inactive_students.length +
    taskCounts.total

  return (
    <div className="space-y-6">

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-[#0B1F3A]">Operations Command Center</h1>
          <p className="mt-0.5 text-sm text-[#64748B]">
            {todaysClasses.length > 0 ? `${todaysClasses.length} class${todaysClasses.length !== 1 ? 'es' : ''} today` : 'No classes today'}
            {' · '}
            {totalWorkItems > 0 ? `${totalWorkItems} items need attention` : 'All clear'}
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/portal/team-leader/students/new" className="rounded-lg border border-[#E2E8F0] px-3 py-2 text-[12px] font-medium text-[#64748B] hover:border-[#FF8A1F] hover:text-[#FF8A1F]">
            + Student
          </Link>
          <Link href="/portal/team-leader/finance" className="rounded-lg bg-[#FF8A1F] px-3 py-2 text-[12px] font-medium text-white hover:bg-[#e87c18]">
            Enroll / Collect
          </Link>
        </div>
      </div>

      {/* ── Finance KPI Strip ────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
        {[
          { label: 'Collected Today',  value: `EGP ${fmt(finSummary.collected_today)}`,      badge: null },
          { label: 'This Month',       value: `EGP ${fmt(finSummary.collected_this_month)}`,  badge: null },
          { label: 'Outstanding',      value: `EGP ${fmt(finSummary.outstanding)}`,           badge: null },
          { label: 'Collection Rate',  value: `${finSummary.collection_rate}%`,               badge: finSummary.collection_rate < 80 ? 'low' : null },
          { label: 'Overdue',          value: String(finSummary.overdue_count),               badge: finSummary.overdue_count > 0 ? 'alert' : null },
          { label: 'Due This Week',    value: String(finSummary.due_this_week),               badge: null },
          { label: 'Open Messages',    value: String(msgCounts.open),                          badge: msgCounts.open > 0 ? 'alert' : null },
        ].map(k => (
          <div key={k.label} className={`rounded-xl border bg-white p-3 ${k.badge === 'alert' ? 'border-red-200' : 'border-[#E2E8F0]'}`}>
            <p className="text-lg font-bold text-[#0B1F3A]">{k.value}</p>
            <p className="text-[11px] text-[#64748B]">{k.label}</p>
          </div>
        ))}
      </div>

      {/* ── Today's Attendance ───────────────────────────────────────────── */}
      {(todayAtt.present + todayAtt.absent + todayAtt.late) > 0 && (
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Present Today', value: todayAtt.present, cls: 'border-emerald-200 bg-emerald-50 text-emerald-700' },
            { label: 'Absent Today',  value: todayAtt.absent,  cls: 'border-red-200 bg-red-50 text-red-700' },
            { label: 'Late Today',    value: todayAtt.late,    cls: 'border-amber-200 bg-amber-50 text-amber-700' },
          ].map(k => (
            <div key={k.label} className={`rounded-xl border px-4 py-3 text-center ${k.cls}`}>
              <p className="text-2xl font-bold">{k.value}</p>
              <p className="text-[11px] font-medium">{k.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* ── 8 Work Queues ────────────────────────────────────────────────── */}
      <div>
        <h2 className="mb-3 text-[15px] font-semibold text-[#0B1F3A]">Work Queues</h2>
        <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">

          {/* 1. Collect Today */}
          <WorkQueue
            title="💰 Collect Today"
            count={queues.collect_today.length}
            items={queues.collect_today}
            viewHref="/portal/team-leader/finance"
            emptyText="No overdue or due-today payments"
            accent={queues.collect_today.length > 0 ? 'border-red-200' : 'border-[#E2E8F0]'}
          />

          {/* 2. Renew Today (urgent) */}
          <WorkQueue
            title="🔄 Renew Now"
            count={queues.renew_urgent.length}
            items={queues.renew_urgent}
            viewHref="/portal/team-leader/students?att=exhausted"
            emptyText="No contracts at 0–2 sessions remaining"
            accent={queues.renew_urgent.length > 0 ? 'border-amber-200' : 'border-[#E2E8F0]'}
          />

          {/* 3. Attendance Risks */}
          <WorkQueue
            title="⚠️ Attendance Risks"
            count={queues.attendance_risks.length}
            items={queues.attendance_risks}
            viewHref="/portal/team-leader/attendance?att=chronic"
            emptyText="No students with 3+ consecutive absences"
            accent={queues.attendance_risks.length > 0 ? 'border-orange-200' : 'border-[#E2E8F0]'}
          />

          {/* 4. Parent Escalations */}
          <WorkQueue
            title="💬 Parent Escalations"
            count={msgCounts.open}
            items={[]}
            viewHref="/portal/team-leader/parent-feedback?tab=messages&status=submitted"
            emptyText="No unresolved parent messages"
            accent={msgCounts.open > 0 ? 'border-blue-200' : 'border-[#E2E8F0]'}
          />

          {/* 5. Contracts Near Exhaustion */}
          <WorkQueue
            title="⏳ Near Exhaustion"
            count={queues.contracts_near_exhaustion.length}
            items={queues.contracts_near_exhaustion}
            viewHref="/portal/team-leader/students"
            emptyText="No contracts at 3–5 sessions remaining"
          />

          {/* 6. Inactive Students */}
          <WorkQueue
            title="😴 Inactive Students"
            count={queues.inactive_students.length}
            items={queues.inactive_students}
            viewHref="/portal/team-leader/attendance?att=never"
            emptyText="No students inactive for 14+ days"
            accent={queues.inactive_students.length > 0 ? 'border-slate-300' : 'border-[#E2E8F0]'}
          />

          {/* 7. Students Missing Groups */}
          <WorkQueue
            title="📦 Missing Groups"
            count={queues.students_missing_groups.length}
            items={queues.students_missing_groups}
            viewHref="/portal/team-leader/students"
            emptyText="All active contracts have delivery groups"
          />

          {/* 8. Today's Classes */}
          <div className="rounded-xl border border-[#E2E8F0] bg-white overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-[#E2E8F0]">
              <div className="flex items-center gap-2">
                <p className="text-[13px] font-semibold text-[#0B1F3A]">📚 Today&apos;s Classes</p>
                {todaysClasses.length > 0 && (
                  <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-blue-500 px-1.5 text-[10px] font-bold text-white">
                    {todaysClasses.length}
                  </span>
                )}
              </div>
              <Link href="/portal/team-leader/attendance/record" className="text-[11px] font-medium text-[#FF8A1F] hover:underline">
                Record →
              </Link>
            </div>
            {todaysClasses.length === 0 ? (
              <p className="px-4 py-6 text-center text-[12px] text-[#94A3B8]">No classes scheduled today</p>
            ) : (
              <div>
                {todaysClasses.map(cls => (
                  <div key={cls.schedule_id} className="flex items-center justify-between gap-3 px-4 py-3 border-b border-[#F1F5F9] last:border-0">
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-medium text-[#0B1F3A]">{cls.group_name}</p>
                      <p className="truncate text-[11px] text-[#94A3B8]">
                        {cls.course_title}{cls.instructor_name && ` · ${cls.instructor_name}`}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-[13px] font-medium text-[#0B1F3A]">
                        {new Date(cls.scheduled_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                      <p className="text-[11px] text-[#94A3B8]">{cls.student_count} students</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      </div>

      {/* ── Operational Tasks Queue (Sprint 51) ─────────────────────────── */}
      {(taskCounts.total > 0 || openTasks.length > 0) && (
        <div>
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h2 className="text-[15px] font-semibold text-[#0B1F3A]">Operational Tasks</h2>
              {taskCounts.total > 0 && (
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-[#FF8A1F] px-1.5 text-[10px] font-bold text-white">
                  {taskCounts.total}
                </span>
              )}
              {taskCounts.critical > 0 && (
                <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-700">
                  {taskCounts.critical} critical
                </span>
              )}
            </div>
          </div>
          <div className="rounded-xl border border-[#E2E8F0] bg-white overflow-hidden">
            {openTasks.length === 0 ? (
              <p className="px-4 py-6 text-center text-[12px] text-[#94A3B8]">No open tasks. All clear!</p>
            ) : (
              <div>
                {openTasks.map(task => {
                  const typeConf = TASK_TYPE_CONFIG[task.type]
                  const sevConf  = TASK_SEVERITY_CONFIG[task.severity]
                  return (
                    <div key={task.id} className="flex items-center gap-3 border-b border-[#F1F5F9] px-4 py-3 last:border-0 hover:bg-[#F8FAFC]">
                      <span className="text-lg">{typeConf.icon}</span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${typeConf.color} ${typeConf.text}`}>
                            {typeConf.label}
                          </span>
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${sevConf.color} ${sevConf.text}`}>
                            {task.severity}
                          </span>
                        </div>
                        <p className="mt-0.5 text-[13px] font-medium text-[#0B1F3A]">
                          {task.student_name ?? 'Unknown Student'}
                          {task.student_code && <span className="ml-1 font-mono text-[11px] text-[#94A3B8]">#{task.student_code}</span>}
                        </p>
                        {task.notes && (
                          <p className="text-[11px] text-[#64748B] truncate">{task.notes}</p>
                        )}
                      </div>
                      {task.due_date && (
                        <span className={`shrink-0 text-[11px] font-medium ${new Date(task.due_date) < new Date() ? 'text-red-500' : 'text-[#94A3B8]'}`}>
                          {new Date(task.due_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                        </span>
                      )}
                      {task.student_id && (
                        <Link href={`/portal/team-leader/students/${task.student_id}`} className="shrink-0 rounded-lg border border-[#E2E8F0] px-2.5 py-1 text-[11px] font-medium text-[#64748B] hover:border-[#FF8A1F] hover:text-[#FF8A1F]">
                          View
                        </Link>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Academic KPIs ────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'Active Students',    value: String(kpis.active_students),           href: '/portal/team-leader/students' },
          { label: 'Monthly Attendance', value: `${kpis.monthly_attendance_pct}%`,      href: '/portal/team-leader/attendance' },
          { label: 'Homework Rate',      value: `${kpis.homework_completion_pct}%`,     href: '/portal/team-leader/assignments' },
          { label: 'Satisfaction',       value: kpis.parent_satisfaction_avg != null ? `${kpis.parent_satisfaction_avg}★` : '—', href: '/portal/team-leader/parent-feedback' },
        ].map(k => (
          <Link key={k.label} href={k.href} className="rounded-xl border border-[#E2E8F0] bg-white p-4 transition hover:border-[#CBD5E1]">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-[#94A3B8]">{k.label}</p>
            <p className="mt-1 text-2xl font-bold text-[#0B1F3A]">{k.value}</p>
          </Link>
        ))}
      </div>

    </div>
  )
}
