'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { StudentOperationsRow } from '@/modules/finance/types'
import { RISK_LEVEL_CLASSES, RISK_FLAG_LABELS, STATUS_COLORS, STATUS_LABELS } from '@/modules/finance/types'
import { quickPayment } from '@/modules/finance/actions'
import StudentOpsDrawer from '../finance/StudentOpsDrawer'

function fmt(n: number) {
  return new Intl.NumberFormat('en-EG', { maximumFractionDigits: 0 }).format(n)
}

function fmtDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

interface Section {
  id:       string
  label:    string
  rows:     StudentOperationsRow[]
  color:    string
  emptyMsg: string
}

interface Stats {
  totalOutstanding: number
  totalDueToday:    number
  totalOverdue:     number
  overdueCount:     number
  milestoneCount:   number
}

interface Props {
  sections:  Section[]
  branchIds: string[]
  stats:     Stats
}

function CollectionRow({ row, onOpen }: { row: StudentOperationsRow; onOpen: () => void }) {
  const router = useRouter()
  const [paying,    setPaying]    = useState<number | 'full' | null>(null)
  const [err,       setErr]       = useState<string | null>(null)
  const [remaining, setRemaining] = useState(row.remaining_amount)
  const [isPending, startTransition] = useTransition()

  const parentPhone = row.parent_phone_1 || row.parent_phone_2

  async function handleQuick(amount: number | 'full') {
    if (!row.account_id) return
    setPaying(amount)
    setErr(null)
    startTransition(async () => {
      const res = await quickPayment({
        account_id: row.account_id!,
        student_id: row.student_id,
        amount,
      })
      if ('error' in res) {
        setErr(res.error)
      } else {
        setRemaining(res.remaining_amount)
        router.refresh()
      }
      setPaying(null)
    })
  }

  return (
    <div className="rounded-xl border border-[#E2E8F0] bg-white p-4">
      {/* Top row */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <button
            onClick={onOpen}
            className="text-left font-semibold text-[#0B1F3A] hover:text-[#FF8A1F] text-sm"
          >
            {row.student_name}
          </button>
          <p className="text-xs text-[#64748B] mt-0.5">
            {row.group_name ?? 'No group'}
            {row.instructor_name ? ` · ${row.instructor_name}` : ''}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${RISK_LEVEL_CLASSES[row.risk_level]}`}>
            {row.risk_level}
          </span>
          {row.financial_status && row.financial_status !== 'CURRENT' && (
            <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${STATUS_COLORS[row.financial_status as keyof typeof STATUS_COLORS] ?? ''}`}>
              {STATUS_LABELS[row.financial_status as keyof typeof STATUS_LABELS] ?? row.financial_status}
            </span>
          )}
        </div>
      </div>

      {/* Stats strip */}
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[#64748B]">
        <span>
          Phone: <strong className="text-[#0B1F3A]">{parentPhone ?? '—'}</strong>
        </span>
        <span>
          Remaining: <strong className={remaining > 0 ? 'text-red-600' : 'text-emerald-600'}>
            {remaining > 0 ? `EGP ${fmt(remaining)}` : 'Paid ✓'}
          </strong>
        </span>
        <span>
          Attendance: <strong className={
            row.attendance_pct >= 80 ? 'text-emerald-600' :
            row.attendance_pct >= 60 ? 'text-amber-600' : 'text-red-600'
          }>{row.sessions_attended > 0 ? `${row.attendance_pct}%` : '—'}</strong>
        </span>
        {row.next_due_date && (
          <span>
            Due: <strong className={row.days_overdue > 0 ? 'text-red-600 font-semibold' : 'text-[#0B1F3A]'}>
              {fmtDate(row.next_due_date)}{row.days_overdue > 0 ? ` (${row.days_overdue}d)` : ''}
            </strong>
          </span>
        )}
        {row.consecutive_absences >= 2 && (
          <span className="text-red-600 font-medium">{row.consecutive_absences} consecutive absences</span>
        )}
      </div>

      {/* Risk flags */}
      {row.risk_flags.filter(f => f !== 'session_milestone').length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {row.risk_flags.filter(f => f !== 'session_milestone').map(f => (
            <span key={f} className="rounded bg-red-50 px-1.5 py-0.5 text-[10px] font-medium text-red-600">
              {RISK_FLAG_LABELS[f] ?? f}
            </span>
          ))}
        </div>
      )}

      {err && <p className="mt-1 text-xs text-red-600">{err}</p>}

      {/* Action row */}
      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-[#F1F5F9] pt-2">
        {/* Quick collect */}
        {row.account_id && remaining > 0 && (
          <>
            {[500, 1000, 2000].map(amt => (
              <button
                key={amt}
                onClick={() => handleQuick(amt)}
                disabled={!!paying || isPending}
                className="rounded-lg bg-[#0B1F3A] px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-[#1a3356] disabled:opacity-40 flex items-center gap-1"
              >
                {paying === amt ? <span className="h-2.5 w-2.5 animate-spin rounded-full border border-white border-t-transparent" /> : null}
                +{fmt(amt)}
              </button>
            ))}
            <button
              onClick={() => handleQuick('full')}
              disabled={!!paying || isPending}
              className="rounded-lg bg-emerald-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-emerald-700 disabled:opacity-40 flex items-center gap-1"
            >
              {paying === 'full' ? <span className="h-2.5 w-2.5 animate-spin rounded-full border border-white border-t-transparent" /> : null}
              Full ({fmt(remaining)})
            </button>
          </>
        )}

        {/* Contact */}
        {parentPhone && (
          <>
            <a
              href={`https://wa.me/${parentPhone.replace(/\D/g, '')}`}
              target="_blank" rel="noopener noreferrer"
              className="rounded-lg bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-700 hover:bg-emerald-100"
            >
              WhatsApp
            </a>
            <a
              href={`tel:${parentPhone}`}
              className="rounded-lg bg-blue-50 px-2.5 py-1 text-[11px] font-medium text-blue-700 hover:bg-blue-100"
            >
              Call
            </a>
          </>
        )}

        <button
          onClick={onOpen}
          className="ml-auto rounded-lg border border-[#E2E8F0] px-2.5 py-1 text-[11px] font-medium text-[#64748B] hover:border-[#CBD5E1]"
        >
          Detail →
        </button>
      </div>
    </div>
  )
}

