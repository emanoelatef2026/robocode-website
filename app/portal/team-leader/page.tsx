import { Suspense }              from 'react'
import Link                       from 'next/link'
import { requirePortalRole }      from '@/modules/rbac/guards'
import { getTLKPIs, getTodayAttendanceSummary, getWorkQueues } from '@/modules/tl-dashboard/queries'
import { getDashboardFinanceSummary }  from '@/modules/finance/queries'
import { getTLMessageCounts }     from '@/modules/parent-messages/queries'
import { SkeletonCard }           from './_components/DashCard'
import TodayActionCenter          from './_sections/TodayActionCenter'
import GroupHealthBoard           from './_sections/GroupHealthBoard'
import InstructorHealthBoard      from './_sections/InstructorHealthBoard'
import FinanceCenter              from './_sections/FinanceCenter'
import StudentRiskBoard           from './_sections/StudentRiskBoard'
import ParentEscalation           from './_sections/ParentEscalation'
import AcademicQuality            from './_sections/AcademicQuality'
import QuickActionDock            from './_sections/QuickActionDock'

// ─── Skeleton placeholders ────────────────────────────────────────────────────

function SectionSkeleton({ title, rows = 3 }: { title: string; rows?: number }) {
  return (
    <div className="space-y-3">
      <div className="h-5 w-40 rounded-full bg-[#F1F5F9] animate-pulse" />
      <SkeletonCard />
    </div>
  )
}

function AttendanceSummarySkeleton() {
  return (
    <div className="grid grid-cols-3 gap-3">
      {[1, 2, 3].map(i => (
        <div key={i} className="h-20 rounded-2xl bg-[#F1F5F9] animate-pulse" />
      ))}
    </div>
  )
}

// ─── Attendance summary (small server component) ──────────────────────────────

async function AttendanceSummary({ branchIds }: { branchIds: string[] }) {
  const att = await getTodayAttendanceSummary(branchIds)
  const total = att.present + att.absent + att.late
  if (!total) return null

  return (
    <div className="grid grid-cols-3 gap-3">
      {[
        { label: 'Present Today', value: att.present, cls: 'border-emerald-200 bg-emerald-50 text-emerald-700' },
        { label: 'Absent Today',  value: att.absent,  cls: 'border-red-200 bg-red-50 text-red-700' },
        { label: 'Late Today',    value: att.late,    cls: 'border-amber-200 bg-amber-50 text-amber-700' },
      ].map(k => (
        <div key={k.label} className={`rounded-2xl border px-4 py-3 text-center ${k.cls}`}>
          <p className="text-2xl font-extrabold">{k.value}</p>
          <p className="mt-0.5 text-[11px] font-medium">{k.label}</p>
        </div>
      ))}
    </div>
  )
}

// ─── Finance KPI strip (small server component) ───────────────────────────────

async function FinanceKPIStrip({ branchIds }: { branchIds: string[] }) {
  const [fin, msgs] = await Promise.all([
    getDashboardFinanceSummary(branchIds),
    getTLMessageCounts(branchIds),
  ])

  function fmt(n: number) {
    return new Intl.NumberFormat('en-EG', { maximumFractionDigits: 0 }).format(n)
  }

  const tiles = [
    { label: 'Collected Today',  value: `EGP ${fmt(fin.collected_today)}`,     alert: false },
    { label: 'This Month',       value: `EGP ${fmt(fin.collected_this_month)}`, alert: false },
    { label: 'Outstanding',      value: `EGP ${fmt(fin.outstanding)}`,          alert: false },
    { label: 'Collection Rate',  value: `${fin.collection_rate}%`,              alert: fin.collection_rate < 70 },
    { label: 'Overdue Accounts', value: String(fin.overdue_count),              alert: fin.overdue_count > 0 },
    { label: 'Due This Week',    value: String(fin.due_this_week),              alert: false },
    { label: 'Open Messages',    value: String(msgs.open),                      alert: msgs.open > 0 },
  ]

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
      {tiles.map(t => (
        <div key={t.label} className={`rounded-2xl border bg-white p-3.5 ${t.alert ? 'border-red-200' : 'border-[#E2E8F0]'}`}>
          <p className={`text-[18px] font-extrabold leading-none ${t.alert ? 'text-red-600' : 'text-[#0B1F3A]'}`}>{t.value}</p>
          <p className="mt-1 text-[10px] font-medium text-[#64748B]">{t.label}</p>
        </div>
      ))}
    </div>
  )
}

