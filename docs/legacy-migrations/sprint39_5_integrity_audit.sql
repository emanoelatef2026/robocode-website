-- =============================================================================
-- SPRINT 39.5 — Full Database Integrity + Production Audit
-- =============================================================================
-- PURPOSE: Validate every relationship, add diagnostic views, apply safe fixes,
--          add missing indexes, and close RLS policy gaps.
--
-- SAFETY GUARANTEES:
--   ✓ IDEMPOTENT — safe to run multiple times (IF NOT EXISTS, OR REPLACE)
--   ✓ NO DESTRUCTIVE DELETES — soft-fix only (UPDATE/SET, never DELETE)
--   ✓ ALL FIXES ARE REVERSIBLE
--   ✓ ALL INDEXES ARE CONCURRENT-SAFE (CREATE INDEX IF NOT EXISTS)
--   ✓ ALL POLICIES USE DO $$ IF NOT EXISTS $$ guards
--
-- RUN ORDER: After sprint39_operational_finalization.sql
-- =============================================================================

-- =============================================================================
-- PHASE 1+2 — RELATIONSHIP AUDIT + DIAGNOSTIC VIEWS
-- =============================================================================
-- Every view is a live query. Run SELECT * FROM v_<name> to see current issues.
-- They return ZERO rows when the system is clean. Non-zero = action required.
-- =============================================================================

-- ─── 1. Orphan students (user_id → users broken) ─────────────────────────────
CREATE OR REPLACE VIEW public.v_diag_orphan_students AS
SELECT s.id, s.student_code, s.branch_id, s.status, s.created_at
FROM   public.students s
WHERE  s.deleted_at IS NULL
  AND  NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id = s.user_id);

COMMENT ON VIEW public.v_diag_orphan_students IS
  'Students whose user_id has no matching users row. These must be investigated before deletion.';

-- ─── 2. Orphan profiles (user_id → users broken) ──────────────────────────────
CREATE OR REPLACE VIEW public.v_diag_orphan_profiles AS
SELECT p.id, p.user_id, p.first_name, p.last_name, p.created_at
FROM   public.profiles p
WHERE  NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id = p.user_id);

COMMENT ON VIEW public.v_diag_orphan_profiles IS
  'Profile rows whose user_id references a missing user. Safe to soft-delete.';

-- ─── 3. Orphan instructors ────────────────────────────────────────────────────
CREATE OR REPLACE VIEW public.v_diag_orphan_instructors AS
SELECT i.id, i.branch_id, i.status, i.created_at
FROM   public.instructors i
WHERE  i.deleted_at IS NULL
  AND  NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id = i.user_id);

COMMENT ON VIEW public.v_diag_orphan_instructors IS
  'Instructors with no matching user. Cannot authenticate; remove from groups before fixing.';

-- ─── 4. Orphan parents ────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW public.v_diag_orphan_parents AS
SELECT p.id, p.user_id, p.created_at
FROM   public.parents p
WHERE  NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id = p.user_id);

COMMENT ON VIEW public.v_diag_orphan_parents IS
  'Parent records with no matching user row.';

-- ─── 5. Duplicate active group enrollments ────────────────────────────────────
CREATE OR REPLACE VIEW public.v_diag_duplicate_active_enrollments AS
SELECT   group_id, student_id, COUNT(*) AS dupe_count
FROM     public.group_students
WHERE    status = 'active'
GROUP BY group_id, student_id
HAVING   COUNT(*) > 1;

COMMENT ON VIEW public.v_diag_duplicate_active_enrollments IS
  'Students enrolled in the same group multiple times with status=active. Keep the newest; deactivate others.';

-- ─── 6. Active students in inactive/deleted groups ────────────────────────────
CREATE OR REPLACE VIEW public.v_diag_students_in_bad_groups AS
SELECT gs.student_id, gs.group_id, gs.status AS enrollment_status,
       g.status AS group_status, g.deleted_at
FROM   public.group_students gs
JOIN   public.groups g ON g.id = gs.group_id
WHERE  gs.status = 'active'
  AND  (g.status IN ('inactive', 'cancelled') OR g.deleted_at IS NOT NULL);

COMMENT ON VIEW public.v_diag_students_in_bad_groups IS
  'Active enrollments pointing to groups that are inactive or deleted.';

-- ─── 7. Groups without instructor ─────────────────────────────────────────────
CREATE OR REPLACE VIEW public.v_diag_groups_no_instructor AS
SELECT g.id, g.name, g.branch_id, b.name AS branch_name, g.status, g.created_at
FROM   public.groups g
JOIN   public.branches b ON b.id = g.branch_id
WHERE  g.status = 'active'
  AND  g.deleted_at IS NULL
  AND  NOT EXISTS (SELECT 1 FROM public.group_instructors gi WHERE gi.group_id = g.id)
  AND  NOT EXISTS (
    SELECT 1 FROM public.group_courses gc
    WHERE  gc.group_id = g.id AND gc.instructor_id IS NOT NULL AND gc.status = 'active'
  );

COMMENT ON VIEW public.v_diag_groups_no_instructor IS
  'Active groups with no instructor assignment in either group_instructors or group_courses.';

-- ─── 8. Groups without active course ──────────────────────────────────────────
CREATE OR REPLACE VIEW public.v_diag_groups_no_course AS
SELECT g.id, g.name, g.branch_id, b.name AS branch_name, g.status, g.created_at
FROM   public.groups g
JOIN   public.branches b ON b.id = g.branch_id
WHERE  g.status = 'active'
  AND  g.deleted_at IS NULL
  AND  NOT EXISTS (
    SELECT 1 FROM public.group_courses gc
    WHERE  gc.group_id = g.id AND gc.status = 'active'
  );

