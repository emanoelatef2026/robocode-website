import { requirePortalRole }     from '@/modules/rbac/guards'
import { listParentsByBranch }   from '@/modules/tl-dashboard/queries'
import Link                      from 'next/link'

function fmt(n: number) {
  return new Intl.NumberFormat('en-EG', { maximumFractionDigits: 0 }).format(n)
}

interface Props {
  searchParams: Promise<{ page?: string; q?: string; risk?: string }>
}

export default async function TLParentsPage({ searchParams }: Props) {
  const user   = await requirePortalRole('team_leader')
  const params = await searchParams
  const page   = Number(params.page ?? 1)
  const search = params.q ?? ''
  const risk   = params.risk ?? ''

  const result = await listParentsByBranch(user.branchIds, { page, perPage: 30, search })

  // Apply risk filter client-side
  const filtered = risk
    ? result.data.filter(p => p.risk_level === risk)
    : result.data

  // ── KPI cards ──────────────────────────────────────────────────────────────
  const allData     = result.data
  const totalParents = allData.length
  const overdueParents = allData.filter(p => p.has_overdue).length
  const totalOutstanding = allData.reduce((s, p) => s + p.total_remaining, 0)
  const highRisk = allData.filter(p => p.risk_level === 'HIGH').length

  const kpis = [
    { label: 'Total Parents',    value: totalParents,                  color: 'bg-blue-400' },
    { label: 'Overdue Payments', value: overdueParents,                color: overdueParents > 0 ? 'bg-red-400' : 'bg-slate-300' },
    { label: 'High Risk',        value: highRisk,                      color: highRisk > 0 ? 'bg-red-400' : 'bg-slate-300' },
    { label: 'Total Outstanding',value: `EGP ${fmt(totalOutstanding)}`,color: 'bg-amber-400' },
  ]

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-[#0B1F3A]">Parents</h1>
          <p className="mt-0.5 text-sm text-[#64748B]">{result.total} parents linked to students in your branch</p>
        </div>
        <Link
          href="/portal/team-leader/parents/new"
          className="inline-flex items-center gap-2 rounded-lg bg-[#FF8A1F] px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-[#e87c18]"
        >
          <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
            <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" />
          </svg>
          Add Parent
        </Link>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {kpis.map(k => (
          <div key={k.label} className="rounded-xl border border-[#E2E8F0] bg-white p-3">
            <div className={`mb-1.5 h-1 w-6 rounded-full ${k.color} opacity-80`} />
            <p className="text-lg font-bold text-[#0B1F3A]">{k.value}</p>
            <p className="text-[11px] text-[#64748B]">{k.label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <form method="get" className="flex flex-wrap gap-2">
        <input
          name="q"
          defaultValue={search}
          placeholder="Search parent name, email, phone…"
          className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2 text-sm text-[#0B1F3A] focus:border-[#FF8A1F] focus:outline-none min-w-52"
        />
        <select
          name="risk"
          defaultValue={risk}
          className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2 text-sm text-[#0B1F3A] focus:border-[#FF8A1F] focus:outline-none"
        >
          <option value="">All Risk Levels</option>
          <option value="HIGH">High Risk (Overdue)</option>
          <option value="MEDIUM">Medium Risk (Balance)</option>
          <option value="LOW">Low Risk</option>
        </select>
        <button type="submit" className="rounded-xl bg-[#FF8A1F] px-4 py-2 text-sm font-medium text-white hover:bg-[#e87c18]">Filter</button>
        {(search || risk) && (
          <Link href="/portal/team-leader/parents" className="rounded-xl border border-[#E2E8F0] px-4 py-2 text-sm font-medium text-[#64748B] hover:border-[#CBD5E1]">
            Clear
          </Link>
        )}
      </form>

      {/* Table */}
      <div className="rounded-xl border border-[#E2E8F0] bg-white">
        {filtered.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <p className="text-sm font-medium text-[#0B1F3A]">No parents found</p>
            <p className="mt-1 text-xs text-[#94A3B8]">
              {search || risk ? 'Try adjusting your search or filters.' : 'Parents appear here once linked to students in your branch.'}
            </p>
          </div>
        ) : (
          <>
            {/* Mobile cards */}
            <div className="md:hidden divide-y divide-[#E2E8F0]">
              {filtered.map(parent => {
                const name = [parent.first_name, parent.last_name].filter(Boolean).join(' ') || parent.email || '—'
                return (
                  <div key={parent.id} className="px-4 py-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <Link href={`/portal/team-leader/parents/${parent.id}`} className="block text-[15px] font-semibold text-[#0B1F3A]">{name}</Link>
                        {parent.email && <p className="mt-0.5 text-[12px] text-[#64748B] truncate">{parent.email}</p>}
                        {parent.phone && <a href={`tel:${parent.phone}`} className="text-[12px] text-[#0B1F3A]">{parent.phone}</a>}
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <span className="rounded-full bg-[#F1F5F9] px-2.5 py-1 text-[12px] font-semibold text-[#64748B]">
                          {parent.student_count} child{parent.student_count !== 1 ? 'ren' : ''}
                        </span>
                        {parent.risk_level && (
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold
                            ${parent.risk_level === 'HIGH' ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-700'}`}>
                            {parent.risk_level}
                          </span>
                        )}
                      </div>
                    </div>
                    {parent.total_remaining > 0 && (
                      <p className={`mt-1 text-[12px] font-medium ${parent.has_overdue ? 'text-red-600' : 'text-amber-600'}`}>
                        EGP {fmt(parent.total_remaining)} outstanding
                      </p>
                    )}
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <div className="flex gap-2">
                        {parent.phone && (
                          <a
                            href={`https://wa.me/${parent.phone.replace(/\D/g, '')}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="rounded-lg border border-[#E2E8F0] px-3 py-1.5 text-[11px] font-medium text-[#25D366] hover:bg-green-50"
                          >
                            WhatsApp
                          </a>
                        )}
                        {parent.phone && (
                          <a href={`tel:${parent.phone}`} className="rounded-lg border border-[#E2E8F0] px-3 py-1.5 text-[11px] font-medium text-[#64748B] hover:bg-[#F8FAFC]">
                            Call
                          </a>
                        )}
                      </div>
                      <Link href={`/portal/team-leader/parents/${parent.id}`} className="rounded-lg bg-[#FF8A1F]/10 px-3 py-1.5 text-[12px] font-semibold text-[#FF8A1F] min-h-9 flex items-center">
                        View →
                      </Link>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                    <th className="px-4 py-3 text-left text-xs font-medium text-[#64748B]">Parent</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-[#64748B]">Phone</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-[#64748B]">Children</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-[#64748B]">Outstanding</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-[#64748B]">Risk / Health</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-[#64748B]">Quick Actions</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(parent => {
                    const name = [parent.first_name, parent.last_name].filter(Boolean).join(' ') || parent.email || '—'
                    return (
                      <tr key={parent.id} className="border-b border-[#E2E8F0] last:border-0 hover:bg-[#F8FAFC]">
                        <td className="px-4 py-3">
                          <p className="font-medium text-[#0B1F3A]">{name}</p>
                          {parent.email && <p className="text-[11px] text-[#94A3B8] truncate max-w-50">{parent.email}</p>}
                        </td>
                        <td className="px-4 py-3">
                          {parent.phone
                            ? <a href={`tel:${parent.phone}`} className="text-[#0B1F3A] hover:text-[#FF8A1F]">{parent.phone}</a>
                            : <span className="text-[#94A3B8]">—</span>}
                        </td>
                        <td className="px-4 py-3 text-right font-medium text-[#0B1F3A]">{parent.student_count}</td>
                        <td className="px-4 py-3 text-right">
                          {parent.total_remaining > 0 ? (
                            <span className={`font-medium ${parent.has_overdue ? 'text-red-600' : 'text-amber-600'}`}>
                              EGP {fmt(parent.total_remaining)}
                            </span>
                          ) : (
                            <span className="text-[#94A3B8]">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-col gap-1">
                            {parent.risk_level ? (
                              <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold
                                ${parent.risk_level === 'HIGH' ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-700'}`}>
                                {parent.risk_level}
                              </span>
                            ) : (
                              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-600">OK</span>
                            )}
                            <span className={`text-[10px] font-semibold ${parent.health_score >= 80 ? 'text-emerald-600' : parent.health_score >= 50 ? 'text-amber-600' : 'text-red-600'}`}>
                              {parent.health_score}/100
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-2">
                            {parent.phone && (
                              <>
                                <a
                                  href={`https://wa.me/${parent.phone.replace(/\D/g, '')}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="rounded-lg border border-[#E2E8F0] px-2.5 py-1 text-[11px] font-medium text-[#25D366] hover:bg-green-50"
                                >
                                  WA
                                </a>
                                <a href={`tel:${parent.phone}`} className="rounded-lg border border-[#E2E8F0] px-2.5 py-1 text-[11px] font-medium text-[#64748B] hover:bg-[#F8FAFC]">
                                  Call
                                </a>
                              </>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Link href={`/portal/team-leader/parents/${parent.id}`} className="text-xs font-medium text-[#FF8A1F] hover:underline">View</Link>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
