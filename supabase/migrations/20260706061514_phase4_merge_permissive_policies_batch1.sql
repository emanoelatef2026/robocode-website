-- Phase 4.3 (batch 1): merge multiple permissive policies into one-per-action.
-- Behavior-preserving: ALL policies are split into INSERT/UPDATE/DELETE copies
-- (identical condition), and SELECT-only policies are folded via OR into one
-- merged SELECT policy alongside the ALL policy's read condition.

-- attendance_records
DROP POLICY IF EXISTS attendance_manage_by_instructor ON public.attendance_records;
DROP POLICY IF EXISTS attendance_read_own_parent ON public.attendance_records;
DROP POLICY IF EXISTS attendance_read_own_student ON public.attendance_records;

CREATE POLICY attendance_write_insert ON public.attendance_records
  FOR INSERT WITH CHECK (schedule_id IN ( SELECT s.id FROM schedules s WHERE user_has_permission((select auth.uid()), 'manage_attendance'::text, s.branch_id)));

CREATE POLICY attendance_write_update ON public.attendance_records
  FOR UPDATE USING (schedule_id IN ( SELECT s.id FROM schedules s WHERE user_has_permission((select auth.uid()), 'manage_attendance'::text, s.branch_id)))
  WITH CHECK (schedule_id IN ( SELECT s.id FROM schedules s WHERE user_has_permission((select auth.uid()), 'manage_attendance'::text, s.branch_id)));

CREATE POLICY attendance_write_delete ON public.attendance_records
  FOR DELETE USING (schedule_id IN ( SELECT s.id FROM schedules s WHERE user_has_permission((select auth.uid()), 'manage_attendance'::text, s.branch_id)));

CREATE POLICY attendance_select_merged ON public.attendance_records
  FOR SELECT USING (
    (schedule_id IN ( SELECT s.id FROM schedules s WHERE user_has_permission((select auth.uid()), 'manage_attendance'::text, s.branch_id)))
    OR (student_id IN ( SELECT ps.student_id FROM (parent_students ps JOIN parents p ON ((p.id = ps.parent_id))) WHERE (p.user_id = (select auth.uid()))))
    OR (student_id IN ( SELECT students.id FROM students WHERE (students.user_id = (select auth.uid()))))
  );

-- finance_installments
DROP POLICY IF EXISTS fi_manage ON public.finance_installments;
DROP POLICY IF EXISTS fi_parent_read ON public.finance_installments;

CREATE POLICY fi_write_insert ON public.finance_installments
  FOR INSERT WITH CHECK (EXISTS ( SELECT 1 FROM student_financial_accounts s WHERE ((s.id = finance_installments.account_id) AND user_has_permission((select auth.uid()), 'manage_financials'::text, s.branch_id))));

CREATE POLICY fi_write_update ON public.finance_installments
  FOR UPDATE USING (EXISTS ( SELECT 1 FROM student_financial_accounts s WHERE ((s.id = finance_installments.account_id) AND user_has_permission((select auth.uid()), 'manage_financials'::text, s.branch_id))))
  WITH CHECK (EXISTS ( SELECT 1 FROM student_financial_accounts s WHERE ((s.id = finance_installments.account_id) AND user_has_permission((select auth.uid()), 'manage_financials'::text, s.branch_id))));

CREATE POLICY fi_write_delete ON public.finance_installments
  FOR DELETE USING (EXISTS ( SELECT 1 FROM student_financial_accounts s WHERE ((s.id = finance_installments.account_id) AND user_has_permission((select auth.uid()), 'manage_financials'::text, s.branch_id))));

CREATE POLICY fi_select_merged ON public.finance_installments
  FOR SELECT USING (
    (EXISTS ( SELECT 1 FROM student_financial_accounts s WHERE ((s.id = finance_installments.account_id) AND user_has_permission((select auth.uid()), 'manage_financials'::text, s.branch_id))))
    OR (EXISTS ( SELECT 1 FROM student_financial_accounts s WHERE ((s.id = finance_installments.account_id) AND (s.student_id IN ( SELECT ps.student_id FROM (parent_students ps JOIN parents p ON ((p.id = ps.parent_id))) WHERE ((p.user_id = (select auth.uid())) AND (ps.can_view_financials = true)))))))
  );

