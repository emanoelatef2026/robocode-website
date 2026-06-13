'use server'

import { createServiceClient } from '@/lib/supabase/service'
import { requirePermission }   from '@/modules/rbac/guards'
import { revalidatePath }      from 'next/cache'
import type { PackageLedgerRecord, StudentCourseTimelineEntry } from './types'

// ── Package Ledger ─────────────────────────────────────────────────────────────

export async function getStudentPackageLedgerAction(
  studentId: string,
): Promise<PackageLedgerRecord[]> {
  await requirePermission('manage_attendance')
  const db = createServiceClient()

  const { data } = await db
    .from('v_student_package_ledger' as any)
    .select('*')
    .eq('student_id', studentId)
    .order('session_date', { ascending: false })

  return (data ?? []) as PackageLedgerRecord[]
}

// ── Course Timeline ────────────────────────────────────────────────────────────

export async function getStudentCourseTimelineAction(
  studentId: string,
): Promise<StudentCourseTimelineEntry[]> {
  await requirePermission('manage_attendance')
  const db = createServiceClient()

  const { data } = await db
    .from('v_student_course_history' as any)
    .select('*')
    .eq('student_id', studentId)
    .order('first_session_date', { ascending: false })

  return (data ?? []) as StudentCourseTimelineEntry[]
}

// ── Remove Consumption ─────────────────────────────────────────────────────────
// Removes a single consumption entry and recomputes the enrollment balance.
// Uses the DB-level remove_student_consumption() which verifies student ownership.

export async function removeConsumptionAction(
  consumptionId: string,
  studentId:     string,
): Promise<{ ok: true } | { error: string }> {
  await requirePermission('manage_attendance')
  const db = createServiceClient()

  const { data, error } = await db.rpc('remove_student_consumption' as any, {
    p_consumption_id: consumptionId,
    p_student_id:     studentId,
  })

  if (error) return { error: error.message }

  const rows = (data ?? []) as Array<{ ok: boolean; message: string }>
  const row  = rows[0]
  if (!row?.ok) return { error: row?.message ?? 'Failed to remove consumption' }

  revalidatePath('/portal/team-leader/groups')
  revalidatePath('/portal/team-leader/finance')
  return { ok: true }
}

// ── Reconcile Consumption ──────────────────────────────────────────────────────
// Re-runs FIFO backfill for all active enrollments of a student, then recomputes
// consumed_sessions counters. Safe to run repeatedly.

export async function reconcileStudentConsumptionAction(
  studentId: string,
): Promise<{ ok: true; fixed: number } | { error: string }> {
  await requirePermission('manage_attendance')
  const db = createServiceClient()

  const { data, error } = await db.rpc('reconcile_student_consumption' as any, {
    p_student_id: studentId,
  })

  if (error) return { error: error.message }

  const rows  = (data ?? []) as Array<{ enrollment_id: string; old_consumed: number; new_consumed: number; fixed: boolean }>
  const fixed = rows.filter(r => r.fixed).length

  revalidatePath('/portal/team-leader/groups')
  revalidatePath('/portal/team-leader/finance')
  return { ok: true, fixed }
}
