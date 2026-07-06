-- 156 policies to fix

-- Phase 4.2: wrap auth.uid()/auth.jwt() in (select ...) to avoid per-row re-evaluation
-- Generated from pg_policies where qual/with_check referenced auth.uid()/auth.jwt() directly.
-- Behavior-preserving: only wraps the function calls, no logic change.

ALTER POLICY "academic_years_manage" ON public."academic_years"
  USING (user_has_permission((select auth.uid()), 'manage_system'::text))
  WITH CHECK (user_has_permission((select auth.uid()), 'manage_system'::text));

ALTER POLICY "academic_years_read" ON public."academic_years"
  USING (((select auth.uid()) IS NOT NULL));

ALTER POLICY "ai_reports_parent_read" ON public."ai_reports"
  USING (((student_id IN ( SELECT ps.student_id
   FROM (parent_students ps
     JOIN parents p ON ((p.id = ps.parent_id)))
  WHERE (p.user_id = (select auth.uid())))) OR user_has_permission((select auth.uid()), 'read_ai_reports'::text)));

ALTER POLICY "analytics_events_self_insert" ON public."analytics_events"
  WITH CHECK (((user_id = (select auth.uid())) OR (user_id IS NULL)));

ALTER POLICY "snapshots_read" ON public."analytics_snapshots"
  USING (user_has_permission((select auth.uid()), 'read_analytics'::text));

ALTER POLICY "announcements_manage" ON public."announcements"
  USING (user_has_permission((select auth.uid()), 'send_announcements'::text, branch_id));

ALTER POLICY "announcements_read" ON public."announcements"
  USING (((deleted_at IS NULL) AND ((expires_at IS NULL) OR (expires_at > now())) AND ((branch_id IN ( SELECT DISTINCT user_roles.branch_id
   FROM user_roles
  WHERE ((user_roles.user_id = (select auth.uid())) AND (user_roles.branch_id IS NOT NULL)))) OR user_has_permission((select auth.uid()), 'manage_system'::text))));

ALTER POLICY "feedback_instructor_all" ON public."assignment_feedback"
  USING (user_has_permission((select auth.uid()), 'grade_assignments'::text));

ALTER POLICY "feedback_public_read" ON public."assignment_feedback"
  USING (((is_public = true) AND (submission_id IN ( SELECT s.id
   FROM (submissions s
     JOIN students st ON ((st.id = s.student_id)))
  WHERE ((st.user_id = (select auth.uid())) OR (st.id IN ( SELECT ps.student_id
           FROM (parent_students ps
             JOIN parents p ON ((p.id = ps.parent_id)))
          WHERE (p.user_id = (select auth.uid())))))))));

ALTER POLICY "consumption_read_own_parent" ON public."attendance_consumptions"
  USING ((student_id IN ( SELECT ps.student_id
   FROM (parent_students ps
     JOIN parents p ON ((p.id = ps.parent_id)))
  WHERE (p.user_id = (select auth.uid())))));

ALTER POLICY "consumption_read_own_student" ON public."attendance_consumptions"
  USING ((student_id IN ( SELECT students.id
   FROM students
  WHERE (students.user_id = (select auth.uid())))));

ALTER POLICY "attendance_manage_by_instructor" ON public."attendance_records"
  USING ((schedule_id IN ( SELECT s.id
   FROM schedules s
  WHERE user_has_permission((select auth.uid()), 'manage_attendance'::text, s.branch_id))));

ALTER POLICY "attendance_read_own_parent" ON public."attendance_records"
  USING ((student_id IN ( SELECT ps.student_id
   FROM (parent_students ps
     JOIN parents p ON ((p.id = ps.parent_id)))
  WHERE (p.user_id = (select auth.uid())))));

ALTER POLICY "attendance_read_own_student" ON public."attendance_records"
  USING ((student_id IN ( SELECT students.id
   FROM students
  WHERE (students.user_id = (select auth.uid())))));

ALTER POLICY "audit_logs_read_by_authorized" ON public."audit_logs"
  USING ((user_has_permission((select auth.uid()), 'read_audit_logs'::text) AND (((branch_id IS NULL) AND user_has_permission((select auth.uid()), 'manage_system'::text)) OR (branch_id IN ( SELECT DISTINCT user_roles.branch_id
   FROM user_roles
  WHERE ((user_roles.user_id = (select auth.uid())) AND (user_roles.branch_id IS NOT NULL)))))));

ALTER POLICY "branches_read_by_member" ON public."branches"
  USING (((deleted_at IS NULL) AND ((id IN ( SELECT user_roles.branch_id
   FROM user_roles
  WHERE ((user_roles.user_id = (select auth.uid())) AND (user_roles.branch_id IS NOT NULL)))) OR user_has_permission((select auth.uid()), 'manage_system'::text))));

ALTER POLICY "branches_write_by_admin" ON public."branches"
  USING (user_has_permission((select auth.uid()), 'manage_branches'::text))
  WITH CHECK (user_has_permission((select auth.uid()), 'manage_branches'::text));

ALTER POLICY "snapshots_admin_insert" ON public."certificate_snapshots"
  WITH CHECK ((user_has_permission((select auth.uid()), 'manage_certificates'::text) OR user_has_permission((select auth.uid()), 'manage_system'::text)));

ALTER POLICY "snapshots_admin_read" ON public."certificate_snapshots"
  USING ((user_has_permission((select auth.uid()), 'manage_certificates'::text) OR user_has_permission((select auth.uid()), 'manage_system'::text)));

ALTER POLICY "snapshots_student_read" ON public."certificate_snapshots"
  USING ((certificate_id IN ( SELECT certificates.id
   FROM certificates
  WHERE (certificates.student_id IN ( SELECT students.id
           FROM students
          WHERE (students.user_id = (select auth.uid())))))));

ALTER POLICY "cert_templates_admin_all" ON public."certificate_templates"
  USING ((user_has_permission((select auth.uid()), 'manage_system'::text) OR user_has_permission((select auth.uid()), 'manage_certificates'::text)))
  WITH CHECK ((user_has_permission((select auth.uid()), 'manage_system'::text) OR user_has_permission((select auth.uid()), 'manage_certificates'::text)));

