import { requirePortalRole }        from '@/modules/rbac/guards'
import { getSystemEvents }           from '@/modules/observability'
import type { EventSeverity, EventType } from '@/modules/observability/types'
import Link                          from 'next/link'

// ── Severity badge ─────────────────────────────────────────────────────────────

function SeverityBadge({ sev }: { sev: string }) {
  const cfg: Record<string, string> = {
    critical: 'bg-[#FEE2E2] text-[#991B1B]',
    error:    'bg-orange-100 text-orange-700',
    warning:  'bg-[#FFFBEB] text-[#B45309]',
    info:     'bg-[#EFF6FF] text-[#1D4ED8]',
  }
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${cfg[sev] ?? 'bg-[#F1F5F9] text-[#475569]'}`}>
      {sev}
    </span>
  )
}

function TypeBadge({ type }: { type: string }) {
  const short = type.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase())
  return (
    <span className="rounded-md bg-[#F1F5F9] px-2 py-0.5 text-[11px] font-medium text-[#64748B]">
      {short}
    </span>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────────

interface Props {
  searchParams: Promise<{
    sev?:    string
    module?: string
    type?:   string
    unresolved?: string
  }>
}

export default async function SystemEventsPage({ searchParams }: Props) {
  await requirePortalRole('super_admin')
  const params = await searchParams

  const severityFilter = (params.sev    ?? '') as EventSeverity | ''
  const moduleFilter   = params.module  ?? ''
  const typeFilter     = (params.type   ?? '') as EventType | ''
  const unresolvedOnly = params.unresolved === '1'

  const events = await getSystemEvents({
    severities:      severityFilter ? [severityFilter] : undefined,
    module:          moduleFilter   || undefined,
    types:           typeFilter     ? [typeFilter]     : undefined,
    unresolvedOnly:  unresolvedOnly || undefined,
    limit:           100,
  })

  // Distinct modules for filter dropdown
  const allModules = [...new Set(events.map(e => e.module))]

  return (
    <div className="space-y-6">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-end gap-3">
        <Link href="/admin/system-health" className="rounded-lg border border-[#E2E8F0] px-3 py-2 text-[12px] font-medium text-[#64748B] hover:border-[#FF8A1F] hover:text-[#FF8A1F]">
          Health Score →
        </Link>
      </div>

      {/* ── Filters ────────────────────────────────────────────────────── */}
      <form method="get" className="flex flex-wrap gap-2">
        <select name="sev" defaultValue={severityFilter}
          className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2 text-sm text-[#0B1F3A] focus:border-[#FF8A1F] focus:outline-none">
          <option value="">All Severities</option>
          {(['critical','error','warning','info'] as EventSeverity[]).map(s => (
            <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
          ))}
        </select>

        <select name="module" defaultValue={moduleFilter}
          className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2 text-sm text-[#0B1F3A] focus:border-[#FF8A1F] focus:outline-none">
          <option value="">All Modules</option>
          {allModules.map(m => <option key={m} value={m}>{m}</option>)}
        </select>

        <select name="type" defaultValue={typeFilter}
          className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2 text-sm text-[#0B1F3A] focus:border-[#FF8A1F] focus:outline-none">
          <option value="">All Types</option>
          {([
            'AUTOMATION_FAILURE','JOB_FAILURE','JOB_DEAD_LETTER','NOTIFICATION_FAILURE',
            'CONSISTENCY_MISMATCH','REALTIME_ERROR','SLOW_QUERY','SECURITY_DENIAL','REPAIR_ACTION',
          ] as EventType[]).map(t => (
            <option key={t} value={t}>{t.replace(/_/g,' ')}</option>
          ))}
        </select>

        <label className="flex items-center gap-2 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2 text-sm text-[#64748B]">
          <input type="checkbox" name="unresolved" value="1" defaultChecked={unresolvedOnly} />
          Unresolved only
        </label>

        <button type="submit" className="rounded-xl bg-[#FF8A1F] px-4 py-2 text-sm font-medium text-white hover:bg-[#e87c18]">
          Filter
        </button>
        {(severityFilter || moduleFilter || typeFilter || unresolvedOnly) && (
          <Link href="/admin/system-events" className="rounded-xl border border-[#E2E8F0] px-4 py-2 text-sm font-medium text-[#64748B] hover:border-[#CBD5E1]">
            Clear
          </Link>
        )}
      </form>

      {/* ── Event List ─────────────────────────────────────────────────── */}
      {events.length === 0 ? (
        <div className="ds-card px-6 py-16 text-center">
          <p className="text-sm font-medium text-[#0B1F3A]">No events found</p>
          <p className="mt-1 text-xs text-[#94A3B8]">
            {unresolvedOnly ? 'No unresolved events — the system is healthy.' : 'No events match the current filters.'}
          </p>
        </div>
      ) : (
        <div className="overflow-hidden ds-card">
          <div className="divide-y divide-[#F1F5F9]">
            {events.map(evt => (
              <div key={evt.id} className={`px-5 py-4 hover:bg-[#F8FAFC] ${!evt.resolved ? '' : 'opacity-50'}`}>
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex-shrink-0">
                    <SeverityBadge sev={evt.severity ?? 'info'} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <TypeBadge type={evt.type} />
                      <span className="text-[11px] text-[#94A3B8]">{evt.module}</span>
                      {evt.entity_type && (
                        <span className="text-[11px] text-[#94A3B8]">
                          {evt.entity_type}{evt.entity_id ? ` ·${evt.entity_id.slice(0, 8)}` : ''}
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-sm text-[#0B1F3A]">{evt.message}</p>
                    {Object.keys(evt.payload ?? {}).length > 0 && (
                      <details className="mt-1">
                        <summary className="cursor-pointer text-[11px] text-[#94A3B8] hover:text-[#64748B]">Payload</summary>
                        <pre className="mt-1 overflow-x-auto rounded-md bg-[#F8FAFC] p-2 text-[10px] text-[#64748B]">
                          {JSON.stringify(evt.payload, null, 2)}
                        </pre>
                      </details>
                    )}
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-[11px] text-[#94A3B8]">
                      {new Date(evt.created_at).toLocaleString('en-GB', {
                        day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
                      })}
                    </p>
                    {evt.resolved && (
                      <span className="mt-1 block text-[10px] text-[#10B981]">Resolved</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
