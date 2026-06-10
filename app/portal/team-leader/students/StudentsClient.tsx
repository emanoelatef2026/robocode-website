'use client'

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import type { StudentOperationalRow, GroupPickerOption } from '@/modules/students/operational'
import { bulkDeleteStudentsAction } from '@/modules/students/modal-actions'
import StudentFormModal from './StudentFormModal'
import StudentDetailDrawer from './StudentDetailDrawer'
import GroupAssignModal from './GroupAssignModal'

function normalizePhone(p: string): string {
  const s = p.replace(/[\s\-\(\)\+]/g, '')
  if (s.startsWith('20') && s.length >= 12) return '0' + s.slice(2)
  if (s.startsWith('002'))                  return '0' + s.slice(3)
  return s
}

// ── Constants ──────────────────────────────────────────────────────────────────

const OP_STATUS_CONFIG: Record<string, { label: string; color: string; text: string }> = {
  ACTIVE:          { label: 'Active',          color: 'bg-emerald-100', text: 'text-emerald-700' },
  NO_GROUP:        { label: 'No Group',        color: 'bg-slate-100',   text: 'text-slate-600'   },
  INACTIVE:        { label: 'Inactive',        color: 'bg-red-100',     text: 'text-red-600'     },
  LOW_ATTENDANCE:  { label: 'Low Attendance',  color: 'bg-amber-100',   text: 'text-amber-700'   },
  NEAR_EXHAUSTION: { label: 'Near Exhaustion', color: 'bg-orange-100',  text: 'text-orange-700'  },
  MULTI_CONTRACT:  { label: 'Multi-Contract',  color: 'bg-blue-100',    text: 'text-blue-700'    },
  NEW_STUDENT:     { label: 'New',             color: 'bg-purple-100',  text: 'text-purple-700'  },
}

const RISK_CONFIG = {
  HIGH:   { color: 'bg-red-100',     text: 'text-red-600'     },
  MEDIUM: { color: 'bg-amber-100',   text: 'text-amber-700'   },
  LOW:    { color: 'bg-emerald-100', text: 'text-emerald-700' },
}

// ── Props ──────────────────────────────────────────────────────────────────────

interface Props {
  rows:         StudentOperationalRow[]
  branchId:     string
  branchIds:    string[]
  branches:     { id: string; name: string }[]
  groups:       { id: string; name: string }[]
  courses:      { id: string; title: string }[]
  instructors:  { id: string; name: string }[]
  groupOptions: GroupPickerOption[]
  isTL:         boolean
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function StudentsClient({
  rows, branchId, branchIds, branches, groups, courses, instructors, groupOptions, isTL,
}: Props) {
  const router    = useRouter()
  const pathname  = usePathname()
  const sp        = useSearchParams()
  const [, startTransition] = useTransition()

  // ── Filter state (URL-backed) ───────────────────────────────────────────────
  const [search,        setSearch]        = useState(sp.get('q')         ?? '')
  const [filterBranch,  setFilterBranch]  = useState(sp.get('branch_id') ?? '')
  const [filterGroup,   setFilterGroup]   = useState(sp.get('group_id')  ?? '')
  const [filterCourse,  setFilterCourse]  = useState(sp.get('course_id') ?? '')
  const [filterRisk,    setFilterRisk]    = useState(sp.get('risk')      ?? '')
  const [filterStatus,  setFilterStatus]  = useState(sp.get('op_status') ?? '')
  const [filterActive,  setFilterActive]  = useState(sp.get('active')    ?? '')
  const [filterHasGrp,  setFilterHasGrp]  = useState(sp.get('has_group') ?? '')
  const [filterMulti,      setFilterMulti]      = useState(sp.get('multi')          ?? '')
  const [filterInstructor, setFilterInstructor] = useState(sp.get('instructor_id') ?? '')
  const [showFilters,      setShowFilters]      = useState(false)

  // ── Modal state ─────────────────────────────────────────────────────────────
  const [createOpen,    setCreateOpen]    = useState(false)
  const [editStudent,   setEditStudent]   = useState<StudentOperationalRow | null>(null)
  const [drawerStudent, setDrawerStudent] = useState<StudentOperationalRow | null>(null)
  const [assignStudent, setAssignStudent] = useState<StudentOperationalRow | null>(null)

  // ── Bulk selection state ────────────────────────────────────────────────────
  const [selectedIds,       setSelectedIds]       = useState<Set<string>>(new Set())
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false)
  const [bulkDeleteLoading, setBulkDeleteLoading] = useState(false)
  const [bulkDeleteErr,     setBulkDeleteErr]     = useState<string | null>(null)