ALTER POLICY "cert_templates_auth_read" ON public."certificate_templates"
  USING ((((select auth.uid()) IS NOT NULL) AND (is_active = true)));

ALTER POLICY "certificate_templates_manage" ON public."certificate_templates"
  USING (user_has_permission((select auth.uid()), 'manage_system'::text))
  WITH CHECK (user_has_permission((select auth.uid()), 'manage_system'::text));

ALTER POLICY "certificate_templates_read" ON public."certificate_templates"
  USING (((is_active = true) OR user_has_permission((select auth.uid()), 'manage_system'::text)));

ALTER POLICY "certs_admin_all" ON public."certificates"
  USING ((user_has_permission((select auth.uid()), 'manage_system'::text) OR user_has_permission((select auth.uid()), 'manage_certificates'::text)))
  WITH CHECK ((user_has_permission((select auth.uid()), 'manage_system'::text) OR user_has_permission((select auth.uid()), 'manage_certificates'::text)));

ALTER POLICY "certs_parent_read" ON public."certificates"
  USING ((student_id IN ( SELECT ps.student_id
   FROM (parent_students ps
     JOIN parents p ON ((p.id = ps.parent_id)))
  WHERE (p.user_id = (select auth.uid())))));

ALTER POLICY "certs_self_read" ON public."certificates"
  USING ((student_id IN ( SELECT students.id
   FROM students
  WHERE (students.user_id = (select auth.uid())))));

ALTER POLICY "ca_staff_all" ON public."collection_activities"
  USING ((EXISTS ( SELECT 1
   FROM student_financial_accounts s
  WHERE ((s.student_id = s.student_id) AND user_has_permission((select auth.uid()), 'manage_financials'::text, s.branch_id)))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM student_financial_accounts s
  WHERE ((s.student_id = s.student_id) AND user_has_permission((select auth.uid()), 'manage_financials'::text, s.branch_id)))));

ALTER POLICY "courses_manage" ON public."courses"
  USING ((user_has_permission((select auth.uid()), 'manage_courses'::text, branch_id) OR user_has_permission((select auth.uid()), 'manage_system'::text)));

ALTER POLICY "courses_read" ON public."courses"
  USING (((deleted_at IS NULL) AND (is_published = true) AND ((scope = ANY (ARRAY['global'::text, 'template'::text])) OR (branch_id IN ( SELECT DISTINCT user_roles.branch_id
   FROM user_roles
  WHERE ((user_roles.user_id = (select auth.uid())) AND (user_roles.branch_id IS NOT NULL)))) OR user_has_permission((select auth.uid()), 'manage_system'::text))));

ALTER POLICY "external_videos_manage" ON public."external_videos"
  USING (user_has_permission((select auth.uid()), 'manage_media'::text, branch_id));

ALTER POLICY "external_videos_read" ON public."external_videos"
  USING (((deleted_at IS NULL) AND ((is_public = true) OR (branch_id IN ( SELECT DISTINCT user_roles.branch_id
   FROM user_roles
  WHERE ((user_roles.user_id = (select auth.uid())) AND (user_roles.branch_id IS NOT NULL)))) OR user_has_permission((select auth.uid()), 'manage_system'::text))));

ALTER POLICY "feature_flags_manage_admin" ON public."feature_flags"
  USING (user_has_permission((select auth.uid()), 'manage_system'::text));

ALTER POLICY "feedback_notes_instructor" ON public."feedback_notes"
  USING (((instructor_id IN ( SELECT instructors.id
   FROM instructors
  WHERE (instructors.user_id = (select auth.uid())))) OR user_has_permission((select auth.uid()), 'manage_feedback'::text)));

ALTER POLICY "feedback_notes_parent_read" ON public."feedback_notes"
  USING (((deleted_at IS NULL) AND (visible_to_parent = true) AND (student_id IN ( SELECT ps.student_id
   FROM (parent_students ps
     JOIN parents p ON ((p.id = ps.parent_id)))
  WHERE (p.user_id = (select auth.uid()))))));

ALTER POLICY "feedback_notes_student_read" ON public."feedback_notes"
  USING (((deleted_at IS NULL) AND (student_id IN ( SELECT students.id
   FROM students
  WHERE (students.user_id = (select auth.uid()))))));

ALTER POLICY "fi_manage" ON public."finance_installments"
  USING ((EXISTS ( SELECT 1
   FROM student_financial_accounts s
  WHERE ((s.id = finance_installments.account_id) AND user_has_permission((select auth.uid()), 'manage_financials'::text, s.branch_id)))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM student_financial_accounts s
  WHERE ((s.id = finance_installments.account_id) AND user_has_permission((select auth.uid()), 'manage_financials'::text, s.branch_id)))));

ALTER POLICY "fi_parent_read" ON public."finance_installments"
  USING ((EXISTS ( SELECT 1
   FROM student_financial_accounts s
  WHERE ((s.id = finance_installments.account_id) AND (s.student_id IN ( SELECT ps.student_id
           FROM (parent_students ps
             JOIN parents p ON ((p.id = ps.parent_id)))
          WHERE ((p.user_id = (select auth.uid())) AND (ps.can_view_financials = true))))))));

ALTER POLICY "fn_parent_read_public" ON public."finance_notes"
  USING (((is_internal = false) AND (student_id IN ( SELECT ps.student_id
   FROM (parent_students ps
     JOIN parents p ON ((p.id = ps.parent_id)))
  WHERE ((p.user_id = (select auth.uid())) AND (ps.can_view_financials = true))))));

ALTER POLICY "fn_staff_all" ON public."finance_notes"
  USING ((EXISTS ( SELECT 1
   FROM student_financial_accounts s
  WHERE ((s.student_id = s.student_id) AND user_has_permission((select auth.uid()), 'manage_financials'::text, s.branch_id)))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM student_financial_accounts s
  WHERE ((s.student_id = s.student_id) AND user_has_permission((select auth.uid()), 'manage_financials'::text, s.branch_id)))));

