import { Suspense }                    from 'react'
import Link                             from 'next/link'
import { requirePortalRole }            from '@/modules/rbac/guards'
import { getTLKPIs, getTodayAttendanceSummary } from '@/modules/tl-dashboard/queries'
import { getDashboardFinanceSummary }   from '@/modules/finance/queries'
import { getTLMessageCounts }           from '@/modules/parent-messages/queries'
import { createServiceClient }          from '@/lib/supabase/service'
import { SkeletonCard }                 from './_components/DashCard'
import DashSection                      from './_components/DashSection'
import BranchFilterBar                  from './_components/BranchFilterBar'
import TodayActionCenter                from './_sections/TodayActionCenter'
import GroupHealthBoard                 from './_sections/GroupHealthBoard'
import InstructorHealthBoard            from './_sections/InstructorHealthBoard'
import FinanceCenter                    from './_sections/FinanceCenter'
import StudentRiskBoard                 from './_sections/StudentRiskBoard'
import ParentEscalation                 from './_sections/ParentEscalation'
import AcademicQuality                  from './_sections/AcademicQuality'

// ─── Page props ───────────────────────────────────────────────────────────────

interface Props {
  searchParams: Promise<{ branch?: string }>
}

// ─── Branch loader ────────────────────────────────────────────────────────────

async function fetchBranches(branchIds: string[]) {
  if (branchIds.length <= 1) return []
  const db = createServiceClient()
  const { data } = await db
    .from('branches')
    .select('id, name')
    .in('id', branchIds)
    .order('name')
  return (data ?? []) as { id: string; name: string }[]
}

// ─── Attendance summary ───────────────────────────────────────────────────────

async function AttendanceSummary({ branchIds }: { branchIds: string[] }) {
  const att = await getTodayAttendanceSummary(branchIds)
  const total = att.present + att.absent + att.late
  if (!total) return null

  return (
    <div className="grid grid-cols-3 gap-2 md:gap-3">
      {[
        { label: 'Present Today', value: att.present, cls: 'border-emerald-200 bg-emerald-50 text-emerald-700' },
        { label: 'Absent Today',  value: att.absent,  cls: 'border-red-200    bg-red-50    text-red-700'     },
        { label: 'Late Today',    value: att.late,    cls: 'border-amber-200  bg-amber-50  text-amber-700'   },
      ].map(k => (
        <div key={k.label} className={`rounded-xl md:rounded-2xl border px-3 py-2.5 md:px-4 md:py-3 text-center ${k.cls}`}>
          <p className="text-xl md:text-2xl font-extrabold">{k.value}</p>
          <p className="mt-0.5 text-[11px] font-medium">{k.label}</p>
        </div>
      ))}
    </div>
  )
}

// ─── Finance KPI strip ────────────────────────────────────────────────────────

async function FinanceKPIStrip({ branchIds }: { branchIds: string[] }) {
  const [fin, msgs] = await Promise.all([
    getDashboardFinanceSummary(branchIds),
    getTLMessageCounts(branchIds),
  ])

  function fmt(n: number) {
    return new Intl.NumberFormat('en-EG', { maximumFractionDigits: 0 }).format(n)
  }

  const tiles = [
    { label: 'Collected Today',  value: `EGP ${fmt(fin.collected_today)}`,      alert: false },
    { label: 'This Month',       value: `EGP ${fmt(fin.collected_this_month)}`,  alert: false },
    { label: 'Outstanding',      value: `EGP ${fmt(fin.outstanding)}`,           alert: false },
    { label: 'Collection Rate',  value: `${fin.collection_rate}%`,               alert: fin.collection_rate < 70 },
    { label: 'Overdue Accounts', value: String(fin.overdue_count),               alert: fin.overdue_count > 0 },
    { label: 'Due This Week',    value: String(fin.due_this_week),               alert: false },
    { label: 'Open Messages',    value: String(msgs.open),                       alert: msgs.open > 0 },
  ]

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7 md:gap-3">
      {tiles.map(t => (
        <div
          key={t.label}
          className={`rounded-xl md:rounded-2xl border bg-white p-2.5 md:p-3.5 ${t.alert ? 'border-red-200' : 'border-[#E2E8F0]'}`}
        >
          <p className={`text-[15px] md:text-[18px] font-extrabold leading-none ${t.alert ? 'text-red-600' : 'text-[#0B1F3A]'}`}>
            {t.value}
          </p>
          <p className="mt-1 text-[10px] font-medium text-[#64748B]">{t.label}</p>
        </div>
      ))}
    </div>
  )
}