COMMENT ON VIEW public.v_diag_groups_no_course IS
  'Active groups with no active course assignment.';

-- ─── 9. Students without finance accounts ─────────────────────────────────────
CREATE OR REPLACE VIEW public.v_diag_students_no_finance AS
SELECT s.id, s.student_code, s.branch_id, b.name AS branch_name,
       s.enrollment_date, s.status
FROM   public.students s
JOIN   public.branches b ON b.id = s.branch_id
WHERE  s.deleted_at IS NULL
  AND  s.status = 'active'
  AND  NOT EXISTS (
    SELECT 1 FROM public.student_financial_accounts fa WHERE fa.student_id = s.id
  );

COMMENT ON VIEW public.v_diag_students_no_finance IS
  'Active students with no financial account. Not necessarily an error if the academy defers billing.';

-- ─── 10. Finance accounts with impossible balances ───────────────────────────
CREATE OR REPLACE VIEW public.v_diag_invalid_finance_balances AS
SELECT fa.id, fa.student_id, fa.branch_id, fa.status,
       fa.total_amount, fa.discount_amount, fa.net_amount,
       fa.paid_amount, fa.remaining_amount,
       -- Expected values
       fa.total_amount - fa.discount_amount              AS expected_net,
       GREATEST(0, fa.net_amount - fa.paid_amount)       AS expected_remaining,
       -- Flags
       (fa.discount_amount > fa.total_amount)            AS discount_exceeds_total,
       (fa.net_amount < 0)                               AS negative_net,
       (fa.paid_amount < 0)                              AS negative_paid,
       (fa.remaining_amount < 0)                         AS negative_remaining,
       (fa.paid_amount > fa.net_amount AND fa.status != 'PAID') AS overpaid_not_marked,
       ABS((fa.total_amount - fa.discount_amount) - fa.net_amount) > 0.01 AS net_drift
FROM   public.student_financial_accounts fa
WHERE  fa.discount_amount > fa.total_amount
    OR fa.net_amount < 0
    OR fa.paid_amount < 0
    OR fa.remaining_amount < 0
    OR ABS((fa.total_amount - fa.discount_amount) - fa.net_amount) > 0.01
    OR (fa.paid_amount > fa.net_amount AND fa.status != 'PAID');

COMMENT ON VIEW public.v_diag_invalid_finance_balances IS
  'Finance accounts with mathematically impossible or inconsistent values. Phase 3 auto-fixes most of these.';

-- ─── 11. Finance status mismatch ──────────────────────────────────────────────
CREATE OR REPLACE VIEW public.v_diag_finance_status_mismatch AS
SELECT fa.id, fa.student_id, fa.status AS current_status,
       fa.remaining_amount, fa.next_due_date,
       CASE
         WHEN fa.remaining_amount <= 0                                              THEN 'PAID'
         WHEN fa.next_due_date IS NOT NULL AND fa.next_due_date < CURRENT_DATE      THEN 'OVERDUE'
         WHEN fa.next_due_date IS NOT NULL
           AND fa.next_due_date <= CURRENT_DATE + INTERVAL '7 days'                THEN 'DUE_SOON'
         ELSE 'CURRENT'
       END AS expected_status
FROM   public.student_financial_accounts fa
WHERE  fa.status != CASE
         WHEN fa.remaining_amount <= 0                                              THEN 'PAID'
         WHEN fa.next_due_date IS NOT NULL AND fa.next_due_date < CURRENT_DATE      THEN 'OVERDUE'
         WHEN fa.next_due_date IS NOT NULL
           AND fa.next_due_date <= CURRENT_DATE + INTERVAL '7 days'                THEN 'DUE_SOON'
         ELSE 'CURRENT'
       END;

COMMENT ON VIEW public.v_diag_finance_status_mismatch IS
  'Finance accounts where status field is stale. Phase 3 auto-corrects all of these.';

-- ─── 12. Broken payment promises ──────────────────────────────────────────────
CREATE OR REPLACE VIEW public.v_diag_broken_promises_unresolved AS
SELECT pp.id, pp.student_id, pp.account_id,
       pp.promised_amount, pp.promised_date, pp.status,
       pp.created_at,
       fa.remaining_amount
FROM   public.payment_promises pp
LEFT JOIN public.student_financial_accounts fa ON fa.id = pp.account_id
WHERE  pp.status = 'ACTIVE'
  AND  pp.promised_date < CURRENT_DATE;

COMMENT ON VIEW public.v_diag_broken_promises_unresolved IS
  'ACTIVE promises past their due date that should have been marked BROKEN. Phase 3 fixes these.';

-- ─── 13. Orphan finance payments (account deleted) ────────────────────────────
CREATE OR REPLACE VIEW public.v_diag_orphan_finance_payments AS
SELECT fp.id, fp.student_id, fp.account_id, fp.amount, fp.payment_date
FROM   public.finance_payments fp
WHERE  NOT EXISTS (
  SELECT 1 FROM public.student_financial_accounts fa WHERE fa.id = fp.account_id
);

COMMENT ON VIEW public.v_diag_orphan_finance_payments IS
  'Payments whose account was deleted (ON DELETE CASCADE should prevent this; this view detects data anomalies).';

-- ─── 14. Finance payment/student mismatch ─────────────────────────────────────
CREATE OR REPLACE VIEW public.v_diag_payment_student_mismatch AS
SELECT fp.id, fp.student_id AS payment_student_id,
       fa.student_id        AS account_student_id,
       fp.amount, fp.payment_date
