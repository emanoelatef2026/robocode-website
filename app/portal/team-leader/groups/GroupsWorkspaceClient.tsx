'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useTopbarAction } from '@/components/admin/TopbarActionContext'
import { useRouter } from 'next/navigation'
import GroupFormModal from './GroupFormModal'
import type { GroupOperationalRow, GroupFormOptions, GroupStudentOption } from '@/modules/groups/operational'
import { GroupSidebar } from './workspace/components/GroupSidebar'
import { CompactKpiStrip, PageHeaderKpiStrip } from './workspace/components/KpiStrips'
import { EmptyWorkspace } from './workspace/components/EmptyWorkspace'
import { GroupWorkspace } from './workspace/GroupWorkspace'
import { useGroupPanel } from './workspace/hooks/useGroupPanel'
import { applyFilters } from './workspace/utils'
import { DEFAULT_FILTERS } from './workspace/types'
import type { Filters } from './workspace/types'
import { fetchGroupsExportData } from '@/modules/groups/export/queries'
import { downloadGroupsWorkbook } from '@/modules/groups/export/workbook'
import type { ExportRole }        from '@/modules/groups/export/workbook'

interface Props {
  groups:          GroupOperationalRow[]
  options:         GroupFormOptions
  studentOptions:  GroupStudentOption[]
  defaultBranchId: string
  isTL:            boolean
  isSuperAdmin?:   boolean
  showPageHeader?: boolean
}