// ─── Header KPIs ─────────────────────────────────────────────────────────────

async function HeaderKPIs({ branchIds }: { branchIds: string[] }) {
  const kpis = await getTLKPIs(branchIds)
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 md:gap-3">
      {[
        { label: 'Active Students',    value: String(kpis.active_students),                                                          href: '/portal/team-leader/students'      },
        { label: 'Monthly Attendance', value: `${kpis.monthly_attendance_pct}%`,                                                     href: '/portal/team-leader/groups'        },
        { label: 'Homework Rate',      value: `${kpis.homework_completion_pct}%`,                                                    href: '/portal/team-leader/assignments'   },
        { label: 'Satisfaction',       value: kpis.parent_satisfaction_avg != null ? `${kpis.parent_satisfaction_avg}★` : '—',       href: '/portal/team-leader/parent-feedback' },
      ].map(k => (
        <Link
          key={k.label}
          href={k.href}
          className="rounded-xl md:rounded-2xl border border-[#E2E8F0] bg-white p-3 md:p-4 transition hover:border-[#CBD5E1] hover:shadow-sm"
        >
          <p className="text-[10px] font-bold uppercase tracking-wide text-[#94A3B8]">{k.label}</p>
          <p className="mt-1 text-[20px] md:text-[24px] font-extrabold leading-none text-[#0B1F3A]">{k.value}</p>
        </Link>
      ))}
    </div>
  )
}

// ─── Section nav ──────────────────────────────────────────────────────────────

function SectionNav() {
  const sections = [
    { href: '#today',              label: 'Today'       },
    { href: '#group-health',       label: 'Groups'      },
    { href: '#finance',            label: 'Finance'     },
    { href: '#student-risk',       label: 'Risk'        },
    { href: '#instructor-health',  label: 'Instructors' },
    { href: '#academic',           label: 'Academic'    },
    { href: '#parent-escalation',  label: 'Parents'     },
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

// ─── Skeletons ────────────────────────────────────────────────────────────────

function SectionSkeleton() {
  return (
    <div className="space-y-3">
      <div className="h-5 w-40 rounded-full bg-[#F1F5F9] animate-pulse" />
      <SkeletonCard />
    </div>
  )
}

function AttendanceSkeleton() {
  return (
    <div className="grid grid-cols-3 gap-3">
      {[1, 2, 3].map(i => (
        <div key={i} className="h-20 rounded-2xl bg-[#F1F5F9] animate-pulse" />
      ))}
    </div>
  )
}

function FinanceStripSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
      {[1, 2, 3, 4, 5, 6, 7].map(i => (
        <div key={i} className="h-16 rounded-2xl bg-[#F1F5F9] animate-pulse" />
      ))}
    </div>
  )
}

function HeaderKPISkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {[1, 2, 3, 4].map(i => (
        <div key={i} className="h-24 rounded-2xl bg-[#F1F5F9] animate-pulse" />
      ))}
    </div>
  )
}

function GroupBoardSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {[1, 2, 3].map(i => (
        <div key={i} className="h-48 rounded-2xl border border-[#E2E8F0] bg-white animate-pulse" />
      ))}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function TLDashboardPage({ searchParams }: Props) {
  const user   = await requirePortalRole('team_leader')
  const params = await searchParams

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

  const allBranchIds   = user.branchIds
  const selectedBranch = params.branch && allBranchIds.includes(params.branch) ? params.branch : null
  const branchIds      = selectedBranch ? [selectedBranch] : allBranchIds

  const branches = await fetchBranches(allBranchIds)

  return (
    <div className="space-y-3 md:space-y-6 pb-24 md:pb-8">

      {/* ── Page header ──────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-[17px] md:text-[20px] font-extrabold tracking-tight text-[#0B1F3A]">
            Operations Center
          </h1>
          <p className="mt-0.5 text-[11px] md:text-[13px] text-[#64748B]">
            {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
        </div>

        <BranchFilterBar branches={branches} selected={selectedBranch} />
      </div>

      {/* ── Section navigation (jump links) ─────────────────────────── */}
      <SectionNav />

      {/* ── Finance KPI strip ────────────────────────────────────────── */}
      <Suspense fallback={<FinanceStripSkeleton />}>
        <FinanceKPIStrip branchIds={branchIds} />
      </Suspense>

      {/* ── Today's Attendance ───────────────────────────────────────── */}
      <Suspense fallback={<AttendanceSkeleton />}>
        <AttendanceSummary branchIds={branchIds} />
      </Suspense>

      {/* ── Summary KPIs ─────────────────────────────────────────────── */}
      <Suspense fallback={<HeaderKPISkeleton />}>
        <HeaderKPIs branchIds={branchIds} />
      </Suspense>

      {/* ══ TODAY ════════════════════════════════════════════════════════ */}
      <DashSection id="today" label="Today's Actions" icon="📅" defaultOpen>
        <Suspense
          fallback={
            <div className="grid gap-4 md:grid-cols-2">
              <SkeletonCard /><SkeletonCard /><SkeletonCard /><SkeletonCard />
            </div>
          }
        >
          <TodayActionCenter branchIds={branchIds} />
        </Suspense>
      </DashSection>

      {/* ══ GROUPS ═══════════════════════════════════════════════════════ */}
      <DashSection id="group-health" label="Group Health" icon="📚" defaultOpen>
        <Suspense fallback={<GroupBoardSkeleton />}>
          <GroupHealthBoard branchIds={branchIds} />
        </Suspense>
      </DashSection>

      {/* ══ FINANCE ══════════════════════════════════════════════════════ */}
      <DashSection id="finance" label="Finance" icon="💰" defaultOpen>
        <Suspense fallback={<SectionSkeleton />}>
          <FinanceCenter branchIds={branchIds} />
        </Suspense>
      </DashSection>

      {/* ══ RISK ═════════════════════════════════════════════════════════ */}
      <DashSection id="student-risk" label="Student Risk" icon="⚠️" defaultOpen>
        <Suspense fallback={<SectionSkeleton />}>
          <StudentRiskBoard branchIds={branchIds} />
        </Suspense>
      </DashSection>

      {/* ══ INSTRUCTORS ══════════════════════════════════════════════════ */}
      <DashSection id="instructor-health" label="Instructors" icon="👨‍🏫" defaultOpen={false}>
        <Suspense fallback={<SectionSkeleton />}>
          <InstructorHealthBoard branchIds={branchIds} />
        </Suspense>
      </DashSection>

      {/* ══ ACADEMIC ═════════════════════════════════════════════════════ */}
      <DashSection id="academic" label="Academic Quality" icon="🎓" defaultOpen={false}>
        <Suspense fallback={<SectionSkeleton />}>
          <AcademicQuality branchIds={branchIds} />
        </Suspense>
      </DashSection>

      {/* ══ PARENTS ══════════════════════════════════════════════════════ */}
      <DashSection id="parent-escalation" label="Parents" icon="👪" defaultOpen={false}>
        <Suspense fallback={<SectionSkeleton />}>
          <ParentEscalation branchIds={branchIds} />
        </Suspense>
      </DashSection>

    </div>
  )
}