ALTER POLICY "super_admin_fpr" ON public."finance_payment_reversals"
  USING ((EXISTS ( SELECT 1
   FROM (user_roles ur
     JOIN roles r ON ((r.id = ur.role_id)))
  WHERE ((ur.user_id = (select auth.uid())) AND (r.name = 'super_admin'::text)))));

ALTER POLICY "tl_fpr_own_branches" ON public."finance_payment_reversals"
  USING ((EXISTS ( SELECT 1
   FROM ((user_roles ur
     JOIN roles r ON ((r.id = ur.role_id)))
     JOIN student_enrollments se ON ((se.id = finance_payment_reversals.enrollment_id)))
  WHERE ((ur.user_id = (select auth.uid())) AND (r.name = 'team_leader'::text) AND (ur.branch_id = se.branch_id)))));

ALTER POLICY "fp_manage" ON public."finance_payments"
  USING ((EXISTS ( SELECT 1
   FROM student_financial_accounts s
  WHERE ((s.id = finance_payments.account_id) AND user_has_permission((select auth.uid()), 'manage_financials'::text, s.branch_id)))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM student_financial_accounts s
  WHERE ((s.id = finance_payments.account_id) AND user_has_permission((select auth.uid()), 'manage_financials'::text, s.branch_id)))));

ALTER POLICY "fp_parent_read" ON public."finance_payments"
  USING ((student_id IN ( SELECT ps.student_id
   FROM (parent_students ps
     JOIN parents p ON ((p.id = ps.parent_id)))
  WHERE ((p.user_id = (select auth.uid())) AND (ps.can_view_financials = true)))));

ALTER POLICY "group_instructors_read" ON public."group_instructors"
  USING (((instructor_id IN ( SELECT instructors.id
   FROM instructors
  WHERE (instructors.user_id = (select auth.uid())))) OR (EXISTS ( SELECT 1
   FROM groups g
  WHERE ((g.id = group_instructors.group_id) AND user_has_permission((select auth.uid()), 'manage_groups'::text, g.branch_id))))));

ALTER POLICY "group_students_read_own" ON public."group_students"
  USING (((student_id IN ( SELECT students.id
   FROM students
  WHERE (students.user_id = (select auth.uid())))) OR (EXISTS ( SELECT 1
   FROM groups g
  WHERE ((g.id = group_students.group_id) AND user_has_permission((select auth.uid()), 'manage_groups'::text, g.branch_id)))) OR (EXISTS ( SELECT 1
   FROM (parent_students ps
     JOIN parents p ON ((p.id = ps.parent_id)))
  WHERE ((ps.student_id = group_students.student_id) AND (p.user_id = (select auth.uid())))))));

ALTER POLICY "groups_read_by_branch_member" ON public."groups"
  USING (((deleted_at IS NULL) AND ((branch_id IN ( SELECT DISTINCT user_roles.branch_id
   FROM user_roles
  WHERE ((user_roles.user_id = (select auth.uid())) AND (user_roles.branch_id IS NOT NULL)))) OR user_has_permission((select auth.uid()), 'manage_system'::text))));

ALTER POLICY "groups_write_by_staff" ON public."groups"
  USING (user_has_permission((select auth.uid()), 'manage_groups'::text, branch_id))
  WITH CHECK (user_has_permission((select auth.uid()), 'manage_groups'::text, branch_id));

ALTER POLICY "ic_super_admin" ON public."instructor_compensation"
  USING (user_has_permission((select auth.uid()), 'manage_financials'::text, branch_id))
  WITH CHECK (user_has_permission((select auth.uid()), 'manage_financials'::text, branch_id));

ALTER POLICY "payouts_read_own" ON public."instructor_payouts"
  USING (((instructor_id IN ( SELECT instructors.id
   FROM instructors
  WHERE (instructors.user_id = (select auth.uid())))) OR user_has_permission((select auth.uid()), 'manage_financials'::text, branch_id)));

ALTER POLICY "instructors_read_by_branch_staff" ON public."instructors"
  USING (((deleted_at IS NULL) AND ((user_id = (select auth.uid())) OR user_has_permission((select auth.uid()), 'manage_instructors'::text, branch_id) OR user_has_permission((select auth.uid()), 'manage_system'::text))));

ALTER POLICY "invoices_manage" ON public."invoices"
  USING (user_has_permission((select auth.uid()), 'manage_financials'::text, branch_id))
  WITH CHECK (user_has_permission((select auth.uid()), 'manage_financials'::text, branch_id));

ALTER POLICY "invoices_read_parent" ON public."invoices"
  USING (((student_id IN ( SELECT ps.student_id
   FROM (parent_students ps
     JOIN parents p ON ((p.id = ps.parent_id)))
  WHERE ((p.user_id = (select auth.uid())) AND (ps.can_view_financials = true)))) OR user_has_permission((select auth.uid()), 'manage_financials'::text, branch_id) OR user_has_permission((select auth.uid()), 'read_financials'::text, branch_id)));

ALTER POLICY "lah_super_admin" ON public."lead_assignment_history"
  USING ((EXISTS ( SELECT 1
   FROM (user_roles ur
     JOIN roles r ON ((r.id = ur.role_id)))
  WHERE ((ur.user_id = (select auth.uid())) AND (r.name = 'super_admin'::text)))));

ALTER POLICY "lah_team_leader" ON public."lead_assignment_history"
  USING ((EXISTS ( SELECT 1
   FROM ((leads l
     JOIN user_roles ur ON (((ur.branch_id = l.branch_id) OR (l.branch_id IS NULL))))
     JOIN roles r ON ((r.id = ur.role_id)))
  WHERE ((l.id = lead_assignment_history.lead_id) AND (ur.user_id = (select auth.uid())) AND (r.name = ANY (ARRAY['team_leader'::text, 'super_admin'::text]))))));