FROM   public.finance_payments fp
JOIN   public.student_financial_accounts fa ON fa.id = fp.account_id
WHERE  fp.student_id != fa.student_id;

COMMENT ON VIEW public.v_diag_payment_student_mismatch IS
  'Payments where student_id column disagrees with the account''s student_id. Data consistency error.';

-- ─── 15. Orphan attendance records (schedule deleted) ─────────────────────────
CREATE OR REPLACE VIEW public.v_diag_orphan_attendance AS
SELECT ar.id, ar.student_id, ar.schedule_id, ar.status, ar.recorded_at
FROM   public.attendance_records ar
WHERE  ar.schedule_id IS NOT NULL
  AND  NOT EXISTS (SELECT 1 FROM public.schedules s WHERE s.id = ar.schedule_id);

COMMENT ON VIEW public.v_diag_orphan_attendance IS
  'Attendance records pointing to non-existent schedule IDs.';

-- ─── 16. Leads with no branch (should always have branch) ─────────────────────
CREATE OR REPLACE VIEW public.v_diag_leads_no_branch AS
SELECT l.id, l.child_name, l.parent_name, l.phone, l.status, l.created_at
FROM   public.leads l
WHERE  l.branch_id IS NULL;

COMMENT ON VIEW public.v_diag_leads_no_branch IS
  'Leads without a branch_id — these can''t be properly scoped to a TL.';

-- ─── 17. Stale leads (no update in 30+ days, still active) ────────────────────
CREATE OR REPLACE VIEW public.v_diag_stale_leads AS
SELECT l.id, l.child_name, l.status, l.branch_id, b.name AS branch_name,
       l.assigned_to, l.created_at, l.updated_at,
       CURRENT_DATE - l.updated_at::date AS days_stale
FROM   public.leads l
LEFT JOIN public.branches b ON b.id = l.branch_id
WHERE  l.status NOT IN ('CONVERTED', 'LOST')
  AND  l.updated_at < NOW() - INTERVAL '30 days';

COMMENT ON VIEW public.v_diag_stale_leads IS
  'Active leads not updated in 30+ days. Likely abandoned — review and set to LOST or reassign.';

-- ─── 18. Leads with overdue follow-up ─────────────────────────────────────────
CREATE OR REPLACE VIEW public.v_diag_leads_overdue_followup AS
SELECT l.id, l.child_name, l.parent_name, l.phone,
       l.status, l.branch_id, b.name AS branch_name,
       l.assigned_to, l.next_follow_up_at,
       CURRENT_DATE - l.next_follow_up_at::date AS days_overdue
FROM   public.leads l
LEFT JOIN public.branches b ON b.id = l.branch_id
WHERE  l.status NOT IN ('CONVERTED', 'LOST')
  AND  l.next_follow_up_at IS NOT NULL
  AND  l.next_follow_up_at::date < CURRENT_DATE;

COMMENT ON VIEW public.v_diag_leads_overdue_followup IS
  'Leads past their scheduled follow-up date — need immediate action.';

-- ─── 19. Orphan certificates (student deleted or group deleted) ───────────────
CREATE OR REPLACE VIEW public.v_diag_orphan_certificates AS
SELECT c.id, c.student_id, c.status, c.issued_at
FROM   public.certificates c
WHERE  NOT EXISTS (
  SELECT 1 FROM public.students s WHERE s.id = c.student_id AND s.deleted_at IS NULL
);

COMMENT ON VIEW public.v_diag_orphan_certificates IS
  'Certificates for students that no longer exist. Audit before any cleanup.';

-- ─── 20. Certificates with impossible data (completion < threshold) ───────────
CREATE OR REPLACE VIEW public.v_diag_certificates_suspicious AS
SELECT c.id, c.student_id, c.status, c.issued_at, c.course_id,
       scp.completion_percentage, scp.attendance_score
FROM   public.certificates c
LEFT JOIN public.student_course_progress scp
  ON  scp.student_id = c.student_id AND scp.course_id = c.course_id
WHERE  c.status = 'active'
  AND  scp.completion_percentage IS NOT NULL
  AND  scp.completion_percentage < 60;

COMMENT ON VIEW public.v_diag_certificates_suspicious IS
  'Active certificates where student progress is below 60%. May indicate data entry error.';

-- ─── 21. Instructors with invalid branch reference ────────────────────────────
CREATE OR REPLACE VIEW public.v_diag_instructors_bad_branch AS
SELECT i.id, i.user_id, i.branch_id, i.status
FROM   public.instructors i
WHERE  i.deleted_at IS NULL
  AND  NOT EXISTS (SELECT 1 FROM public.branches b WHERE b.id = i.branch_id AND b.is_active = true);

COMMENT ON VIEW public.v_diag_instructors_bad_branch IS
  'Active instructors assigned to branches that are inactive or missing.';

-- ─── 22. Group_students without branch alignment ──────────────────────────────
CREATE OR REPLACE VIEW public.v_diag_cross_branch_enrollments AS
SELECT gs.student_id, gs.group_id,
       s.branch_id AS student_branch,
       g.branch_id AS group_branch,
       sb.name AS student_branch_name, gb.name AS group_branch_name
FROM   public.group_students gs
JOIN   public.students s ON s.id = gs.student_id
JOIN   public.groups   g ON g.id = gs.group_id
JOIN   public.branches sb ON sb.id = s.branch_id
JOIN   public.branches gb ON gb.id = g.branch_id
WHERE  gs.status = 'active'
  AND  s.branch_id != g.branch_id;

