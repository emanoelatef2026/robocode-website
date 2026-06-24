import Link from 'next/link'
import { getStudentRiskData, type StudentRiskRow } from '@/modules/tl-dashboard/dashboard-v2-queries'
import DashCard, { DashCardEmpty, DashRow } from '../_components/DashCard'
import RiskBadge from '../_components/RiskBadge'
import WaCallButtons from '../_components/WaCallButtons'

function RiskRow({ student }: { student: StudentRiskRow }) {
  return (
    <DashRow
      left={
        <>
          <div className="flex items-center gap-1.5">
            <Link
              href={`/portal/team-leader/students/${student.student_id}`}
              className="text-[13px] font-medium text-[#0B1F3A] hover:text-[#FF8A1F] leading-snug"
            >
              {student.student_name}
            </Link>
            {student.student_code && (
              <span className="font-mono text-[10px] text-[#94A3B8]">#{student.student_code}</span>
            )}
            <RiskBadge score={student.risk_score} />
          </div>
          {student.current_group_name && (
            <p className="mt-0.5 text-[11px] text-[#64748B]">{student.current_group_name}</p>
          )}
          {/* Risk flags */}
          <div className="mt-1 flex flex-wrap gap-1">
            {student.risk_flags.slice(0, 3).map((flag, i) => (
              <span key={i} className="rounded-full bg-[#F1F5F9] px-1.5 py-0.5 text-[9px] font-medium text-[#64748B]">
                {flag}
              </span>
            ))}
          </div>
        </>
      }
      right={
        <div className="text-right">
          {student.attendance_score > 0 && (
            <p className={`text-[12px] font-bold ${student.attendance_score >= 75 ? 'text-[#10B981]' : student.attendance_score >= 55 ? 'text-[#F59E0B]' : 'text-[#EF4444]'}`}>
              {student.attendance_score}%
            </p>
          )}
          {student.remaining_sessions != null && (
            <p className={`text-[10px] font-medium ${student.remaining_sessions <= 0 ? 'text-[#EF4444]' : student.remaining_sessions <= 2 ? 'text-[#F59E0B]' : 'text-[#94A3B8]'}`}>
              {student.remaining_sessions <= 0 ? 'Exhausted' : `${student.remaining_sessions} sess`}
            </p>
          )}
          {student.remaining_balance > 0 && (
            <p className="text-[10px] text-[#EF4444]">
              EGP {student.remaining_balance.toLocaleString()}
            </p>
          )}
        </div>
      }
      actions={
        <div className="flex flex-col gap-1">
          <Link
            href={`/portal/team-leader/students/${student.student_id}`}
            className="rounded-lg border border-[#E2E8F0] px-2.5 py-1 text-[10px] font-medium text-[#64748B] hover:border-[#FF8A1F] hover:text-[#FF8A1F]"
          >
            View
          </Link>
          <WaCallButtons
            parentPhone={student.parent_phone}
            studentPhone={student.student_phone}
            studentName={student.student_name}
            context="We wanted to check in about your student's progress."
          />
        </div>
      }
    />
  )
}

export default async function StudentRiskBoard({ branchIds }: { branchIds: string[] }) {
  const students = await getStudentRiskData(branchIds, 20)

  const critical = students.filter(s => s.risk_score >= 60).length
  const medium   = students.filter(s => s.risk_score >= 35 && s.risk_score < 60).length

  return (
    <section id="student-risk">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h2 className="text-[16px] font-bold text-[#0B1F3A]">Student Risk Engine</h2>
          {critical > 0 && (
            <span className="rounded-full bg-[#FEE2E2] px-2.5 py-0.5 text-[11px] font-semibold text-[#DC2626]">
              {critical} critical
            </span>
          )}
          {medium > 0 && (
            <span className="rounded-full bg-[#FFFBEB] px-2.5 py-0.5 text-[11px] font-semibold text-[#B45309]">
              {medium} medium
            </span>
          )}
        </div>
        <Link href="/portal/team-leader/students?filter=at-risk" className="text-[12px] font-medium text-[#FF8A1F] hover:underline">
          All students →
        </Link>
      </div>

      <DashCard
        title="At-Risk Students"
        count={students.length}
        accent={critical > 0 ? 'border-[#FECACA]' : students.length > 0 ? 'border-[#FDE68A]' : 'border-[#E2E8F0]'}
        action={
          <Link href="/portal/team-leader/students?filter=at-risk" className="text-[11px] font-medium text-[#FF8A1F] hover:underline">
            View all →
          </Link>
        }
      >
        {students.length === 0 ? (
          <DashCardEmpty text="No at-risk students detected! 🎉" />
        ) : (
          students.map(s => <RiskRow key={s.student_id} student={s} />)
        )}
      </DashCard>
    </section>
  )
}
