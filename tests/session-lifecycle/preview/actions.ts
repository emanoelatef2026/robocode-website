import type { ActionResult } from '@/types/app'

export const PREVIEW_EVENT = 'synthetic-session-action'
export const controls = { delay: 900, failOnce: false, calls: 0 }
export type PreviewAction = { name: string; fields: [string, string][]; completed: boolean; failed: boolean }

// In-memory only: these functions never import a backend or make a request.
async function perform(name: string, args: unknown[]): Promise<ActionResult<any>> {
  const form = args.find(arg => arg instanceof FormData) as FormData | undefined
  const fields: [string, string][] = form ? Array.from(form.entries(), ([key, value]) => [key, String(value)]) : []
  const failed = controls.failOnce
  controls.failOnce = false
  controls.calls += 1
  await new Promise(resolve => setTimeout(resolve, controls.delay))
  const detail: PreviewAction = { name, fields, completed: !failed && (name === 'saveAndEndSession' || name === 'endSession'), failed }
  window.dispatchEvent(new CustomEvent(PREVIEW_EVENT, { detail }))
  if (failed) return { success: false, error: { code: 'DB_ERROR', message: 'Synthetic save failed once. Your draft is kept; retry to save.' } }
  return { success: true, data: { id: 'synthetic-created-1', assignmentId: 'synthetic-homework-1' } }
}

export const saveAttendance = (...args: unknown[]) => perform('saveAttendance', args)
export const saveAndEndSession = (...args: unknown[]) => perform('saveAndEndSession', args)
export const updateSession = (...args: unknown[]) => perform('updateSession', args)
export const endSession = (...args: unknown[]) => perform('endSession', args)
export const addSessionRecording = (...args: unknown[]) => perform('addSessionRecording', args)
export const removeSessionRecording = (...args: unknown[]) => perform('removeSessionRecording', args)
export const updateSessionResources = (...args: unknown[]) => perform('updateSessionResources', args)
export const createSessionHomework = (...args: unknown[]) => perform('createSessionHomework', args)
export const updateSessionHomework = (...args: unknown[]) => perform('updateSessionHomework', args)
export const cancelSession = (...args: unknown[]) => perform('cancelSession', args)
export const postponeSession = (...args: unknown[]) => perform('postponeSession', args)
export const createStudentNote = (...args: unknown[]) => perform('createStudentNote', args)
export const createInstructorEvaluation = (...args: unknown[]) => perform('createInstructorEvaluation', args)
export const createInstructorEvaluationBatch = (...args: unknown[]) => perform('createInstructorEvaluationBatch', args)
