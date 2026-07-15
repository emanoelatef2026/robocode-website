'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createServiceClient } from '@/lib/supabase/service'
import { requireAuth, requirePermission } from '@/modules/rbac/guards'
import { getInstructorByUserId } from '@/modules/instructor-portal/queries'
import { logTimelineEvent } from '@/lib/timeline'
import {
  seedStudentNoteNotification,
  seedParentNoteNotification,
} from '@/modules/notifications/actions'
import { getStudentUserId, getParentUserIdsForStudent } from '@/modules/notifications/queries'
import { NOTE_CATEGORIES, NOTE_SEVERITIES, NOTE_VISIBILITIES, PRIVATE_VISIBILITIES } from './types'
import type { NoteVisibility } from './types'
import type { ActionResult } from '@/types/app'

// Notifies the student and/or parent(s) if the note's visibility reaches them.
// Fire-and-forget — never blocks note creation.
async function notifyNoteAudience(studentId: string, noteId: string, visibility: NoteVisibility): Promise<void> {
  try {
    if (visibility === 'SHARED' || visibility === 'STUDENT_INSTRUCTION') {
      const studentUserId = await getStudentUserId(studentId)
      if (studentUserId) await seedStudentNoteNotification(studentUserId, noteId)
    }
    if (visibility === 'SHARED' || visibility === 'PARENT_EVALUATION') {
      const parentUserIds = await getParentUserIdsForStudent(studentId)
      await Promise.all(parentUserIds.map((pid) => seedParentNoteNotification(pid, noteId)))
    }
  } catch {
    // non-critical — never throw from notification/timeline side effects
  }
}

function logNoteTimelineEvent(studentId: string, content: string, createdBy: string, visibility: NoteVisibility): void {
  if (PRIVATE_VISIBILITIES.includes(visibility)) return // never leak an author-private note into the timeline
  void logTimelineEvent({
    student_id: studentId,
    event_type: 'NOTE_ADDED',
    notes:      content.slice(0, 140),
    created_by: createdBy,
  }).catch(() => {})
}

// ── Instructor authoring (existing behavior, relocated from instructor-portal) ─
// The is_private checkbox in the existing UI maps to PRIVATE_INSTRUCTOR / INTERNAL_STAFF —
// no UI change; visibility is computed server-side from the same form field.

const noteSchema = z.object({
  student_id:  z.string().uuid(),
  group_id:    z.string().uuid(),
  content:     z.string().min(1, 'Note content is required'),
  category:    z.enum(NOTE_CATEGORIES as [string, ...string[]]).default('GENERAL'),
  severity:    z.enum(NOTE_SEVERITIES as [string, ...string[]]).default('LOW'),
  is_private:  z.string().optional().transform((v) => v !== 'false'),
  schedule_id: z.string().uuid().optional().or(z.literal('')),
})

export async function createStudentNote(
  _prev: unknown,
  formData: FormData
): Promise<ActionResult<{ noteId: string }>> {
  const user = await requireAuth()
  const db   = createServiceClient()

  const raw = {
    student_id:  formData.get('student_id'),
    group_id:    formData.get('group_id'),
    content:     formData.get('content'),
    category:    formData.get('category') || 'GENERAL',
    severity:    formData.get('severity') || 'LOW',
    is_private:  formData.get('is_private') as string | undefined,
    schedule_id: formData.get('schedule_id') || undefined,
  }

  const parsed = noteSchema.safeParse(raw)
  if (!parsed.success) {
    return { success: false, error: { code: 'VALIDATION', message: parsed.error.issues[0].message } }
  }

  const d = parsed.data

  const instructor = await getInstructorByUserId(user.id)
  if (!instructor) {
    return { success: false, error: { code: 'FORBIDDEN', message: 'Instructor record not found.' } }
  }

  // Verify access (group_courses OR group_instructors)
  const { data: gcRow } = await db
    .from('group_courses')
    .select('id')
    .eq('group_id', d.group_id)
    .eq('instructor_id', instructor.id)
    .eq('status', 'active')
    .maybeSingle()

  if (!gcRow) {
    const { data: giRow } = await db
      .from('group_instructors')
      .select('group_id')
      .eq('group_id', d.group_id)
      .eq('instructor_id', instructor.id)
      .maybeSingle()
    if (!giRow) {
      return { success: false, error: { code: 'FORBIDDEN', message: 'You are not assigned to this group.' } }
    }
  }

  const visibility: NoteVisibility = d.is_private ? 'PRIVATE_INSTRUCTOR' : 'INTERNAL_STAFF'

  const { data: note, error: noteErr } = await db
    .from('student_notes')
    .insert({
      student_id:  d.student_id,
      author_id:   user.id,
      content:     d.content,
      category:    d.category,
      severity:    d.severity,
      visibility,
      schedule_id: d.schedule_id || null,
    })
    .select('id')
    .single()

  if (noteErr || !note) {
    return { success: false, error: { code: 'DB_ERROR', message: noteErr?.message ?? 'Failed to save note.' } }
  }

  const noteId = (note as any).id as string
  logNoteTimelineEvent(d.student_id, d.content, user.id, visibility)
  void notifyNoteAudience(d.student_id, noteId, visibility)

  revalidatePath(`/portal/instructor/groups/${d.group_id}/students/${d.student_id}`)
  return { success: true, data: { noteId } }
}