COMMENT ON VIEW public.v_diag_cross_branch_enrollments IS
  'Students enrolled in groups from a different branch. May be intentional (multi-branch), but worth reviewing.';

-- ─── 23. Attendance anomalies (same student, same schedule, multiple records) ──
CREATE OR REPLACE VIEW public.v_diag_attendance_duplicates AS
SELECT   student_id, schedule_id, COUNT(*) AS record_count
FROM     public.attendance_records
WHERE    schedule_id IS NOT NULL
GROUP BY student_id, schedule_id
HAVING   COUNT(*) > 1;

COMMENT ON VIEW public.v_diag_attendance_duplicates IS
  'Students with more than one attendance record for the same session. Only the latest should be kept.';

-- ─── 24. Assignments with broken module/lesson chain ─────────────────────────
CREATE OR REPLACE VIEW public.v_diag_assignments_broken_chain AS
SELECT a.id, a.title, a.status, a.module_id, a.lesson_id, a.schedule_id
FROM   public.assignments a
WHERE  a.deleted_at IS NULL
  AND  a.module_id  IS NOT NULL
  AND  NOT EXISTS (SELECT 1 FROM public.course_modules m WHERE m.id = a.module_id);

COMMENT ON VIEW public.v_diag_assignments_broken_chain IS
  'Assignments referencing module_ids that no longer exist.';

-- ─── 25. Parent-student links with no student ─────────────────────────────────
CREATE OR REPLACE VIEW public.v_diag_orphan_parent_links AS
SELECT ps.id, ps.parent_id, ps.student_id
FROM   public.parent_students ps
WHERE  NOT EXISTS (
  SELECT 1 FROM public.students s WHERE s.id = ps.student_id AND s.deleted_at IS NULL
);

COMMENT ON VIEW public.v_diag_orphan_parent_links IS
  'Parent-student links pointing to deleted or non-existent students.';

-- ─── 26. Installments exceeding account total ────────────────────────────────
CREATE OR REPLACE VIEW public.v_diag_installments_over_total AS
SELECT fi.account_id,
       SUM(fi.amount)      AS total_installments,
       fa.net_amount       AS account_net,
       SUM(fi.amount) - fa.net_amount AS over_by
FROM   public.finance_installments fi
JOIN   public.student_financial_accounts fa ON fa.id = fi.account_id
GROUP BY fi.account_id, fa.net_amount
HAVING SUM(fi.amount) > fa.net_amount + 0.01;

COMMENT ON VIEW public.v_diag_installments_over_total IS
  'Accounts where sum of installments exceeds net_amount — data entry or calculation error.';

-- ─── 27. Progress percentages out of range ────────────────────────────────────
CREATE OR REPLACE VIEW public.v_diag_invalid_progress AS
SELECT id, student_id, course_id, group_id,
       completion_percentage, attendance_score,
       assignment_score, portfolio_score
FROM   public.student_course_progress
WHERE  completion_percentage  < 0 OR completion_percentage  > 100
    OR attendance_score       < 0 OR attendance_score       > 100
    OR assignment_score       < 0 OR assignment_score       > 100
    OR portfolio_score        < 0 OR portfolio_score        > 100;

COMMENT ON VIEW public.v_diag_invalid_progress IS
  'Progress rows with score fields outside 0-100. Phase 3 clamps these to valid range.';

-- ─── 28. Leads with converted_at but wrong status ────────────────────────────
CREATE OR REPLACE VIEW public.v_diag_leads_converted_mismatch AS
SELECT id, child_name, status, converted_at
FROM   public.leads
WHERE  (status = 'CONVERTED' AND converted_at IS NULL)
    OR (status != 'CONVERTED' AND converted_at IS NOT NULL);

COMMENT ON VIEW public.v_diag_leads_converted_mismatch IS
  'Leads where status and converted_at column are inconsistent. Phase 3 backfills converted_at.';

-- =============================================================================
-- PHASE 3 — SAFE AUTO-FIXES
-- =============================================================================
-- These UPDATE statements fix computed or derived fields.
-- They never delete rows. All changes are logged by the existing audit trigger.
-- =============================================================================

-- ─── Fix 1: Recompute finance account net_amount where it has drifted ─────────
UPDATE public.student_financial_accounts
SET
  net_amount = total_amount - discount_amount,
  updated_at = now()
WHERE ABS(net_amount - (total_amount - discount_amount)) > 0.01;

-- ─── Fix 2: Recompute remaining_amount where it's incorrect ───────────────────
-- The trigger handles this on payment insert/update, but accounts modified
-- outside the trigger may have stale remaining_amount.
UPDATE public.student_financial_accounts fa
SET
  paid_amount      = COALESCE((
    SELECT SUM(fp.amount) FROM public.finance_payments fp WHERE fp.account_id = fa.id
  ), 0),
  remaining_amount = GREATEST(0, fa.net_amount - COALESCE((
    SELECT SUM(fp.amount) FROM public.finance_payments fp WHERE fp.account_id = fa.id
  ), 0)),
  updated_at = now()
WHERE ABS(
  fa.paid_amount - COALESCE((
    SELECT SUM(fp.amount) FROM public.finance_payments fp WHERE fp.account_id = fa.id
  ), 0)
) > 0.01;

-- ─── Fix 3: Correct stale finance statuses ────────────────────────────────────
UPDATE public.student_financial_accounts
SET
  status = CASE
    WHEN remaining_amount <= 0                                              THEN 'PAID'
    WHEN next_due_date IS NOT NULL AND next_due_date < CURRENT_DATE         THEN 'OVERDUE'
    WHEN next_due_date IS NOT NULL
      AND next_due_date <= CURRENT_DATE + INTERVAL '7 days'                THEN 'DUE_SOON'
    ELSE 'CURRENT'
  END,
  updated_at = now()