export default function CollectionsView({ sections, branchIds, stats }: Props) {
  const [activeSection, setActiveSection] = useState<string>('overdue')
  const [drawerStudent, setDrawerStudent] = useState<StudentOperationsRow | null>(null)

  const current = sections.find(s => s.id === activeSection) ?? sections[0]

  return (
    <div className="space-y-5">

      {/* ── KPI strip ───────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {[
          { label: 'Total Outstanding', value: `EGP ${fmt(stats.totalOutstanding)}`, color: 'bg-slate-400' },
          { label: 'Due Today',         value: `EGP ${fmt(stats.totalDueToday)}`,    color: 'bg-blue-400'  },
          { label: 'Overdue Amount',    value: `EGP ${fmt(stats.totalOverdue)}`,     color: 'bg-red-500'   },
          { label: 'Overdue Count',     value: stats.overdueCount,                   color: stats.overdueCount > 0 ? 'bg-red-400' : 'bg-slate-300' },
          { label: 'Milestone Alerts',  value: stats.milestoneCount,                 color: stats.milestoneCount > 0 ? 'bg-amber-400' : 'bg-slate-300' },
        ].map(k => (
          <div key={k.label} className="rounded-xl border border-[#E2E8F0] bg-white p-3">
            <div className={`mb-1.5 h-1 w-6 rounded-full ${k.color} opacity-80`} />
            <p className="text-sm font-bold text-[#0B1F3A]">{k.value}</p>
            <p className="text-[11px] text-[#64748B]">{k.label}</p>
          </div>
        ))}
      </div>

      {/* ── Section tabs ────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-1.5">
        {sections.map(s => (
          <button
            key={s.id}
            onClick={() => setActiveSection(s.id)}
            className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-all ${
              activeSection === s.id
                ? 'border-[#0B1F3A] bg-[#0B1F3A] text-white'
                : 'border-[#E2E8F0] bg-white text-[#64748B] hover:border-[#CBD5E1]'
            }`}
          >
            <span className={`h-2 w-2 rounded-full ${s.color}`} />
            {s.label}
            <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
              activeSection === s.id ? 'bg-white/20 text-white' : 'bg-[#F1F5F9] text-[#64748B]'
            }`}>
              {s.rows.length}
            </span>
          </button>
        ))}
      </div>

      {/* ── Section content ─────────────────────────────────────────────────── */}
      {current && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-[#0B1F3A]">
              {current.label}
              <span className="ml-2 text-[#94A3B8] font-normal">({current.rows.length})</span>
            </h2>
            {current.rows.length > 0 && (
              <span className="text-xs text-[#64748B]">
                Outstanding: <strong className="text-[#0B1F3A]">EGP {fmt(current.rows.reduce((s, r) => s + r.remaining_amount, 0))}</strong>
              </span>
            )}
          </div>

          {current.rows.length === 0 ? (
            <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-6 py-10 text-center">
              <p className="text-sm font-medium text-emerald-600">All clear</p>
              <p className="mt-1 text-xs text-[#94A3B8]">{current.emptyMsg}</p>
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {current.rows.map(row => (
                <CollectionRow
                  key={row.enrollment_id ?? row.student_id}
                  row={row}
                  onOpen={() => setDrawerStudent(row)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Drawer */}
      {drawerStudent && (
        <StudentOpsDrawer
          student={drawerStudent}
          onClose={() => setDrawerStudent(null)}
        />
      )}
    </div>
  )
}
