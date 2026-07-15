import 'server-only'
import { createServiceClient } from '@/lib/supabase/service'

// ── Event types ────────────────────────────────────────────────────────────────

export type TimelineEventType =
  | 'ENROLLMENT_CREATED'
  | 'PAYMENT'
  | 'PAYMENT_REVERSAL'
  | 'REMINDER_SENT'
  | 'NOTE_ADDED'
  | 'PROMISE_MADE'
  | 'PROMISE_FULFILLED'
  | 'PROMISE_BROKEN'
  | 'OVERDRAFT_GRANTED'
  | 'ATTENDANCE_RECORDED'
  | 'RENEWAL_NEEDED'
  | 'RENEWAL_CREATED'
  | 'TRANSFER'
  | 'TRANSFER_REQUESTED'
  | 'COMPLAINT_LOGGED'
  | 'PARENT_MESSAGE'
  | 'PARENT_ESCALATION'
  | 'MANUAL_ADJUSTMENT'
  | 'BLOCK_APPLIED'
  | 'BLOCK_LIFTED'
  // Sprint 51: new coverage
  | 'HOMEWORK_ASSIGNED'
  | 'HOMEWORK_COMPLETED'
  | 'CERTIFICATE_ISSUED'
  | 'CALL_LOGGED'
  | 'WHATSAPP_SENT'
  | 'TASK_CREATED'
  | 'TASK_COMPLETED'
  | 'SCORE_COMPUTED'
  | 'COLLECTION_STAGE_ADVANCED'
  | 'ENROLLMENT_CANCELLED'
  // Sprint 2: Student Domain
  | 'EVALUATION_RECORDED'
  | 'COMPETITION_LOGGED'
  | 'ACHIEVEMENT_EARNED'
  | 'BADGE_EARNED'

export type TimelineEventSeverity = 'INFO' | 'WARNING' | 'CRITICAL'

export interface TimelineEventInput {
  student_id:    string
  enrollment_id?: string | null
  account_id?:   string | null
  schedule_id?:  string | null
  event_type:    TimelineEventType
  notes?:        string | null
  created_by?:   string | null
  branch_id?:    string | null
  severity?:     TimelineEventSeverity
}

// ── Severity map ───────────────────────────────────────────────────────────────

const SEVERITY_MAP: Record<TimelineEventType, TimelineEventSeverity> = {
  ENROLLMENT_CREATED:        'INFO',
  PAYMENT:                   'INFO',
  PAYMENT_REVERSAL:          'WARNING',
  REMINDER_SENT:             'INFO',
  NOTE_ADDED:                'INFO',
  PROMISE_MADE:              'INFO',
  PROMISE_FULFILLED:         'INFO',
  PROMISE_BROKEN:            'WARNING',
  OVERDRAFT_GRANTED:         'WARNING',
  ATTENDANCE_RECORDED:       'INFO',
  RENEWAL_NEEDED:            'WARNING',
  RENEWAL_CREATED:           'INFO',
  TRANSFER:                  'INFO',
  TRANSFER_REQUESTED:        'INFO',
  COMPLAINT_LOGGED:          'WARNING',
  PARENT_MESSAGE:            'INFO',
  PARENT_ESCALATION:         'CRITICAL',
  MANUAL_ADJUSTMENT:         'WARNING',
  BLOCK_APPLIED:             'CRITICAL',
  BLOCK_LIFTED:              'INFO',
  // Sprint 51
  HOMEWORK_ASSIGNED:         'INFO',
  HOMEWORK_COMPLETED:        'INFO',
  CERTIFICATE_ISSUED:        'INFO',
  CALL_LOGGED:               'INFO',
  WHATSAPP_SENT:             'INFO',
  TASK_CREATED:              'INFO',
  TASK_COMPLETED:            'INFO',
  SCORE_COMPUTED:            'INFO',
  COLLECTION_STAGE_ADVANCED: 'WARNING',
  ENROLLMENT_CANCELLED:      'CRITICAL',
  // Sprint 2
  EVALUATION_RECORDED:       'INFO',
  COMPETITION_LOGGED:        'INFO',
  ACHIEVEMENT_EARNED:        'INFO',
  BADGE_EARNED:              'INFO',
}

// ── Log event ──────────────────────────────────────────────────────────────────

export async function logTimelineEvent(input: TimelineEventInput): Promise<void> {
  const db = createServiceClient()

  const severity = input.severity ?? SEVERITY_MAP[input.event_type] ?? 'INFO'

  const { error } = await db.from('student_timeline_events').insert({
    student_id:    input.student_id,
    enrollment_id: input.enrollment_id ?? null,
    account_id:    input.account_id    ?? null,
    schedule_id:   input.schedule_id   ?? null,
    event_type:    input.event_type,
    notes:         input.notes         ?? null,
    created_by:    input.created_by    ?? null,
    branch_id:     input.branch_id     ?? null,
    // Store severity as part of notes JSON if column not present yet
    // (added in migration 0050; non-fatal if missing)
  })

  // Non-fatal — never throw from timeline logging
  if (error && process.env.NODE_ENV === 'development') {
    console.warn('[timeline] Failed to log event:', error.message)
  }
}

// ── Batch log ──────────────────────────────────────────────────────────────────