export default function GroupsWorkspaceClient({
  groups, options, studentOptions, defaultBranchId, isTL, isSuperAdmin = false, showPageHeader = false,
}: Props) {
  const router = useRouter()

  // Filters + visible groups
  const [filters, setFilters]   = useState<Filters>(DEFAULT_FILTERS)
  const visible = useMemo(() => applyFilters(groups, filters), [groups, filters])

  // Selection state
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null)
  const selectedGroup = groups.find(g => g.group_id === selectedGroupId) ?? null
  const [mobilePanel, setMobilePanel]         = useState<'list' | 'detail'>('list')

  // Create/edit modal
  const [refreshKey, setRefreshKey] = useState(0)
  const [modalOpen, setModalOpen]   = useState(false)
  const [modalMode, setModalMode]   = useState<'create' | 'edit'>('create')
  const [editGroup, setEditGroup]   = useState<GroupOperationalRow | undefined>()

  // Resizable panel
  const { containerRef, panelWidth, isDesktop, handleDividerMouseDown, handleDividerDoubleClick } = useGroupPanel()

  // Export state
  const [exporting, setExporting]     = useState(false)
  const [exportToast, setExportToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)

  const exportRole: ExportRole = isSuperAdmin ? 'super_admin' : 'team_leader'

  const handleExport = useCallback(async () => {
    setExporting(true)
    setExportToast(null)
    try {
      const groupIds  = visible.map(g => g.group_id)
      const branchIds = [...new Set(groups.map(g => g.branch_id))]
      const result    = await fetchGroupsExportData(groupIds, branchIds)
      downloadGroupsWorkbook(visible, result.pnlRows, result.students, exportRole)
      setExportToast({ type: 'success', msg: 'Excel exported successfully' })
    } catch {
      setExportToast({ type: 'error', msg: 'Export failed. Please try again.' })
    } finally {
      setExporting(false)
      setTimeout(() => setExportToast(null), 4000)
    }
  }, [visible, groups, exportRole])

  const openCreate = useCallback(() => {
    setModalMode('create')
    setEditGroup(undefined)
    setModalOpen(true)
  }, [])

  function openEdit(g: GroupOperationalRow) {
    setModalMode('edit')
    setEditGroup(g)
    setModalOpen(true)
  }

  function selectGroup(g: GroupOperationalRow) {
    setSelectedGroupId(g.group_id)
    setMobilePanel('detail')
  }

  function handleGroupDeleted() {
    const nextGroup = visible.find(g => g.group_id !== selectedGroupId) ?? null
    setSelectedGroupId(nextGroup?.group_id ?? null)
    if (!nextGroup) setMobilePanel('list')
    router.refresh()
  }

  function handleStudentsChanged() {
    setRefreshKey(k => k + 1)
    router.refresh()
  }

  function handleGroupSaved(groupId: string) {
    setModalOpen(false)
    setSelectedGroupId(groupId)
    setRefreshKey(k => k + 1)
    router.refresh()
  }

  // Phase 2: Graduation Wizard committed — select the newly created (Draft)
  // cohort so the TL lands directly on it.
  function handleGraduationCommitted(newGroupId: string) {
    setSelectedGroupId(newGroupId)
    setRefreshKey(k => k + 1)
    router.refresh()
  }

  // Topbar buttons: Export Excel + New Group
  const { setAction } = useTopbarAction()
  useEffect(() => {
    setAction(
      <div className="flex items-center gap-2">
        <button
          onClick={handleExport}
          disabled={exporting}
          className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-[#E2E8F0] bg-white px-3.5 text-[13px] font-medium text-[#374151] transition hover:border-[#CBD5E1] hover:bg-[#F8FAFC] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {exporting ? (
            <svg className="h-4 w-4 animate-spin text-[#94A3B8]" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z" />
            </svg>
          ) : (
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 text-[#64748B]">
              <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          )}
          {exporting ? 'Exporting…' : 'Export Excel'}
        </button>

        {isTL && (
          <button
            onClick={openCreate}
            className="inline-flex h-9 shrink-0 items-center gap-2 rounded-lg bg-[#FF8A1F] px-4 text-[13px] font-semibold text-white transition hover:bg-[#e87c18] active:scale-95"
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
              <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" />
            </svg>
            New Group
          </button>
        )}
      </div>,
    )
    return () => setAction(null)
  }, [isTL, openCreate, setAction, exporting, handleExport])

  return (
    <div className="flex flex-col h-full gap-3">

      {/* Export toast */}
      {exportToast && (
        <div className={`fixed top-6 right-6 z-[100] flex items-center gap-2 rounded-xl border px-4 py-3 text-[13px] font-medium shadow-lg ${
          exportToast.type === 'success'
            ? 'border-[#A7F3D0] bg-[#E7F8EE] text-[#15803D]'
            : 'border-[#FECACA] bg-[#FEE2E2] text-[#DC2626]'
        }`}>
          {exportToast.type === 'success' ? (
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 shrink-0">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
          ) : (
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 shrink-0">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
          )}
          {exportToast.msg}
        </div>
      )}

      {/* KPI strip */}
      {showPageHeader ? (
        <div className="shrink-0">
          <PageHeaderKpiStrip groups={groups} />
        </div>
      ) : (
        <CompactKpiStrip groups={groups} />
      )}

      {/* Split panel workspace */}
      <div ref={containerRef} className="flex-1 min-h-0 flex overflow-hidden ds-card">

        {/* Left panel */}
        <div
          className={[
            'shrink-0 border-r border-[#E2E8F0] overflow-hidden flex flex-col',
            mobilePanel === 'detail' ? 'hidden md:flex' : 'flex',
            !isDesktop ? 'w-full' : '',
          ].join(' ')}
          style={isDesktop ? { width: `${panelWidth}%` } : undefined}
        >
          <GroupSidebar
            groups={visible}
            allGroups={groups}
            filters={filters}
            onFilterChange={patch => setFilters(prev => ({ ...prev, ...patch }))}
            options={options}
            selectedId={selectedGroup?.group_id ?? null}
            onSelect={selectGroup}
          />
        </div>

        {/* Resizable divider */}
        <div
          className="hidden md:flex w-1 shrink-0 cursor-col-resize flex-col items-center justify-center bg-[#F1F5F9] hover:bg-[#FF8A1F]/20 active:bg-[#FF8A1F]/30 transition-colors select-none group"
          onMouseDown={handleDividerMouseDown}
          onDoubleClick={handleDividerDoubleClick}
          title="Drag to resize · Double-click to cycle widths (20 / 30 / 40%)"
        >
          <div className="h-8 w-0.5 rounded-full bg-[#CBD5E1] group-hover:bg-[#FF8A1F]/70 transition-colors" />
        </div>

        {/* Right workspace */}
        <div className={[
          'flex-1 min-w-0 overflow-hidden flex flex-col',
          mobilePanel === 'list' ? 'hidden md:flex' : 'flex',
        ].join(' ')}>
          {mobilePanel === 'detail' && selectedGroup && (
            <div className="flex items-center border-b border-[#E2E8F0] px-4 py-2.5 md:hidden shrink-0 bg-white">
              <button
                onClick={() => setMobilePanel('list')}
                className="flex items-center gap-1.5 text-[12px] font-medium text-[#64748B] hover:text-[#374151]"
              >
                <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                  <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                Back to groups
              </button>
            </div>
          )}

          {selectedGroup ? (
            <GroupWorkspace
              key={selectedGroup.group_id}
              group={selectedGroup}
              isTL={isTL}
              isSuperAdmin={isSuperAdmin}
              onEdit={openEdit}
              onDelete={handleGroupDeleted}
              onStudentsChanged={handleStudentsChanged}
              studentOptions={studentOptions}
              refreshKey={refreshKey}
              allGroups={groups}
              onGraduationCommitted={handleGraduationCommitted}
            />
          ) : (
            <EmptyWorkspace />
          )}
        </div>
      </div>

      {/* Create / Edit modal */}
      <GroupFormModal
        key={`${modalMode}-${editGroup?.group_id ?? 'new'}`}
        isOpen={modalOpen}
        mode={modalMode}
        group={editGroup}
        options={options}
        studentOptions={studentOptions}
        defaultBranchId={defaultBranchId}
        onClose={() => setModalOpen(false)}
        onSuccess={handleGroupSaved}
      />
    </div>
  )
}
