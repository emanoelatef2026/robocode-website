import Link from 'next/link'
import {
  getSessionsStartingSoon,
  getOverdueCollections,
  getRenewalsNeeded,
  getMissingOperationalData,
  type SessionStartingSoon,
  type OverdueCollectionItem,
  type RenewalItem,
  type MissingDataAlert,
} from '@/modules/tl-dashboard/dashboard-v2-queries'
import DashCard, { DashCardEmpty, DashRow } from '../_components/DashCard'
import WaCallButtons from '../_components/WaCallButtons'
import { normalizeEgyptPhone } from '@/lib/contact-utils'

// ─── helpers ─────────────────────────────────────────────────────────────────

function fmtEGP(n: number) {
  return `EGP ${n.toLocaleString('en-EG', { maximumFractionDigits: 0 })}`
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

// ─── Session starting soon card ───────────────────────────────────────────────

function SessionCard({ session }: { session: SessionStartingSoon }) {
  const urgent = session.starts_in_min <= 30

  const waMsg = session.instructor_phone
    ? encodeURIComponent(`Hi, this is a reminder that ${session.group_name} starts in ${session.starts_in_min} min. Please confirm you are on your way.`)
    : undefined

  return (
    <DashRow
      left={
        <>
          <p className="text-[13px] font-medium text-[#0B1F3A] leading-snug">{session.group_name}</p>
          <p className="mt-0.5 text-[11px] text-[#64748B]">
            {session.course_title && <span>{session.course_title} · </span>}
            {session.instructor_name ?? <span className="text-[#F59E0B]">No instructor</span>}
          </p>
        </>
      }
      right={
        <div className="text-right">
          <p className={`text-[13px] font-bold ${urgent ? 'text-[#EF4444]' : 'text-[#0B1F3A]'}`}>
            {session.starts_in_min <= 0 ? 'Now' : `${session.starts_in_min}m`}
          </p>
          <p className="text-[10px] text-[#94A3B8]">{fmtTime(session.scheduled_at)}</p>
          <p className="text-[10px] text-[#94A3B8]">{session.student_count} students</p>
        </div>
      }
      actions={
        <div className="flex flex-col items-end gap-1">
          <Link
            href={`/portal/team-leader/attendance/record?group=${session.group_id}`}
            className="rounded-lg bg-[#0B1F3A] px-2.5 py-1 text-[10px] font-semibold text-white hover:bg-[#1a3352]"
          >
            Attend
          </Link>
          {session.instructor_phone && (
            <a
              href={`https://wa.me/${normalizeEgyptPhone(session.instructor_phone)}${waMsg ? `?text=${waMsg}` : ''}`}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg border border-[#A7F3D0] bg-[#E7F8EE] px-2.5 py-1 text-[10px] font-semibold text-[#15803D] hover:bg-[#E7F8EE]"
            >
              WA
            </a>
          )}
        </div>
      }
    />
  )
}

// ─── Overdue collection row ───────────────────────────────────────────────────

function CollectRow({ item }: { item: OverdueCollectionItem }) {
  const critical = item.days_overdue >= 7

  return (
    <DashRow
      left={
        <>
          <Link href={`/portal/team-leader/students/${item.student_id}`} className="block text-[13px] font-medium text-[#0B1F3A] hover:text-[#FF8A1F] leading-snug">
            {item.student_name}
            {item.student_code && <span className="ml-1 font-mono text-[10px] text-[#94A3B8]">#{item.student_code}</span>}
          </Link>
          <p className="mt-0.5 text-[11px] text-[#64748B]">
            {item.group_name ?? 'No group'}
            {item.days_overdue > 0 && <span className={`ml-1.5 font-medium ${critical ? 'text-[#EF4444]' : 'text-[#F59E0B]'}`}>{item.days_overdue}d overdue</span>}
          </p>
        </>
      }
      right={
        <p className={`text-[13px] font-bold ${critical ? 'text-[#EF4444]' : 'text-[#B45309]'}`}>
          {fmtEGP(item.remaining_amount)}
        </p>
      }
      actions={
        <WaCallButtons
          parentPhone={item.parent_phone}
          studentPhone={item.student_phone}
          studentName={item.student_name}
          context={`Payment of ${fmtEGP(item.remaining_amount)} is overdue by ${item.days_overdue} days.`}
        />
      }
    />
  )
}

// ─── Renewal row ──────────────────────────────────────────────────────────────

function RenewalRow({ item }: { item: RenewalItem }) {
  const urgencyLabel = item.urgency === 'exhausted' ? 'Exhausted'
    : item.urgency === 'critical' ? '1 left'
    : '2 left'

  const urgencyCls = item.urgency === 'exhausted' ? 'bg-[#FEE2E2] text-[#DC2626]'
    : item.urgency === 'critical' ? 'bg-orange-100 text-orange-700'
    : 'bg-[#FFFBEB] text-[#B45309]'

  return (
    <DashRow
      left={
        <>
          <Link href={`/portal/team-leader/students/${item.student_id}`} className="block text-[13px] font-medium text-[#0B1F3A] hover:text-[#FF8A1F] leading-snug">
            {item.student_name}
            {item.student_code && <span className="ml-1 font-mono text-[10px] text-[#94A3B8]">#{item.student_code}</span>}
          </Link>
          <p className="mt-0.5 text-[11px] text-[#64748B]">{item.group_name ?? 'No group'}</p>
        </>
      }
      right={
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${urgencyCls}`}>
          {urgencyLabel}
        </span>
      }
      actions={
        <div className="flex flex-col gap-1">
          <Link
            href={`/portal/team-leader/finance?student=${item.student_id}&mode=renew`}
            className="rounded-lg bg-[#FF8A1F] px-2.5 py-1 text-[10px] font-semibold text-white hover:bg-[#e87c18]"
          >
            Renew
          </Link>
          <WaCallButtons
            parentPhone={item.parent_phone}
            studentPhone={item.student_phone}
            studentName={item.student_name}
            context="Your sessions are almost exhausted. Please renew your contract."
          />
        </div>
      }
    />
  )
}

// ─── Missing data row ─────────────────────────────────────────────────────────

const ALERT_TYPE_LABEL: Record<string, string> = {
  no_instructor:       'No Instructor',
  no_course:           'No Course',
  no_group:            'No Group',
  missing_attendance:  'Missing Attendance',
  orphan_enrollment:   'Orphan Enrollment',
}

const SEVERITY_CLS: Record<string, string> = {
  critical: 'bg-[#FEE2E2] text-[#DC2626]',
  warning:  'bg-[#FFFBEB] text-[#B45309]',
  info:     'bg-[#EFF6FF] text-[#1D4ED8]',
}

function AlertRow({ alert }: { alert: MissingDataAlert }) {
  return (
    <DashRow
      left={
        <>
          <Link href={alert.href} className="block text-[13px] font-medium text-[#0B1F3A] hover:text-[#FF8A1F] leading-snug truncate max-w-[200px]">
            {alert.entity_name}
          </Link>
        </>
      }
      right={
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${SEVERITY_CLS[alert.severity]}`}>
          {ALERT_TYPE_LABEL[alert.type] ?? alert.type}
        </span>
      }
      actions={
        <Link
          href={alert.href}
          className="rounded-lg border border-[#E2E8F0] px-2.5 py-1 text-[10px] font-medium text-[#64748B] hover:border-[#FF8A1F] hover:text-[#FF8A1F]"
        >
          Fix →
        </Link>
      }
    />
  )
}

// ─── Main section ─────────────────────────────────────────────────────────────

interface Props {
  branchIds: string[]
}

export default async function TodayActionCenter({ branchIds }: Props) {
  const [sessions, overdue, renewals, missingData] = await Promise.all([
    getSessionsStartingSoon(branchIds),
    getOverdueCollections(branchIds, 10),
    getRenewalsNeeded(branchIds, 10),
    getMissingOperationalData(branchIds),
  ])

  const totalAlerts = sessions.length + overdue.length + renewals.length + missingData.filter(a => a.severity === 'critical').length

  if (!totalAlerts && !sessions.length && !overdue.length && !renewals.length && !missingData.length) {
    return (
      <div className="rounded-2xl border border-[#A7F3D0] bg-[#E7F8EE] px-5 py-4 text-center">
        <p className="text-[15px] font-semibold text-[#15803D]">All clear today! 🎉</p>
        <p className="mt-0.5 text-[12px] text-[#10B981]">No urgent actions required right now.</p>
      </div>
    )
  }

  const criticalMissing = missingData.filter(a => a.severity === 'critical').slice(0, 5)
  const warningMissing  = missingData.filter(a => a.severity !== 'critical').slice(0, 5)

  return (
    <div className="space-y-4">
      {/* Row 1: sessions + overdue (side by side on md+) */}
      <div className="grid gap-4 md:grid-cols-2">

        {/* Sessions starting soon */}
        <DashCard
          title="📅 Starting Soon"
          count={sessions.length}
          accent={sessions.length > 0 ? 'border-blue-200' : 'border-[#E2E8F0]'}
          action={
            <Link href="/portal/team-leader/attendance/record" className="text-[11px] font-medium text-[#FF8A1F] hover:underline">
              Record →
            </Link>
          }
        >
          {sessions.length === 0
            ? <DashCardEmpty text="No sessions in the next 2 hours" emoji="✅" />
            : sessions.map(s => <SessionCard key={s.schedule_id} session={s} />)
          }
        </DashCard>

        {/* Overdue collections */}
        <DashCard
          title="💰 Overdue Collections"
          count={overdue.length}
          accent={overdue.length > 0 ? 'border-[#FECACA]' : 'border-[#E2E8F0]'}
          action={overdue.length > 0 ? (
            <Link href="/portal/team-leader/finance" className="text-[11px] font-medium text-[#FF8A1F] hover:underline">
              View all →
            </Link>
          ) : undefined}
        >
          {overdue.length === 0
            ? <DashCardEmpty text="No overdue payments today 🎉" />
            : overdue.slice(0, 5).map(item => <CollectRow key={item.enrollment_id} item={item} />)
          }
        </DashCard>
      </div>

      {/* Row 2: renewals + missing data */}
      <div className="grid gap-4 md:grid-cols-2">

        {/* Renewals needed */}
        <DashCard
          title="🔄 Renewals Needed"
          count={renewals.length}
          accent={renewals.length > 0 ? 'border-[#FDE68A]' : 'border-[#E2E8F0]'}
          action={renewals.length > 0 ? (
            <Link href="/portal/team-leader/students?filter=expiring" className="text-[11px] font-medium text-[#FF8A1F] hover:underline">
              View all →
            </Link>
          ) : undefined}
        >
          {renewals.length === 0
            ? <DashCardEmpty text="No contracts at 0–2 sessions remaining" emoji="✅" />
            : renewals.slice(0, 5).map(item => <RenewalRow key={item.enrollment_id} item={item} />)
          }
        </DashCard>

        {/* Missing operational data */}
        <DashCard
          title="⚠️ Operational Gaps"
          count={missingData.length}
          accent={criticalMissing.length > 0 ? 'border-[#FECACA]' : missingData.length > 0 ? 'border-[#FDE68A]' : 'border-[#E2E8F0]'}
        >
          {missingData.length === 0 ? (
            <DashCardEmpty text="All operational data is complete ✅" />
          ) : (
            <>
              {criticalMissing.map((a, i) => <AlertRow key={`c-${i}`} alert={a} />)}
              {warningMissing.map((a, i)  => <AlertRow key={`w-${i}`} alert={a} />)}
              {missingData.length > 10 && (
                <p className="px-4 py-2 text-center text-[11px] text-[#94A3B8]">
                  +{missingData.length - 10} more issues
                </p>
              )}
            </>
          )}
        </DashCard>
      </div>
    </div>
  )
}
