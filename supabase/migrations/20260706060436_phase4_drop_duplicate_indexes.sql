-- Phase 4.1: remove duplicate indexes (schema-only, no data change)
-- attendance_records: 3 duplicate pairs
DROP INDEX IF EXISTS public.idx_attendance_records_student_recorded; -- duplicate of idx_attendance_student_recorded
DROP INDEX IF EXISTS public.idx_att_records_student_status;          -- duplicate of idx_attendance_student_status
ALTER TABLE public.attendance_records DROP CONSTRAINT IF EXISTS attendance_records_schedule_id_student_id_key; -- duplicate UNIQUE of attendance_records_schedule_student_unique (kept, referenced by migration 0097)

-- blog_posts: keep the real UNIQUE constraint, drop the redundant plain unique index
DROP INDEX IF EXISTS public.idx_blog_posts_slug; -- duplicate of constraint blog_posts_slug_unique

-- finance_payments
DROP INDEX IF EXISTS public.idx_fp_account_date; -- duplicate of idx_finance_payments_account_month

-- student_enrollments: 2 duplicate pairs
DROP INDEX IF EXISTS public.idx_enrollments_student_start;   -- duplicate of idx_enrollments_student_fifo
DROP INDEX IF EXISTS public.idx_enrollment_student;          -- duplicate of idx_student_enrollments_student_status

-- student_financial_accounts
DROP INDEX IF EXISTS public.idx_sfa_student; -- duplicate of idx_sfa_student_id