  // Clear selection when data changes (after refresh)
  useEffect(() => { setSelectedIds(new Set()) }, [rows])

  // ── URL persistence helper ──────────────────────────────────────────────────
  const pushFilters = useCallback((overrides: Record<string, string> = {}) => {
    const params = new URLSearchParams()
    const merged = {
      q: search, branch_id: filterBranch, group_id: filterGroup,
      course_id: filterCourse, risk: filterRisk, op_status: filterStatus,
      active: filterActive, has_group: filterHasGrp, multi: filterMulti,
      instructor_id: filterInstructor,
      ...overrides,
    }
    Object.entries(merged).forEach(([k, v]) => { if (v) params.set(k, v) })
    startTransition(() => router.replace(`${pathname}?${params.toString()}`, { scroll: false }))
  }, [search, filterBranch, filterGroup, filterCourse, filterRisk, filterStatus, filterActive, filterHasGrp, filterMulti, filterInstructor, pathname, router])

  // ── Debounced search ────────────────────────────────────────────────────────
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(() => pushFilters({ q: search }), 350)
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current) }
  }, [search]) // eslint-disable-line react-hooks/exhaustive-deps

  const clearFilters = () => {
    setSearch(''); setFilterBranch(''); setFilterGroup(''); setFilterCourse('')
    setFilterRisk(''); setFilterStatus(''); setFilterActive(''); setFilterHasGrp('')
    setFilterMulti(''); setFilterInstructor('')
    startTransition(() => router.replace(pathname, { scroll: false }))
  }

  const activeFilterCount = [filterBranch, filterGroup, filterCourse, filterRisk, filterStatus, filterActive, filterHasGrp, filterMulti, filterInstructor].filter(Boolean).length

  // ── Client-side filtering ───────────────────────────────────────────────────
  const filtered = useMemo(() => {
    return rows.filter(r => {
      if (filterBranch && r.branch_id !== filterBranch)        return false
      if (filterGroup  && r.group_id  !== filterGroup)         return false
      if (filterCourse && r.course_id !== filterCourse)        return false
      if (filterRisk   && r.risk_level !== filterRisk)         return false
      if (filterStatus && r.op_status  !== filterStatus)       return false
      if (filterActive === 'active'   && r.student_status !== 'active')  return false
      if (filterActive === 'inactive' && r.student_status === 'active')  return false
      if (filterHasGrp === 'yes' && !r.group_id)               return false
      if (filterHasGrp === 'no'  && r.group_id)                return false
      if (filterMulti       === '1'   && r.active_enrollment_count < 2) return false
      if (filterInstructor  && r.instructor_id !== filterInstructor)   return false
      if (search) {
        const q = search.toLowerCase()
        const qPhone = normalizePhone(search)
        const phoneNumbers = [
          r.student_phone       ?? '',
          r.primary_contact_phone ?? '',
          ...r.parent_contacts.flatMap(g => [g.phone1 ?? '', g.phone2 ?? '']),
        ].filter(Boolean)
        const phoneMatch = qPhone.length >= 5 && phoneNumbers.some(p => normalizePhone(p).includes(qPhone))
        const haystack = [
          r.student_name,
          r.student_code ?? '',
          r.user_email   ?? '',
          r.primary_contact_name ?? '',
          ...r.parent_contacts.map(g => g.name),
        ]
        if (!phoneMatch && !haystack.some(h => h.toLowerCase().includes(q))) return false
      }
      return true
    })
  }, [rows, search, filterBranch, filterGroup, filterCourse, filterRisk, filterStatus, filterActive, filterHasGrp, filterMulti, filterInstructor])

  // ── Selection helpers ───────────────────────────────────────────────────────
  function toggleStudent(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleAll() {
    if (selectedIds.size === filtered.length && filtered.length > 0) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(filtered.map(r => r.student_id)))
    }
  }

  // ── Bulk delete ─────────────────────────────────────────────────────────────
  async function handleBulkDelete() {
    setBulkDeleteLoading(true)
    setBulkDeleteErr(null)
    const res = await bulkDeleteStudentsAction(Array.from(selectedIds))
    setBulkDeleteLoading(false)
    if (!res.success) {
      setBulkDeleteErr(res.error.message)
      return
    }
    const { deleted, failed } = res.data
    setBulkDeleteConfirm(false)
    setSelectedIds(new Set())
    if (failed.length > 0) setBulkDeleteErr(`${deleted.length} deleted, ${failed.length} failed.`)
    router.refresh()
  }

  // ── KPI strip ───────────────────────────────────────────────────────────────
  const kpis = useMemo(() => [
    { label: 'Total',          value: rows.length, color: 'bg-blue-400' },
    { label: 'High Risk',      value: rows.filter(r => r.risk_level === 'HIGH').length,        color: rows.filter(r => r.risk_level === 'HIGH').length ? 'bg-red-400' : 'bg-slate-300' },
    { label: 'No Group',       value: rows.filter(r => r.op_status === 'NO_GROUP').length,     color: rows.filter(r => r.op_status === 'NO_GROUP').length ? 'bg-amber-400' : 'bg-slate-300' },
    { label: 'Low Attendance', value: rows.filter(r => r.op_status === 'LOW_ATTENDANCE').length, color: rows.filter(r => r.op_status === 'LOW_ATTENDANCE').length ? 'bg-orange-400' : 'bg-slate-300' },
    { label: 'Near Exhaustion',value: rows.filter(r => r.op_status === 'NEAR_EXHAUSTION').length, color: rows.filter(r => r.op_status === 'NEAR_EXHAUSTION').length ? 'bg-amber-400' : 'bg-slate-300' },
    { label: 'New',            value: rows.filter(r => r.op_status === 'NEW_STUDENT').length,  color: 'bg-purple-400' },
    { label: 'Multi-Contract', value: rows.filter(r => r.active_enrollment_count > 1).length,  color: 'bg-sky-400' },
  ], [rows])

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-[#0B1F3A]">Students</h1>
          <p className="mt-0.5 text-sm text-[#64748B]">{filtered.length} of {rows.length} students</p>
        </div>
        {isTL && (
          <button
            onClick={() => setCreateOpen(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-[#FF8A1F] px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-[#e87c18]"
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
              <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" />
            </svg>
            Add Student
          </button>
        )}
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
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
            placeholder="Name, code, phone, parent, email…"
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

        {/* Expanded filters */}
        {showFilters && (
          <div className="flex flex-wrap gap-2 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-3">
            {branches.length > 1 && (
              <select value={filterBranch} onChange={e => { setFilterBranch(e.target.value); pushFilters({ branch_id: e.target.value }) }}
                className="rounded-lg border border-[#E2E8F0] bg-white px-3 py-1.5 text-sm text-[#0B1F3A] focus:border-[#FF8A1F] focus:outline-none">
                <option value="">All Branches</option>
                {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            )}

            <select value={filterGroup} onChange={e => { setFilterGroup(e.target.value); pushFilters({ group_id: e.target.value }) }}
              className="rounded-lg border border-[#E2E8F0] bg-white px-3 py-1.5 text-sm text-[#0B1F3A] focus:border-[#FF8A1F] focus:outline-none">
              <option value="">All Groups</option>
              {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>

            {courses.length > 0 && (
              <select value={filterCourse} onChange={e => { setFilterCourse(e.target.value); pushFilters({ course_id: e.target.value }) }}
                className="rounded-lg border border-[#E2E8F0] bg-white px-3 py-1.5 text-sm text-[#0B1F3A] focus:border-[#FF8A1F] focus:outline-none">
                <option value="">All Courses</option>
                {courses.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
              </select>
            )}

            <select value={filterRisk} onChange={e => { setFilterRisk(e.target.value); pushFilters({ risk: e.target.value }) }}
              className="rounded-lg border border-[#E2E8F0] bg-white px-3 py-1.5 text-sm text-[#0B1F3A] focus:border-[#FF8A1F] focus:outline-none">
              <option value="">All Risk Levels</option>
              <option value="HIGH">High Risk</option>
              <option value="MEDIUM">Medium Risk</option>
              <option value="LOW">Low Risk</option>
            </select>

            <select value={filterStatus} onChange={e => { setFilterStatus(e.target.value); pushFilters({ op_status: e.target.value }) }}
              className="rounded-lg border border-[#E2E8F0] bg-white px-3 py-1.5 text-sm text-[#0B1F3A] focus:border-[#FF8A1F] focus:outline-none">
              <option value="">All Statuses</option>
              {Object.entries(OP_STATUS_CONFIG).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </select>

            <select value={filterActive} onChange={e => { setFilterActive(e.target.value); pushFilters({ active: e.target.value }) }}
              className="rounded-lg border border-[#E2E8F0] bg-white px-3 py-1.5 text-sm text-[#0B1F3A] focus:border-[#FF8A1F] focus:outline-none">
              <option value="">Active + Inactive</option>
              <option value="active">Active Only</option>
              <option value="inactive">Inactive Only</option>
            </select>

            <select value={filterHasGrp} onChange={e => { setFilterHasGrp(e.target.value); pushFilters({ has_group: e.target.value }) }}
              className="rounded-lg border border-[#E2E8F0] bg-white px-3 py-1.5 text-sm text-[#0B1F3A] focus:border-[#FF8A1F] focus:outline-none">
              <option value="">Has Group / No Group</option>
              <option value="yes">Has Group</option>
              <option value="no">No Group</option>
            </select>

            <select value={filterMulti} onChange={e => { setFilterMulti(e.target.value); pushFilters({ multi: e.target.value }) }}
              className="rounded-lg border border-[#E2E8F0] bg-white px-3 py-1.5 text-sm text-[#0B1F3A] focus:border-[#FF8A1F] focus:outline-none">
              <option value="">All Contracts</option>
              <option value="1">Multi-Contract Only</option>
            </select>

            {instructors.length > 0 && (
              <select value={filterInstructor} onChange={e => { setFilterInstructor(e.target.value); pushFilters({ instructor_id: e.target.value }) }}
                className="rounded-lg border border-[#E2E8F0] bg-white px-3 py-1.5 text-sm text-[#0B1F3A] focus:border-[#FF8A1F] focus:outline-none">
                <option value="">All Instructors</option>
                {instructors.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
              </select>
            )}
          </div>
        )}
      </div>

      {/* Bulk selection toolbar */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 rounded-xl bg-[#0B1F3A] px-4 py-2.5 text-white">
          <span className="text-sm font-medium">{selectedIds.size} selected</span>
          <div className="flex-1" />
          {isTL && (
            <button
              onClick={() => { setBulkDeleteErr(null); setBulkDeleteConfirm(true) }}
              className="rounded-lg border border-red-500 bg-red-600/20 px-3 py-1.5 text-xs font-semibold text-red-300 hover:bg-red-600/40"
            >
              Delete Selected
            </button>
          )}
          <button
            onClick={() => setSelectedIds(new Set())}
            className="rounded-lg px-3 py-1.5 text-xs font-medium text-slate-300 hover:text-white"
          >
            Clear
          </button>
        </div>
      )}

      {/* Table / Cards */}
      <div className="rounded-xl border border-[#E2E8F0] bg-white">
        {filtered.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <p className="text-sm font-medium text-[#0B1F3A]">No students found</p>
            <p className="mt-1 text-xs text-[#94A3B8]">
              {search || activeFilterCount > 0 ? 'Try adjusting your search or filters.' : 'Add the first student to get started.'}
            </p>
          </div>
        ) : (
          <>
            {/* ── Mobile cards ─────────────────────────────────────────── */}
            <div className="md:hidden divide-y divide-[#E2E8F0]">
              {filtered.map(row => {
                const opCfg   = OP_STATUS_CONFIG[row.op_status]
                const riskCfg = RISK_CONFIG[row.risk_level]
                return (
                  <div
                    key={row.student_id}
                    className="cursor-pointer px-4 py-4 hover:bg-[#F8FAFC]"
                    onClick={() => setDrawerStudent(row)}
                  >
                    <div className="flex items-start gap-2">
                      {/* Checkbox */}
                      {isTL && (
                        <div className="pt-0.5 shrink-0" onClick={e => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={selectedIds.has(row.student_id)}
                            onChange={() => toggleStudent(row.student_id)}
                            className="h-4 w-4 rounded border-[#E2E8F0] accent-[#FF8A1F]"
                          />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="text-[15px] font-semibold text-[#0B1F3A] leading-tight">{row.student_name}</p>
                        <div className="mt-0.5 flex items-center gap-1.5 flex-wrap">
                          {row.student_code && <span className="font-mono text-[11px] text-[#94A3B8]">#{row.student_code}</span>}
                          {row.age !== null && <span className="text-[11px] text-[#94A3B8]">Age {row.age}</span>}
                        </div>
                        {row.group_name && (
                          <p className="text-[12px] text-[#64748B]">
                            {row.group_name}{row.instructor_name ? ` · ${row.instructor_name}` : ''}
                          </p>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${opCfg.color} ${opCfg.text}`}>
                          {opCfg.label}
                        </span>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${riskCfg.color} ${riskCfg.text}`}>
                          {row.risk_level}
                        </span>
                      </div>
                    </div>
                    <div className="mt-2 grid grid-cols-3 gap-1 text-[11px]">
                      <div className="rounded-lg bg-[#F8FAFC] px-2 py-1.5 text-center">
                        <p className="font-bold text-[#0B1F3A]">{row.attendance_pct}%</p>
                        <p className="text-[#94A3B8]">Attend.</p>
                      </div>
                      <div className="rounded-lg bg-[#F8FAFC] px-2 py-1.5 text-center">
                        <p className={`font-bold ${row.enrolled_sessions > 0 && row.remaining_sessions <= 2 ? 'text-red-600' : 'text-[#0B1F3A]'}`}>
                          {row.enrolled_sessions > 0 ? `${row.remaining_sessions}/${row.enrolled_sessions}` : '—'}
                        </p>
                        <p className="text-[#94A3B8]">Sessions</p>
                      </div>
                      <div className="rounded-lg bg-[#F8FAFC] px-2 py-1.5 text-center">
                        <p className="font-bold text-[#0B1F3A]">{row.parent_contact_count}</p>
                        <p className="text-[#94A3B8]">Contacts</p>
                      </div>
                    </div>
                    <div className="mt-2 flex items-center justify-between">
                      {row.primary_contact_phone && (
                        <a
                          href={`tel:${row.primary_contact_phone}`}
                          className="text-[12px] text-[#64748B]"
                          onClick={e => e.stopPropagation()}
                        >
                          {row.primary_contact_phone}
                        </a>
                      )}
                      {!row.group_id && isTL && (
                        <button
                          onClick={e => { e.stopPropagation(); setAssignStudent(row) }}
                          className="ml-auto rounded-lg bg-amber-100 px-3 py-1.5 text-[12px] font-semibold text-amber-700"
                        >
                          Assign Group
                        </button>
                      )}
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
                    {isTL && (
                      <th className="px-4 py-3 w-10">
                        <input
                          type="checkbox"
                          checked={selectedIds.size === filtered.length && filtered.length > 0}
                          onChange={toggleAll}
                          className="h-4 w-4 rounded border-[#E2E8F0] accent-[#FF8A1F]"
                          aria-label="Select all"
                        />
                      </th>
                    )}
                    <th className="px-4 py-3 text-left text-xs font-medium text-[#64748B]">Student</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-[#64748B]">Course / Group</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-[#64748B]">Instructor</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-[#64748B]">Sessions</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-[#64748B]">Attendance</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-[#64748B]">Risk</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-[#64748B]">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-[#64748B]">Parent Contacts</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(row => {
                    const opCfg   = OP_STATUS_CONFIG[row.op_status]
                    const riskCfg = RISK_CONFIG[row.risk_level]
                    return (
                      <tr
                        key={row.student_id}
                        className={`cursor-pointer border-b border-[#E2E8F0] last:border-0 hover:bg-[#F8FAFC]
                          ${selectedIds.has(row.student_id) ? 'bg-[#FFF7ED]' : ''}`}
                        onClick={() => setDrawerStudent(row)}
                      >
                        {/* Checkbox */}
                        {isTL && (
                          <td className="px-4 py-3 w-10" onClick={e => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              checked={selectedIds.has(row.student_id)}
                              onChange={() => toggleStudent(row.student_id)}
                              className="h-4 w-4 rounded border-[#E2E8F0] accent-[#FF8A1F]"
                            />
                          </td>
                        )}

                        {/* Student identity */}
                        <td className="px-4 py-3">
                          <p className="font-medium text-[#0B1F3A]">{row.student_name}</p>
                          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                            {row.student_code && (
                              <span className="font-mono text-[10px] text-[#94A3B8]">#{row.student_code}</span>
                            )}
                            {row.age !== null && (
                              <span className="text-[10px] text-[#94A3B8]">Age {row.age}</span>
                            )}
                          </div>
                          {row.student_phone && (
                            <p className="text-[11px] text-[#94A3B8]">{row.student_phone}</p>
                          )}
                        </td>

                        {/* Course / Group */}
                        <td className="px-4 py-3">
                          <p className="text-[#0B1F3A]">{row.group_name ?? '—'}</p>
                          {row.course_name && (
                            <p className="text-[11px] text-[#94A3B8]">{row.course_name}</p>
                          )}
                        </td>

                        {/* Instructor */}
                        <td className="px-4 py-3">
                          <p className="text-[#64748B]">{row.instructor_name ?? '—'}</p>
                        </td>

                        {/* Sessions */}
                        <td className="px-4 py-3">
                          {row.enrolled_sessions > 0 ? (
                            <>
                              <p className={`font-medium ${row.remaining_sessions <= 2 ? 'text-red-600' : row.remaining_sessions <= 5 ? 'text-amber-600' : 'text-emerald-600'}`}>
                                {row.remaining_sessions} left
                              </p>
                              <p className="text-[11px] text-[#94A3B8]">{row.consumed_sessions}/{row.enrolled_sessions} used</p>
                            </>
                          ) : (
                            <span className="text-[#94A3B8]">—</span>
                          )}
                        </td>

                        {/* Attendance */}
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="h-1.5 w-14 rounded-full bg-[#E2E8F0]">
                              <div
                                className={`h-1.5 rounded-full ${row.attendance_pct >= 80 ? 'bg-emerald-400' : row.attendance_pct >= 60 ? 'bg-amber-400' : 'bg-red-400'}`}
                                style={{ width: `${Math.min(row.attendance_pct, 100)}%` }}
                              />
                            </div>
                            <span className="text-xs text-[#64748B]">{row.attendance_pct}%</span>
                          </div>
                          <p className="text-[11px] text-[#94A3B8]">{row.sessions_attended}/{row.total_sessions} sessions</p>
                        </td>

                        {/* Risk */}
                        <td className="px-4 py-3">
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${riskCfg.color} ${riskCfg.text}`}>
                            {row.risk_level}
                          </span>
                          {row.consecutive_absences >= 2 && (
                            <p className="mt-0.5 text-[10px] text-red-500">{row.consecutive_absences} absent</p>
                          )}
                        </td>

                        {/* Operational status */}
                        <td className="px-4 py-3">
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${opCfg.color} ${opCfg.text}`}>
                            {opCfg.label}
                          </span>
                        </td>

                        {/* Guardian contacts */}
                        <td className="px-4 py-3">
                          {row.parent_contacts.length > 0 ? (
                            <>
                              <p className="text-[12px] font-medium text-[#0B1F3A]">{row.parent_contacts[0].name}</p>
                              {row.parent_contacts[0].phone1 && (
                                <a
                                  href={`tel:${row.parent_contacts[0].phone1}`}
                                  className="text-[11px] text-[#64748B] hover:text-[#FF8A1F]"
                                  onClick={e => e.stopPropagation()}
                                >
                                  {row.parent_contacts[0].phone1}
                                </a>
                              )}
                              {row.parent_contact_count > 1 && (
                                <p className="text-[10px] text-[#94A3B8]">+{row.parent_contact_count - 1} more</p>
                              )}
                            </>
                          ) : (
                            <span className="text-[11px] text-red-400">No contact</span>
                          )}
                        </td>

                        {/* Row actions */}
                        <td className="px-4 py-3 text-right" onClick={e => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-2">
                            {!row.group_id && isTL && (
                              <button
                                onClick={() => setAssignStudent(row)}
                                className="rounded-lg bg-amber-100 px-2.5 py-1 text-[11px] font-semibold text-amber-700 hover:bg-amber-200"
                              >
                                Assign
                              </button>
                            )}
                            {isTL && (
                              <button
                                onClick={() => setEditStudent(row)}
                                className="rounded-lg border border-[#E2E8F0] px-2.5 py-1 text-[11px] font-medium text-[#64748B] hover:border-[#CBD5E1]"
                              >
                                Edit
                              </button>
                            )}
                            <button
                              onClick={() => setDrawerStudent(row)}
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

      {/* ── Modals ──────────────────────────────────────────────────────────── */}
      {createOpen && (
        <StudentFormModal
          mode="create"
          branchId={branchId}
          branchIds={branchIds}
          branches={branches}
          groupOptions={groupOptions}
          isTL={isTL}
          onClose={() => setCreateOpen(false)}
          onSuccess={() => { setCreateOpen(false); router.refresh() }}
        />
      )}
      {editStudent && (
        <StudentFormModal
          mode="edit"
          student={editStudent}
          branchId={branchId}
          branchIds={branchIds}
          branches={branches}
          groupOptions={groupOptions}
          isTL={isTL}
          onClose={() => setEditStudent(null)}
          onSuccess={() => { setEditStudent(null); router.refresh() }}
          onDelete={() => { setEditStudent(null); router.refresh() }}
        />
      )}
      {drawerStudent && (
        <StudentDetailDrawer
          student={drawerStudent}
          isTL={isTL}
          onClose={() => setDrawerStudent(null)}
          onEdit={isTL ? () => { setDrawerStudent(null); setEditStudent(drawerStudent) } : undefined}
          onAssign={isTL && !drawerStudent.group_id
            ? () => { setDrawerStudent(null); setAssignStudent(drawerStudent) }
            : undefined}
        />
      )}
      {assignStudent && (
        <GroupAssignModal
          student={assignStudent}
          groups={groups}
          onClose={() => setAssignStudent(null)}
          onSuccess={() => { setAssignStudent(null); router.refresh() }}
        />
      )}

      {/* Bulk delete confirmation modal */}
      {bulkDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="mx-4 w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
            <h3 className="text-base font-semibold text-[#0B1F3A]">
              Delete {selectedIds.size} {selectedIds.size === 1 ? 'Student' : 'Students'}?
            </h3>
            <p className="mt-2 text-sm text-[#64748B]">
              Selected students will be soft-deleted. Their attendance and payment history is preserved but they will be hidden from all views.
            </p>
            {bulkDeleteErr && (
              <p className="mt-2 text-sm text-red-600">{bulkDeleteErr}</p>
            )}
            <div className="mt-5 flex gap-3">
              <button
                onClick={() => { setBulkDeleteConfirm(false); setBulkDeleteErr(null) }}
                className="flex-1 rounded-lg border border-[#E2E8F0] py-2.5 text-sm font-medium text-[#64748B] hover:border-[#CBD5E1]"
              >
                Cancel
              </button>
              <button
                onClick={handleBulkDelete}
                disabled={bulkDeleteLoading}
                className="flex-1 rounded-lg bg-red-600 py-2.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60"
              >
                {bulkDeleteLoading ? 'Deleting…' : `Delete ${selectedIds.size}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
