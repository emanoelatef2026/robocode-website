'use client'

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import type { ParentOperationalRow, StudentPickerOption } from '@/modules/parents/operational'
import ParentDetailDrawer from './ParentDetailDrawer'
import ParentFormModal    from './ParentFormModal'

// Normalize Egyptian phone formats so search matches any variant
function normalizePhone(p: string): string {
  const s = p.replace(/[\s\-\(\)\+]/g, '')
  if (s.startsWith('20') && s.length >= 12) return '0' + s.slice(2)
  if (s.startsWith('002'))                  return '0' + s.slice(3)
  return s
}

// ── Constants ──────────────────────────────────────────────────────────────────

const HEALTH_CONFIG: Record<string, { label: string; color: string; text: string }> = {
  HEALTHY:         { label: 'Active',         color: 'bg-emerald-100', text: 'text-emerald-700' },
  AT_RISK:         { label: 'At Risk',         color: 'bg-red-100',    text: 'text-red-600'     },
  NEEDS_ATTENTION: { label: 'Needs Action',    color: 'bg-amber-100',  text: 'text-amber-700'   },
  NO_ENROLLMENTS:  { label: 'No Enrollment',   color: 'bg-orange-100', text: 'text-orange-700'  },
  GRADUATED:       { label: 'Graduated',       color: 'bg-blue-100',   text: 'text-blue-700'    },
  INACTIVE:        { label: 'Inactive',        color: 'bg-slate-100',  text: 'text-slate-500'   },
  ARCHIVED:        { label: 'Archived',        color: 'bg-slate-100',  text: 'text-slate-400'   },
  NO_CHILDREN:     { label: 'No Children',     color: 'bg-slate-100',  text: 'text-slate-500'   },
}

// ── Props ──────────────────────────────────────────────────────────────────────

