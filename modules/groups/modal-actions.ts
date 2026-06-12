// Named re-exports — no "use server" here; each source file carries its own directive.
// This file is a pure re-export boundary — no wildcard exports, no runtime code.

export { createGroupModal, updateGroupModal, archiveGroupAction, deleteGroupAction } from './actions/group-crud'
export { addStudentsToGroupAction, removeStudentFromGroupAction } from './actions/students'
export { getGroupDetailDataAction } from './actions/detail'
export { getStudentAttendanceHistoryAction } from './actions/attendance'
export { getStudentAuthDataAction, getStudentAttendanceSummaryAction, getStudentPortalCredentials } from './actions/student-quick-view'

export type {
  GroupDetailData,
  GroupDetailSession,
  GroupDetailStudent,
  StudentAttendanceHistoryRecord,
  StudentAuthData,
  StudentAttendanceSummary,
} from './actions/types'
export type { StudentPortalCredentials, PortalStatus } from '@/modules/students/portal-credentials'
