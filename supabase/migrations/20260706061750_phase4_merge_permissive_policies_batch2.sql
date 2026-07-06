-- Phase 4.3 (batch 2): merge multiple permissive policies into one-per-action.
-- Same behavior-preserving pattern as batch 1.

-- certificate_templates
DROP POLICY IF EXISTS cert_templates_admin_all ON public.certificate_templates;
DROP POLICY IF EXISTS certificate_templates_manage ON public.certificate_templates;
DROP POLICY IF EXISTS cert_templates_auth_read ON public.certificate_templates;
DROP POLICY IF EXISTS certificate_templates_read ON public.certificate_templates;

CREATE POLICY certificate_templates_write_insert ON public.certificate_templates
  FOR INSERT WITH CHECK (
    (user_has_permission((select auth.uid()), 'manage_system'::text) OR user_has_permission((select auth.uid()), 'manage_certificates'::text))
    OR (user_has_permission((select auth.uid()), 'manage_system'::text))
  );

CREATE POLICY certificate_templates_write_update ON public.certificate_templates
  FOR UPDATE USING (
    (user_has_permission((select auth.uid()), 'manage_system'::text) OR user_has_permission((select auth.uid()), 'manage_certificates'::text))
    OR (user_has_permission((select auth.uid()), 'manage_system'::text))
  )
  WITH CHECK (
    (user_has_permission((select auth.uid()), 'manage_system'::text) OR user_has_permission((select auth.uid()), 'manage_certificates'::text))
    OR (user_has_permission((select auth.uid()), 'manage_system'::text))
  );

CREATE POLICY certificate_templates_write_delete ON public.certificate_templates
  FOR DELETE USING (
    (user_has_permission((select auth.uid()), 'manage_system'::text) OR user_has_permission((select auth.uid()), 'manage_certificates'::text))
    OR (user_has_permission((select auth.uid()), 'manage_system'::text))
  );

CREATE POLICY certificate_templates_select_merged ON public.certificate_templates
  FOR SELECT USING (
    (user_has_permission((select auth.uid()), 'manage_system'::text) OR user_has_permission((select auth.uid()), 'manage_certificates'::text))
    OR (user_has_permission((select auth.uid()), 'manage_system'::text))
    OR (((select auth.uid()) IS NOT NULL) AND (is_active = true))
    OR ((is_active = true) OR user_has_permission((select auth.uid()), 'manage_system'::text))
  );

-- portfolio_projects
DROP POLICY IF EXISTS portfolio_projects_admin_all ON public.portfolio_projects;
DROP POLICY IF EXISTS portfolio_projects_student_insert ON public.portfolio_projects;
DROP POLICY IF EXISTS portfolio_projects_instructor_read ON public.portfolio_projects;
DROP POLICY IF EXISTS portfolio_projects_parent_read ON public.portfolio_projects;
DROP POLICY IF EXISTS portfolio_projects_public_read ON public.portfolio_projects;
DROP POLICY IF EXISTS portfolio_projects_self_read ON public.portfolio_projects;
DROP POLICY IF EXISTS portfolio_projects_instructor_update ON public.portfolio_projects;
DROP POLICY IF EXISTS portfolio_projects_student_update ON public.portfolio_projects;

CREATE POLICY portfolio_projects_write_insert ON public.portfolio_projects
  FOR INSERT WITH CHECK (
    (user_has_permission((select auth.uid()), 'manage_system'::text) OR user_has_permission((select auth.uid()), 'manage_students'::text))
    OR (student_id IN ( SELECT students.id FROM students WHERE (students.user_id = (select auth.uid()))))
  );

CREATE POLICY portfolio_projects_write_update ON public.portfolio_projects
  FOR UPDATE USING (
    (user_has_permission((select auth.uid()), 'manage_system'::text) OR user_has_permission((select auth.uid()), 'manage_students'::text))
    OR (student_id IN ( SELECT gs.student_id FROM ((group_students gs JOIN group_courses gc ON ((gc.group_id = gs.group_id))) JOIN instructors i ON (((i.id = gc.instructor_id) OR (EXISTS ( SELECT 1 FROM group_instructors gi WHERE ((gi.group_id = gs.group_id) AND (gi.instructor_id = i.id))))))) WHERE ((i.user_id = (select auth.uid())) AND (gs.status = 'active'::text))))
    OR (student_id IN ( SELECT students.id FROM students WHERE (students.user_id = (select auth.uid()))))
  )
  WITH CHECK (
    (user_has_permission((select auth.uid()), 'manage_system'::text) OR user_has_permission((select auth.uid()), 'manage_students'::text))
    OR (student_id IN ( SELECT gs.student_id FROM ((group_students gs JOIN group_courses gc ON ((gc.group_id = gs.group_id))) JOIN instructors i ON (((i.id = gc.instructor_id) OR (EXISTS ( SELECT 1 FROM group_instructors gi WHERE ((gi.group_id = gs.group_id) AND (gi.instructor_id = i.id))))))) WHERE ((i.user_id = (select auth.uid())) AND (gs.status = 'active'::text))))
    OR (student_id IN ( SELECT students.id FROM students WHERE (students.user_id = (select auth.uid()))))
  );

