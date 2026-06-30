'use client'

import { useState, useEffect, useTransition } from 'react'
import EnrollmentWizard from '../../finance/EnrollmentWizard'
import type { GroupContext } from '../../finance/EnrollmentWizard'
import StudentOpsDrawer from '../../finance/StudentOpsDrawer'
import StudentQuickViewModal from '../StudentQuickViewModal'
import type { StudentOperationsRow } from '@/modules/finance/types'
import {
  getGroupDetailDataAction,
  deleteGroupAction,
  removeStudentFromGroupAction,
} from '@/modules/groups/modal-actions'
import type { GroupDetailData, GroupDetailStudent } from '@/modules/groups/modal-actions'
import type { GroupOperationalRow, GroupStudentOption } from '@/modules/groups/operational'
import GroupAttendanceModal from '../GroupAttendanceModal'
import { GroupSummaryBar } from './components/GroupSummaryBar'
import { GroupStudentsTable } from './components/GroupStudentsTable'
import { StudentSelectionToolbar } from './components/StudentSelectionToolbar'
import { GroupAttendanceTab } from './components/GroupAttendanceTab'
import { GroupFinanceTab } from './components/GroupFinanceTab'
import { GroupPerformanceTab } from './components/GroupPerformanceTab'
import { QuickAddStudentModal } from './dialogs/QuickAddStudentModal'
import { MoveGroupModal } from './dialogs/MoveGroupModal'
import { BulkCertificatesModal } from './dialogs/BulkCertificatesModal'
import { buildStudentResult, mapToOpsRow } from './utils'
import type { WorkspaceTab } from './types'

const TABS: { key: WorkspaceTab; label: (count: number) => string }[] = [
  { key: 'students',    label: count => `Students (${count})` },
  { key: 'attendance',  label: () => 'Attendance'  },
  { key: 'finance',     label: () => 'Finance'     },
  { key: 'performance', label: () => 'Performance' },
]

