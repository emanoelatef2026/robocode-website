import { useMemo } from 'react'
import type { GroupDetailStudent } from '@/modules/groups/modal-actions'
import { fmtDateShort, fmtCurrency } from '../utils'
import { RiskBadge } from './StatusChip'
import { LoadingSpinner } from './LoadingSpinner'

export function GroupStudentsTable({
  students, loading, selectedIds, onToggleStudent, onToggleAll,
}: {
  students:        GroupDetailStudent[]
  loading:         boolean
  selectedIds:     Set<string>
  onToggleStudent: (id: string) => void
  onToggleAll:     () => void
}) {
  const sorted = useMemo(() => [...students].sort((a, b) => {
    const ro: Record<string, number> = { HIGH: 0, MEDIUM: 1, LOW: 2 }
    return (ro[a.risk_level] ?? 3) - (ro[b.risk_level] ?? 3)
  }), [students])

  if (loading && !students.length) return <LoadingSpinner />

  if (!students.length) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-[#94A3B8]">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="mb-3 h-10 w-10 opacity-40">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
        <p className="text-sm">No students enrolled yet.</p>
      </div>
    )
  }

  const allSelected = sorted.length > 0 && sorted.every(s => selectedIds.has(s.student_id))

  return (
    <div className="overflow-x-auto h-full">
      <table className="w-full text-sm min-w-240">
        <thead className="ds-table-head">
          <tr className="bg-[#F8FAFC] border-b border-[#E2E8F0] sticky top-0 z-10">
            <th className="pl-3 pr-2 py-2 w-8">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={onToggleAll}
                className="h-3.5 w-3.5 cursor-pointer rounded border-[#CBD5E1] accent-[#FF8A1F]"
              />
            </th>
            <th className="w-7 px-1 py-2 text-center text-[11px] font-semibold text-[#94A3B8]">#</th>
            <th className="px-3 py-2 text-left text-[11px] font-semibold text-[#64748B] whitespace-nowrap">Student</th>
            <th className="px-2 py-2 text-center text-[11px] font-semibold text-[#64748B]">Age</th>
            <th className="px-3 py-2 text-left text-[11px] font-semibold text-[#64748B] whitespace-nowrap">Stu. Phone</th>
            <th className="px-3 py-2 text-left text-[11px] font-semibold text-[#64748B] whitespace-nowrap">Par. Phone</th>
            <th className="px-2 py-2 text-center text-[11px] font-semibold text-[#64748B] whitespace-nowrap">Sessions</th>
            <th className="px-2 py-2 text-center text-[11px] font-semibold text-[#64748B]">Left</th>
            <th className="px-3 py-2 text-right text-[11px] font-semibold text-[#64748B] whitespace-nowrap">Subscription</th>
            <th className="px-3 py-2 text-right text-[11px] font-semibold text-[#64748B]">Paid</th>
            <th className="px-3 py-2 text-right text-[11px] font-semibold text-[#64748B]">Remaining</th>
            <th className="px-3 py-2 text-center text-[11px] font-semibold text-[#64748B]">Risk</th>
            <th className="px-3 py-2 text-center text-[11px] font-semibold text-[#64748B]">Joined</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((s, idx) => {
            const isSelected = selectedIds.has(s.student_id)

            const attColor = s.attendance_pct >= 75 ? 'text-[#10B981]'
                           : s.attendance_pct >= 60 ? 'text-[#F59E0B]'
                           : s.attendance_pct > 0   ? 'text-[#EF4444]'
                                                    : 'text-[#CBD5E1]'

            const sessStat = s.sessions_used != null && s.sessions_total != null
              ? `${s.sessions_used}/${s.sessions_total}`
              : s.sessions_used != null ? `${s.sessions_used}` : '—'

            const sessLeft      = s.sessions_remaining
            const sessLeftColor = sessLeft != null && sessLeft <= 2
              ? 'text-[#EF4444] font-semibold'
              : 'text-[#374151]'

            return (
              <tr
                key={s.student_id}
                onClick={() => onToggleStudent(s.student_id)}
                className={[
                  'border-b border-[#F1F5F9] cursor-pointer transition-colors',
                  isSelected ? 'bg-[#FFF7ED]' : 'hover:bg-[#FAFAFA]',
                ].join(' ')}
              >
                <td className="pl-3 pr-2 py-1.5 w-8" onClick={e => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => onToggleStudent(s.student_id)}
                    className="h-3.5 w-3.5 cursor-pointer rounded border-[#CBD5E1] accent-[#FF8A1F]"
                  />
                </td>

                <td className="w-7 px-1 py-1.5 text-center text-[11px] font-semibold text-[#94A3B8]">
                  {idx + 1}
                </td>

                <td className="px-3 py-1.5">
                  <p className="text-[12px] font-semibold text-[#0B1F3A] whitespace-nowrap leading-tight">{s.student_name}</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    {s.student_code && (
                      <span className="font-mono text-[10px] text-[#94A3B8]">{s.student_code}</span>
                    )}
                    {s.attendance_pct > 0 && (
                      <span className={`text-[10px] font-semibold ${attColor}`}>{s.attendance_pct}%</span>
                    )}
                  </div>
                </td>

                <td className="px-2 py-1.5 text-center text-[11px] text-[#64748B]">
                  {s.age != null ? `${s.age}y` : '—'}
                </td>

                <td className="px-3 py-1.5">
                  <span className="font-mono text-[11px] text-[#374151] whitespace-nowrap">{s.phone ?? '—'}</span>
                </td>

                <td className="px-3 py-1.5">
                  <span className="font-mono text-[11px] text-[#374151] whitespace-nowrap">{s.parent_phone ?? '—'}</span>
                </td>

                <td className="px-2 py-1.5 text-center text-[11px] text-[#64748B] whitespace-nowrap">
                  {sessStat}
                </td>

                <td className="px-2 py-1.5 text-center">
                  <span className={`text-[11px] ${sessLeftColor}`}>
                    {sessLeft != null ? sessLeft : '—'}
                  </span>
                </td>

                <td className="px-3 py-1.5 text-right whitespace-nowrap">
                  {s.subscription_amount
                    ? <span className="text-[11px] text-[#374151]">{fmtCurrency(s.subscription_amount)}</span>
                    : <span className="text-[10px] text-[#CBD5E1]">No Package</span>
                  }
                </td>

                <td className="px-3 py-1.5 text-right text-[11px] text-[#374151] whitespace-nowrap">
                  {s.paid_amount > 0 ? fmtCurrency(s.paid_amount) : '—'}
                </td>

                <td className="px-3 py-1.5 text-right whitespace-nowrap">
                  <span className={`text-[11px] ${s.remaining_balance > 0 ? 'text-[#EF4444] font-semibold' : 'text-[#94A3B8]'}`}>
                    {s.remaining_balance > 0 ? fmtCurrency(s.remaining_balance) : '—'}
                  </span>
                </td>

                <td className="px-3 py-1.5 text-center">
                  <RiskBadge level={s.risk_level} />
                </td>

                <td className="px-3 py-1.5 text-center text-[11px] text-[#94A3B8] whitespace-nowrap">
                  {fmtDateShort(s.joined_at)}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