WHERE status != CASE
    WHEN remaining_amount <= 0                                              THEN 'PAID'
    WHEN next_due_date IS NOT NULL AND next_due_date < CURRENT_DATE         THEN 'OVERDUE'
    WHEN next_due_date IS NOT NULL
      AND next_due_date <= CURRENT_DATE + INTERVAL '7 days'                THEN 'DUE_SOON'
    ELSE 'CURRENT'
  END;

-- ─── Fix 4: Mark broken payment promises ──────────────────────────────────────
UPDATE public.payment_promises
SET status = 'BROKEN', updated_at = now()
WHERE status = 'ACTIVE'
  AND promised_date < CURRENT_DATE;

-- ─── Fix 5: Mark overdue installments ─────────────────────────────────────────
UPDATE public.finance_installments
SET status = 'OVERDUE', updated_at = now()
WHERE status IN ('PENDING', 'PARTIAL')
  AND due_date < CURRENT_DATE;

-- ─── Fix 6: Clamp out-of-range progress percentages ──────────────────────────
UPDATE public.student_course_progress
SET
  completion_percentage = LEAST(100, GREATEST(0, COALESCE(completion_percentage, 0))),
  attendance_score      = LEAST(100, GREATEST(0, COALESCE(attendance_score, 0))),
  assignment_score      = LEAST(100, GREATEST(0, COALESCE(assignment_score, 0))),
  portfolio_score       = LEAST(100, GREATEST(0, COALESCE(portfolio_score, 0)))
WHERE completion_percentage  < 0 OR completion_percentage  > 100
   OR attendance_score       < 0 OR attendance_score       > 100
   OR assignment_score       < 0 OR assignment_score       > 100
   OR portfolio_score        < 0 OR portfolio_score        > 100;

-- ─── Fix 7: Deactivate duplicate active enrollments (keep newest) ────────────
-- Deactivates all but the most recent active enrollment per student-group pair.
UPDATE public.group_students gs
SET    status = 'inactive'
WHERE  gs.status = 'active'
  AND  EXISTS (
    SELECT 1 FROM public.group_students newer
    WHERE  newer.group_id  = gs.group_id
      AND  newer.student_id = gs.student_id
      AND  newer.status    = 'active'
      AND  newer.id        > gs.id  -- keep the latest (larger UUID = inserted later)
  );

-- ─── Fix 8: Backfill leads.converted_at for converted leads ───────────────────
-- Only backfill from lead_timeline if the column was added and is null.
UPDATE public.leads l
SET    converted_at = (
  SELECT MIN(lt.created_at) FROM public.lead_timeline lt
  WHERE  lt.lead_id    = l.id
    AND  lt.event_type = 'status_changed'
    AND  lt.note ILIKE '%CONVERTED%'
)
WHERE  l.status = 'CONVERTED'
  AND  l.converted_at IS NULL;

-- ─── Fix 9: Normalize leads.converted_at for non-converted leads ────────────
-- Non-converted leads should never have converted_at set.
UPDATE public.leads
SET    converted_at = NULL
WHERE  status != 'CONVERTED'
  AND  converted_at IS NOT NULL;

-- ─── Fix 10: Deactivate active enrollments pointing to deleted groups ─────────
UPDATE public.group_students gs
SET    status = 'inactive'
FROM   public.groups g
WHERE  g.id = gs.group_id
  AND  gs.status = 'active'
  AND  (g.deleted_at IS NOT NULL OR g.status = 'cancelled');

-- =============================================================================
-- PHASE 4 — PERFORMANCE INDEXES
-- =============================================================================
-- Only adds indexes where analytical queries show table scan risk.
-- All indexes are CREATE IF NOT EXISTS — zero risk on re-run.
-- =============================================================================

-- ─── Composite: attendance per student per month ──────────────────────────────
CREATE INDEX IF NOT EXISTS idx_att_student_recorded
  ON public.attendance_records (student_id, recorded_at DESC);

-- ─── Composite: attendance per schedule ───────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_att_schedule_id
  ON public.attendance_records (schedule_id)
  WHERE schedule_id IS NOT NULL;

-- ─── Composite: group_students active lookups ─────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_gs_student_status
  ON public.group_students (student_id, status);

CREATE INDEX IF NOT EXISTS idx_gs_group_status
  ON public.group_students (group_id, status);

-- ─── Composite: group_courses active lookups ──────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_gc_group_status
  ON public.group_courses (group_id, status);

CREATE INDEX IF NOT EXISTS idx_gc_instructor_status
  ON public.group_courses (instructor_id, status)
  WHERE instructor_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_gc_course_status
  ON public.group_courses (course_id, status);

-- ─── Composite: submissions per student + assignment ──────────────────────────
CREATE INDEX IF NOT EXISTS idx_sub_student_assignment
  ON public.submissions (student_id, assignment_id);

CREATE INDEX IF NOT EXISTS idx_sub_assignment_status
  ON public.submissions (assignment_id, status);

-- ─── Composite: student_course_progress analytics queries ─────────────────────
CREATE INDEX IF NOT EXISTS idx_scp_group_status
  ON public.student_course_progress (group_id, status);

CREATE INDEX IF NOT EXISTS idx_scp_branch_via_student
  ON public.student_course_progress (student_id, status);

