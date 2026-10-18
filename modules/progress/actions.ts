'use server'
import { requireAuth } from '@/modules/rbac/guards'
import { recalculateStudentProgress } from './recalculate'
import type { ActionResult } from '@/types/app'

export async function calculateStudentProgress(
  studentId: string, courseId: string, semesterId: string, groupId: string,
): Promise<ActionResult<void>> {
  await requireAuth()
  return recalculateStudentProgress(studentId, courseId, semesterId, groupId)
}