export function GroupWorkspace({
  group, isTL, onEdit, onDelete, onStudentsChanged, studentOptions, refreshKey, allGroups,
}: {
  group:             GroupOperationalRow
  isTL:              boolean
  onEdit:            (g: GroupOperationalRow) => void
  onDelete:          () => void
  onStudentsChanged: () => void
  studentOptions:    GroupStudentOption[]
  refreshKey:        number
  allGroups:         GroupOperationalRow[]
}) {
  const [tab, setTab]                           = useState<WorkspaceTab>('students')
  const [detailData, setDetailData]             = useState<GroupDetailData | null>(null)
  const [loading, setLoading]                   = useState(false)
  const [deleteConfirm, setDeleteConfirm]       = useState(false)
  const [deleteError, setDeleteError]           = useState<string | null>(null)
  const [quickAddOpen, setQuickAddOpen]         = useState(false)
  const [moveGroupOpen, setMoveGroupOpen]       = useState(false)
  const [attendanceOpen, setAttendanceOpen]     = useState(false)
  const [selectedIds, setSelectedIds]           = useState<Set<string>>(new Set())
  const [drawerOpsRow, setDrawerOpsRow]         = useState<StudentOperationsRow | null>(null)
  const [paymentStudent, setPaymentStudent]     = useState<GroupDetailStudent | null>(null)
  const [quickViewStudent, setQuickViewStudent] = useState<GroupDetailStudent | null>(null)
  const [bulkCertOpen, setBulkCertOpen]         = useState(false)
  const [, startT]                              = useTransition()

  function reloadDetail() {
    setLoading(true)
    getGroupDetailDataAction(group.group_id)
      .then(d => { setDetailData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelectedIds(new Set())
    reloadDetail()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [group.group_id, refreshKey])

  function toggleStudent(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleAll() {
    const all = detailData?.students ?? []
    if (all.every(s => selectedIds.has(s.student_id))) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(all.map(s => s.student_id)))
    }
  }

  async function handleRemoveStudents(ids: string[]) {
    await Promise.all(ids.map(id => removeStudentFromGroupAction(group.group_id, id)))
    setSelectedIds(new Set())
    onStudentsChanged()
  }

  function handleAddPayment(student: GroupDetailStudent) {
    if (student.account_id) {
      setDrawerOpsRow(mapToOpsRow(student, group))
    } else {
      setPaymentStudent(student)
    }
  }

  function handleDeleteConfirm() {
    setDeleteError(null)
    startT(async () => {
      const res = await deleteGroupAction(group.group_id)
      if (!res.success) { setDeleteError(res.error?.message ?? 'Failed to delete group.'); return }
      setDeleteConfirm(false)
      onDelete()
    })
  }

  const students          = detailData?.students ?? []
  const sessions          = detailData?.sessions ?? []
  const currentStudentIds = students.map(s => s.student_id)
  const sessionsCompleted = group.completed_sessions

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <GroupSummaryBar
        group={group}
        sessionsCompleted={sessionsCompleted}
        isTL={isTL}
        onEdit={onEdit}
        onDelete={() => { setDeleteError(null); setDeleteConfirm(true) }}
        onRecordAttendance={() => setAttendanceOpen(true)}
        onAddStudent={() => setQuickAddOpen(true)}
        onIssueBulkCertificates={() => setBulkCertOpen(true)}
      />

      {/* Tab bar */}
      <div className="flex border-b border-[#E2E8F0] shrink-0 bg-white overflow-x-auto">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={[
              'flex-1 md:flex-none shrink-0 border-b-2 px-2 md:px-4 py-2.5 text-[11px] md:text-[12px] font-medium transition whitespace-nowrap text-center',
              tab === t.key
                ? 'border-[#FF8A1F] text-[#FF8A1F]'
                : 'border-transparent text-[#64748B] hover:text-[#374151]',
            ].join(' ')}
          >
            {t.label(group.student_count)}
          </button>
        ))}
      </div>

      {/* Students toolbar */}
      {tab === 'students' && (
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-[#E2E8F0] bg-white px-4 py-2 flex-wrap">
          <span className="text-[12px] text-[#64748B]">
            {loading ? '' : `${students.length} students`}
          </span>
          <div className="flex items-center gap-2 flex-wrap">
            {selectedIds.size > 0 && (
              <StudentSelectionToolbar
                students={students}
                selectedIds={selectedIds}
                isTL={isTL}
                onRemove={handleRemoveStudents}
                onAddPayment={handleAddPayment}
                onMoveGroup={() => setMoveGroupOpen(true)}
                onView={s => setQuickViewStudent(s)}
                onClear={() => setSelectedIds(new Set())}
              />
            )}
          </div>
        </div>
      )}

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {tab === 'students' && (
          <GroupStudentsTable
            students={students}
            loading={loading}
            selectedIds={selectedIds}
            onToggleStudent={toggleStudent}
            onToggleAll={toggleAll}
          />
        )}
        {tab === 'attendance' && (
          <GroupAttendanceTab
            sessions={sessions}
            students={students}
            group={group}
            loading={loading}
            isTL={isTL}
            onOpenAddSession={() => setAttendanceOpen(true)}
            onSessionsChanged={reloadDetail}
          />
        )}
        {tab === 'finance' && (
          <GroupFinanceTab students={students} loading={loading} />
        )}
        {tab === 'performance' && (
          <GroupPerformanceTab group={group} />
        )}
      </div>

      {/* Finance drawer — student has existing contract */}
      {drawerOpsRow && isTL && (
        <StudentOpsDrawer
          student={drawerOpsRow}
          onClose={() => {
            setDrawerOpsRow(null)
            setSelectedIds(new Set())
            onStudentsChanged()
          }}
        />
      )}

      {/* EnrollmentWizard — new contract */}
      {paymentStudent && isTL && (
        <EnrollmentWizard
          branchIds={[group.branch_id]}
          preselectedStudent={buildStudentResult(paymentStudent, group)}
          groupContext={{
            group_id:        group.group_id,
            group_name:      group.name,
            course_id:       group.course_id   ?? null,
            course_name:     group.course_name ?? null,
            instructor_id:   group.lead_instructor_id   ?? null,
            instructor_name: group.lead_instructor_name ?? null,
          } satisfies GroupContext}
          onClose={() => setPaymentStudent(null)}
          onSuccess={() => {
            setPaymentStudent(null)
            setSelectedIds(new Set())
            onStudentsChanged()
          }}
        />
      )}

      {/* Move Group modal */}
      <MoveGroupModal
        isOpen={moveGroupOpen}
        currentGroup={group}
        allGroups={allGroups}
        selectedIds={selectedIds}
        onClose={() => setMoveGroupOpen(false)}
        onMoved={() => {
          setMoveGroupOpen(false)
          setSelectedIds(new Set())
          onStudentsChanged()
        }}
      />

      {/* Student quick view modal */}
      {quickViewStudent && (
        <StudentQuickViewModal
          student={quickViewStudent}
          group={group}
          onClose={() => setQuickViewStudent(null)}
          onStudentUpdated={() => {
            setQuickViewStudent(null)
            onStudentsChanged()
          }}
          onOpenFullFinance={() => {
            const s = quickViewStudent
            setQuickViewStudent(null)
            if (s.account_id) setDrawerOpsRow(mapToOpsRow(s, group))
          }}
        />
      )}

      {/* Delete confirmation */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="mb-1 text-[15px] font-bold text-[#0B1F3A]">Delete Group</h3>
            <p className="mb-4 text-[13px] text-[#64748B]">
              Permanently remove <strong>{group.name}</strong>?
            </p>
            <div className="mb-4 space-y-2 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-3">
              <div className="flex items-center justify-between text-[12px]">
                <span className="text-[#64748B]">Active students</span>
                <span className="font-semibold text-[#0B1F3A]">{group.student_count}</span>
              </div>
              <div className="flex items-center justify-between text-[12px]">
                <span className="text-[#64748B]">Sessions completed</span>
                <span className="font-semibold text-[#0B1F3A]">{sessionsCompleted}</span>
              </div>
              {students.some(s => s.paid_amount > 0) && (
                <p className="mt-1 rounded-lg bg-[#FFFBEB] px-2 py-1.5 text-[11px] text-[#B45309]">
                  This group has financial records. Payment history will be preserved.
                </p>
              )}
            </div>
            <p className="mb-5 text-[11px] text-[#94A3B8]">
              The group will be archived. Student payment and attendance history are never deleted.
            </p>
            {deleteError && (
              <p className="mb-3 rounded-lg bg-[#FEE2E2] px-3 py-2 text-[12px] text-[#EF4444]">{deleteError}</p>
            )}
            <div className="flex gap-2">
              <button
                onClick={() => setDeleteConfirm(false)}
                className="flex-1 rounded-lg border border-[#E2E8F0] py-2 text-[13px] text-[#374151] hover:bg-[#F8FAFC] transition"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteConfirm}
                className="flex-1 rounded-lg bg-[#EF4444] py-2 text-[13px] font-semibold text-white hover:bg-[#DC2626] transition"
              >
                Delete Group
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quick Add Student modal */}
      <QuickAddStudentModal
        isOpen={quickAddOpen}
        group={group}
        studentOptions={studentOptions}
        currentStudentIds={currentStudentIds}
        onClose={() => setQuickAddOpen(false)}
        onAdded={onStudentsChanged}
      />

      {/* Bulk Certificates wizard */}
      <BulkCertificatesModal
        isOpen={bulkCertOpen}
        group={group}
        students={detailData?.students ?? []}
        onClose={() => setBulkCertOpen(false)}
        onSuccess={() => {
          setBulkCertOpen(false)
          reloadDetail()
        }}
      />

      {/* Group Attendance modal */}
      <GroupAttendanceModal
        group={group}
        students={students}
        isOpen={attendanceOpen}
        onClose={() => setAttendanceOpen(false)}
        onSuccess={() => {
          setAttendanceOpen(false)
          reloadDetail()
          onStudentsChanged()
        }}
      />
    </div>
  )
}