ALTER POLICY "lt_super_admin" ON public."lead_timeline"
  USING ((EXISTS ( SELECT 1
   FROM (user_roles ur
     JOIN roles r ON ((r.id = ur.role_id)))
  WHERE ((ur.user_id = (select auth.uid())) AND (r.name = 'super_admin'::text)))));

ALTER POLICY "lt_team_leader" ON public."lead_timeline"
  USING ((EXISTS ( SELECT 1
   FROM ((leads l
     JOIN user_roles ur ON (((ur.branch_id = l.branch_id) OR (l.branch_id IS NULL))))
     JOIN roles r ON ((r.id = ur.role_id)))
  WHERE ((l.id = lead_timeline.lead_id) AND (ur.user_id = (select auth.uid())) AND (r.name = ANY (ARRAY['team_leader'::text, 'super_admin'::text]))))));

ALTER POLICY "leads_super_admin" ON public."leads"
  USING ((EXISTS ( SELECT 1
   FROM (user_roles ur
     JOIN roles r ON ((r.id = ur.role_id)))
  WHERE ((ur.user_id = (select auth.uid())) AND (r.name = 'super_admin'::text)))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM (user_roles ur
     JOIN roles r ON ((r.id = ur.role_id)))
  WHERE ((ur.user_id = (select auth.uid())) AND (r.name = 'super_admin'::text)))));

ALTER POLICY "leads_team_leader" ON public."leads"
  USING (((branch_id IS NULL) OR (EXISTS ( SELECT 1
   FROM (user_roles ur
     JOIN roles r ON ((r.id = ur.role_id)))
  WHERE ((ur.user_id = (select auth.uid())) AND (r.name = 'team_leader'::text) AND (ur.branch_id = leads.branch_id))))))
  WITH CHECK (((branch_id IS NULL) OR (EXISTS ( SELECT 1
   FROM (user_roles ur
     JOIN roles r ON ((r.id = ur.role_id)))
  WHERE ((ur.user_id = (select auth.uid())) AND (r.name = 'team_leader'::text) AND (ur.branch_id = leads.branch_id))))));

ALTER POLICY "learning_tracks_manage" ON public."learning_tracks"
  USING (user_has_permission((select auth.uid()), 'manage_system'::text))
  WITH CHECK (user_has_permission((select auth.uid()), 'manage_system'::text));

ALTER POLICY "learning_tracks_read_published" ON public."learning_tracks"
  USING (((deleted_at IS NULL) AND ((is_published = true) OR user_has_permission((select auth.uid()), 'manage_curriculum'::text) OR user_has_permission((select auth.uid()), 'manage_system'::text))));

ALTER POLICY "lesson_completions_self" ON public."lesson_completions"
  USING ((student_id IN ( SELECT students.id
   FROM students
  WHERE (students.user_id = (select auth.uid())))));

ALTER POLICY "lessons_read_by_enrolled_student" ON public."lessons"
  USING (((deleted_at IS NULL) AND (is_published = true) AND (module_id IN ( SELECT m.id
   FROM (((course_modules m
     JOIN group_courses gc ON ((gc.course_id = m.course_id)))
     JOIN group_students gs ON ((gs.group_id = gc.group_id)))
     JOIN students s ON ((s.id = gs.student_id)))
  WHERE ((s.user_id = (select auth.uid())) AND (gs.status = 'active'::text))))));

ALTER POLICY "media_assets_manage" ON public."media_assets"
  USING (((uploader_id = (select auth.uid())) OR user_has_permission((select auth.uid()), 'manage_media'::text, branch_id)));

ALTER POLICY "media_assets_read" ON public."media_assets"
  USING (((deleted_at IS NULL) AND ((uploader_id = (select auth.uid())) OR (branch_id IN ( SELECT DISTINCT user_roles.branch_id
   FROM user_roles
  WHERE ((user_roles.user_id = (select auth.uid())) AND (user_roles.branch_id IS NOT NULL)))) OR user_has_permission((select auth.uid()), 'manage_system'::text))));

ALTER POLICY "notification_preferences_self" ON public."notification_preferences"
  USING ((user_id = (select auth.uid())));

ALTER POLICY "notification_recipients_self" ON public."notification_recipients"
  USING ((user_id = (select auth.uid())));

ALTER POLICY "operational_tasks_tl_insert" ON public."operational_tasks"
  WITH CHECK ((EXISTS ( SELECT 1
   FROM (user_roles ur
     JOIN roles r ON ((r.id = ur.role_id)))
  WHERE ((ur.user_id = (select auth.uid())) AND (r.name = ANY (ARRAY['team_leader'::text, 'super_admin'::text])) AND ((ur.branch_id = operational_tasks.branch_id) OR (r.name = 'super_admin'::text))))));

ALTER POLICY "operational_tasks_tl_select" ON public."operational_tasks"
  USING ((EXISTS ( SELECT 1
   FROM (user_roles ur
     JOIN roles r ON ((r.id = ur.role_id)))
  WHERE ((ur.user_id = (select auth.uid())) AND (r.name = ANY (ARRAY['team_leader'::text, 'super_admin'::text])) AND ((ur.branch_id = operational_tasks.branch_id) OR (r.name = 'super_admin'::text))))));

ALTER POLICY "operational_tasks_tl_update" ON public."operational_tasks"
  USING ((EXISTS ( SELECT 1
   FROM (user_roles ur
     JOIN roles r ON ((r.id = ur.role_id)))
  WHERE ((ur.user_id = (select auth.uid())) AND (r.name = ANY (ARRAY['team_leader'::text, 'super_admin'::text])) AND ((ur.branch_id = operational_tasks.branch_id) OR (r.name = 'super_admin'::text))))));

ALTER POLICY "parent_feedback_admin_read" ON public."parent_feedback"
  USING ((user_has_permission((select auth.uid()), 'manage_system'::text) OR user_has_permission((select auth.uid()), 'manage_students'::text)));

