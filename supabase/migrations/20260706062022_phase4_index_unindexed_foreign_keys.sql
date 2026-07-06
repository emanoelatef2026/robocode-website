-- Phase 4.4: add covering indexes for unindexed FKs on actively-joined tables.

-- student_enrollments (5)
CREATE INDEX IF NOT EXISTS idx_student_enrollments_created_by ON public.student_enrollments (created_by);
CREATE INDEX IF NOT EXISTS idx_student_enrollments_group_student_id ON public.student_enrollments (group_student_id);
CREATE INDEX IF NOT EXISTS idx_student_enrollments_instructor_id ON public.student_enrollments (instructor_id);
CREATE INDEX IF NOT EXISTS idx_student_enrollments_transferred_from ON public.student_enrollments (transferred_from);
CREATE INDEX IF NOT EXISTS idx_student_enrollments_transferred_to ON public.student_enrollments (transferred_to);

-- student_timeline_events (4)
CREATE INDEX IF NOT EXISTS idx_student_timeline_events_actor_user_id ON public.student_timeline_events (actor_user_id);
CREATE INDEX IF NOT EXISTS idx_student_timeline_events_branch_id ON public.student_timeline_events (branch_id);
CREATE INDEX IF NOT EXISTS idx_student_timeline_events_enrollment_id ON public.student_timeline_events (enrollment_id);
CREATE INDEX IF NOT EXISTS idx_student_timeline_events_student_id ON public.student_timeline_events (student_id);

-- attendance_records (2)
CREATE INDEX IF NOT EXISTS idx_attendance_records_makeup_schedule_id ON public.attendance_records (makeup_schedule_id);
CREATE INDEX IF NOT EXISTS idx_attendance_records_recorded_by ON public.attendance_records (recorded_by);

-- collection_activities (2)
CREATE INDEX IF NOT EXISTS idx_collection_activities_account_id ON public.collection_activities (account_id);
CREATE INDEX IF NOT EXISTS idx_collection_activities_created_by ON public.collection_activities (created_by);

-- finance_notes (2)
CREATE INDEX IF NOT EXISTS idx_finance_notes_account_id ON public.finance_notes (account_id);
CREATE INDEX IF NOT EXISTS idx_finance_notes_created_by ON public.finance_notes (created_by);

-- certificates (3)
CREATE INDEX IF NOT EXISTS idx_certificates_issued_by ON public.certificates (issued_by);
CREATE INDEX IF NOT EXISTS idx_certificates_revoked_by ON public.certificates (revoked_by);
CREATE INDEX IF NOT EXISTS idx_certificates_template_id ON public.certificates (template_id);

-- finance_payment_reversals (3)
CREATE INDEX IF NOT EXISTS idx_fpr_account_id ON public.finance_payment_reversals (account_id);
CREATE INDEX IF NOT EXISTS idx_fpr_created_by ON public.finance_payment_reversals (created_by);
CREATE INDEX IF NOT EXISTS idx_fpr_original_payment_id ON public.finance_payment_reversals (original_payment_id);