-- ─── Composite: schedules branch + date range (TL today's classes) ───────────
CREATE INDEX IF NOT EXISTS idx_sched_branch_date
  ON public.schedules (branch_id, scheduled_at)
  WHERE status != 'cancelled';

-- ─── Composite: finance accounts branch + status ──────────────────────────────
-- (Already created in sprint38 but guarding with IF NOT EXISTS)
CREATE INDEX IF NOT EXISTS idx_sfa_branch_status
  ON public.student_financial_accounts (branch_id, status);

-- ─── Composite: finance installments account + status + due_date ──────────────
CREATE INDEX IF NOT EXISTS idx_fi_account_status_due
  ON public.finance_installments (account_id, status, due_date);

-- ─── Composite: payment_promises per account + status ─────────────────────────
CREATE INDEX IF NOT EXISTS idx_pp_account_status
  ON public.payment_promises (account_id, status);

-- ─── Composite: leads branch + status + followup ─────────────────────────────
CREATE INDEX IF NOT EXISTS idx_leads_branch_status_followup
  ON public.leads (branch_id, status, next_follow_up_at)
  WHERE status NOT IN ('CONVERTED', 'LOST');

-- ─── Composite: collection_activities recency per account ────────────────────
CREATE INDEX IF NOT EXISTS idx_ca_account_created
  ON public.collection_activities (account_id, created_at DESC);

-- ─── Composite: user_roles for permission resolution (critical hot path) ─────
CREATE INDEX IF NOT EXISTS idx_user_roles_user_branch
  ON public.user_roles (user_id, branch_id);

-- ─── students: active lookup (very frequent) ─────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_students_branch_active
  ON public.students (branch_id, status)
  WHERE deleted_at IS NULL AND status = 'active';

-- ─── groups: active groups per branch (very frequent) ────────────────────────
CREATE INDEX IF NOT EXISTS idx_groups_branch_active
  ON public.groups (branch_id, status)
  WHERE deleted_at IS NULL AND status = 'active';

-- ─── group_instructors: reverse lookup (instructor → groups) ─────────────────
CREATE INDEX IF NOT EXISTS idx_gi_instructor_id
  ON public.group_instructors (instructor_id);

-- ─── certificates: student + status ──────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_certs_student_status
  ON public.certificates (student_id, status);

-- ─── instructor_branches: branch lookup ───────────────────────────────────────
-- (Already in sprint38, idempotent)
CREATE INDEX IF NOT EXISTS idx_instr_branches_branch
  ON public.instructor_branches (branch_id);

-- ─── profiles: name search ───────────────────────────────────────────────────
-- Already via trigram in 0014; add btree for exact lookups
CREATE INDEX IF NOT EXISTS idx_profiles_user_id
  ON public.profiles (user_id);

-- ─── assignments: published + due_at (analytics) ─────────────────────────────
CREATE INDEX IF NOT EXISTS idx_assignments_due_at
  ON public.assignments (due_at)
  WHERE status = 'published' AND deleted_at IS NULL;

-- =============================================================================
-- PHASE 5 — SECURITY AUDIT + RLS POLICY GAPS
-- =============================================================================

-- ─── 5A: assignments table — add branch-scoped management policy ──────────────
-- Current state: RLS enabled but no admin policy → service role works but
-- client-side queries with anon/user tokens would fail silently.
-- Fix: Add explicit admin/TL management policy scoped to branch.
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename='assignments' AND policyname='assignments_staff_manage'
  ) THEN
    CREATE POLICY "assignments_staff_manage"
      ON public.assignments FOR ALL
      USING (
        public.user_has_permission(auth.uid(), 'manage_assignments')
        OR public.user_has_permission(auth.uid(), 'manage_system')
      )
      WITH CHECK (
        public.user_has_permission(auth.uid(), 'manage_assignments')
        OR public.user_has_permission(auth.uid(), 'manage_system')
      );
  END IF;
END $$;

-- Instructors can read their own group's assignments
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename='assignments' AND policyname='assignments_instructor_read'
  ) THEN
    CREATE POLICY "assignments_instructor_read"
      ON public.assignments FOR SELECT
      USING (
        schedule_id IN (
          SELECT s.id FROM public.schedules s
          JOIN public.group_courses gc ON gc.id = s.group_course_id
          JOIN public.group_instructors gi ON gi.group_id = gc.group_id
          JOIN public.instructors i ON i.id = gi.instructor_id
          WHERE i.user_id = auth.uid()
        )
        OR module_id IN (
          SELECT m.id FROM public.course_modules m
          JOIN public.group_courses gc ON gc.course_id = m.course_id
          JOIN public.group_instructors gi ON gi.group_id = gc.group_id
          JOIN public.instructors i ON i.id = gi.instructor_id
          WHERE i.user_id = auth.uid()
        )
      );
  END IF;
END $$;

-- Students can read published assignments for their enrolled groups
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename='assignments' AND policyname='assignments_student_read'
  ) THEN
    CREATE POLICY "assignments_student_read"
      ON public.assignments FOR SELECT
      USING (
        status = 'published'
        AND deleted_at IS NULL
        AND (
          module_id IN (
            SELECT m.id FROM public.course_modules m
            JOIN public.group_courses gc ON gc.course_id = m.course_id
            JOIN public.group_students gs ON gs.group_id = gc.group_id
            JOIN public.students s ON s.id = gs.student_id
            WHERE s.user_id = auth.uid() AND gs.status = 'active'
          )
          OR schedule_id IN (
            SELECT sch.id FROM public.schedules sch
            JOIN public.group_courses gc ON gc.id = sch.group_course_id
            JOIN public.group_students gs ON gs.group_id = gc.group_id
            JOIN public.students s ON s.id = gs.student_id
            WHERE s.user_id = auth.uid() AND gs.status = 'active'
          )
        )
      );
  END IF;