export async function logTimelineEvents(events: TimelineEventInput[]): Promise<void> {
  if (!events.length) return
  const db = createServiceClient()

  const rows = events.map(e => ({
    student_id:    e.student_id,
    enrollment_id: e.enrollment_id ?? null,
    account_id:    e.account_id    ?? null,
    schedule_id:   e.schedule_id   ?? null,
    event_type:    e.event_type,
    notes:         e.notes         ?? null,
    created_by:    e.created_by    ?? null,
    branch_id:     e.branch_id     ?? null,
  }))

  await db.from('student_timeline_events').insert(rows)
  // Non-fatal
}

// ── Fetch timeline for a student/enrollment ────────────────────────────────────

export async function getStudentTimeline(
  studentId:    string,
  enrollmentId?: string | null,
  limit = 50
) {
  const db = createServiceClient()

  let q = db
    .from('student_timeline_events')
    .select(`
      id, event_type, notes, created_at, branch_id,
      users!student_timeline_events_created_by_fkey(
        profiles!profiles_user_id_fkey(first_name, last_name)
      )
    `)
    .eq('student_id', studentId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (enrollmentId) q = q.eq('enrollment_id', enrollmentId)

  const { data } = await q

  return ((data ?? []) as any[]).map(e => {
    const prof = e.users?.profiles
    return {
      id:          e.id as string,
      event_type:  e.event_type as TimelineEventType,
      notes:       e.notes as string | null,
      created_at:  e.created_at as string,
      severity:    SEVERITY_MAP[e.event_type as TimelineEventType] ?? 'INFO',
      created_by_name: prof ? [prof.first_name, prof.last_name].filter(Boolean).join(' ') || null : null,
    }
  })
}

// ── Event labels ───────────────────────────────────────────────────────────────

export const TIMELINE_EVENT_LABELS: Record<TimelineEventType, string> = {
  ENROLLMENT_CREATED:        'Enrollment Created',
  PAYMENT:                   'Payment Received',
  PAYMENT_REVERSAL:          'Payment Reversed',
  REMINDER_SENT:             'Reminder Sent',
  NOTE_ADDED:                'Note Added',
  PROMISE_MADE:              'Payment Promise Made',
  PROMISE_FULFILLED:         'Promise Fulfilled',
  PROMISE_BROKEN:            'Promise Broken',
  OVERDRAFT_GRANTED:         'Overdraft Granted',
  ATTENDANCE_RECORDED:       'Session Recorded',
  RENEWAL_NEEDED:            'Renewal Needed',
  RENEWAL_CREATED:           'Renewal Created',
  TRANSFER:                  'Contract Transferred',
  TRANSFER_REQUESTED:        'Transfer Requested',
  COMPLAINT_LOGGED:          'Complaint Logged',
  PARENT_MESSAGE:            'Parent Message',
  PARENT_ESCALATION:         'Parent Escalation',
  MANUAL_ADJUSTMENT:         'Manual Adjustment',
  BLOCK_APPLIED:             'Account Blocked',
  BLOCK_LIFTED:              'Block Lifted',
  // Sprint 51
  HOMEWORK_ASSIGNED:         'Homework Assigned',
  HOMEWORK_COMPLETED:        'Homework Completed',
  CERTIFICATE_ISSUED:        'Certificate Issued',
  CALL_LOGGED:               'Call Logged',
  WHATSAPP_SENT:             'WhatsApp Sent',
  TASK_CREATED:              'Task Created',
  TASK_COMPLETED:            'Task Completed',
  SCORE_COMPUTED:            'Risk Score Updated',
  COLLECTION_STAGE_ADVANCED: 'Collection Stage Advanced',
  ENROLLMENT_CANCELLED:      'Contract Cancelled',
  // Sprint 2
  EVALUATION_RECORDED:       'Evaluation Recorded',
  COMPETITION_LOGGED:        'Competition Logged',
  ACHIEVEMENT_EARNED:        'Achievement Earned',
  BADGE_EARNED:              'Badge Earned',
}

// ── Student-visible subset ────────────────────────────────────────────────────
// student_timeline_events is a shared table — most of the 31 event types are
// staff/finance/collections concerns (payments, promises, complaints, block
// state, call logs...) that must never reach a student or parent portal. This
// is the allowlist the Student Workspace's Learning Journey feed filters
// against before rendering anything from this table.

export const STUDENT_VISIBLE_TIMELINE_EVENT_TYPES: readonly TimelineEventType[] = [
  'ENROLLMENT_CREATED',
  'ENROLLMENT_CANCELLED',
  'RENEWAL_CREATED',
  'TRANSFER',
  'ATTENDANCE_RECORDED',
  'HOMEWORK_ASSIGNED',
  'HOMEWORK_COMPLETED',
  'CERTIFICATE_ISSUED',
  'EVALUATION_RECORDED',
  'COMPETITION_LOGGED',
  'ACHIEVEMENT_EARNED',
  'BADGE_EARNED',
  'NOTE_ADDED',
]

export const TIMELINE_SEVERITY_COLORS: Record<TimelineEventSeverity, string> = {
  INFO:     'bg-slate-100 text-slate-600',
  WARNING:  'bg-amber-100 text-amber-700',
  CRITICAL: 'bg-red-100 text-red-700',
}
