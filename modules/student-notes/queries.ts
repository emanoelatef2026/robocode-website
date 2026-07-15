import 'server-only'
import { createServiceClient } from '@/lib/supabase/service'
import { PRIVATE_VISIBILITIES } from './types'
import type { StudentNoteRecord, StudentNote, ViewerKind } from './types'

// ─── Visibility matrix — single source of truth ──────────────────────────────
// RLS enforces the same rule set at the DB layer (defense in depth); this is the
// app-layer decision used by every service-role query, matching this repo's
// documented pattern of real enforcement living in hand-written app-layer checks.

export function canViewerReadNote(
  note: Pick<StudentNoteRecord, 'author_id' | 'visibility'>,
  viewer: { userId: string; kind: ViewerKind }
): boolean {
  if (note.author_id === viewer.userId) return true
  if (PRIVATE_VISIBILITIES.includes(note.visibility)) return false

  switch (viewer.kind) {
    case 'staff':   return true // INTERNAL_STAFF, SHARED, STUDENT_INSTRUCTION, PARENT_EVALUATION
    case 'student': return note.visibility === 'SHARED' || note.visibility === 'STUDENT_INSTRUCTION'
    case 'parent':  return note.visibility === 'SHARED' || note.visibility === 'PARENT_EVALUATION'
    default:        return false
  }
}

// ─── Reader — shared across staff/student/parent portals ─────────────────────

export async function getStudentNotes(
  studentId: string,
  viewer: { userId: string; kind: ViewerKind }
): Promise<StudentNote[]> {
  const db = createServiceClient()

  const { data: rows } = await db
    .from('student_notes')
    .select(
      `id, content, category, severity, visibility, author_id, schedule_id, created_at, updated_at,
       schedules!student_notes_schedule_id_fkey(topic)`
    )
    .eq('student_id', studentId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })

  if (!rows || rows.length === 0) return []

  const authorIds = [...new Set((rows as any[]).map((n) => n.author_id as string))]
  const authorNameMap = new Map<string, string>()
  if (authorIds.length > 0) {
    const { data: authorRows } = await db
      .from('users')
      .select('id, profiles!profiles_user_id_fkey(first_name, last_name)')
      .in('id', authorIds)
    for (const a of authorRows ?? []) {
      const p = (a as any).profiles
      const name = [p?.first_name, p?.last_name].filter(Boolean).join(' ') || (a as any).id
      authorNameMap.set((a as any).id, name)
    }
  }

  return (rows as any[])
    .filter((n) => canViewerReadNote({ author_id: n.author_id, visibility: n.visibility }, viewer))
    .map((n) => ({
      id:             n.id,
      content:        n.content,
      category:       n.category,
      severity:       n.severity,
      visibility:     n.visibility,
      schedule_id:    n.schedule_id ?? null,
      schedule_topic: n.schedules?.topic ?? null,
      created_at:     n.created_at,
      updated_at:     n.updated_at,
      author_name:    authorNameMap.get(n.author_id) ?? 'Staff',
      is_own:         n.author_id === viewer.userId,
    }))
}
