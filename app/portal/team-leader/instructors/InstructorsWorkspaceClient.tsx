'use client'

import { useState, useCallback, useEffect } from 'react'
import { useTopbarAction } from '@/components/shared/layout/TopbarActionContext'
import type { InstructorOperationalRow, InstructorFormOptions } from '@/modules/instructors/types'
import { useInstructorState } from './workspace/hooks/useInstructorState'
import { useInstructorFilters } from './workspace/hooks/useInstructorFilters'
import { InstructorTopBar } from './workspace/components/InstructorTopBar'
import { InstructorFiltersBar } from './workspace/components/InstructorFiltersBar'
import { InstructorGridCard } from './workspace/components/InstructorGridCard'
import { InstructorListRow } from './workspace/components/InstructorListRow'
import { InstructorPopup } from './workspace/dialogs/InstructorPopup'
import { InstructorFormModal } from './workspace/dialogs/InstructorFormModal'
import { AssignGroupModal } from './workspace/dialogs/AssignGroupModal'
import { ConfirmArchive } from './workspace/dialogs/ConfirmArchive'
import { ConfirmDelete } from './workspace/dialogs/ConfirmDelete'
import { Toast } from './workspace/dialogs/Toast'
import { displayName, isFuture } from './workspace/utils'

export default function InstructorsWorkspaceClient({
  instructors: initialInstructors,
  options:     initialOptions,
  branchIds,
  canManage,
}: {
  instructors: InstructorOperationalRow[]
  options:     InstructorFormOptions
  branchIds:   string[]
  canManage:   boolean
}) {
  const [options] = useState(initialOptions)
  const state     = useInstructorState(initialInstructors, branchIds)
  const filters   = useInstructorFilters(state.instructors)

  const { setAction } = useTopbarAction()
  const openCreate = useCallback(() => state.openCreate(), [state.openCreate])

  useEffect(() => {
    if (!canManage) return
    setAction(
      <button onClick={openCreate} className="ds-btn-orange">
        <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
          <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" />
        </svg>
        Add Instructor
      </button>
    )
    return () => setAction(null)
  }, [canManage, openCreate, setAction])

  return (
    <div className="flex h-[calc(100vh-64px)] flex-col overflow-hidden bg-[#F8FAFC]">
      <InstructorTopBar
        viewMode={filters.viewMode}
        onViewModeChange={filters.setViewMode}
      />

      <InstructorFiltersBar
        searchQ={filters.searchQ}
        onSearchChange={filters.setSearchQ}
        branchFilter={filters.branchFilter}
        onBranchChange={filters.setBranchFilter}
        quickFilter={filters.quickFilter}
        onQuickFilterChange={filters.setQuickFilter}
        onClear={filters.clearFilters}
        hasActiveFilter={filters.hasActiveFilter}
        branches={options.branches}
        instructors={state.instructors}
        visibleCount={filters.visible.length}
        totalCount={state.instructors.length}
      />

      <div className="flex-1 overflow-y-auto pb-bottom-nav md:pb-0">
        {filters.visible.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="mb-4 h-12 w-12 text-[#E2E8F0]">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
            </svg>
            <p className="text-[15px] font-semibold text-[#94A3B8]">No instructors found</p>
            <p className="mt-1 text-[12px] text-[#CBD5E1]">Try adjusting your filters</p>
          </div>
        ) : filters.viewMode === 'grid' ? (
          <div className="p-2 md:p-5 grid grid-cols-1 gap-1.5 md:gap-3 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
            {filters.visible.map(i => (
              <InstructorGridCard
                key={i.id}
                instructor={i}
                selected={state.selectedId === i.id}
                onClick={() => state.selectInstructor(i)}
                canManage={canManage}
                onAssign={e => state.openAssignForInstructor(i, e)}
                onEdit={e => state.openEditForInstructor(i, e)}
                onDelete={e => state.openDeleteForInstructor(i, e)}
              />
            ))}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px]">
              <thead className="ds-table-head sticky top-0 z-10">
                <tr>
                  <th>Instructor</th>
                  <th>Branches</th>
                  <th>Groups</th>
                  <th>Students</th>
                  <th>Today</th>
                  <th>Att.%</th>
                  <th>Salary/Sess</th>
                  <th>Status</th>
                  {canManage && <th>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {filters.visible.map(i => (
                  <InstructorListRow
                    key={i.id}
                    instructor={i}
                    selected={state.selectedId === i.id}
                    onClick={() => state.selectInstructor(i)}
                    canManage={canManage}
                    onAssign={e => state.openAssignForInstructor(i, e)}
                    onEdit={e => state.openEditForInstructor(i, e)}
                    onDelete={e => state.openDeleteForInstructor(i, e)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {state.selectedId && state.selectedInstructor && (
        <InstructorPopup
          instructor={state.selectedInstructor}
          detail={state.detail}
          loading={state.detailLoading}
          activeTab={state.activeTab}
          onTabChange={state.setActiveTab}
          canManage={canManage}
          onEdit={state.openEditFromPopup}
          onAssignGroup={() => state.setShowAssignGroup(true)}
          onArchive={() => state.setShowArchive(true)}
          onDelete={() => state.setShowDelete(true)}
          onRemoveGroup={state.handleRemoveGroup}
          onClose={state.closeInstructor}
          onRefreshDetail={state.refreshDetail}
        />
      )}

      {state.showForm && (
        <InstructorFormModal
          instructor={state.editingInstructor}
          options={options}
          defaultBranchIds={branchIds}
          onClose={() => { state.setShowForm(false); state.setEditingInstructor(null) }}
          onSaved={state.handleSaved}
        />
      )}

      {state.showAssignGroup && state.selectedId && (
        <AssignGroupModal
          instructorId={state.selectedId}
          currentGroupIds={state.currentGroupIds}
          options={options}
          onClose={() => state.setShowAssignGroup(false)}
          onAssigned={state.handleAssigned}
        />
      )}

      {state.showArchive && state.selectedInstructor && (
        <ConfirmArchive
          name={displayName(state.selectedInstructor.first_name, state.selectedInstructor.last_name, state.selectedInstructor.user_email)}
          onConfirm={state.confirmArchive}
          onCancel={() => state.setShowArchive(false)}
          isPending={state.isArchiving}
        />
      )}

      {state.showDelete && state.selectedInstructor && (
        <ConfirmDelete
          name={displayName(state.selectedInstructor.first_name, state.selectedInstructor.last_name, state.selectedInstructor.user_email)}
          instructorCode={state.selectedInstructor.instructor_code}
          branchNames={state.selectedInstructor.branch_names}
          groupCount={state.selectedInstructor.group_count}
          studentCount={state.selectedInstructor.student_count}
          activeGroupCount={state.detail?.groups.filter(g => g.status === 'active').length ?? 0}
          futureSessionCount={state.detail?.sessions.filter(s => isFuture(s.scheduled_at) && s.status !== 'cancelled').length ?? 0}
          onConfirm={state.confirmDelete}
          onCancel={() => state.setShowDelete(false)}
          onArchiveInstead={() => { state.setShowDelete(false); state.setShowArchive(true) }}
          isPending={state.isDeleting}
        />
      )}

      {state.toast && <Toast msg={state.toast.msg} type={state.toast.type} />}
    </div>
  )
}