ALTER POLICY "parent_feedback_insert" ON public."parent_feedback"
  WITH CHECK ((parent_id IN ( SELECT parents.id
   FROM parents
  WHERE (parents.user_id = (select auth.uid())))));

ALTER POLICY "parent_feedback_read_own" ON public."parent_feedback"
  USING ((parent_id IN ( SELECT parents.id
   FROM parents
  WHERE (parents.user_id = (select auth.uid())))));

ALTER POLICY "parent_messages_insert" ON public."parent_messages"
  WITH CHECK ((parent_user_id = (select auth.uid())));

ALTER POLICY "parent_messages_select_own" ON public."parent_messages"
  USING ((parent_user_id = (select auth.uid())));

ALTER POLICY "parent_students_read" ON public."parent_students"
  USING (((parent_id IN ( SELECT parents.id
   FROM parents
  WHERE (parents.user_id = (select auth.uid())))) OR (EXISTS ( SELECT 1
   FROM students s
  WHERE ((s.id = parent_students.student_id) AND user_has_permission((select auth.uid()), 'manage_students'::text, s.branch_id))))));

ALTER POLICY "parents_self_read" ON public."parents"
  USING ((user_id = (select auth.uid())));

ALTER POLICY "pp_staff_all" ON public."payment_promises"
  USING ((EXISTS ( SELECT 1
   FROM student_financial_accounts s
  WHERE ((s.student_id = s.student_id) AND user_has_permission((select auth.uid()), 'manage_financials'::text, s.branch_id)))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM student_financial_accounts s
  WHERE ((s.student_id = s.student_id) AND user_has_permission((select auth.uid()), 'manage_financials'::text, s.branch_id)))));

ALTER POLICY "portfolio_projects_admin_all" ON public."portfolio_projects"
  USING ((user_has_permission((select auth.uid()), 'manage_system'::text) OR user_has_permission((select auth.uid()), 'manage_students'::text)))
  WITH CHECK ((user_has_permission((select auth.uid()), 'manage_system'::text) OR user_has_permission((select auth.uid()), 'manage_students'::text)));

ALTER POLICY "portfolio_projects_instructor_read" ON public."portfolio_projects"
  USING ((student_id IN ( SELECT gs.student_id
   FROM ((group_students gs
     JOIN group_courses gc ON ((gc.group_id = gs.group_id)))
     JOIN instructors i ON (((i.id = gc.instructor_id) OR (EXISTS ( SELECT 1
           FROM group_instructors gi
          WHERE ((gi.group_id = gs.group_id) AND (gi.instructor_id = i.id)))))))
  WHERE ((i.user_id = (select auth.uid())) AND (gs.status = 'active'::text)))));

ALTER POLICY "portfolio_projects_instructor_update" ON public."portfolio_projects"
  USING ((student_id IN ( SELECT gs.student_id
   FROM ((group_students gs
     JOIN group_courses gc ON ((gc.group_id = gs.group_id)))
     JOIN instructors i ON (((i.id = gc.instructor_id) OR (EXISTS ( SELECT 1
           FROM group_instructors gi
          WHERE ((gi.group_id = gs.group_id) AND (gi.instructor_id = i.id)))))))
  WHERE ((i.user_id = (select auth.uid())) AND (gs.status = 'active'::text)))));

ALTER POLICY "portfolio_projects_parent_read" ON public."portfolio_projects"
  USING ((student_id IN ( SELECT ps.student_id
   FROM (parent_students ps
     JOIN parents p ON ((p.id = ps.parent_id)))
  WHERE (p.user_id = (select auth.uid())))));

ALTER POLICY "portfolio_projects_self_read" ON public."portfolio_projects"
  USING ((student_id IN ( SELECT students.id
   FROM students
  WHERE (students.user_id = (select auth.uid())))));

ALTER POLICY "portfolio_projects_student_insert" ON public."portfolio_projects"
  WITH CHECK ((student_id IN ( SELECT students.id
   FROM students
  WHERE (students.user_id = (select auth.uid())))));

ALTER POLICY "portfolio_projects_student_update" ON public."portfolio_projects"
  USING ((student_id IN ( SELECT students.id
   FROM students
  WHERE (students.user_id = (select auth.uid())))))
  WITH CHECK ((student_id IN ( SELECT students.id
   FROM students
  WHERE (students.user_id = (select auth.uid())))));

ALTER POLICY "profiles_self_read" ON public."profiles"
  USING ((user_id = (select auth.uid())));

ALTER POLICY "profiles_self_update" ON public."profiles"
  USING ((user_id = (select auth.uid())));

ALTER POLICY "schedules_manage" ON public."schedules"
  USING (user_has_permission((select auth.uid()), 'manage_schedule'::text, branch_id))
  WITH CHECK (user_has_permission((select auth.uid()), 'manage_schedule'::text, branch_id));

ALTER POLICY "schedules_read" ON public."schedules"
  USING (((branch_id IN ( SELECT DISTINCT user_roles.branch_id
   FROM user_roles
  WHERE ((user_roles.user_id = (select auth.uid())) AND (user_roles.branch_id IS NOT NULL)))) OR user_has_permission((select auth.uid()), 'manage_system'::text)));

ALTER POLICY "semester_courses_manage" ON public."semester_courses"
  USING (user_has_permission((select auth.uid()), 'manage_curriculum'::text))
  WITH CHECK (user_has_permission((select auth.uid()), 'manage_curriculum'::text));

ALTER POLICY "semester_courses_read" ON public."semester_courses"
  USING (((select auth.uid()) IS NOT NULL));

ALTER POLICY "semester_enrollments_manage" ON public."semester_enrollments"
  USING ((user_has_permission((select auth.uid()), 'manage_students'::text, branch_id) OR user_has_permission((select auth.uid()), 'manage_system'::text)))
  WITH CHECK ((user_has_permission((select auth.uid()), 'manage_students'::text, branch_id) OR user_has_permission((select auth.uid()), 'manage_system'::text)));