-- finance_payments
DROP POLICY IF EXISTS fp_manage ON public.finance_payments;
DROP POLICY IF EXISTS fp_parent_read ON public.finance_payments;

CREATE POLICY fp_write_insert ON public.finance_payments
  FOR INSERT WITH CHECK (EXISTS ( SELECT 1 FROM student_financial_accounts s WHERE ((s.id = finance_payments.account_id) AND user_has_permission((select auth.uid()), 'manage_financials'::text, s.branch_id))));

CREATE POLICY fp_write_update ON public.finance_payments
  FOR UPDATE USING (EXISTS ( SELECT 1 FROM student_financial_accounts s WHERE ((s.id = finance_payments.account_id) AND user_has_permission((select auth.uid()), 'manage_financials'::text, s.branch_id))))
  WITH CHECK (EXISTS ( SELECT 1 FROM student_financial_accounts s WHERE ((s.id = finance_payments.account_id) AND user_has_permission((select auth.uid()), 'manage_financials'::text, s.branch_id))));

CREATE POLICY fp_write_delete ON public.finance_payments
  FOR DELETE USING (EXISTS ( SELECT 1 FROM student_financial_accounts s WHERE ((s.id = finance_payments.account_id) AND user_has_permission((select auth.uid()), 'manage_financials'::text, s.branch_id))));

CREATE POLICY fp_select_merged ON public.finance_payments
  FOR SELECT USING (
    (EXISTS ( SELECT 1 FROM student_financial_accounts s WHERE ((s.id = finance_payments.account_id) AND user_has_permission((select auth.uid()), 'manage_financials'::text, s.branch_id))))
    OR (student_id IN ( SELECT ps.student_id FROM (parent_students ps JOIN parents p ON ((p.id = ps.parent_id))) WHERE ((p.user_id = (select auth.uid())) AND (ps.can_view_financials = true))))
  );

-- groups
DROP POLICY IF EXISTS groups_write_by_staff ON public.groups;
DROP POLICY IF EXISTS groups_read_by_branch_member ON public.groups;

CREATE POLICY groups_write_insert ON public.groups
  FOR INSERT WITH CHECK (user_has_permission((select auth.uid()), 'manage_groups'::text, branch_id));

CREATE POLICY groups_write_update ON public.groups
  FOR UPDATE USING (user_has_permission((select auth.uid()), 'manage_groups'::text, branch_id))
  WITH CHECK (user_has_permission((select auth.uid()), 'manage_groups'::text, branch_id));

CREATE POLICY groups_write_delete ON public.groups
  FOR DELETE USING (user_has_permission((select auth.uid()), 'manage_groups'::text, branch_id));

CREATE POLICY groups_select_merged ON public.groups
  FOR SELECT USING (
    (user_has_permission((select auth.uid()), 'manage_groups'::text, branch_id))
    OR ((deleted_at IS NULL) AND ((branch_id IN ( SELECT DISTINCT user_roles.branch_id FROM user_roles WHERE ((user_roles.user_id = (select auth.uid())) AND (user_roles.branch_id IS NOT NULL)))) OR user_has_permission((select auth.uid()), 'manage_system'::text)))
  );

-- schedules
DROP POLICY IF EXISTS schedules_manage ON public.schedules;
DROP POLICY IF EXISTS schedules_read ON public.schedules;

CREATE POLICY schedules_write_insert ON public.schedules
  FOR INSERT WITH CHECK (user_has_permission((select auth.uid()), 'manage_schedule'::text, branch_id));

CREATE POLICY schedules_write_update ON public.schedules
  FOR UPDATE USING (user_has_permission((select auth.uid()), 'manage_schedule'::text, branch_id))
  WITH CHECK (user_has_permission((select auth.uid()), 'manage_schedule'::text, branch_id));

CREATE POLICY schedules_write_delete ON public.schedules
  FOR DELETE USING (user_has_permission((select auth.uid()), 'manage_schedule'::text, branch_id));

CREATE POLICY schedules_select_merged ON public.schedules
  FOR SELECT USING (
    (user_has_permission((select auth.uid()), 'manage_schedule'::text, branch_id))
    OR ((branch_id IN ( SELECT DISTINCT user_roles.branch_id FROM user_roles WHERE ((user_roles.user_id = (select auth.uid())) AND (user_roles.branch_id IS NOT NULL)))) OR user_has_permission((select auth.uid()), 'manage_system'::text))
  );