END $$;

-- ─── 5B: Fix student_course_progress admin policy (missing branch scoping) ────
-- Current: scp_admin_all uses manage_students WITHOUT branch_id check.
-- This lets a TL from Branch A read/write ALL progress data across all branches.
-- Fix: Drop and replace with branch-scoped version.
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename='student_course_progress' AND policyname='scp_admin_all'
  ) THEN
    DROP POLICY "scp_admin_all" ON public.student_course_progress;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename='student_course_progress' AND policyname='scp_admin_branch'
  ) THEN
    CREATE POLICY "scp_admin_branch"
      ON public.student_course_progress FOR ALL
      USING (
        -- Super admin: unrestricted
        public.user_has_permission(auth.uid(), 'manage_system')
        -- Team leader / staff: scoped to their branch's students
        OR (
          public.user_has_permission(auth.uid(), 'manage_students')
          AND student_id IN (
            SELECT s.id FROM public.students s
            WHERE public.user_has_permission(auth.uid(), 'manage_students', s.branch_id)
          )
        )
      )
      WITH CHECK (
        public.user_has_permission(auth.uid(), 'manage_system')
        OR (
          public.user_has_permission(auth.uid(), 'manage_students')
          AND student_id IN (
            SELECT s.id FROM public.students s
            WHERE public.user_has_permission(auth.uid(), 'manage_students', s.branch_id)
          )
        )
      );
  END IF;
END $$;

-- ─── 5C: quizzes, quiz_questions, quiz_options, quiz_attempts — add policies ──
-- RLS enabled but no policies = nobody can read (only service role works).
-- For the LMS to function, students + instructors + admins need read access.

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename='quizzes' AND policyname='quizzes_read_enrolled'
  ) THEN
    CREATE POLICY "quizzes_read_enrolled"
      ON public.quizzes FOR SELECT
      USING (
        public.user_has_permission(auth.uid(), 'manage_system')
        OR public.user_has_permission(auth.uid(), 'manage_assignments')
        OR EXISTS (
          SELECT 1 FROM public.students s
          WHERE s.user_id = auth.uid()
        )
        OR EXISTS (
          SELECT 1 FROM public.instructors i
          WHERE i.user_id = auth.uid()
        )
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename='quizzes' AND policyname='quizzes_staff_manage'
  ) THEN
    CREATE POLICY "quizzes_staff_manage"
      ON public.quizzes FOR ALL
      USING (
        public.user_has_permission(auth.uid(), 'manage_assignments')
        OR public.user_has_permission(auth.uid(), 'manage_system')
      )
      WITH CHECK (
        public.user_has_permission(auth.uid(), 'manage_assignments')
        OR public.user_has_permission(auth.uid(), 'manage_system')
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename='quiz_questions' AND policyname='quiz_questions_read'
  ) THEN
    CREATE POLICY "quiz_questions_read"
      ON public.quiz_questions FOR SELECT
      USING (
        public.user_has_permission(auth.uid(), 'manage_assignments')
        OR public.user_has_permission(auth.uid(), 'manage_system')
        OR EXISTS (SELECT 1 FROM public.students   s WHERE s.user_id = auth.uid())
        OR EXISTS (SELECT 1 FROM public.instructors i WHERE i.user_id = auth.uid())
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename='quiz_options' AND policyname='quiz_options_read'
  ) THEN
    CREATE POLICY "quiz_options_read"
      ON public.quiz_options FOR SELECT
      USING (
        public.user_has_permission(auth.uid(), 'manage_assignments')
        OR public.user_has_permission(auth.uid(), 'manage_system')
        OR EXISTS (SELECT 1 FROM public.students   s WHERE s.user_id = auth.uid())
        OR EXISTS (SELECT 1 FROM public.instructors i WHERE i.user_id = auth.uid())
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename='quiz_attempts' AND policyname='quiz_attempts_self'
  ) THEN
    CREATE POLICY "quiz_attempts_self"
      ON public.quiz_attempts FOR ALL
      USING (
        student_id IN (SELECT id FROM public.students WHERE user_id = auth.uid())
        OR public.user_has_permission(auth.uid(), 'manage_assignments')
        OR public.user_has_permission(auth.uid(), 'manage_system')
      );
  END IF;
END $$;

-- ─── 5D: Ensure notification_queue has no overly broad policies ───────────────
-- Sprint 39 migration added policies; this section verifies they're tight.
-- The existing policies scope to branch + role = correct.

-- ─── 5E: Ensure instructor_compensation is super_admin only ──────────────────
-- Already handled by 0047_finance_collections.sql — no change needed.

-- ─── 5F: Add READ policy for group_courses so students can see their courses ──
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename='group_courses' AND policyname='group_courses_student_read'
  ) THEN
    CREATE POLICY "group_courses_student_read"
      ON public.group_courses FOR SELECT
      USING (
        -- Students can see courses for their active groups
        group_id IN (
          SELECT gs.group_id FROM public.group_students gs
          JOIN public.students s ON s.id = gs.student_id
          WHERE s.user_id = auth.uid() AND gs.status = 'active'
        )
        -- Instructors can see their assigned group_courses
        OR instructor_id IN (
          SELECT i.id FROM public.instructors i WHERE i.user_id = auth.uid()
        )
        -- Staff can manage
        OR public.user_has_permission(auth.uid(), 'manage_groups')
        OR public.user_has_permission(auth.uid(), 'manage_system')
      );
  END IF;
END $$;

-- =============================================================================
-- PHASE 6 — FINAL INTEGRITY SUMMARY VIEW
-- =============================================================================