ALTER POLICY "semester_enrollments_parent" ON public."semester_enrollments"
  USING ((student_id IN ( SELECT ps.student_id
   FROM (parent_students ps
     JOIN parents p ON ((p.id = ps.parent_id)))
  WHERE (p.user_id = (select auth.uid())))));

ALTER POLICY "semester_enrollments_self" ON public."semester_enrollments"
  USING ((student_id IN ( SELECT students.id
   FROM students
  WHERE (students.user_id = (select auth.uid())))));

ALTER POLICY "semester_enrollments_staff" ON public."semester_enrollments"
  USING ((user_has_permission((select auth.uid()), 'manage_students'::text, branch_id) OR user_has_permission((select auth.uid()), 'manage_system'::text)));

ALTER POLICY "semesters_manage" ON public."semesters"
  USING (user_has_permission((select auth.uid()), 'manage_system'::text))
  WITH CHECK (user_has_permission((select auth.uid()), 'manage_system'::text));

ALTER POLICY "semesters_read" ON public."semesters"
  USING (((select auth.uid()) IS NOT NULL));

ALTER POLICY "semesters_read_by_branch_member" ON public."semesters"
  USING (((branch_id IN ( SELECT user_roles.branch_id
   FROM user_roles
  WHERE ((user_roles.user_id = (select auth.uid())) AND (user_roles.branch_id IS NOT NULL)))) OR user_has_permission((select auth.uid()), 'manage_system'::text)));

ALTER POLICY "feedback_admin_all" ON public."session_feedback"
  USING ((user_has_permission((select auth.uid()), 'manage_system'::text) OR user_has_permission((select auth.uid()), 'manage_attendance'::text)))
  WITH CHECK ((user_has_permission((select auth.uid()), 'manage_system'::text) OR user_has_permission((select auth.uid()), 'manage_attendance'::text)));

ALTER POLICY "feedback_student_insert" ON public."session_feedback"
  WITH CHECK ((student_id IN ( SELECT students.id
   FROM students
  WHERE (students.user_id = (select auth.uid())))));

ALTER POLICY "feedback_student_read_own" ON public."session_feedback"
  USING ((student_id IN ( SELECT students.id
   FROM students
  WHERE (students.user_id = (select auth.uid())))));

ALTER POLICY "super_admin_sma" ON public."session_milestone_alerts"
  USING ((EXISTS ( SELECT 1
   FROM (user_roles ur
     JOIN roles r ON ((r.id = ur.role_id)))
  WHERE ((ur.user_id = (select auth.uid())) AND (r.name = 'super_admin'::text)))));

ALTER POLICY "tl_sma_own_branches" ON public."session_milestone_alerts"
  USING ((EXISTS ( SELECT 1
   FROM (user_roles ur
     JOIN roles r ON ((r.id = ur.role_id)))
  WHERE ((ur.user_id = (select auth.uid())) AND (r.name = 'team_leader'::text) AND (ur.branch_id = session_milestone_alerts.branch_id)))));

ALTER POLICY "sp_super_admin" ON public."session_payments"
  USING ((EXISTS ( SELECT 1
   FROM (instructors i
     JOIN instructor_compensation ic ON ((ic.instructor_id = i.id)))
  WHERE ((i.id = ic.instructor_id) AND user_has_permission((select auth.uid()), 'manage_financials'::text, ic.branch_id)))))
  WITH CHECK (true);

ALTER POLICY "recordings_manage" ON public."session_recordings"
  USING (user_has_permission((select auth.uid()), 'manage_schedule'::text, branch_id));

ALTER POLICY "recordings_read_by_parent" ON public."session_recordings"
  USING (((visible_to_parents = true) AND ((expires_at IS NULL) OR (expires_at > now())) AND (schedule_id IN ( SELECT s.id
   FROM ((((schedules s
     JOIN group_courses gc ON ((gc.id = s.group_course_id)))
     JOIN group_students gs ON ((gs.group_id = gc.group_id)))
     JOIN parent_students ps ON ((ps.student_id = gs.student_id)))
     JOIN parents p ON ((p.id = ps.parent_id)))
  WHERE (p.user_id = (select auth.uid()))))));

ALTER POLICY "recordings_read_by_student" ON public."session_recordings"
  USING (((visible_to_students = true) AND ((expires_at IS NULL) OR (expires_at > now())) AND (schedule_id IN ( SELECT s.id
   FROM (((schedules s
     JOIN group_courses gc ON ((gc.id = s.group_course_id)))
     JOIN group_students gs ON ((gs.group_id = gc.group_id)))
     JOIN students st ON ((st.id = gs.student_id)))
  WHERE (st.user_id = (select auth.uid()))))));

ALTER POLICY "settings_read_own" ON public."settings"
  USING ((((entity_type = 'user'::text) AND (entity_id = (select auth.uid()))) OR user_has_permission((select auth.uid()), 'manage_settings'::text)));

ALTER POLICY "achievements_admin_all" ON public."student_achievements"
  USING ((user_has_permission((select auth.uid()), 'manage_system'::text) OR user_has_permission((select auth.uid()), 'manage_students'::text)))
  WITH CHECK ((user_has_permission((select auth.uid()), 'manage_system'::text) OR user_has_permission((select auth.uid()), 'manage_students'::text)));

ALTER POLICY "achievements_parent_read" ON public."student_achievements"
  USING ((student_id IN ( SELECT ps.student_id
   FROM (parent_students ps
     JOIN parents p ON ((p.id = ps.parent_id)))
  WHERE (p.user_id = (select auth.uid())))));

ALTER POLICY "achievements_self_read" ON public."student_achievements"
  USING ((student_id IN ( SELECT students.id
   FROM students
  WHERE (students.user_id = (select auth.uid())))));

ALTER POLICY "badges_admin_all" ON public."student_badges"
  USING ((user_has_permission((select auth.uid()), 'manage_system'::text) OR user_has_permission((select auth.uid()), 'manage_students'::text)))
  WITH CHECK ((user_has_permission((select auth.uid()), 'manage_system'::text) OR user_has_permission((select auth.uid()), 'manage_students'::text)));

