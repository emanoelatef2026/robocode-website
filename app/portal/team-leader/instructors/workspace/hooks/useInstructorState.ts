'use client'

import { useState, useTransition, useCallback, useRef, useEffect } from 'react'
import {
  getInstructorDetailAction,
  archiveInstructorAction,
  removeGroupModalAction,
  refreshInstructorListAction,
  deleteInstructorAction,
} from '@/modules/instructors/modal-actions'
import type {
  InstructorOperationalRow,
  FullInstructor,
  InstructorDetailData,
  InstructorGroupDetail,
} from '@/modules/instructors/types'
import type { TabKey } from '../types'

export function useInstructorState(
  initialInstructors: InstructorOperationalRow[],
  branchIds: string[],
) {
  const [instructors, setInstructors] = useState(initialInstructors)

  const [selectedId, setSelectedId]       = useState<string | null>(null)
  const [detail, setDetail]               = useState<InstructorDetailData | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [activeTab, setActiveTab]         = useState<TabKey>('overview')

  const [showForm, setShowForm]                   = useState(false)
  const [editingInstructor, setEditingInstructor] = useState<FullInstructor | null>(null)
  const [showAssignGroup, setShowAssignGroup]     = useState(false)
  const [showArchive, setShowArchive]             = useState(false)
  const [isArchiving, startArchiveTransition]     = useTransition()
  const [showDelete, setShowDelete]               = useState(false)
  const [isDeleting, startDeleteTransition]       = useTransition()
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)

  const pendingEditRef   = useRef(false)
  const pendingDeleteRef = useRef(false)

  const selectedInstructor = instructors.find(i => i.id === selectedId) ?? null
  const currentGroupIds    = detail?.groups.map(g => g.id) ?? []

  const loadDetail = useCallback(async (id: string) => {
    setDetailLoading(true)
    setDetail(null)
    const res = await getInstructorDetailAction(id)
    if (res.success) {
      setDetail(res.data)
      if (pendingEditRef.current) {
        setEditingInstructor(res.data.instructor)
        setShowForm(true)
        pendingEditRef.current = false
      }
      if (pendingDeleteRef.current) {
        setShowDelete(true)
        pendingDeleteRef.current = false
      }
    }
    setDetailLoading(false)
  }, [])

  function selectInstructor(i: InstructorOperationalRow) {
    setSelectedId(i.id)
    setActiveTab('overview')
    loadDetail(i.id)
  }

  function openAssignForInstructor(i: InstructorOperationalRow, e: React.MouseEvent) {
    e.stopPropagation()
    setSelectedId(i.id)
    loadDetail(i.id)
    setShowAssignGroup(true)
  }

  function openEditForInstructor(i: InstructorOperationalRow, e: React.MouseEvent) {
    e.stopPropagation()
    if (selectedId === i.id && detail) {
      setEditingInstructor(detail.instructor)
      setShowForm(true)
    } else {
      setSelectedId(i.id)
      setActiveTab('overview')
      pendingEditRef.current = true
      loadDetail(i.id)
    }
  }

  function openDeleteForInstructor(i: InstructorOperationalRow, e: React.MouseEvent) {
    e.stopPropagation()
    if (selectedId === i.id && detail) {
      setShowDelete(true)
    } else {
      setSelectedId(i.id)
      setActiveTab('overview')
      pendingDeleteRef.current = true
      loadDetail(i.id)
    }
  }

  function openEditFromPopup() {
    setEditingInstructor(detail?.instructor ?? null)
    setShowForm(true)
  }

  const openCreate = useCallback(() => {
    setEditingInstructor(null)
    setShowForm(true)
  }, [])

  function closeInstructor() {
    setSelectedId(null)
    setDetail(null)
  }

  function refreshDetail() {
    if (selectedId) loadDetail(selectedId)
  }

  async function refreshList() {
    const res = await refreshInstructorListAction(branchIds)
    if (res.success) setInstructors(res.data)
  }

  function handleSaved(id: string) {
    setShowForm(false)
    refreshList()
    if (selectedId === id) refreshDetail()
  }

  function handleAssigned() {
    setShowAssignGroup(false)
    refreshDetail()
    refreshList()
  }

  function handleRemoveGroup(g: InstructorGroupDetail) {
    if (!selectedId || !confirm(`Remove instructor from "${g.name}"?`)) return
    removeGroupModalAction(selectedId, g.id).then(res => {
      if (res.success) { refreshDetail(); refreshList() }
    })
  }

  function confirmArchive() {
    if (!selectedId) return
    startArchiveTransition(async () => {
      const res = await archiveInstructorAction(selectedId)
      if (res.success) {
        setShowArchive(false)
        setSelectedId(null)
        setDetail(null)
        refreshList()
      }
    })
  }

  function confirmDelete() {
    if (!selectedId) return
    const deletedId = selectedId
    startDeleteTransition(async () => {
      const res = await deleteInstructorAction(deletedId)
      if (res.success) {
        setShowDelete(false)
        setSelectedId(null)
        setDetail(null)
        setInstructors(prev => prev.filter(i => i.id !== deletedId))
        setToast({ msg: 'Instructor permanently deleted.', type: 'success' })
      } else {
        setShowDelete(false)
        setToast({ msg: res.error?.message ?? 'Delete failed.', type: 'error' })
      }
    })
  }

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 3500)
    return () => clearTimeout(t)
  }, [toast])

  return {
    instructors,
    selectedId,
    detail,
    detailLoading,
    activeTab, setActiveTab,
    showForm, setShowForm,
    editingInstructor, setEditingInstructor,
    showAssignGroup, setShowAssignGroup,
    showArchive, setShowArchive,
    isArchiving,
    showDelete, setShowDelete,
    isDeleting,
    toast,
    selectedInstructor,
    currentGroupIds,
    openCreate,
    openEditFromPopup,
    closeInstructor,
    selectInstructor,
    openAssignForInstructor,
    openEditForInstructor,
    openDeleteForInstructor,
    refreshDetail,
    handleSaved,
    handleAssigned,
    handleRemoveGroup,
    confirmArchive,
    confirmDelete,
  }
}