CREATE POLICY portfolio_projects_write_delete ON public.portfolio_projects
  FOR DELETE USING (
    user_has_permission((select auth.uid()), 'manage_system'::text) OR user_has_permission((select auth.uid()), 'manage_students'::text)
  );

CREATE POLICY portfolio_projects_select_merged ON public.portfolio_projects
  FOR SELECT USING (
    (user_has_permission((select auth.uid()), 'manage_system'::text) OR user_has_permission((select auth.uid()), 'manage_students'::text))
    OR (student_id IN ( SELECT gs.student_id FROM ((group_students gs JOIN group_courses gc ON ((gc.group_id = gs.group_id))) JOIN instructors i ON (((i.id = gc.instructor_id) OR (EXISTS ( SELECT 1 FROM group_instructors gi WHERE ((gi.group_id = gs.group_id) AND (gi.instructor_id = i.id))))))) WHERE ((i.user_id = (select auth.uid())) AND (gs.status = 'active'::text))))
    OR (student_id IN ( SELECT ps.student_id FROM (parent_students ps JOIN parents p ON ((p.id = ps.parent_id))) WHERE (p.user_id = (select auth.uid()))))
    OR ((is_public = true) AND (is_archived = false))
    OR (student_id IN ( SELECT students.id FROM students WHERE (students.user_id = (select auth.uid()))))
  );

-- session_feedback
DROP POLICY IF EXISTS feedback_admin_all ON public.session_feedback;
DROP POLICY IF EXISTS feedback_student_insert ON public.session_feedback;
DROP POLICY IF EXISTS feedback_student_read_own ON public.session_feedback;

CREATE POLICY session_feedback_write_insert ON public.session_feedback
  FOR INSERT WITH CHECK (
    (user_has_permission((select auth.uid()), 'manage_system'::text) OR user_has_permission((select auth.uid()), 'manage_attendance'::text))
    OR (student_id IN ( SELECT students.id FROM students WHERE (students.user_id = (select auth.uid()))))
  );

CREATE POLICY session_feedback_write_update ON public.session_feedback
  FOR UPDATE USING (user_has_permission((select auth.uid()), 'manage_system'::text) OR user_has_permission((select auth.uid()), 'manage_attendance'::text))
  WITH CHECK (user_has_permission((select auth.uid()), 'manage_system'::text) OR user_has_permission((select auth.uid()), 'manage_attendance'::text));

CREATE POLICY session_feedback_write_delete ON public.session_feedback
  FOR DELETE USING (user_has_permission((select auth.uid()), 'manage_system'::text) OR user_has_permission((select auth.uid()), 'manage_attendance'::text));

CREATE POLICY session_feedback_select_merged ON public.session_feedback
  FOR SELECT USING (
    (user_has_permission((select auth.uid()), 'manage_system'::text) OR user_has_permission((select auth.uid()), 'manage_attendance'::text))
    OR (student_id IN ( SELECT students.id FROM students WHERE (students.user_id = (select auth.uid()))))
  );

-- student_portfolios
DROP POLICY IF EXISTS portfolio_admin_all ON public.student_portfolios;
DROP POLICY IF EXISTS portfolio_student_insert ON public.student_portfolios;
DROP POLICY IF EXISTS portfolio_instructor_read ON public.student_portfolios;
DROP POLICY IF EXISTS portfolio_parent_read ON public.student_portfolios;
DROP POLICY IF EXISTS portfolio_self_read ON public.student_portfolios;

CREATE POLICY student_portfolios_write_insert ON public.student_portfolios
  FOR INSERT WITH CHECK (
    (user_has_permission((select auth.uid()), 'manage_system'::text) OR user_has_permission((select auth.uid()), 'manage_students'::text))
    OR (student_id IN ( SELECT students.id FROM students WHERE (students.user_id = (select auth.uid()))))
  );

CREATE POLICY student_portfolios_write_update ON public.student_portfolios
  FOR UPDATE USING (user_has_permission((select auth.uid()), 'manage_system'::text) OR user_has_permission((select auth.uid()), 'manage_students'::text))
  WITH CHECK (user_has_permission((select auth.uid()), 'manage_system'::text) OR user_has_permission((select auth.uid()), 'manage_students'::text));

CREATE POLICY student_portfolios_write_delete ON public.student_portfolios
  FOR DELETE USING (user_has_permission((select auth.uid()), 'manage_system'::text) OR user_has_permission((select auth.uid()), 'manage_students'::text));

