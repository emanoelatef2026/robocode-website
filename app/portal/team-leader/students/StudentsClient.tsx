'use client'

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { useTopbarAction } from '@/components/shared/layout/TopbarActionContext'
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
  ACTIVE:          { label: 'Active',          color: 'bg-[#E7F8EE]', text: 'text-[#15803D]' },
  NO_GROUP:        { label: 'No Group',        color: 'bg-[#F1F5F9]', text: 'text-[#475569]' },
  INACTIVE:        { label: 'Inactive',        color: 'bg-[#FEE2E2]', text: 'text-[#DC2626]' },
  LOW_ATTENDANCE:  { label: 'Low Attendance',  color: 'bg-[#FFFBEB]', text: 'text-[#B45309]' },
  NEAR_EXHAUSTION: { label: 'Near Exhaustion', color: 'bg-[#FFF3E0]', text: 'text-[#C2410C]' },
  MULTI_CONTRACT:  { label: 'Multi-Contract',  color: 'bg-[#EFF6FF]', text: 'text-[#1D4ED8]' },
  NEW_STUDENT:     { label: 'New',             color: 'bg-[#F3E8FF]', text: 'text-[#7C3AED]' },
}

const RISK_CONFIG = {
  HIGH:   { color: 'bg-[#FEE2E2]', text: 'text-[#DC2626]' },
  MEDIUM: { color: 'bg-[#FFFBEB]', text: 'text-[#B45309]' },
  LOW:    { color: 'bg-[#E7F8EE]', text: 'text-[#15803D]' },
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

  // Legacy shortcut param used by dashboard links (e.g. ?filter=at-risk, ?filter=expiring)
  const legacyFilter = sp.get('filter')

  // ── Filter state (URL-backed) ───────────────────────────────────────────────
  const [search,        setSearch]        = useState(sp.get('q')         ?? '')
  const [filterBranch,  setFilterBranch]  = useState(sp.get('branch_id') ?? '')
  const [filterGroup,   setFilterGroup]   = useState(sp.get('group_id')  ?? '')
  const [filterCourse,  setFilterCourse]  = useState(sp.get('course_id') ?? '')
  const [filterRisk,    setFilterRisk]    = useState(sp.get('risk')      || (legacyFilter === 'at-risk'  ? 'HIGH'            : ''))
  const [filterStatus,  setFilterStatus]  = useState(sp.get('op_status') || (legacyFilter === 'expiring' ? 'NEAR_EXHAUSTION' : ''))
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

  // ── Topbar Add button ───────────────────────────────────────────────────────
  const { setAction } = useTopbarAction()
  const openCreate = useCallback(() => setCreateOpen(true), [])
  useEffect(() => {
    if (!isTL) return
    setAction(
      <button
        onClick={openCreate}
        className="ds-btn-orange"
      >
        <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
          <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" />
        </svg>
        Add Student
      </button>
    )
    return () => setAction(null)
  }, [isTL, openCreate, setAction])

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

  // Normalize legacy `?filter=at-risk` / `?filter=expiring` shortcut links (used by
  // dashboard cards) into the real risk/op_status params, once, so the URL and the
  // active-filter chip bar stay consistent with what's actually being applied.
  const normalizedLegacyFilter = useRef(false)
  useEffect(() => {
    if (!legacyFilter || normalizedLegacyFilter.current) return
    normalizedLegacyFilter.current = true
    pushFilters({})
  }, [legacyFilter]) // eslint-disable-line react-hooks/exhaustive-deps

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

  // ── Active filter chips (always-visible context for what's currently applied) ─
  const RISK_LABELS:   Record<string, string> = { HIGH: 'High Risk', MEDIUM: 'Medium Risk', LOW: 'Low Risk' }
  const ACTIVE_LABELS: Record<string, string> = { active: 'Active', inactive: 'Inactive' }
  const HASGRP_LABELS: Record<string, string> = { yes: 'Has Group', no: 'No Group' }

  const activeFilters = useMemo(() => {
    const chips: { key: string; label: string; clear: () => void }[] = []
    if (search)        chips.push({ key: 'q',             label: `Search: "${search}"`,                        clear: () => { setSearch('');           pushFilters({ q: '' }) } })
    if (filterBranch)  chips.push({ key: 'branch_id',      label: `Branch: ${branches.find(b => b.id === filterBranch)?.name ?? filterBranch}`,           clear: () => { setFilterBranch('');      pushFilters({ branch_id: '' }) } })
    if (filterGroup)   chips.push({ key: 'group_id',       label: `Group: ${groups.find(g => g.id === filterGroup)?.name ?? filterGroup}`,                clear: () => { setFilterGroup('');       pushFilters({ group_id: '' }) } })
    if (filterCourse)  chips.push({ key: 'course_id',      label: `Course: ${courses.find(c => c.id === filterCourse)?.title ?? filterCourse}`,           clear: () => { setFilterCourse('');      pushFilters({ course_id: '' }) } })
    if (filterRisk)    chips.push({ key: 'risk',           label: `Risk: ${RISK_LABELS[filterRisk] ?? filterRisk}`,                                       clear: () => { setFilterRisk('');        pushFilters({ risk: '' }) } })
    if (filterStatus)  chips.push({ key: 'op_status',      label: `Status: ${OP_STATUS_CONFIG[filterStatus]?.label ?? filterStatus}`,                     clear: () => { setFilterStatus('');      pushFilters({ op_status: '' }) } })
    if (filterActive)  chips.push({ key: 'active',         label: ACTIVE_LABELS[filterActive] ?? filterActive,                                            clear: () => { setFilterActive('');      pushFilters({ active: '' }) } })
    if (filterHasGrp)  chips.push({ key: 'has_group',      label: HASGRP_LABELS[filterHasGrp] ?? filterHasGrp,                                            clear: () => { setFilterHasGrp('');      pushFilters({ has_group: '' }) } })
    if (filterMulti)   chips.push({ key: 'multi',          label: 'Multi-Contract Only',                                                                   clear: () => { setFilterMulti('');       pushFilters({ multi: '' }) } })
    if (filterInstructor) chips.push({ key: 'instructor_id', label: `Instructor: ${instructors.find(i => i.id === filterInstructor)?.name ?? filterInstructor}`, clear: () => { setFilterInstructor(''); pushFilters({ instructor_id: '' }) } })
    return chips
  }, [search, filterBranch, filterGroup, filterCourse, filterRisk, filterStatus, filterActive, filterHasGrp, filterMulti, filterInstructor, branches, groups, courses, instructors, pushFilters])

  // ── Client-side filtering ───────────────────────────────────────────────────
  const filtered = useMemo(() => {
    return rows.filter(r => {
      if (filterBranch) {
        // Branch is derived from the student's active group(s), not student.branch_id.
        // Students with no group are excluded when a branch filter is active.
        if (!r.group_branch_ids.length) return false
        if (!r.group_branch_ids.includes(filterBranch)) return false
      }
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
    { label: 'Total',          value: filtered.length, color: 'bg-[#38BDF8]' },
    { label: 'High Risk',      value: filtered.filter(r => r.risk_level === 'HIGH').length,          color: filtered.filter(r => r.risk_level === 'HIGH').length ? 'bg-[#EF4444]' : 'bg-[#CBD5E1]' },
    { label: 'No Group',       value: filtered.filter(r => r.op_status === 'NO_GROUP').length,       color: filtered.filter(r => r.op_status === 'NO_GROUP').length ? 'bg-[#F59E0B]' : 'bg-[#CBD5E1]' },
    { label: 'Low Attendance', value: filtered.filter(r => r.op_status === 'LOW_ATTENDANCE').length, color: filtered.filter(r => r.op_status === 'LOW_ATTENDANCE').length ? 'bg-orange-400' : 'bg-[#CBD5E1]' },
    { label: 'Near Exhaustion',value: filtered.filter(r => r.op_status === 'NEAR_EXHAUSTION').length, color: filtered.filter(r => r.op_status === 'NEAR_EXHAUSTION').length ? 'bg-[#F59E0B]' : 'bg-[#CBD5E1]' },
    { label: 'New',            value: filtered.filter(r => r.op_status === 'NEW_STUDENT').length,    color: 'bg-purple-400' },
    { label: 'Multi-Contract', value: filtered.filter(r => r.active_enrollment_count > 1).length,    color: 'bg-sky-400' },
  ], [filtered])

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-3 md:space-y-5">

      {/* KPI Strip */}
      <div className="grid grid-cols-4 gap-1.5 md:gap-3 lg:grid-cols-7">
        {kpis.map(k => (
          <div key={k.label} className="min-w-0 ds-card px-2 py-1.5 md:p-3">
            <div className={`mb-0.5 h-0.5 w-3 rounded-full ${k.color} opacity-80 md:mb-1.5 md:h-1 md:w-6`} />
            <p className="truncate text-[13px] font-bold leading-none text-[#0B1F3A] md:text-lg">{k.value}</p>
            <p className="mt-0.5 truncate text-[8px] leading-tight text-[#64748B] md:text-[11px]">{k.label}</p>
          </div>
        ))}
      </div>

      {/* Filter bar */}
      <div className="space-y-2">

        {/* Row 1: Search + Filters toggle + Clear */}
        <div className="flex gap-2">
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Name, code, phone…"
            className="min-w-0 flex-1 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2 text-[13px] text-[#0B1F3A] focus:border-[#FF8A1F] focus:outline-none"
          />
          {/* Filters toggle — all viewports */}
          <button
            onClick={() => setShowFilters(f => !f)}
            className={`flex shrink-0 items-center gap-1.5 rounded-xl border px-3 py-2 text-sm font-medium transition
              ${showFilters || activeFilterCount > 0
                ? 'border-[#FF8A1F] bg-[#FF8A1F]/10 text-[#FF8A1F]'
                : 'border-[#E2E8F0] bg-[#F8FAFC] text-[#64748B] hover:border-[#CBD5E1]'}`}
          >
            <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M3 3a1 1 0 011-1h12a1 1 0 011 1v3a1 1 0 01-.293.707L13 10.414V17a1 1 0 01-.553.894l-4 2A1 1 0 017 19v-8.586L3.293 6.707A1 1 0 013 6V3z" clipRule="evenodd" />
            </svg>
            <span className="hidden sm:inline">Filters</span>
            {activeFilterCount > 0 && (
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[#FF8A1F] text-[10px] font-bold text-white">
                {activeFilterCount}
              </span>
            )}
          </button>
          {(search || activeFilterCount > 0) && (
            <button
              onClick={clearFilters}
              className="shrink-0 rounded-xl border border-[#E2E8F0] px-3 py-2 text-sm font-medium text-[#64748B] hover:border-[#CBD5E1]"
            >
              Clear
            </button>
          )}
        </div>

        {/* Active filter chips */}
        {activeFilters.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {activeFilters.map(chip => (
              <span
                key={chip.key}
                className="inline-flex items-center gap-1 rounded-full border border-[#FF8A1F]/30 bg-[#FF8A1F]/10 px-2.5 py-1 text-[11px] font-medium text-[#FF8A1F]"
              >
                {chip.label}
                <button
                  onClick={chip.clear}
                  aria-label={`Remove filter: ${chip.label}`}
                  className="ml-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full hover:bg-[#FF8A1F]/20"
                >
                  <svg viewBox="0 0 20 20" fill="currentColor" className="h-3 w-3">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </button>
              </span>
            ))}
          </div>
        )}

        {/* ── Desktop: CSS-grid filter row — never overflows, shrinks to fit ── */}
        {showFilters && (
          <div className="hidden md:block sticky top-0 z-10">
            <div
              className="grid gap-2 ds-card p-2"
              style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(0, 1fr))' }}
            >
              {branches.length > 1 && (
                <select value={filterBranch} onChange={e => { setFilterBranch(e.target.value); pushFilters({ branch_id: e.target.value }) }}
                  className="min-w-0 w-full rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-2 py-2 text-sm text-[#0B1F3A] focus:border-[#FF8A1F] focus:outline-none">
                  <option value="">All Branches</option>
                  {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              )}
              <select value={filterGroup} onChange={e => { setFilterGroup(e.target.value); pushFilters({ group_id: e.target.value }) }}
                className="min-w-0 w-full rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-2 py-2 text-sm text-[#0B1F3A] focus:border-[#FF8A1F] focus:outline-none">
                <option value="">All Groups</option>
                {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
              {courses.length > 0 && (
                <select value={filterCourse} onChange={e => { setFilterCourse(e.target.value); pushFilters({ course_id: e.target.value }) }}
                  className="min-w-0 w-full rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-2 py-2 text-sm text-[#0B1F3A] focus:border-[#FF8A1F] focus:outline-none">
                  <option value="">All Courses</option>
                  {courses.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
                </select>
              )}
              <select value={filterRisk} onChange={e => { setFilterRisk(e.target.value); pushFilters({ risk: e.target.value }) }}
                className="min-w-0 w-full rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-2 py-2 text-sm text-[#0B1F3A] focus:border-[#FF8A1F] focus:outline-none">
                <option value="">All Risk Levels</option>
                <option value="HIGH">High Risk</option>
                <option value="MEDIUM">Medium Risk</option>
                <option value="LOW">Low Risk</option>
              </select>
              <select value={filterStatus} onChange={e => { setFilterStatus(e.target.value); pushFilters({ op_status: e.target.value }) }}
                className="min-w-0 w-full rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-2 py-2 text-sm text-[#0B1F3A] focus:border-[#FF8A1F] focus:outline-none">
                <option value="">All Statuses</option>
                {Object.entries(OP_STATUS_CONFIG).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </select>
              <select value={filterActive} onChange={e => { setFilterActive(e.target.value); pushFilters({ active: e.target.value }) }}
                className="min-w-0 w-full rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-2 py-2 text-sm text-[#0B1F3A] focus:border-[#FF8A1F] focus:outline-none">
                <option value="">Active + Inactive</option>
                <option value="active">Active Only</option>
                <option value="inactive">Inactive Only</option>
              </select>
              <select value={filterHasGrp} onChange={e => { setFilterHasGrp(e.target.value); pushFilters({ has_group: e.target.value }) }}
                className="min-w-0 w-full rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-2 py-2 text-sm text-[#0B1F3A] focus:border-[#FF8A1F] focus:outline-none">
                <option value="">Has Group / No Group</option>
                <option value="yes">Has Group</option>
                <option value="no">No Group</option>
              </select>
              <select value={filterMulti} onChange={e => { setFilterMulti(e.target.value); pushFilters({ multi: e.target.value }) }}
                className="min-w-0 w-full rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-2 py-2 text-sm text-[#0B1F3A] focus:border-[#FF8A1F] focus:outline-none">
                <option value="">All Contracts</option>
                <option value="1">Multi-Contract Only</option>
              </select>
              {instructors.length > 0 && (
                <select value={filterInstructor} onChange={e => { setFilterInstructor(e.target.value); pushFilters({ instructor_id: e.target.value }) }}
                  className="min-w-0 w-full rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-2 py-2 text-sm text-[#0B1F3A] focus:border-[#FF8A1F] focus:outline-none">
                  <option value="">All Instructors</option>
                  {instructors.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
                </select>
              )}
            </div>
          </div>
        )}

        {/* ── Mobile: bottom sheet filter ────────────────────────────── */}
        {showFilters && (
          <>
            <div
              className="fixed inset-0 z-50 bg-black/40 md:hidden"
              onClick={() => setShowFilters(false)}
            />
            <div
              className="fixed bottom-0 left-0 right-0 z-50 max-h-[72vh] overflow-y-auto rounded-t-2xl bg-white shadow-2xl md:hidden"
              style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}
            >
              {/* Handle */}
              <div className="flex justify-center pt-3 pb-1">
                <div className="h-1 w-10 rounded-full bg-[#E2E8F0]" />
              </div>
              {/* Header */}
              <div className="flex items-center justify-between px-4 pb-3 pt-1">
                <p className="text-sm font-semibold text-[#0B1F3A]">
                  Filters {activeFilterCount > 0 && <span className="ml-1 text-[#FF8A1F]">({activeFilterCount})</span>}
                </p>
                <button
                  onClick={() => setShowFilters(false)}
                  className="flex h-7 w-7 items-center justify-center rounded-full text-[#94A3B8] hover:bg-[#F1F5F9]"
                >
                  <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>
              {/* Filter selects */}
              <div className="space-y-2 px-4">
                {branches.length > 1 && (
                  <select value={filterBranch} onChange={e => { setFilterBranch(e.target.value); pushFilters({ branch_id: e.target.value }) }}
                    className="w-full rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2.5 text-sm text-[#0B1F3A] focus:border-[#FF8A1F] focus:outline-none">
                    <option value="">All Branches</option>
                    {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                )}
                <select value={filterGroup} onChange={e => { setFilterGroup(e.target.value); pushFilters({ group_id: e.target.value }) }}
                  className="w-full rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2.5 text-sm text-[#0B1F3A] focus:border-[#FF8A1F] focus:outline-none">
                  <option value="">All Groups</option>
                  {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
                {courses.length > 0 && (
                  <select value={filterCourse} onChange={e => { setFilterCourse(e.target.value); pushFilters({ course_id: e.target.value }) }}
                    className="w-full rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2.5 text-sm text-[#0B1F3A] focus:border-[#FF8A1F] focus:outline-none">
                    <option value="">All Courses</option>
                    {courses.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
                  </select>
                )}
                <div className="grid grid-cols-2 gap-2">
                  <select value={filterRisk} onChange={e => { setFilterRisk(e.target.value); pushFilters({ risk: e.target.value }) }}
                    className="w-full rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2.5 text-sm text-[#0B1F3A] focus:border-[#FF8A1F] focus:outline-none">
                    <option value="">All Risk</option>
                    <option value="HIGH">High</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="LOW">Low</option>
                  </select>
                  <select value={filterStatus} onChange={e => { setFilterStatus(e.target.value); pushFilters({ op_status: e.target.value }) }}
                    className="w-full rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2.5 text-sm text-[#0B1F3A] focus:border-[#FF8A1F] focus:outline-none">
                    <option value="">All Statuses</option>
                    {Object.entries(OP_STATUS_CONFIG).map(([k, v]) => (
                      <option key={k} value={k}>{v.label}</option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <select value={filterActive} onChange={e => { setFilterActive(e.target.value); pushFilters({ active: e.target.value }) }}
                    className="w-full rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2.5 text-sm text-[#0B1F3A] focus:border-[#FF8A1F] focus:outline-none">
                    <option value="">Any Status</option>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                  <select value={filterHasGrp} onChange={e => { setFilterHasGrp(e.target.value); pushFilters({ has_group: e.target.value }) }}
                    className="w-full rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2.5 text-sm text-[#0B1F3A] focus:border-[#FF8A1F] focus:outline-none">
                    <option value="">Group / No Group</option>
                    <option value="yes">Has Group</option>
                    <option value="no">No Group</option>
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <select value={filterMulti} onChange={e => { setFilterMulti(e.target.value); pushFilters({ multi: e.target.value }) }}
                    className="w-full rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2.5 text-sm text-[#0B1F3A] focus:border-[#FF8A1F] focus:outline-none">
                    <option value="">Any Contract</option>
                    <option value="1">Multi Only</option>
                  </select>
                  {instructors.length > 0 && (
                    <select value={filterInstructor} onChange={e => { setFilterInstructor(e.target.value); pushFilters({ instructor_id: e.target.value }) }}
                      className="w-full rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2.5 text-sm text-[#0B1F3A] focus:border-[#FF8A1F] focus:outline-none">
                      <option value="">All Instructors</option>
                      {instructors.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
                    </select>
                  )}
                </div>
              </div>
              {/* Actions */}
              <div className="mt-4 flex gap-2 border-t border-[#E2E8F0] px-4 pt-3">
                <button
                  onClick={() => { clearFilters(); setShowFilters(false) }}
                  className="flex-1 rounded-xl border border-[#E2E8F0] py-2.5 text-sm font-medium text-[#64748B]"
                >
                  Clear All
                </button>
                <button
                  onClick={() => setShowFilters(false)}
                  className="flex-1 rounded-xl bg-[#FF8A1F] py-2.5 text-sm font-semibold text-white"
                >
                  Apply
                </button>
              </div>
            </div>
          </>
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
              className="rounded-lg border border-red-500 bg-[#DC2626]/20 px-3 py-1.5 text-xs font-semibold text-red-300 hover:bg-[#DC2626]/40"
            >
              Delete Selected
            </button>
          )}
          <button
            onClick={() => setSelectedIds(new Set())}
            className="rounded-lg px-3 py-1.5 text-xs font-medium text-[#CBD5E1] hover:text-white"
          >
            Clear
          </button>
        </div>
      )}

      {/* Table / Cards */}
      <div className="ds-card overflow-hidden">
        {filtered.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <p className="text-sm font-medium text-[#0B1F3A]">
              {search || activeFilterCount > 0 ? 'No students match current filters' : 'No students found'}
            </p>
            <p className="mt-1 text-xs text-[#94A3B8]">
              {search || activeFilterCount > 0
                ? `${rows.length} student${rows.length === 1 ? '' : 's'} total across your branches — none match the filters above.`
                : 'Add the first student to get started.'}
            </p>
            {(search || activeFilterCount > 0) && (
              <button
                onClick={clearFilters}
                className="mt-3 rounded-lg border border-[#E2E8F0] px-3 py-1.5 text-xs font-medium text-[#64748B] hover:border-[#CBD5E1]"
              >
                Clear filters
              </button>
            )}
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
                    className="cursor-pointer px-3 py-2.5 hover:bg-[#F8FAFC] active:bg-[#F1F5F9]"
                    onClick={() => setDrawerStudent(row)}
                  >
                    {/* Row 1: checkbox · name · risk · status */}
                    <div className="flex items-center gap-1.5">
                      {isTL && (
                        <div className="shrink-0" onClick={e => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={selectedIds.has(row.student_id)}
                            onChange={() => toggleStudent(row.student_id)}
                            className="h-3.5 w-3.5 rounded border-[#E2E8F0] accent-[#FF8A1F]"
                          />
                        </div>
                      )}
                      <p className="min-w-0 flex-1 truncate text-[13px] font-semibold text-[#0B1F3A]">
                        {row.student_name}
                      </p>
                      <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-bold ${riskCfg.color} ${riskCfg.text}`}>
                        {row.risk_level}
                      </span>
                      <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-bold ${opCfg.color} ${opCfg.text}`}>
                        {opCfg.label}
                      </span>
                    </div>

                    {/* Row 2: code · age · group */}
                    <div className="mt-0.5 flex items-center gap-x-1.5 overflow-hidden text-[10px] text-[#94A3B8]">
                      {row.student_code && (
                        <span className="shrink-0 font-mono">#{row.student_code}</span>
                      )}
                      {row.age !== null && (
                        <span className="shrink-0">· {row.age}y</span>
                      )}
                      {row.group_name && (
                        <span className="truncate text-[#64748B]">· {row.group_name}</span>
                      )}
                    </div>

                    {/* Row 3: stats · phone / assign */}
                    <div className="mt-1 flex min-w-0 items-center gap-x-1 text-[10px]">
                      <span className={`shrink-0 font-semibold ${row.attendance_pct < 60 ? 'text-[#EF4444]' : row.attendance_pct < 80 ? 'text-[#F59E0B]' : 'text-[#10B981]'}`}>
                        {row.attendance_pct}%
                      </span>
                      <span className="shrink-0 text-[#94A3B8]">att</span>
                      <span className="mx-0.5 shrink-0 text-[#CBD5E1]">·</span>
                      <span className={`shrink-0 font-semibold ${row.enrolled_sessions > 0 && row.remaining_sessions <= 2 ? 'text-[#EF4444]' : 'text-[#0B1F3A]'}`}>
                        {row.enrolled_sessions > 0 ? `${row.remaining_sessions}/${row.enrolled_sessions}` : '—'}
                      </span>
                      <span className="shrink-0 text-[#94A3B8]">sess</span>
                      <span className="mx-0.5 shrink-0 text-[#CBD5E1]">·</span>
                      <span className="shrink-0 font-semibold text-[#0B1F3A]">{row.parent_contact_count}</span>
                      <span className="shrink-0 text-[#94A3B8]">ctcts</span>
                      <div className="min-w-0 flex-1" />
                      {!row.group_id && isTL ? (
                        <button
                          onClick={e => { e.stopPropagation(); setAssignStudent(row) }}
                          className="shrink-0 rounded-md bg-[#FFFBEB] px-2 py-0.5 text-[10px] font-semibold text-[#B45309] active:bg-[#FEF3C7]"
                        >
                          Assign
                        </button>
                      ) : row.primary_contact_phone ? (
                        <a
                          href={`tel:${row.primary_contact_phone}`}
                          className="shrink-0 text-[10px] text-[#64748B]"
                          onClick={e => e.stopPropagation()}
                        >
                          {row.primary_contact_phone}
                        </a>
                      ) : null}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* ── Desktop table ─────────────────────────────────────────── */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="ds-table-head">
                  <tr>
                    {isTL && (
                      <th className="w-10">
                        <input
                          type="checkbox"
                          checked={selectedIds.size === filtered.length && filtered.length > 0}
                          onChange={toggleAll}
                          className="h-4 w-4 rounded border-[#E2E8F0] accent-[#FF8A1F]"
                          aria-label="Select all"
                        />
                      </th>
                    )}
                    <th>Student</th>
                    <th>Course / Group</th>
                    <th>Instructor</th>
                    <th>Sessions</th>
                    <th>Attendance</th>
                    <th>Risk</th>
                    <th>Status</th>
                    <th>Parent Contacts</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(row => {
                    const opCfg   = OP_STATUS_CONFIG[row.op_status]
                    const riskCfg = RISK_CONFIG[row.risk_level]
                    return (
                      <tr
                        key={row.student_id}
                        className={`cursor-pointer ds-table-row
                          ${selectedIds.has(row.student_id) ? 'bg-[#FFF7ED] hover:bg-[#FFF7ED]' : ''}`}
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
                              <p className={`font-medium ${row.remaining_sessions <= 2 ? 'text-[#EF4444]' : row.remaining_sessions <= 5 ? 'text-[#F59E0B]' : 'text-[#10B981]'}`}>
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
                                className={`h-1.5 rounded-full ${row.attendance_pct >= 80 ? 'bg-[#10B981]' : row.attendance_pct >= 60 ? 'bg-[#F59E0B]' : 'bg-[#EF4444]'}`}
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
                            <p className="mt-0.5 text-[10px] text-[#EF4444]">{row.consecutive_absences} absent</p>
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
                            <span className="text-[11px] text-[#F87171]">No contact</span>
                          )}
                        </td>

                        {/* Row actions */}
                        <td className="px-4 py-3 text-right" onClick={e => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-2">
                            {!row.group_id && isTL && (
                              <button
                                onClick={() => setAssignStudent(row)}
                                className="rounded-lg bg-[#FFFBEB] px-2.5 py-1 text-[11px] font-semibold text-[#B45309] hover:bg-[#FEF3C7]"
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
          groups={
            // Only groups in the student's branch — the server rejects cross-branch assignments
            groupOptions.length
              ? groupOptions
                  .filter(g => g.branch_id === assignStudent.branch_id)
                  .map(g => ({ id: g.group_id, name: g.group_name }))
              : groups
          }
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
              <p className="mt-2 text-sm text-[#EF4444]">{bulkDeleteErr}</p>
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
                className="flex-1 rounded-lg bg-[#DC2626] py-2.5 text-sm font-medium text-white hover:bg-[#B91C1C] disabled:opacity-60"
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