// ─── Section nav (sticky jump links) ─────────────────────────────────────────

function SectionNav() {
  const sections = [
    { href: '#today',         label: 'Today'       },
    { href: '#group-health',  label: 'Groups'      },
    { href: '#finance',       label: 'Finance'     },
    { href: '#student-risk',  label: 'Risk'        },
    { href: '#instructor-health', label: 'Instructors' },
    { href: '#academic',      label: 'Academic'    },
    { href: '#parent-escalation', label: 'Parents' },
  ]

  return (
    <div className="flex overflow-x-auto gap-1.5 pb-0.5 no-scrollbar">
      {sections.map(s => (
        <a
          key={s.href}
          href={s.href}
          className="shrink-0 rounded-full border border-[#E2E8F0] bg-white px-3 py-1.5 text-[11px] font-medium text-[#64748B] hover:border-[#CBD5E1] hover:text-[#0B1F3A] transition"
        >
          {s.label}
        </a>
      ))}
    </div>
  )
}

// ─── Summary header KPIs ──────────────────────────────────────────────────────

async function HeaderKPIs({ branchIds }: { branchIds: string[] }) {
  const kpis = await getTLKPIs(branchIds)
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {[
        { label: 'Active Students',    value: String(kpis.active_students),           href: '/portal/team-leader/students' },
        { label: 'Monthly Attendance', value: `${kpis.monthly_attendance_pct}%`,      href: '/portal/team-leader/attendance' },
        { label: 'Homework Rate',      value: `${kpis.homework_completion_pct}%`,     href: '/portal/team-leader/assignments' },
        { label: 'Satisfaction',       value: kpis.parent_satisfaction_avg != null ? `${kpis.parent_satisfaction_avg}★` : '—', href: '/portal/team-leader/parent-feedback' },
      ].map(k => (
        <Link
          key={k.label}
          href={k.href}
          className="rounded-2xl border border-[#E2E8F0] bg-white p-4 transition hover:border-[#CBD5E1] hover:shadow-sm"
        >
          <p className="text-[10px] font-bold uppercase tracking-wide text-[#94A3B8]">{k.label}</p>
          <p className="mt-1 text-[24px] font-extrabold leading-none text-[#0B1F3A]">{k.value}</p>
        </Link>
      ))}
    </div>
  )
}

// ─── Skeleton placeholders for lazy sections ─────────────────────────────────