-- student_enrollments
DROP POLICY IF EXISTS super_admin_enrollments ON public.student_enrollments;
DROP POLICY IF EXISTS tl_enrollments_own_branches ON public.student_enrollments;
DROP POLICY IF EXISTS student_own_enrollments ON public.student_enrollments;

CREATE POLICY enrollments_write_insert ON public.student_enrollments
  FOR INSERT TO authenticated WITH CHECK (
    (EXISTS ( SELECT 1 FROM (user_roles ur JOIN roles r ON ((r.id = ur.role_id))) WHERE ((ur.user_id = (select auth.uid())) AND (r.name = 'super_admin'::text))))
    OR (EXISTS ( SELECT 1 FROM (user_roles ur JOIN roles r ON ((r.id = ur.role_id))) WHERE ((ur.user_id = (select auth.uid())) AND (r.name = 'team_leader'::text) AND (ur.branch_id = student_enrollments.branch_id))))
  );

CREATE POLICY enrollments_write_update ON public.student_enrollments
  FOR UPDATE TO authenticated USING (
    (EXISTS ( SELECT 1 FROM (user_roles ur JOIN roles r ON ((r.id = ur.role_id))) WHERE ((ur.user_id = (select auth.uid())) AND (r.name = 'super_admin'::text))))
    OR (EXISTS ( SELECT 1 FROM (user_roles ur JOIN roles r ON ((r.id = ur.role_id))) WHERE ((ur.user_id = (select auth.uid())) AND (r.name = 'team_leader'::text) AND (ur.branch_id = student_enrollments.branch_id))))
  )
  WITH CHECK (
    (EXISTS ( SELECT 1 FROM (user_roles ur JOIN roles r ON ((r.id = ur.role_id))) WHERE ((ur.user_id = (select auth.uid())) AND (r.name = 'super_admin'::text))))
    OR (EXISTS ( SELECT 1 FROM (user_roles ur JOIN roles r ON ((r.id = ur.role_id))) WHERE ((ur.user_id = (select auth.uid())) AND (r.name = 'team_leader'::text) AND (ur.branch_id = student_enrollments.branch_id))))
  );

CREATE POLICY enrollments_write_delete ON public.student_enrollments
  FOR DELETE TO authenticated USING (
    (EXISTS ( SELECT 1 FROM (user_roles ur JOIN roles r ON ((r.id = ur.role_id))) WHERE ((ur.user_id = (select auth.uid())) AND (r.name = 'super_admin'::text))))
    OR (EXISTS ( SELECT 1 FROM (user_roles ur JOIN roles r ON ((r.id = ur.role_id))) WHERE ((ur.user_id = (select auth.uid())) AND (r.name = 'team_leader'::text) AND (ur.branch_id = student_enrollments.branch_id))))
  );

CREATE POLICY enrollments_select_merged ON public.student_enrollments
  FOR SELECT TO authenticated USING (
    (EXISTS ( SELECT 1 FROM (user_roles ur JOIN roles r ON ((r.id = ur.role_id))) WHERE ((ur.user_id = (select auth.uid())) AND (r.name = 'super_admin'::text))))
    OR (EXISTS ( SELECT 1 FROM (user_roles ur JOIN roles r ON ((r.id = ur.role_id))) WHERE ((ur.user_id = (select auth.uid())) AND (r.name = 'team_leader'::text) AND (ur.branch_id = student_enrollments.branch_id))))
    OR (student_id IN ( SELECT students.id FROM students WHERE (students.user_id = (select auth.uid()))))
  );

-- students (no ALL policy here; just merge the two SELECT policies)
DROP POLICY IF EXISTS students_read_by_branch_staff ON public.students;
DROP POLICY IF EXISTS students_read_by_parent ON public.students;

CREATE POLICY students_select_merged ON public.students
  FOR SELECT USING (
    ((deleted_at IS NULL) AND ((user_id = (select auth.uid())) OR user_has_permission((select auth.uid()), 'manage_students'::text, branch_id) OR user_has_permission((select auth.uid()), 'manage_system'::text)))
    OR ((deleted_at IS NULL) AND (id IN ( SELECT ps.student_id FROM (parent_students ps JOIN parents p ON ((p.id = ps.parent_id))) WHERE (p.user_id = (select auth.uid())))))
  );
