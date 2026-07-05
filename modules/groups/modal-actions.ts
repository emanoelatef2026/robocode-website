// Named re-exports — no "use server" here; each source file carries its own directive.
// This file is a pure re-export boundary — no wildcard exports, no runtime code.

export { createGroupModal, updateGroupModal, archiveGroupAction, deleteGroupAction } from './actions/group-crud'
export { addStudentsToGroupAction, removeStudentFromGroupAction } from './actions/students'
export { getGroupDetailDataAction } from './actions/detail'
export { getStudentAttendanceHistoryAction } from './actions/attendance'
export {
  addGroupSessionAction,
  editGroupSessionAction,
  deleteGroupSessionAction,
  rebuildGroupAttendanceAction,
} from './actions/group-attendance'
export { getStudentAuthDataAction, getStudentAttendanceSummaryAction, getStudentPortalCredentials } from './actions/student-quick-view'
export {
  getStudentPackageLedgerAction,
  getStudentCourseTimelineAction,
  removeConsumptionAction,
  reconcileStudentConsumptionAction,
} from './actions/package-ledger'

export type {
  GroupDetailData,
  GroupDetailSession,
  GroupDetailStudent,
  GroupDetailParentInfo,
  SessionAttendanceRecord,
  StudentAttendanceHistoryRecord,
  StudentAuthData,
  StudentAttendanceSummary,
  PackageLedgerRecord,
  StudentCourseTimelineEntry,
} from './actions/types'
export type { StudentPortalCredentials, PortalStatus } from '@/modules/students/portal-credentials'
