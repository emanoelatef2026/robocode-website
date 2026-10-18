import type { SessionDetail } from '@/modules/instructor-portal/types'

// All identifiers and names are synthetic. No production data is loaded.
export function makeSession() {
  return {
    id: 'synthetic-session-1', group_course_id: 'synthetic-group-course-1',
    group_id: 'synthetic-group-1', branch_id: 'synthetic-branch-1',
    scheduled_at: '2026-10-18T12:00:00Z', started_at: '2026-10-18T12:00:00Z',
    ended_at: null, duration_minutes: 90, type: 'regular', delivery: 'offline',
    meeting_url: null, room: 'Test room', status: 'ongoing',
    topic: 'Synthetic session: loops and conditions', notes: null,
    cancellation_reason: null, cancelled_at: null, postponed_reason: null,
    original_session_id: null, group_name: 'Test group',
    course_title: 'Test course', course_id: 'synthetic-course-1',
    attendance: Array.from({ length: 8 }, (_, i) => ({
      record_id: null, student_id: `synthetic-student-${i + 1}`,
      student_name: `TestStudent${i + 1}`, status: null, late_minutes: null, notes: null,
    })),
    student_count: 8, recordings: [], resources_links: [],
    course_modules: [{ id: 'synthetic-module-1', title: 'Test module: loops' }],
    progress: [{ id: 'synthetic-session-1', scheduled_at: '2026-10-18T12:00:00Z', status: 'ongoing', topic: 'Synthetic session: loops and conditions', session_num: 1 }],
    current_session_num: 1, session_homework: [],
  } satisfies SessionDetail
}