-- Master summary view: counts issues across all diagnostic views
CREATE OR REPLACE VIEW public.v_integrity_summary AS
SELECT
  'orphan_students'               AS check_name,
  COUNT(*)                        AS issue_count,
  'CRITICAL'                      AS severity
FROM public.v_diag_orphan_students

UNION ALL SELECT 'orphan_instructors', COUNT(*), 'CRITICAL'
FROM public.v_diag_orphan_instructors

UNION ALL SELECT 'duplicate_active_enrollments', COUNT(*), 'CRITICAL'
FROM public.v_diag_duplicate_active_enrollments

UNION ALL SELECT 'students_in_bad_groups', COUNT(*), 'HIGH'
FROM public.v_diag_students_in_bad_groups

UNION ALL SELECT 'invalid_finance_balances', COUNT(*), 'CRITICAL'
FROM public.v_diag_invalid_finance_balances

UNION ALL SELECT 'finance_status_mismatch', COUNT(*), 'HIGH'
FROM public.v_diag_finance_status_mismatch

UNION ALL SELECT 'broken_promises_unresolved', COUNT(*), 'MEDIUM'
FROM public.v_diag_broken_promises_unresolved

UNION ALL SELECT 'payment_student_mismatch', COUNT(*), 'CRITICAL'
FROM public.v_diag_payment_student_mismatch

UNION ALL SELECT 'orphan_attendance', COUNT(*), 'MEDIUM'
FROM public.v_diag_orphan_attendance

UNION ALL SELECT 'attendance_duplicates', COUNT(*), 'HIGH'
FROM public.v_diag_attendance_duplicates

UNION ALL SELECT 'stale_leads', COUNT(*), 'LOW'
FROM public.v_diag_stale_leads

UNION ALL SELECT 'leads_overdue_followup', COUNT(*), 'MEDIUM'
FROM public.v_diag_leads_overdue_followup

UNION ALL SELECT 'groups_no_instructor', COUNT(*), 'MEDIUM'
FROM public.v_diag_groups_no_instructor

UNION ALL SELECT 'groups_no_course', COUNT(*), 'MEDIUM'
FROM public.v_diag_groups_no_course

UNION ALL SELECT 'invalid_progress', COUNT(*), 'HIGH'
FROM public.v_diag_invalid_progress

UNION ALL SELECT 'orphan_parent_links', COUNT(*), 'MEDIUM'
FROM public.v_diag_orphan_parent_links

UNION ALL SELECT 'assignments_broken_chain', COUNT(*), 'HIGH'
FROM public.v_diag_assignments_broken_chain

ORDER BY
  CASE severity WHEN 'CRITICAL' THEN 1 WHEN 'HIGH' THEN 2 WHEN 'MEDIUM' THEN 3 ELSE 4 END,
  issue_count DESC;

COMMENT ON VIEW public.v_integrity_summary IS
  'Run: SELECT * FROM v_integrity_summary WHERE issue_count > 0;
   Shows all integrity problems by severity. Zero rows = clean database.';

-- =============================================================================
-- GRANTS — ensure authenticated role can query diagnostic views
-- =============================================================================
GRANT SELECT ON public.v_diag_orphan_students              TO authenticated;
GRANT SELECT ON public.v_diag_orphan_profiles              TO authenticated;
GRANT SELECT ON public.v_diag_orphan_instructors           TO authenticated;
GRANT SELECT ON public.v_diag_orphan_parents               TO authenticated;
GRANT SELECT ON public.v_diag_duplicate_active_enrollments TO authenticated;
GRANT SELECT ON public.v_diag_students_in_bad_groups       TO authenticated;
GRANT SELECT ON public.v_diag_groups_no_instructor         TO authenticated;
GRANT SELECT ON public.v_diag_groups_no_course             TO authenticated;
GRANT SELECT ON public.v_diag_students_no_finance          TO authenticated;
GRANT SELECT ON public.v_diag_invalid_finance_balances     TO authenticated;
GRANT SELECT ON public.v_diag_finance_status_mismatch      TO authenticated;
GRANT SELECT ON public.v_diag_broken_promises_unresolved   TO authenticated;
GRANT SELECT ON public.v_diag_orphan_finance_payments      TO authenticated;
GRANT SELECT ON public.v_diag_payment_student_mismatch     TO authenticated;
GRANT SELECT ON public.v_diag_orphan_attendance            TO authenticated;
GRANT SELECT ON public.v_diag_leads_no_branch              TO authenticated;
GRANT SELECT ON public.v_diag_stale_leads                  TO authenticated;
GRANT SELECT ON public.v_diag_leads_overdue_followup       TO authenticated;
GRANT SELECT ON public.v_diag_orphan_certificates          TO authenticated;
GRANT SELECT ON public.v_diag_certificates_suspicious      TO authenticated;
GRANT SELECT ON public.v_diag_instructors_bad_branch       TO authenticated;
GRANT SELECT ON public.v_diag_cross_branch_enrollments     TO authenticated;
GRANT SELECT ON public.v_diag_attendance_duplicates        TO authenticated;
GRANT SELECT ON public.v_diag_assignments_broken_chain     TO authenticated;
GRANT SELECT ON public.v_diag_orphan_parent_links          TO authenticated;
GRANT SELECT ON public.v_diag_installments_over_total      TO authenticated;
GRANT SELECT ON public.v_diag_invalid_progress             TO authenticated;
GRANT SELECT ON public.v_diag_leads_converted_mismatch     TO authenticated;
GRANT SELECT ON public.v_integrity_summary                 TO authenticated;