ALTER POLICY "badges_parent_read" ON public."student_badges"
  USING ((student_id IN ( SELECT ps.student_id
   FROM (parent_students ps
     JOIN parents p ON ((p.id = ps.parent_id)))
  WHERE (p.user_id = (select auth.uid())))));

ALTER POLICY "badges_self_read" ON public."student_badges"
  USING ((student_id IN ( SELECT students.id
   FROM students
  WHERE (students.user_id = (select auth.uid())))));

ALTER POLICY "student_certificates_admin" ON public."student_certificates"
  USING (user_has_permission((select auth.uid()), 'manage_system'::text))
  WITH CHECK (user_has_permission((select auth.uid()), 'manage_system'::text));

ALTER POLICY "student_certificates_parent" ON public."student_certificates"
  USING ((student_id IN ( SELECT ps.student_id
   FROM (parent_students ps
     JOIN parents p ON ((p.id = ps.parent_id)))
  WHERE (p.user_id = (select auth.uid())))));

ALTER POLICY "student_certificates_self" ON public."student_certificates"
  USING ((student_id IN ( SELECT students.id
   FROM students
  WHERE (students.user_id = (select auth.uid())))));

ALTER POLICY "scp_admin_all" ON public."student_course_progress"
  USING ((user_has_permission((select auth.uid()), 'manage_system'::text) OR user_has_permission((select auth.uid()), 'manage_students'::text)))
  WITH CHECK ((user_has_permission((select auth.uid()), 'manage_system'::text) OR user_has_permission((select auth.uid()), 'manage_students'::text)));

ALTER POLICY "scp_instructor_read" ON public."student_course_progress"
  USING ((group_id IN ( SELECT gi.group_id
   FROM (group_instructors gi
     JOIN instructors i ON ((i.id = gi.instructor_id)))
  WHERE (i.user_id = (select auth.uid())))));

ALTER POLICY "scp_parent_read" ON public."student_course_progress"
  USING ((student_id IN ( SELECT ps.student_id
   FROM (parent_students ps
     JOIN parents p ON ((p.id = ps.parent_id)))
  WHERE (p.user_id = (select auth.uid())))));

ALTER POLICY "scp_self_read" ON public."student_course_progress"
  USING ((student_id IN ( SELECT students.id
   FROM students
  WHERE (students.user_id = (select auth.uid())))));

ALTER POLICY "student_own_enrollments" ON public."student_enrollments"
  USING ((student_id IN ( SELECT students.id
   FROM students
  WHERE (students.user_id = (select auth.uid())))));

ALTER POLICY "super_admin_enrollments" ON public."student_enrollments"
  USING ((EXISTS ( SELECT 1
   FROM (user_roles ur
     JOIN roles r ON ((r.id = ur.role_id)))
  WHERE ((ur.user_id = (select auth.uid())) AND (r.name = 'super_admin'::text)))));

ALTER POLICY "tl_enrollments_own_branches" ON public."student_enrollments"
  USING ((EXISTS ( SELECT 1
   FROM (user_roles ur
     JOIN roles r ON ((r.id = ur.role_id)))
  WHERE ((ur.user_id = (select auth.uid())) AND (r.name = 'team_leader'::text) AND (ur.branch_id = student_enrollments.branch_id)))));

ALTER POLICY "sfa_parent_read" ON public."student_financial_accounts"
  USING ((student_id IN ( SELECT ps.student_id
   FROM (parent_students ps
     JOIN parents p ON ((p.id = ps.parent_id)))
  WHERE ((p.user_id = (select auth.uid())) AND (ps.can_view_financials = true)))));

ALTER POLICY "sfa_super_admin" ON public."student_financial_accounts"
  USING (user_has_permission((select auth.uid()), 'manage_financials'::text, branch_id))
  WITH CHECK (user_has_permission((select auth.uid()), 'manage_financials'::text, branch_id));

ALTER POLICY "sfa_team_leader_read" ON public."student_financial_accounts"
  USING (user_has_permission((select auth.uid()), 'read_financials'::text, branch_id));

ALTER POLICY "grade_summaries_parent_read" ON public."student_grade_summaries"
  USING (((student_id IN ( SELECT ps.student_id
   FROM (parent_students ps
     JOIN parents p ON ((p.id = ps.parent_id)))
  WHERE (p.user_id = (select auth.uid())))) OR (student_id IN ( SELECT students.id
   FROM students
  WHERE (students.user_id = (select auth.uid())))) OR (EXISTS ( SELECT 1
   FROM students s
  WHERE ((s.id = student_grade_summaries.student_id) AND user_has_permission((select auth.uid()), 'read_grades'::text, s.branch_id))))));

ALTER POLICY "student_notes_author_all" ON public."student_notes"
  USING ((author_id = (select auth.uid())))
  WITH CHECK ((author_id = (select auth.uid())));

ALTER POLICY "student_notes_manager_read" ON public."student_notes"
  USING ((student_id IN ( SELECT s.id
   FROM students s
  WHERE user_has_permission((select auth.uid()), 'manage_students'::text, s.branch_id))));

ALTER POLICY "portfolio_admin_all" ON public."student_portfolios"
  USING ((user_has_permission((select auth.uid()), 'manage_system'::text) OR user_has_permission((select auth.uid()), 'manage_students'::text)))
  WITH CHECK ((user_has_permission((select auth.uid()), 'manage_system'::text) OR user_has_permission((select auth.uid()), 'manage_students'::text)));

ALTER POLICY "portfolio_instructor_read" ON public."student_portfolios"
  USING ((student_id IN ( SELECT gs.student_id
   FROM ((group_students gs
     JOIN group_courses gc ON ((gc.group_id = gs.group_id)))
     JOIN instructors i ON ((i.id = ( SELECT gi.instructor_id
           FROM group_instructors gi
          WHERE (gi.group_id = gs.group_id)
         LIMIT 1))))
  WHERE ((i.user_id = (select auth.uid())) AND (gs.status = 'active'::text)))));

