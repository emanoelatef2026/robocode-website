-- Migration: 0017_phase2_stability_indexes
-- Purpose: Missing indexes identified in Phase 2 stability audit
-- Dependencies: 0004_people, 0005_academic, 0007_schedule_attendance

-- Attendance list queries order by recorded_at DESC — full scan without this index
CREATE INDEX IF NOT EXISTS idx_attendance_recorded_at
  ON public.attendance_records(recorded_at DESC);

-- getGroupStudentsForSession filters status = 'active'
CREATE INDEX IF NOT EXISTS idx_group_students_status
  ON public.group_students(status);

-- Future reporting queries on enrollment date; partial to exclude inactive students
CREATE INDEX IF NOT EXISTS idx_students_enrollment_date
  ON public.students(enrollment_date) WHERE deleted_at IS NULL;

-- Instructor list queries filter by status; partial to exclude soft-deleted rows
CREATE INDEX IF NOT EXISTS idx_instructors_status
  ON public.instructors(status) WHERE deleted_at IS NULL;