const updateNoteSchema = z.object({
  note_id:    z.string().uuid(),
  student_id: z.string().uuid(),
  group_id:   z.string().uuid(),
  content:    z.string().min(1, 'Note content is required'),
  is_private: z.string().optional().transform((v) => v !== 'false'),
})

export async function updateStudentNote(
  _prev: unknown,
  formData: FormData
): Promise<ActionResult<void>> {
  const user = await requireAuth()
  const db   = createServiceClient()

  const raw = {
    note_id:    formData.get('note_id'),
    student_id: formData.get('student_id'),
    group_id:   formData.get('group_id'),
    content:    formData.get('content'),
    is_private: formData.get('is_private') as string | undefined,
  }

  const parsed = updateNoteSchema.safeParse(raw)
  if (!parsed.success) {
    return { success: false, error: { code: 'VALIDATION', message: parsed.error.issues[0].message } }
  }

  const d = parsed.data
  const visibility: NoteVisibility = d.is_private ? 'PRIVATE_INSTRUCTOR' : 'INTERNAL_STAFF'

  const { error: updateErr } = await db
    .from('student_notes')
    .update({ content: d.content, visibility })
    .eq('id', d.note_id)
    .eq('author_id', user.id)

  if (updateErr) {
    return { success: false, error: { code: 'DB_ERROR', message: updateErr.message } }
  }

  revalidatePath(`/portal/instructor/groups/${d.group_id}/students/${d.student_id}`)
  return { success: true, data: undefined }
}

// Soft delete — preserves the audit trail (the audit trigger logs the deleted_at transition).
export async function deleteStudentNote(formData: FormData): Promise<ActionResult<void>> {
  const user = await requireAuth()
  const db   = createServiceClient()

  const noteId    = formData.get('note_id')    as string
  const studentId = formData.get('student_id') as string
  const groupId   = formData.get('group_id')   as string

  if (!noteId || !studentId || !groupId) {
    return { success: false, error: { code: 'VALIDATION', message: 'Missing required fields.' } }
  }

  const { error } = await db
    .from('student_notes')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', noteId)
    .eq('author_id', user.id)

  if (error) {
    return { success: false, error: { code: 'DB_ERROR', message: error.message } }
  }

  revalidatePath(`/portal/instructor/groups/${groupId}/students/${studentId}`)
  return { success: true, data: undefined }
}

// ── Team Leader authoring (new) ────────────────────────────────────────────────
// No dedicated UI yet (business layer only, per Sprint 2 scope) — callable from a
// future TL portal page. Gated by manage_students (the same permission the RLS
// staff-read policy keys off), scoped to the student's branch.

const tlNoteSchema = z.object({
  student_id:  z.string().uuid(),
  content:     z.string().min(1, 'Note content is required'),
  category:    z.enum(NOTE_CATEGORIES as [string, ...string[]]).default('GENERAL'),
  severity:    z.enum(NOTE_SEVERITIES as [string, ...string[]]).default('LOW'),
  visibility:  z.enum(NOTE_VISIBILITIES as [string, ...string[]]).default('PRIVATE_TEAM_LEADER'),
  schedule_id: z.string().uuid().nullable().optional(),
})

export async function createTeamLeaderNote(
  input: z.infer<typeof tlNoteSchema>
): Promise<ActionResult<{ noteId: string }>> {
  const parsed = tlNoteSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: { code: 'VALIDATION', message: parsed.error.issues[0].message } }
  }
  const d = parsed.data
  const db = createServiceClient()

  const { data: studentRow } = await db
    .from('students')
    .select('branch_id')
    .eq('id', d.student_id)
    .maybeSingle()

  if (!studentRow) {
    return { success: false, error: { code: 'NOT_FOUND', message: 'Student not found.' } }
  }

  const user = await requirePermission('manage_students', { branchId: (studentRow as any).branch_id })

  const { data: note, error } = await db
    .from('student_notes')
    .insert({
      student_id:  d.student_id,
      author_id:   user.id,
      content:     d.content,
      category:    d.category,
      severity:    d.severity,
      visibility:  d.visibility as NoteVisibility,
      schedule_id: d.schedule_id ?? null,
    })
    .select('id')
    .single()

  if (error || !note) {
    return { success: false, error: { code: 'DB_ERROR', message: error?.message ?? 'Failed to save note.' } }
  }

  const noteId = (note as any).id as string
  logNoteTimelineEvent(d.student_id, d.content, user.id, d.visibility as NoteVisibility)
  void notifyNoteAudience(d.student_id, noteId, d.visibility as NoteVisibility)

  return { success: true, data: { noteId } }
}