function GroupBoardSkeleton() {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <div className="h-5 w-36 rounded-full bg-[#F1F5F9] animate-pulse" />
        <div className="h-5 w-20 rounded-full bg-[#F1F5F9] animate-pulse" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-48 rounded-2xl border border-[#E2E8F0] bg-white animate-pulse" />
        ))}
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function TLDashboardPage() {
  const user = await requirePortalRole('team_leader')

  if (!user.branchIds.length) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-center">
          <p className="text-[15px] font-semibold text-[#0B1F3A]">No branch assigned</p>
          <p className="mt-1 text-[13px] text-[#64748B]">Contact a super admin to assign you to a branch.</p>
        </div>
      </div>
    )
  }

  const branchIds = user.branchIds

  return (
    <div className="space-y-8 pb-32 md:pb-8">

      {/* ── Page header ──────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-[20px] font-extrabold tracking-tight text-[#0B1F3A]">
            Operations Center
          </h1>
          <p className="mt-0.5 text-[13px] text-[#64748B]">
            {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Link
            href="/portal/team-leader/students/new"
            className="rounded-xl border border-[#E2E8F0] px-3 py-2 text-[12px] font-medium text-[#64748B] hover:border-[#FF8A1F] hover:text-[#FF8A1F] transition"
          >
            + Student
          </Link>
          <Link
            href="/portal/team-leader/finance"
            className="rounded-xl bg-[#FF8A1F] px-3 py-2 text-[12px] font-semibold text-white hover:bg-[#e87c18] transition"
          >
            Enroll / Collect
          </Link>
        </div>
      </div>

      {/* ── Section navigation (jump links) ─────────────────────────── */}
      <SectionNav />

      {/* ── Finance KPI strip ────────────────────────────────────────── */}
      <Suspense
        fallback={
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
            {[1, 2, 3, 4, 5, 6, 7].map(i => (
              <div key={i} className="h-16 rounded-2xl bg-[#F1F5F9] animate-pulse" />
            ))}
          </div>
        }
      >
        <FinanceKPIStrip branchIds={branchIds} />
      </Suspense>

      {/* ── Today's Attendance ────────────────────────────────────────── */}
      <Suspense fallback={<AttendanceSummarySkeleton />}>
        <AttendanceSummary branchIds={branchIds} />
      </Suspense>

      {/* ── Header KPIs ──────────────────────────────────────────────── */}
      <Suspense
        fallback={
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-24 rounded-2xl bg-[#F1F5F9] animate-pulse" />
            ))}
          </div>
        }
      >
        <HeaderKPIs branchIds={branchIds} />
      </Suspense>

      {/* ══ SECTION 1: TODAY ACTION CENTER ══════════════════════════════ */}
      <section id="today">
        <div className="mb-4 flex items-center gap-2">
          <h2 className="text-[16px] font-bold text-[#0B1F3A]">Today&apos;s Actions</h2>
          <span className="rounded-full bg-[#FF8A1F]/10 px-2.5 py-0.5 text-[11px] font-semibold text-[#FF8A1F]">
            Priority
          </span>
        </div>
        <Suspense
          fallback={
            <div className="grid gap-4 md:grid-cols-2">
              <SkeletonCard /><SkeletonCard /><SkeletonCard /><SkeletonCard />
            </div>
          }
        >
          <TodayActionCenter branchIds={branchIds} />
        </Suspense>
      </section>

      {/* ══ SECTION 3: GROUP HEALTH BOARD ═══════════════════════════════ */}
      <Suspense fallback={<GroupBoardSkeleton />}>
        <GroupHealthBoard branchIds={branchIds} />
      </Suspense>

      {/* ══ SECTION 5 + 6: FINANCE + RISK (side by side on xl) ══════════ */}
      <div className="grid gap-8 xl:grid-cols-2">
        <Suspense fallback={<SectionSkeleton title="Finance" />}>
          <FinanceCenter branchIds={branchIds} />
        </Suspense>

        <Suspense fallback={<SectionSkeleton title="Student Risk" />}>
          <StudentRiskBoard branchIds={branchIds} />
        </Suspense>
      </div>

      {/* ══ SECTION 4: INSTRUCTOR HEALTH ════════════════════════════════ */}
      <Suspense fallback={<SectionSkeleton title="Instructors" />}>
        <InstructorHealthBoard branchIds={branchIds} />
      </Suspense>

      {/* ══ SECTION 7 + 8: PARENT + ACADEMIC (side by side on xl) ══════ */}
      <div className="grid gap-8 xl:grid-cols-2">
        <Suspense fallback={<SectionSkeleton title="Parent Escalations" />}>
          <ParentEscalation branchIds={branchIds} />
        </Suspense>

        <Suspense fallback={<SectionSkeleton title="Academic Quality" />}>
          <AcademicQuality branchIds={branchIds} />
        </Suspense>
      </div>

      {/* ── Floating quick action dock ───────────────────────────────── */}
      <QuickActionDock />

    </div>
  )
}
