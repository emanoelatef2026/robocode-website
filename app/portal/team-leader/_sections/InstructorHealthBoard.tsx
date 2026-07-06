import Link from 'next/link'
import { getInstructorOpsData, type InstructorOpsRow } from '@/modules/tl-dashboard/queries'
import { InstructorScoreBadge, ScoreBar } from '../_components/RiskBadge'
import DashCard, { DashCardEmpty } from '../_components/DashCard'

// ─── helpers ─────────────────────────────────────────────────────────────────

function buildInstructorWa(phone: string | null | undefined, name: string): string | null {
  if (!phone) return null
  const digits = phone.replace(/\D/g, '')
  const normalized = digits.startsWith('20') && digits.length === 12 ? digits
    : digits.length === 11 && /^0(10|11|12|15)/.test(digits) ? `2${digits}`
    : digits.length === 10 && /^(10|11|12|15)/.test(digits)  ? `20${digits}`
    : digits
  const msg = encodeURIComponent(`Hi ${name}, this is a message from Robocode regarding your teaching.`)
  return `https://wa.me/${normalized}?text=${msg}`
}

// ─── Row item ─────────────────────────────────────────────────────────────────

function InstructorRow({ instr }: { instr: InstructorOpsRow }) {
  const score = instr.health_score

  const attColor = instr.attendance_rate >= 85 ? 'text-[#10B981]'
                 : instr.attendance_rate >= 70 ? 'text-[#F59E0B]'
                 : 'text-[#EF4444]'

  const hwColor  = instr.homework_review_pct >= 80 ? 'text-[#10B981]'
                 : instr.homework_review_pct >= 60 ? 'text-[#F59E0B]'
                 : 'text-[#EF4444]'

  return (
    <div className="border-b border-[#F1F5F9] last:border-0">
      {/* Main row */}
      <div className="flex items-center gap-3 px-4 py-3">
        {/* Avatar */}
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#0B1F3A] text-[12px] font-bold text-white">
          {instr.instructor_name.split(' ').map(w => w[0]).slice(0, 2).join('')}
        </div>

        {/* Name + meta */}
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-semibold text-[#0B1F3A]">{instr.instructor_name}</p>
          <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[10px] text-[#94A3B8]">
            <span>{instr.active_groups} group{instr.active_groups !== 1 ? 's' : ''}</span>
            <span>·</span>
            <span>{instr.active_students} students</span>
            {instr.avg_student_rating != null && (
              <>
                <span>·</span>
                <span className="text-[#F59E0B]">{instr.avg_student_rating}★</span>
              </>
            )}
          </div>
        </div>

        {/* Score badge */}
        <InstructorScoreBadge score={score} />
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 divide-x divide-[#F1F5F9] border-t border-[#F1F5F9] bg-[#F8FAFC]">
        <div className="px-3 py-2">
          <p className={`text-[12px] font-bold ${attColor}`}>{instr.attendance_rate}%</p>
          <p className="text-[9px] text-[#94A3B8] uppercase tracking-wide">Attendance</p>
          <ScoreBar value={instr.attendance_rate} colorClass={attColor.replace('text-', 'bg-')} />
        </div>
        <div className="px-3 py-2">
          <p className={`text-[12px] font-bold ${hwColor}`}>{instr.homework_review_pct}%</p>
          <p className="text-[9px] text-[#94A3B8] uppercase tracking-wide">HW Review</p>
          <ScoreBar value={instr.homework_review_pct} colorClass={hwColor.replace('text-', 'bg-')} />
        </div>
        <div className="px-3 py-2">
          <p className="text-[12px] font-bold text-[#0B1F3A]">
            {instr.risk_students > 0
              ? <span className="text-[#EF4444]">{instr.risk_students}</span>
              : <span className="text-[#10B981]">0</span>}
          </p>
          <p className="text-[9px] text-[#94A3B8] uppercase tracking-wide">Risk Students</p>
        </div>
      </div>

      {/* Action bar */}
      <div className="flex items-center gap-2 border-t border-[#F1F5F9] px-4 py-2">
        <Link
          href="/portal/team-leader/instructors"
          className="text-[11px] font-medium text-[#FF8A1F] hover:underline"
        >
          View profile →
        </Link>
        <span className="flex-1" />
        {instr.outstanding_amount > 0 && (
          <span className="text-[10px] text-[#94A3B8]">
            EGP {instr.outstanding_amount.toLocaleString()} outstanding
          </span>
        )}
      </div>
    </div>
  )
}

// ─── Main section ─────────────────────────────────────────────────────────────

export default async function InstructorHealthBoard({ branchIds }: { branchIds: string[] }) {
  const instructors = await getInstructorOpsData(branchIds)

  const atRisk = instructors.filter(i => i.health_score < 55).length
  const healthy = instructors.filter(i => i.health_score >= 75).length

  return (
    <section id="instructor-health">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h2 className="text-[16px] font-bold text-[#0B1F3A]">Instructor Performance</h2>
          {atRisk > 0 && (
            <span className="rounded-full bg-[#FEE2E2] px-2.5 py-0.5 text-[11px] font-semibold text-[#DC2626]">
              {atRisk} need attention
            </span>
          )}
        </div>
        <Link
          href="/portal/team-leader/instructors"
          className="text-[12px] font-medium text-[#FF8A1F] hover:underline"
        >
          All instructors →
        </Link>
      </div>

      <DashCard
        title={`${instructors.length} Instructor${instructors.length !== 1 ? 's' : ''}`}
        badge={
          healthy > 0
            ? <span className="rounded-full bg-[#E7F8EE] px-2 py-0.5 text-[10px] font-semibold text-[#15803D]">{healthy} healthy</span>
            : undefined
        }
        accent={atRisk > 0 ? 'border-[#FDE68A]' : 'border-[#E2E8F0]'}
      >
        {instructors.length === 0
          ? <DashCardEmpty text="No active instructors found" emoji="👨‍🏫" />
          : instructors.map(i => <InstructorRow key={i.instructor_id} instr={i} />)
        }
      </DashCard>
    </section>
  )
}