interface Props {
  rows:           ParentOperationalRow[]
  branches:       { id: string; name: string }[]
  groups:         { id: string; name: string }[]
  courses:        { id: string; title: string }[]
  instructors:    { id: string; name: string }[]
  studentOptions: StudentPickerOption[]
  isTL:           boolean
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function ParentsClient({
  rows, branches, groups, courses, instructors, studentOptions, isTL,
}: Props) {
  const router   = useRouter()
  const pathname = usePathname()
  const sp       = useSearchParams()
  const [, startTransition] = useTransition()

  // ── Filter state ────────────────────────────────────────────────────────────
  const [search,          setSearch]          = useState(sp.get('q')           ?? '')
  const [filterBranch,    setFilterBranch]    = useState(sp.get('branch_id')   ?? '')
  const [filterGroup,     setFilterGroup]     = useState(sp.get('group_id')    ?? '')
  const [filterCourse,    setFilterCourse]    = useState(sp.get('course_id')   ?? '')
  const [filterInstructor,setFilterInstructor]= useState(sp.get('instructor_id') ?? '')
  const [filterHealth,    setFilterHealth]    = useState(sp.get('health')      ?? '')
  const [filterMulti,     setFilterMulti]     = useState(sp.get('multi')       ?? '')
  const [filterRisk,      setFilterRisk]      = useState(sp.get('has_risk')    ?? '')
  const [showFilters,     setShowFilters]     = useState(false)

  // ── Modal state ─────────────────────────────────────────────────────────────
  const [drawerParent,  setDrawerParent]  = useState<ParentOperationalRow | null>(null)
  const [createOpen,    setCreateOpen]    = useState(false)
  const [editParent,    setEditParent]    = useState<ParentOperationalRow | null>(null)

  // ── URL persistence ─────────────────────────────────────────────────────────
  const pushFilters = useCallback((overrides: Record<string, string> = {}) => {
    const params = new URLSearchParams()
    const merged = {
      q: search, branch_id: filterBranch, group_id: filterGroup,
      course_id: filterCourse, instructor_id: filterInstructor,
      health: filterHealth, multi: filterMulti, has_risk: filterRisk,
      ...overrides,
    }
    Object.entries(merged).forEach(([k, v]) => { if (v) params.set(k, v) })
    startTransition(() => router.replace(`${pathname}?${params.toString()}`, { scroll: false }))
  }, [search, filterBranch, filterGroup, filterCourse, filterInstructor, filterHealth, filterMulti, filterRisk, pathname, router])

  // ── Debounced search ────────────────────────────────────────────────────────
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(() => pushFilters({ q: search }), 350)
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current) }
  }, [search]) // eslint-disable-line react-hooks/exhaustive-deps

  const clearFilters = () => {
    setSearch(''); setFilterBranch(''); setFilterGroup(''); setFilterCourse('')
    setFilterInstructor(''); setFilterHealth(''); setFilterMulti(''); setFilterRisk('')
    startTransition(() => router.replace(pathname, { scroll: false }))
  }

  const activeFilterCount = [filterBranch, filterGroup, filterCourse, filterInstructor, filterHealth, filterMulti, filterRisk].filter(Boolean).length

  // ── Client-side filtering ───────────────────────────────────────────────────
  const filtered = useMemo(() => {
    return rows.filter(r => {
      if (filterBranch     && !r.branch_ids.includes(filterBranch))         return false
      if (filterGroup      && !r.group_ids.includes(filterGroup))           return false
      if (filterCourse     && !r.course_ids.includes(filterCourse))         return false
      if (filterInstructor && !r.instructor_ids.includes(filterInstructor)) return false
      if (filterHealth     && r.op_health !== filterHealth)                  return false
      if (filterMulti === '1' && r.children_count < 2)                      return false
      if (filterRisk  === '1' && r.attendance_risk_children_count === 0)    return false
      if (search) {
        const q        = search.toLowerCase()
        const qPhone   = normalizePhone(search)
        const rowPhone = r.phone ? normalizePhone(r.phone) : ''
        const phoneMatch = qPhone.length >= 5 && rowPhone.includes(qPhone)
        const haystack = [
          r.parent_name,
          r.email ?? '',
          ...r.children.flatMap(c => [
            c.student_name,
            c.student_code    ?? '',
            c.course_name     ?? '',
            c.group_name      ?? '',
            c.instructor_name ?? '',
          ]),
        ]
        if (!phoneMatch && !haystack.some(h => h.toLowerCase().includes(q))) return false
      }
      return true
    })
  }, [rows, search, filterBranch, filterGroup, filterCourse, filterInstructor, filterHealth, filterMulti, filterRisk])

  // ── KPI strip ───────────────────────────────────────────────────────────────
  const kpis = useMemo(() => [
    { label: 'Total Families',  value: rows.length,                                                                                              color: 'bg-blue-400'   },
    { label: 'At Risk',         value: rows.filter(r => r.op_health === 'AT_RISK').length,                                                       color: rows.some(r => r.op_health === 'AT_RISK') ? 'bg-red-400' : 'bg-slate-300'    },
    { label: 'Needs Action',    value: rows.filter(r => r.op_health === 'NEEDS_ATTENTION').length,                                               color: rows.some(r => r.op_health === 'NEEDS_ATTENTION') ? 'bg-amber-400' : 'bg-slate-300' },
    { label: 'No Enrollment',   value: rows.filter(r => r.op_health === 'NO_ENROLLMENTS').length,                                                color: rows.some(r => r.op_health === 'NO_ENROLLMENTS') ? 'bg-orange-400' : 'bg-slate-300' },
    { label: 'Multi-Child',     value: rows.filter(r => r.children_count > 1).length,                                                           color: 'bg-purple-400' },
    { label: 'Graduated/Inact', value: rows.filter(r => r.op_health === 'GRADUATED' || r.op_health === 'INACTIVE' || r.op_health === 'ARCHIVED').length, color: 'bg-slate-300'  },
  ], [rows])

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-[#0B1F3A]">Parents</h1>
          <p className="mt-0.5 text-sm text-[#64748B]">{filtered.length} of {rows.length} families</p>
        </div>
        {isTL && (
          <button
            onClick={() => setCreateOpen(true)}
            className="flex items-center gap-1.5 rounded-xl bg-[#FF8A1F] px-4 py-2 text-sm font-semibold text-white hover:bg-[#e87c18] active:scale-95 transition"
          >
            <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
            </svg>
            Add Parent
          </button>
        )}
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {kpis.map(k => (
          <div key={k.label} className="rounded-xl border border-[#E2E8F0] bg-white p-3">
            <div className={`mb-1.5 h-1 w-6 rounded-full ${k.color} opacity-80`} />
            <p className="text-lg font-bold text-[#0B1F3A]">{k.value}</p>
            <p className="text-[11px] text-[#64748B]">{k.label}</p>
          </div>
        ))}
      </div>

      {/* Filter bar */}
      <div className="space-y-2">
        <div className="flex flex-wrap gap-2">
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Name, phone, student, course…"
            className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2 text-sm text-[#0B1F3A] focus:border-[#FF8A1F] focus:outline-none min-w-52"
          />
          <button
            onClick={() => setShowFilters(f => !f)}
            className={`flex items-center gap-1.5 rounded-xl border px-3 py-2 text-sm font-medium transition
              ${showFilters || activeFilterCount > 0
                ? 'border-[#FF8A1F] bg-[#FF8A1F]/10 text-[#FF8A1F]'
                : 'border-[#E2E8F0] bg-[#F8FAFC] text-[#64748B] hover:border-[#CBD5E1]'}`}
          >
            <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M3 3a1 1 0 011-1h12a1 1 0 011 1v3a1 1 0 01-.293.707L13 10.414V17a1 1 0 01-.553.894l-4 2A1 1 0 017 19v-8.586L3.293 6.707A1 1 0 013 6V3z" clipRule="evenodd" />
            </svg>
            Filters
            {activeFilterCount > 0 && (
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[#FF8A1F] text-[10px] font-bold text-white">
                {activeFilterCount}
              </span>
            )}
          </button>
          {(search || activeFilterCount > 0) && (
            <button
              onClick={clearFilters}
              className="rounded-xl border border-[#E2E8F0] px-3 py-2 text-sm font-medium text-[#64748B] hover:border-[#CBD5E1]"
            >
              Clear
            </button>
          )}
        </div>

        {showFilters && (
          <div className="flex flex-wrap gap-2 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-3">
            {branches.length > 1 && (
              <select value={filterBranch} onChange={e => { setFilterBranch(e.target.value); pushFilters({ branch_id: e.target.value }) }}
                className="rounded-lg border border-[#E2E8F0] bg-white px-3 py-1.5 text-sm text-[#0B1F3A] focus:border-[#FF8A1F] focus:outline-none">
                <option value="">All Branches</option>
                {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            )}

            {instructors.length > 0 && (
              <select value={filterInstructor} onChange={e => { setFilterInstructor(e.target.value); pushFilters({ instructor_id: e.target.value }) }}
                className="rounded-lg border border-[#E2E8F0] bg-white px-3 py-1.5 text-sm text-[#0B1F3A] focus:border-[#FF8A1F] focus:outline-none">
                <option value="">All Instructors</option>
                {instructors.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
              </select>
            )}

            {courses.length > 0 && (
              <select value={filterCourse} onChange={e => { setFilterCourse(e.target.value); pushFilters({ course_id: e.target.value }) }}
                className="rounded-lg border border-[#E2E8F0] bg-white px-3 py-1.5 text-sm text-[#0B1F3A] focus:border-[#FF8A1F] focus:outline-none">
                <option value="">All Courses</option>
                {courses.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
              </select>
            )}

            {groups.length > 0 && (
              <select value={filterGroup} onChange={e => { setFilterGroup(e.target.value); pushFilters({ group_id: e.target.value }) }}
                className="rounded-lg border border-[#E2E8F0] bg-white px-3 py-1.5 text-sm text-[#0B1F3A] focus:border-[#FF8A1F] focus:outline-none">
                <option value="">All Groups</option>
                {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
            )}

            <select value={filterHealth} onChange={e => { setFilterHealth(e.target.value); pushFilters({ health: e.target.value }) }}
              className="rounded-lg border border-[#E2E8F0] bg-white px-3 py-1.5 text-sm text-[#0B1F3A] focus:border-[#FF8A1F] focus:outline-none">
              <option value="">All Health</option>
              {Object.entries(HEALTH_CONFIG).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </select>

            <select value={filterMulti} onChange={e => { setFilterMulti(e.target.value); pushFilters({ multi: e.target.value }) }}
              className="rounded-lg border border-[#E2E8F0] bg-white px-3 py-1.5 text-sm text-[#0B1F3A] focus:border-[#FF8A1F] focus:outline-none">
              <option value="">All Families</option>
              <option value="1">Multi-Child Only</option>
            </select>

            <select value={filterRisk} onChange={e => { setFilterRisk(e.target.value); pushFilters({ has_risk: e.target.value }) }}
              className="rounded-lg border border-[#E2E8F0] bg-white px-3 py-1.5 text-sm text-[#0B1F3A] focus:border-[#FF8A1F] focus:outline-none">
              <option value="">All Risk Levels</option>
              <option value="1">Has Attendance Risk</option>
            </select>
          </div>
        )}
      </div>

      {/* Table / Cards */}
      <div className="rounded-xl border border-[#E2E8F0] bg-white">
        {filtered.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <p className="text-sm font-medium text-[#0B1F3A]">No parents found</p>
            <p className="mt-1 text-xs text-[#94A3B8]">
              {search || activeFilterCount > 0 ? 'Try adjusting your search or filters.' : 'Parents appear here once linked to students in your branch.'}
            </p>
          </div>
        ) : (
          <>
            {/* ── Mobile cards ─────────────────────────────────────────── */}
            <div className="md:hidden divide-y divide-[#E2E8F0]">
              {filtered.map(row => {
                const hCfg = HEALTH_CONFIG[row.op_health] ?? HEALTH_CONFIG.HEALTHY
                return (
                  <div
                    key={row.parent_id}
                    className="cursor-pointer px-4 py-4 hover:bg-[#F8FAFC]"
                    onClick={() => setDrawerParent(row)}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-[15px] font-semibold text-[#0B1F3A] leading-tight">{row.parent_name}</p>
                        {row.email && <p className="text-[11px] text-[#94A3B8] truncate">{row.email}</p>}
                        {row.phone && (
                          <a href={`tel:${row.phone}`} className="text-[12px] text-[#64748B]" onClick={e => e.stopPropagation()}>
                            {row.phone}
                          </a>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${hCfg.color} ${hCfg.text}`}>
                          {hCfg.label}
                        </span>
                        <span className="rounded-full bg-[#F1F5F9] px-2 py-0.5 text-[10px] font-semibold text-[#64748B]">
                          {row.children_count} child{row.children_count !== 1 ? 'ren' : ''}
                        </span>
                      </div>
                    </div>

                    {/* Children summary */}
                    {row.children.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {row.children.slice(0, 2).map(c => (
                          <div key={c.student_id} className="flex items-center gap-1.5 text-[11px] text-[#64748B]">
                            <span className="font-medium text-[#0B1F3A]">{c.student_name}</span>
                            {c.age !== null && <span>· Age {c.age}</span>}
                            {c.group_name && <span>· {c.group_name}</span>}
                            {c.risk_level === 'HIGH' && (
                              <span className="ml-auto rounded-full bg-red-100 px-1.5 py-0.5 text-[9px] font-bold text-red-600">RISK</span>
                            )}
                          </div>
                        ))}
                        {row.children.length > 2 && (
                          <p className="text-[10px] text-[#94A3B8]">+{row.children.length - 2} more children</p>
                        )}
                      </div>
                    )}

                    <div className="mt-2 flex items-center gap-2" onClick={e => e.stopPropagation()}>
                      {row.phone && (
                        <>
                          <a
                            href={`https://wa.me/${row.phone.replace(/\D/g, '')}`}
                            target="_blank" rel="noopener noreferrer"
                            className="rounded-lg border border-[#E2E8F0] px-2.5 py-1.5 text-[11px] font-medium text-[#25D366] hover:bg-green-50"
                          >
                            WhatsApp
                          </a>
                          <a href={`tel:${row.phone}`} className="rounded-lg border border-[#E2E8F0] px-2.5 py-1.5 text-[11px] font-medium text-[#64748B] hover:bg-[#F8FAFC]">
                            Call
                          </a>
                        </>
                      )}
                      <div className="ml-auto flex items-center gap-1.5">
                        {isTL && (
                          <button
                            onClick={() => setEditParent(row)}
                            className="rounded-lg border border-[#E2E8F0] px-2.5 py-1.5 text-[11px] font-medium text-[#64748B] hover:bg-[#F8FAFC]"
                          >
                            Edit
                          </button>
                        )}
                        <button
                          onClick={() => setDrawerParent(row)}
                          className="rounded-lg bg-[#FF8A1F]/10 px-3 py-1.5 text-[12px] font-semibold text-[#FF8A1F]"
                        >
                          View →
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* ── Desktop table ─────────────────────────────────────────── */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                    <th className="px-4 py-3 text-left text-xs font-medium text-[#64748B]">Parent</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-[#64748B]">Phone</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-[#64748B]">Children</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-[#64748B]">Sessions</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-[#64748B]">Health</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-[#64748B]">Badges</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(row => {
                    const hCfg = HEALTH_CONFIG[row.op_health] ?? HEALTH_CONFIG.HEALTHY
                    return (
                      <tr
                        key={row.parent_id}
                        className="cursor-pointer border-b border-[#E2E8F0] last:border-0 hover:bg-[#F8FAFC]"
                        onClick={() => setDrawerParent(row)}
                      >
                        {/* Parent identity */}
                        <td className="px-4 py-3">
                          <p className="font-medium text-[#0B1F3A]">{row.parent_name}</p>
                          {row.email && (
                            <p className="text-[11px] text-[#94A3B8] max-w-48 truncate">{row.email}</p>
                          )}
                        </td>

                        {/* Phone */}
                        <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                          {row.phone ? (
                            <div className="flex items-center gap-1.5">
                              <a href={`tel:${row.phone}`} className="text-sm text-[#0B1F3A] hover:text-[#FF8A1F]">{row.phone}</a>
                              <a
                                href={`https://wa.me/${row.phone.replace(/\D/g, '')}`}
                                target="_blank" rel="noopener noreferrer"
                                className="rounded border border-[#25D366]/30 px-1.5 py-0.5 text-[10px] font-medium text-[#25D366] hover:bg-green-50"
                              >
                                WA
                              </a>
                            </div>
                          ) : (
                            <span className="text-[#94A3B8]">—</span>
                          )}
                        </td>

                        {/* Children */}
                        <td className="px-4 py-3">
                          <p className="font-medium text-[#0B1F3A]">
                            {row.children_count} child{row.children_count !== 1 ? 'ren' : ''}
                          </p>
                          {row.children.length > 0 && (
                            <p className="text-[11px] text-[#94A3B8] truncate max-w-32">
                              {row.children.map(c => c.student_name).join(', ')}
                            </p>
                          )}
                        </td>

                        {/* Sessions */}
                        <td className="px-4 py-3">
                          {row.total_sessions_remaining > 0 ? (
                            <>
                              <p className={`font-medium ${row.near_exhaustion_children_count > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                                {row.total_sessions_remaining} remaining
                              </p>
                              <p className="text-[11px] text-[#94A3B8]">across {row.active_contracts_count} contract{row.active_contracts_count !== 1 ? 's' : ''}</p>
                            </>
                          ) : (
                            <span className="text-[#94A3B8]">—</span>
                          )}
                        </td>

                        {/* Health */}
                        <td className="px-4 py-3">
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${hCfg.color} ${hCfg.text}`}>
                            {hCfg.label}
                          </span>
                        </td>

                        {/* Badges */}
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1">
                            {row.children_count > 1 && (
                              <span className="rounded-full bg-purple-100 px-1.5 py-0.5 text-[9px] font-bold text-purple-700">
                                MULTI
                              </span>
                            )}
                            {row.attendance_risk_children_count > 0 && (
                              <span className="rounded-full bg-red-100 px-1.5 py-0.5 text-[9px] font-bold text-red-600">
                                ATT RISK
                              </span>
                            )}
                            {row.near_exhaustion_children_count > 0 && (
                              <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold text-amber-700">
                                NEAR END
                              </span>
                            )}
                            {(row.op_health === 'NO_CHILDREN' || row.op_health === 'ARCHIVED') && (
                              <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[9px] font-bold text-slate-500">
                                {row.op_health === 'ARCHIVED' ? 'ARCHIVED' : 'NO CHILD'}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Actions */}
                        <td className="px-4 py-3 text-right" onClick={e => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-3">
                            {isTL && (
                              <button
                                onClick={() => setEditParent(row)}
                                className="text-xs font-medium text-[#64748B] hover:text-[#0B1F3A] hover:underline"
                              >
                                Edit
                              </button>
                            )}
                            <button
                              onClick={() => setDrawerParent(row)}
                              className="text-xs font-medium text-[#FF8A1F] hover:underline"
                            >
                              View
                            </button>
                          </div>
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

      {/* ── Detail Drawer ────────────────────────────────────────────────────── */}
      {drawerParent && (
        <ParentDetailDrawer
          parent={drawerParent}
          isTL={isTL}
          onClose={() => setDrawerParent(null)}
          onEdit={isTL ? () => { setEditParent(drawerParent); setDrawerParent(null) } : undefined}
        />
      )}

      {/* ── Add Parent Modal ─────────────────────────────────────────────────── */}
      {createOpen && (
        <ParentFormModal
          mode="create"
          studentOptions={studentOptions}
          onClose={() => setCreateOpen(false)}
          onSuccess={() => { setCreateOpen(false); router.refresh() }}
        />
      )}

      {/* ── Edit Parent Modal ────────────────────────────────────────────────── */}
      {editParent && (
        <ParentFormModal
          mode="edit"
          parent={editParent}
          studentOptions={studentOptions}
          onClose={() => setEditParent(null)}
          onSuccess={() => { setEditParent(null); router.refresh() }}
        />
      )}
    </div>
  )
}