ALTER POLICY "portfolio_parent_read" ON public."student_portfolios"
  USING ((student_id IN ( SELECT ps.student_id
   FROM (parent_students ps
     JOIN parents p ON ((p.id = ps.parent_id)))
  WHERE (p.user_id = (select auth.uid())))));

ALTER POLICY "portfolio_self_read" ON public."student_portfolios"
  USING ((student_id IN ( SELECT students.id
   FROM students
  WHERE (students.user_id = (select auth.uid())))));

ALTER POLICY "portfolio_student_insert" ON public."student_portfolios"
  WITH CHECK ((student_id IN ( SELECT students.id
   FROM students
  WHERE (students.user_id = (select auth.uid())))));

ALTER POLICY "student_progress_read" ON public."student_progress"
  USING (((student_id IN ( SELECT students.id
   FROM students
  WHERE (students.user_id = (select auth.uid())))) OR (student_id IN ( SELECT ps.student_id
   FROM (parent_students ps
     JOIN parents p ON ((p.id = ps.parent_id)))
  WHERE (p.user_id = (select auth.uid())))) OR (EXISTS ( SELECT 1
   FROM students s
  WHERE ((s.id = student_progress.student_id) AND user_has_permission((select auth.uid()), 'manage_students'::text, s.branch_id))))));

ALTER POLICY "student_projects_admin" ON public."student_projects"
  USING (user_has_permission((select auth.uid()), 'manage_curriculum'::text))
  WITH CHECK (user_has_permission((select auth.uid()), 'manage_curriculum'::text));

ALTER POLICY "student_projects_parent_read" ON public."student_projects"
  USING (((deleted_at IS NULL) AND (student_id IN ( SELECT ps.student_id
   FROM (parent_students ps
     JOIN parents p ON ((p.id = ps.parent_id)))
  WHERE (p.user_id = (select auth.uid()))))));

ALTER POLICY "student_projects_self" ON public."student_projects"
  USING (((deleted_at IS NULL) AND (student_id IN ( SELECT students.id
   FROM students
  WHERE (students.user_id = (select auth.uid()))))));

ALTER POLICY "students_read_by_branch_staff" ON public."students"
  USING (((deleted_at IS NULL) AND ((user_id = (select auth.uid())) OR user_has_permission((select auth.uid()), 'manage_students'::text, branch_id) OR user_has_permission((select auth.uid()), 'manage_system'::text))));

ALTER POLICY "students_read_by_parent" ON public."students"
  USING (((deleted_at IS NULL) AND (id IN ( SELECT ps.student_id
   FROM (parent_students ps
     JOIN parents p ON ((p.id = ps.parent_id)))
  WHERE (p.user_id = (select auth.uid()))))));

ALTER POLICY "students_update_by_staff" ON public."students"
  USING (user_has_permission((select auth.uid()), 'manage_students'::text, branch_id));

ALTER POLICY "students_write_by_staff" ON public."students"
  WITH CHECK (user_has_permission((select auth.uid()), 'manage_students'::text, branch_id));

ALTER POLICY "submissions_grade" ON public."submissions"
  USING (user_has_permission((select auth.uid()), 'grade_assignments'::text));

ALTER POLICY "submissions_instructor_read" ON public."submissions"
  USING ((assignment_id IN ( SELECT a.id
   FROM (((((assignments a
     JOIN lessons l ON ((l.id = a.lesson_id)))
     JOIN course_modules m ON ((m.id = l.module_id)))
     JOIN group_courses gc ON ((gc.course_id = m.course_id)))
     JOIN group_instructors gi ON ((gi.group_id = gc.group_id)))
     JOIN instructors i ON ((i.id = gi.instructor_id)))
  WHERE (i.user_id = (select auth.uid())))));

ALTER POLICY "submissions_self" ON public."submissions"
  USING ((student_id IN ( SELECT students.id
   FROM students
  WHERE (students.user_id = (select auth.uid())))));

ALTER POLICY "track_courses_manage" ON public."track_courses"
  USING (user_has_permission((select auth.uid()), 'manage_system'::text))
  WITH CHECK (user_has_permission((select auth.uid()), 'manage_system'::text));

ALTER POLICY "track_courses_read" ON public."track_courses"
  USING ((track_id IN ( SELECT learning_tracks.id
   FROM learning_tracks
  WHERE ((learning_tracks.deleted_at IS NULL) AND ((learning_tracks.is_published = true) OR user_has_permission((select auth.uid()), 'manage_system'::text))))));

ALTER POLICY "user_permissions_admin_delete" ON public."user_permissions"
  USING ((user_has_permission((select auth.uid()), 'manage_permissions'::text) OR user_has_permission((select auth.uid()), 'manage_system'::text)));

ALTER POLICY "user_permissions_admin_insert" ON public."user_permissions"
  WITH CHECK ((user_has_permission((select auth.uid()), 'manage_permissions'::text) OR user_has_permission((select auth.uid()), 'manage_system'::text)));

ALTER POLICY "user_permissions_self_read" ON public."user_permissions"
  USING (((user_id = (select auth.uid())) OR user_has_permission((select auth.uid()), 'manage_permissions'::text) OR user_has_permission((select auth.uid()), 'manage_system'::text)));

ALTER POLICY "user_roles_admin_delete" ON public."user_roles"
  USING (user_has_permission((select auth.uid()), 'manage_permissions'::text));

ALTER POLICY "user_roles_admin_insert" ON public."user_roles"
  WITH CHECK (user_has_permission((select auth.uid()), 'manage_permissions'::text));

ALTER POLICY "user_roles_self_read" ON public."user_roles"
  USING (((user_id = (select auth.uid())) OR user_has_permission((select auth.uid()), 'manage_permissions'::text) OR user_has_permission((select auth.uid()), 'manage_users'::text)));

ALTER POLICY "users_self_read" ON public."users"
  USING ((id = (select auth.uid())));

ALTER POLICY "users_self_update" ON public."users"
  USING ((id = (select auth.uid())));

