'use client'
import { useState } from 'react'
import Link         from 'next/link'

// ── Recovery operation card ───────────────────────────────────────────────────

interface OpCardProps {
  id:          string
  title:       string
  description: string
  risk:        'safe' | 'moderate' | 'caution'
  onRun:       (id: string) => void
  result:      null | { success: boolean; repaired: number; duration_ms: number; error?: string }
  running:     boolean
}

function OpCard({ id, title, description, risk, onRun, result, running }: OpCardProps) {
  const riskCls = risk === 'safe' ? 'border-emerald-200 bg-emerald-50' :
                  risk === 'moderate' ? 'border-amber-200 bg-amber-50' :
                  'border-orange-200 bg-orange-50'
  const riskLabel = risk === 'safe' ? 'Safe — idempotent' : risk === 'moderate' ? 'Moderate' : 'Caution'
  const riskTextCls = risk === 'safe' ? 'text-emerald-700' : risk === 'moderate' ? 'text-amber-700' : 'text-orange-700'

  return (
    <div className={`rounded-xl border p-4 ${riskCls}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="font-semibold text-[#0B1F3A]">{title}</p>
            <span className={`text-[10px] font-semibold ${riskTextCls}`}>{riskLabel}</span>
          </div>
          <p className="mt-0.5 text-[12px] text-[#64748B]">{description}</p>
        </div>
        <button
          onClick={() => onRun(id)}
          disabled={running}
          className={`shrink-0 rounded-lg px-4 py-2 text-[12px] font-semibold text-white transition-colors
            ${running ? 'cursor-not-allowed bg-slate-300' :
              risk === 'safe' ? 'bg-emerald-600 hover:bg-emerald-700' :
              risk === 'moderate' ? 'bg-amber-500 hover:bg-amber-600' :
              'bg-orange-600 hover:bg-orange-700'
            }`}
        >
          {running ? 'Running…' : 'Run'}
        </button>
      </div>

      {result && (
        <div className={`mt-3 rounded-lg p-3 text-sm ${result.success ? 'bg-white' : 'bg-red-50'}`}>
          {result.success ? (
            <p className="text-emerald-700 font-medium">
              ✓ Fixed {result.repaired} records in {result.duration_ms}ms
            </p>
          ) : (
            <p className="text-red-700 font-medium">✗ Error: {result.error}</p>
          )}
        </div>
      )}
    </div>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────────

interface OpResult { success: boolean; repaired: number; duration_ms: number; error?: string }

type OpResults = Partial<Record<string, OpResult>>

const OPERATIONS = [
  {
    id:          'repair_balances',
    title:       'Repair Finance Balances',
    description: 'Fixes remaining_amount = net_amount - paid_amount for all drifted accounts. Idempotent — safe to re-run.',
    risk:        'safe' as const,
  },
  {
    id:          'rebuild_codes',
    title:       'Rebuild Missing Contract Codes',
    description: 'Generates CNT-YYYY-NNNNNN codes for active enrollments missing contract codes.',
    risk:        'safe' as const,
  },
  {
    id:          'cleanup_tasks',
    title:       'Cleanup Orphan Tasks',
    description: 'Dismisses open tasks for enrollments no longer active (completed, dropped, or deleted).',
    risk:        'safe' as const,
  },
  {
    id:          'repair_payments',
    title:       'Repair Orphan Payments',
    description: 'Links payments with no account_id or enrollment_id to the student\'s primary account.',
    risk:        'moderate' as const,
  },
  {
    id:          'recompute_sessions',
    title:       'Recompute Session Consumption',
    description: 'Recounts consumed_sessions from actual attendance records for all active enrollments.',
    risk:        'moderate' as const,
  },
  {
    id:          'full_suite',
    title:       'Run Full Recovery Suite',
    description: 'Runs all safe repairs in sequence: balances + contract codes + orphan tasks + orphan payments.',
    risk:        'moderate' as const,
  },
]

export default function RecoveryPage() {
  const [running, setRunning]   = useState<string | null>(null)
  const [results, setResults]   = useState<OpResults>({})
  const [summary, setSummary]   = useState<null | { items: any[] }>(null)

  async function loadSummary() {
    const res = await fetch('/api/admin/recovery?action=summary')
    if (res.ok) {
      const data = await res.json()
      setSummary({ items: data.summary ?? [] })
    }
  }

  async function runOp(id: string) {
    setRunning(id)
    try {
      const res  = await fetch('/api/admin/recovery', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ operation: id }),
      })
      const data = await res.json()
      setResults(prev => ({ ...prev, [id]: data }))
    } catch (e) {
      setResults(prev => ({ ...prev, [id]: { success: false, repaired: 0, duration_ms: 0, error: String(e) } }))
    } finally {
      setRunning(null)
    }
  }

  return (
    <div className="max-w-3xl space-y-6">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-end gap-3">
        <div className="flex gap-2">
          <button
            onClick={loadSummary}
            className="rounded-lg border border-[#E2E8F0] px-3 py-2 text-[12px] font-medium text-[#64748B] hover:border-[#FF8A1F] hover:text-[#FF8A1F]"
          >
            Check Status
          </button>
          <Link href="/admin/system-health" className="rounded-lg border border-[#E2E8F0] px-3 py-2 text-[12px] font-medium text-[#64748B] hover:border-[#FF8A1F] hover:text-[#FF8A1F]">
            Health →
          </Link>
        </div>
      </div>

      {/* ── Recovery Summary ───────────────────────────────────────────── */}
      {summary && (
        <div className="rounded-xl border border-[#E2E8F0] bg-white overflow-hidden">
          <div className="border-b border-[#E2E8F0] px-4 py-3">
            <p className="text-[13px] font-semibold text-[#0B1F3A]">Current Recovery Needs</p>
          </div>
          <div className="divide-y divide-[#F1F5F9]">
            {summary.items.map((item: any) => (
              <div key={item.check_name} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="text-[13px] font-medium text-[#0B1F3A]">{item.description}</p>
                  <p className="text-[11px] text-[#94A3B8]">{item.check_name}</p>
                </div>
                <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold
                  ${item.severity === 'critical' ? 'bg-red-100 text-red-700' :
                    item.severity === 'warning'  ? 'bg-amber-100 text-amber-700' :
                    'bg-emerald-100 text-emerald-700'}`}>
                  {item.count}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Operations ─────────────────────────────────────────────────── */}
      <div>
        <h2 className="mb-3 text-[14px] font-semibold text-[#0B1F3A]">Recovery Operations</h2>
        <p className="mb-4 text-[12px] text-[#94A3B8]">
          All operations are idempotent — safe to run multiple times. They log results to the system event log.
        </p>
        <div className="space-y-3">
          {OPERATIONS.map(op => (
            <OpCard
              key={op.id}
              {...op}
              running={running === op.id}
              result={results[op.id] ?? null}
              onRun={runOp}
            />
          ))}
        </div>
      </div>

      {/* ── Warning ────────────────────────────────────────────────────── */}
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
        <p className="font-semibold">⚠ Super Admin Only</p>
        <p className="mt-0.5">Recovery operations modify production data. Always check the summary before running. All actions are logged to the system event log.</p>
      </div>

    </div>
  )
}