CREATE POLICY student_portfolios_select_merged ON public.student_portfolios
  FOR SELECT USING (
    (user_has_permission((select auth.uid()), 'manage_system'::text) OR user_has_permission((select auth.uid()), 'manage_students'::text))
    OR (student_id IN ( SELECT gs.student_id FROM ((group_students gs JOIN group_courses gc ON ((gc.group_id = gs.group_id))) JOIN instructors i ON ((i.id = ( SELECT gi.instructor_id FROM group_instructors gi WHERE (gi.group_id = gs.group_id) LIMIT 1)))) WHERE ((i.user_id = (select auth.uid())) AND (gs.status = 'active'::text))))
    OR (student_id IN ( SELECT ps.student_id FROM (parent_students ps JOIN parents p ON ((p.id = ps.parent_id))) WHERE (p.user_id = (select auth.uid()))))
    OR (student_id IN ( SELECT students.id FROM students WHERE (students.user_id = (select auth.uid()))))
  );

-- student_projects
DROP POLICY IF EXISTS student_projects_admin ON public.student_projects;
DROP POLICY IF EXISTS student_projects_self ON public.student_projects;
DROP POLICY IF EXISTS student_projects_approved_read ON public.student_projects;
DROP POLICY IF EXISTS student_projects_parent_read ON public.student_projects;

CREATE POLICY student_projects_write_insert ON public.student_projects
  FOR INSERT WITH CHECK (
    user_has_permission((select auth.uid()), 'manage_curriculum'::text)
    OR ((deleted_at IS NULL) AND (student_id IN ( SELECT students.id FROM students WHERE (students.user_id = (select auth.uid())))))
  );

CREATE POLICY student_projects_write_update ON public.student_projects
  FOR UPDATE USING (
    user_has_permission((select auth.uid()), 'manage_curriculum'::text)
    OR ((deleted_at IS NULL) AND (student_id IN ( SELECT students.id FROM students WHERE (students.user_id = (select auth.uid())))))
  )
  WITH CHECK (
    user_has_permission((select auth.uid()), 'manage_curriculum'::text)
    OR ((deleted_at IS NULL) AND (student_id IN ( SELECT students.id FROM students WHERE (students.user_id = (select auth.uid())))))
  );

CREATE POLICY student_projects_write_delete ON public.student_projects
  FOR DELETE USING (
    user_has_permission((select auth.uid()), 'manage_curriculum'::text)
    OR ((deleted_at IS NULL) AND (student_id IN ( SELECT students.id FROM students WHERE (students.user_id = (select auth.uid())))))
  );

CREATE POLICY student_projects_select_merged ON public.student_projects
  FOR SELECT USING (
    user_has_permission((select auth.uid()), 'manage_curriculum'::text)
    OR ((deleted_at IS NULL) AND (student_id IN ( SELECT students.id FROM students WHERE (students.user_id = (select auth.uid())))))
    OR ((deleted_at IS NULL) AND (status = ANY (ARRAY['approved'::text, 'featured'::text])))
    OR ((deleted_at IS NULL) AND (student_id IN ( SELECT ps.student_id FROM (parent_students ps JOIN parents p ON ((p.id = ps.parent_id))) WHERE (p.user_id = (select auth.uid())))))
  );

-- submissions
DROP POLICY IF EXISTS submissions_self ON public.submissions;
DROP POLICY IF EXISTS submissions_instructor_read ON public.submissions;
DROP POLICY IF EXISTS submissions_grade ON public.submissions;

CREATE POLICY submissions_write_insert ON public.submissions
  FOR INSERT WITH CHECK (student_id IN ( SELECT students.id FROM students WHERE (students.user_id = (select auth.uid()))));

CREATE POLICY submissions_write_update ON public.submissions
  FOR UPDATE USING (
    (student_id IN ( SELECT students.id FROM students WHERE (students.user_id = (select auth.uid()))))
    OR (user_has_permission((select auth.uid()), 'grade_assignments'::text))
  )
  WITH CHECK (
    (student_id IN ( SELECT students.id FROM students WHERE (students.user_id = (select auth.uid()))))
    OR (user_has_permission((select auth.uid()), 'grade_assignments'::text))
  );

CREATE POLICY submissions_write_delete ON public.submissions
  FOR DELETE USING (student_id IN ( SELECT students.id FROM students WHERE (students.user_id = (select auth.uid()))));

CREATE POLICY submissions_select_merged ON public.submissions
  FOR SELECT USING (
    (student_id IN ( SELECT students.id FROM students WHERE (students.user_id = (select auth.uid()))))
    OR (assignment_id IN ( SELECT a.id FROM (((((assignments a JOIN lessons l ON ((l.id = a.lesson_id))) JOIN course_modules m ON ((m.id = l.module_id))) JOIN group_courses gc ON ((gc.course_id = m.course_id))) JOIN group_instructors gi ON ((gi.group_id = gc.group_id))) JOIN instructors i ON ((i.id = gi.instructor_id))) WHERE (i.user_id = (select auth.uid()))))
  );
