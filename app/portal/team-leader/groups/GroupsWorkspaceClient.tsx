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

interface Props {
  groups:          GroupOperationalRow[]
  options:         GroupFormOptions
  studentOptions:  GroupStudentOption[]
  defaultBranchId: string
  isTL:            boolean
  showPageHeader?: boolean
}

export default function GroupsWorkspaceClient({
  groups, options, studentOptions, defaultBranchId, isTL, showPageHeader = false,
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

  // Topbar "New Group" button
  const { setAction } = useTopbarAction()
  useEffect(() => {
    if (!isTL) return
    setAction(
      <button
        onClick={openCreate}
        className="inline-flex h-9 shrink-0 items-center gap-2 rounded-lg bg-[#FF8A1F] px-4 text-[13px] font-semibold text-white transition hover:bg-[#e87c18] active:scale-95"
      >
        <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
          <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" />
        </svg>
        New Group
      </button>,
    )
    return () => setAction(null)
  }, [isTL, openCreate, setAction])

  return (
    <div className="flex flex-col h-full gap-3">

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
              onEdit={openEdit}
              onDelete={handleGroupDeleted}
              onStudentsChanged={handleStudentsChanged}
              studentOptions={studentOptions}
              refreshKey={refreshKey}
              allGroups={groups}
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
