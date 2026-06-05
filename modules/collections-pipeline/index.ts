import 'server-only'
import { createServiceClient } from '@/lib/supabase/service'
import { logTimelineEvent }    from '@/lib/timeline'

// ── Types ──────────────────────────────────────────────────────────────────────

export type CollectionStage =
  | 'FRIENDLY_REMINDER'
  | 'DUE_NOTICE'
  | 'OVERDUE_WARNING'
  | 'CRITICAL_COLLECTION'
  | 'FINAL_ESCALATION'

export interface CollectionPipelineRow {
  enrollment_id:   string
  student_id:      string
  student_name:    string
  branch_id:       string
  days_overdue:    number
  remaining_amount: number
  current_stage:   CollectionStage | null
  stage_set_at:    string | null
  promise_reliability: number | null  // 0-100
}

// ── Stage progression ─────────────────────────────────────────────────────────

const STAGE_ORDER: CollectionStage[] = [
  'FRIENDLY_REMINDER',
  'DUE_NOTICE',
  'OVERDUE_WARNING',
  'CRITICAL_COLLECTION',
  'FINAL_ESCALATION',
]

export function computeCollectionStage(
  daysOverdue: number,
  brokenPromises: number = 0
): CollectionStage | null {
  if (daysOverdue <= 0) return null

  // Accelerate stage for broken promises
  const acceleration = Math.min(2, brokenPromises)

  const baseStageIdx =
    daysOverdue >= 60 ? 4 :
    daysOverdue >= 30 ? 3 :
    daysOverdue >= 14 ? 2 :
    daysOverdue >= 7  ? 1 : 0

  const idx = Math.min(4, baseStageIdx + acceleration)
  return STAGE_ORDER[idx]
}

export function nextStage(current: CollectionStage | null): CollectionStage | null {
  if (!current) return 'FRIENDLY_REMINDER'
  const idx = STAGE_ORDER.indexOf(current)
  return idx < STAGE_ORDER.length - 1 ? STAGE_ORDER[idx + 1] : current
}

// ── Advance stage for a single enrollment ────────────────────────────────────

export async function advanceCollectionStage(
  enrollmentId: string,
  newStage: CollectionStage,
  actorUserId?: string
): Promise<void> {
  const db = createServiceClient()

  // Get enrollment context
  const { data: enroll } = await db
    .from('student_enrollments')
    .select('student_id, branch_id, collection_stage')
    .eq('id', enrollmentId)
    .single()

  if (!enroll) return

  // Only advance — never retreat
  const currentIdx = enroll.collection_stage
    ? STAGE_ORDER.indexOf(enroll.collection_stage as CollectionStage)
    : -1
  const newIdx = STAGE_ORDER.indexOf(newStage)
  if (newIdx <= currentIdx) return

  await db
    .from('student_enrollments')
    .update({
      collection_stage:        newStage,
      collection_stage_set_at: new Date().toISOString(),
    })
    .eq('id', enrollmentId)

  await logTimelineEvent({
    student_id:    enroll.student_id,
    enrollment_id: enrollmentId,
    event_type:    'COLLECTION_STAGE_ADVANCED' as any,
    notes:         `Collection stage → ${newStage}`,
    created_by:    actorUserId ?? null,
    branch_id:     enroll.branch_id ?? null,
  }).catch(() => {/* non-fatal */})
}

// ── Process pipeline for all active overdue enrollments ──────────────────────

export async function processCollectionPipeline(
  branchIds: string[]
): Promise<{ processed: number; advanced: number }> {
  if (!branchIds.length) return { processed: 0, advanced: 0 }

  const db = createServiceClient()

  // Fetch all ACTIVE overdue enrollments
  const { data: enrollments } = await db
    .from('student_enrollments')
    .select(`
      id, student_id, branch_id, financial_status,
      collection_stage, collection_stage_set_at
    `)
    .in('branch_id', branchIds)
    .eq('status', 'ACTIVE')
    .in('financial_status', ['OVERDUE', 'BLOCKED'])

  if (!enrollments?.length) return { processed: 0, advanced: 0 }

  // Fetch linked financial accounts for days_overdue
  const enrollIds = enrollments.map((e: any) => e.id as string)
  const { data: accounts } = await db
    .from('student_financial_accounts')
    .select('enrollment_id, next_due_date')
    .in('enrollment_id', enrollIds)

  const accMap = new Map<string, string | null>()
  for (const acc of (accounts ?? []) as any[]) {
    accMap.set(acc.enrollment_id, acc.next_due_date)
  }

  // Fetch broken promises per enrollment
  const { data: promises } = await db
    .from('payment_promises')
    .select('enrollment_id, status')
    .in('enrollment_id', enrollIds)
    .eq('status', 'BROKEN')

  const brokenMap = new Map<string, number>()
  for (const p of (promises ?? []) as any[]) {
    brokenMap.set(p.enrollment_id, (brokenMap.get(p.enrollment_id) ?? 0) + 1)
  }

  let processed = 0, advanced = 0
  const today = new Date().toISOString().slice(0, 10)

  for (const enroll of (enrollments ?? []) as any[]) {
    processed++
    const nextDue   = accMap.get(enroll.id) ?? null
    const daysOver  = nextDue
      ? Math.max(0, Math.floor((Date.now() - new Date(nextDue).getTime()) / 86400000))
      : 0

    const broken   = brokenMap.get(enroll.id) ?? 0
    const computed = computeCollectionStage(daysOver, broken)
    if (!computed) continue

    const currentIdx = enroll.collection_stage
      ? STAGE_ORDER.indexOf(enroll.collection_stage as CollectionStage) : -1
    const newIdx = STAGE_ORDER.indexOf(computed)

    if (newIdx > currentIdx) {
      await advanceCollectionStage(enroll.id, computed).catch(() => {/* non-fatal */})
      advanced++
    }
  }

  return { processed, advanced }
}

// ── Compute promise reliability score ────────────────────────────────────────

export async function computePromiseReliability(studentId: string): Promise<number> {
  const db = createServiceClient()
  const { data } = await db
    .from('payment_promises')
    .select('status')
    .eq('student_id', studentId)
    .in('status', ['FULFILLED', 'BROKEN'])

  const rows = (data ?? []) as any[]
  if (!rows.length) return 100  // no history = perfect score

  const fulfilled = rows.filter(r => r.status === 'FULFILLED').length
  return Math.round((fulfilled / rows.length) * 100)
}

// ── Display config ────────────────────────────────────────────────────────────

export const COLLECTION_STAGE_CONFIG: Record<CollectionStage, {
  label: string; color: string; text: string; description: string
}> = {
  FRIENDLY_REMINDER: {
    label: 'Friendly Reminder', color: 'bg-blue-100',   text: 'text-blue-700',
    description: 'First reminder — payment is due or slightly overdue.',
  },
  DUE_NOTICE: {
    label: 'Due Notice',        color: 'bg-amber-100',  text: 'text-amber-700',
    description: 'Payment is overdue — formal notice sent.',
  },
  OVERDUE_WARNING: {
    label: 'Overdue Warning',   color: 'bg-orange-100', text: 'text-orange-700',
    description: 'Significantly overdue — escalating to parent.',
  },
  CRITICAL_COLLECTION: {
    label: 'Critical',          color: 'bg-red-100',    text: 'text-red-700',
    description: 'Critical collection situation — may restrict access.',
  },
  FINAL_ESCALATION: {
    label: 'Final Escalation',  color: 'bg-red-200',    text: 'text-red-900',
    description: 'Final stage — management intervention required.',
  },
}
