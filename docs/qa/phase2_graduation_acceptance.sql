-- Phase 2 Graduation Wizard — Production Acceptance QA
--
-- ============================================================
-- PREPARATION — run this BEFORE executing the QA body below
-- ============================================================
-- This script never hardcodes real production identifiers. It is
-- parameterized with psql client-side variables (`:'NAME'`) that you must
-- supply yourself, sourced fresh from the target database, every time you
-- run it. Do not commit a version of this file with real UUIDs filled in.
--
-- Step 1 — look up the required real rows (read-only queries, safe to run
-- directly against the target project):
--
--   -- Two distinct branches (any two will do):
--   SELECT id, name FROM public.branches ORDER BY name LIMIT 5;
--     -> BRANCH1_ID, BRANCH2_ID
--
--   -- A real instructor assigned to BRANCH1_ID:
--   SELECT id FROM public.instructors WHERE branch_id = '<BRANCH1_ID>' LIMIT 1;
--     -> INSTRUCTOR_ID
--
--   -- A real team_leader whose branch scope INCLUDES BRANCH1_ID
--   -- (a multi-branch TL is fine and closer to a realistic scenario):
--   SELECT ur.user_id FROM public.user_roles ur
--     JOIN public.roles r ON r.id = ur.role_id
--    WHERE r.name = 'team_leader' AND ur.branch_id = '<BRANCH1_ID>' LIMIT 1;
--     -> TEAM_LEADER_ID
--
--   -- A real super_admin (global role, no branch_id required):
--   SELECT ur.user_id FROM public.user_roles ur
--     JOIN public.roles r ON r.id = ur.role_id
--    WHERE r.name = 'super_admin' LIMIT 1;
--     -> SUPER_ADMIN_ID
--
--   -- Seven distinct real students enrolled at BRANCH1_ID. The script only
--   -- reads them and makes transaction-scoped, rolled-back writes — nothing
--   -- persists — but pick students you're comfortable using for this:
--   SELECT id FROM public.students WHERE branch_id = '<BRANCH1_ID>' LIMIT 7;
--     -> CONTINUING_STUDENT_ID, GRADUATING_STUDENT_ID, HOLD_STUDENT_ID,
--        REPEATING_STUDENT_ID, TRANSFERRING_STUDENT_ID, DROPPING_STUDENT_ID,
--        ARCHIVED_COHORT_STUDENT_ID
--   NOTE: ARCHIVED_COHORT_STUDENT_ID's underlying `students.id` is reused a
--   second time later in the script to source a "second team_leader, scoped
--   only to BRANCH2" test subject (the T6 permission checks) — the script
--   grants that same person's user_id a temporary, transaction-scoped
--   team_leader role on BRANCH2_ID. Pick a student who does not already
--   hold an elevated role, to keep the before/after role state clean.
--
--   -- One more real student with NO elevated role at all (plain
--   -- student/parent account) — the "unauthorized user" for T6:
--   SELECT s.id FROM public.students s
--    WHERE s.user_id NOT IN (SELECT user_id FROM public.user_roles) LIMIT 1;
--     -> UNAUTHORIZED_STUDENT_ID
--
-- Step 2 — run this file with `psql`, supplying every value found above via
-- `-v` (psql only, not a plain SQL executor — client-side `:'NAME'`
-- substitution happens before the query is ever sent to Postgres):
--
--   psql "$SUPABASE_DB_URL" \
--     -v BRANCH1_ID='<uuid>' -v BRANCH2_ID='<uuid>' \
--     -v INSTRUCTOR_ID='<uuid>' -v TEAM_LEADER_ID='<uuid>' \
--     -v SUPER_ADMIN_ID='<uuid>' \
--     -v CONTINUING_STUDENT_ID='<uuid>' -v GRADUATING_STUDENT_ID='<uuid>' \
--     -v HOLD_STUDENT_ID='<uuid>' -v REPEATING_STUDENT_ID='<uuid>' \
--     -v TRANSFERRING_STUDENT_ID='<uuid>' -v DROPPING_STUDENT_ID='<uuid>' \
--     -v ARCHIVED_COHORT_STUDENT_ID='<uuid>' -v UNAUTHORIZED_STUDENT_ID='<uuid>' \
--     -f docs/qa/phase2_graduation_acceptance.sql
--
-- The whole script runs inside one `BEGIN ... ROLLBACK` transaction — every
-- fixture, every commit, every assertion happens inside it, and the final
-- `ROLLBACK` guarantees nothing persists, regardless of which real rows
-- were supplied above.
-- ============================================================
--
-- Last confirmed result: 66/66 checks passed (2026-07-14). Full narrative
-- write-up in docs/PHASE2_ACCEPTANCE_REPORT.md.
--
-- Two REAL PRODUCTION BUGS were found and fixed via migrations during the
-- QA pass that produced that result (both already applied live, and both
-- written to supabase/migrations/ in this repo):
--   1. 20260714131000_fix_missing_renewal_of_column.sql
--      student_enrollments.renewal_of did not exist on the live table at all
--      (migration 0054's CREATE TABLE IF NOT EXISTS was a no-op against a
--      differently-shaped pre-existing table). This would have made 100% of
--      real graduation commits fail.
--   2. 20260714131500_fix_old_enrollment_status_transition.sql
--      commit_cohort_graduation() never transitioned the OLD enrollment's
--      status away from 'ACTIVE', so any real Continue/Repeat into the SAME
--      course (the common case) would violate the live
--      uq_student_enrollments_active_course unique constraint. Fixed by
--      transitioning old enrollment status to COMPLETED/PAUSED/DROPPED/
--      TRANSFERRED per decision (mirrors group_students.status handling).
--
-- Runs entirely inside one rolled-back transaction. Nothing persists.

BEGIN;

CREATE TEMP TABLE qa_results (n serial, check_name text, passed boolean, detail text) ON COMMIT DROP;

DO $QA$
DECLARE
  -- Real, pre-existing rows reused for this QA run — public.users.id has an FK
  -- to auth.users.id, so fabricating brand-new user/student/instructor
  -- identities isn't possible here. Everything below is either newly created
  -- (courses, groups, and their children — no auth dependency) or a real,
  -- already-existing identity borrowed read-only / with a transaction-scoped
  -- extra role grant that is rolled back at the end with everything else.
  -- All real IDs are supplied at runtime via psql variables — see
  -- "PREPARATION" above. Never hardcode a real UUID here.
  v_branch1 uuid := :'BRANCH1_ID';
  v_branch2 uuid := :'BRANCH2_ID';
  v_course_id uuid := gen_random_uuid();
  v_instr_id uuid := :'INSTRUCTOR_ID';
  v_tl_user uuid := :'TEAM_LEADER_ID';
  v_tl2_user uuid;                                            -- borrowed real user, granted a TEMP branch2-only team_leader role below
  v_sa_user uuid := :'SUPER_ADMIN_ID';
  v_unauth_user uuid;                                         -- borrowed real user with no elevated role (plain student account)
  v_role_tl uuid; v_role_sa uuid;
  v_s1 uuid := :'CONTINUING_STUDENT_ID';
  v_s2 uuid := :'GRADUATING_STUDENT_ID';
  v_s3 uuid := :'HOLD_STUDENT_ID';
  v_s4 uuid := :'REPEATING_STUDENT_ID';
  v_s5 uuid := :'TRANSFERRING_STUDENT_ID';
  v_s6 uuid := :'DROPPING_STUDENT_ID';
  v_s7 uuid := :'ARCHIVED_COHORT_STUDENT_ID';
  v_gs7 uuid := gen_random_uuid();
  v_old_group uuid := gen_random_uuid();
  v_other_group uuid := gen_random_uuid();
  v_archived_group uuid := gen_random_uuid();
  v_completed_group2 uuid := gen_random_uuid();
  v_gc_old uuid := gen_random_uuid();
  v_gc_other uuid := gen_random_uuid();
  v_sched1 uuid := gen_random_uuid();
  v_sched2 uuid := gen_random_uuid();
  v_enr1 uuid := gen_random_uuid(); v_gs1 uuid := gen_random_uuid();
  v_enr2 uuid := gen_random_uuid(); v_gs2 uuid := gen_random_uuid();
  v_enr3 uuid := gen_random_uuid(); v_gs3 uuid := gen_random_uuid();
  v_enr4 uuid := gen_random_uuid(); v_gs4 uuid := gen_random_uuid();
  v_enr5 uuid := gen_random_uuid(); v_gs5 uuid := gen_random_uuid();
  v_enr6 uuid := gen_random_uuid(); v_gs6 uuid := gen_random_uuid();
  v_cert1 uuid := gen_random_uuid();
  v_req_a uuid := gen_random_uuid();
  v_req_b uuid := gen_random_uuid();
  v_payload jsonb;
  v_result jsonb;
  v_count int;
  v_count2 int;
  v_bool boolean;
  v_pre_att text;
  v_post_att text;
  v_pre_cert text;
  v_post_cert text;
  v_pre_enr text;
  v_post_enr text;
BEGIN
  SELECT id INTO v_role_tl FROM public.roles WHERE name = 'team_leader';
  SELECT id INTO v_role_sa FROM public.roles WHERE name = 'super_admin';

  SELECT user_id INTO v_tl2_user FROM public.students WHERE id = :'ARCHIVED_COHORT_STUDENT_ID'::uuid;
  SELECT user_id INTO v_unauth_user FROM public.students WHERE id = :'UNAUTHORIZED_STUDENT_ID'::uuid;
  INSERT INTO public.user_roles (user_id, role_id, branch_id) VALUES (v_tl2_user, v_role_tl, v_branch2);

  INSERT INTO public.courses (id, branch_id, title, scope, is_published)
    VALUES (v_course_id, v_branch1, 'QA Robotics Course', 'branch', true);

  INSERT INTO public.groups (id, branch_id, name, type, status, day_of_week, time, start_date)
    VALUES (v_old_group, v_branch1, 'QA Robotics — Round 1', 'class', 'completed', 'saturday', '10:00', current_date - 90);
  INSERT INTO public.group_courses (id, group_id, course_id, instructor_id, status, total_sessions)
    VALUES (v_gc_old, v_old_group, v_course_id, v_instr_id, 'active', 10);
  INSERT INTO public.group_instructors (group_id, instructor_id, role, from_session, allocation_status)
    VALUES (v_old_group, v_instr_id, 'lead', 1, 'active');

  INSERT INTO public.groups (id, branch_id, name, type, status, day_of_week, time, start_date)
    VALUES (v_other_group, v_branch1, 'QA Robotics — Sunday Track', 'class', 'active', 'sunday', '12:00', current_date - 10);
  INSERT INTO public.group_courses (id, group_id, course_id, instructor_id, status)
    VALUES (v_gc_other, v_other_group, v_course_id, v_instr_id, 'active');

  INSERT INTO public.groups (id, branch_id, name, type, status)
    VALUES (v_archived_group, v_branch1, 'QA Archived Cohort', 'class', 'completed');
  INSERT INTO public.group_students (id, group_id, student_id, status, course_id)
    VALUES (v_gs7, v_archived_group, v_s7, 'active', v_course_id);
  UPDATE public.groups SET status = 'archived', archived_at = now() WHERE id = v_archived_group;

  INSERT INTO public.groups (id, branch_id, name, type, status)
    VALUES (v_completed_group2, v_branch1, 'QA Completed (not graduated)', 'class', 'completed');

  INSERT INTO public.schedules (id, group_course_id, branch_id, scheduled_at, duration_minutes, status, session_number, topic)
    VALUES
      (v_sched1, v_gc_old, v_branch1, now() - interval '20 days', 60, 'completed', 1, 'QA Topic 1'),
      (v_sched2, v_gc_old, v_branch1, now() - interval '13 days', 60, 'completed', 2, 'QA Topic 2');
  INSERT INTO public.attendance_records (schedule_id, student_id, status, recorded_by) VALUES
    (v_sched1, v_s1, 'present', v_tl_user), (v_sched1, v_s2, 'present', v_tl_user),
    (v_sched1, v_s3, 'absent',  v_tl_user), (v_sched1, v_s4, 'present', v_tl_user),
    (v_sched1, v_s5, 'late',    v_tl_user), (v_sched1, v_s6, 'present', v_tl_user),
    (v_sched2, v_s1, 'present', v_tl_user), (v_sched2, v_s2, 'present', v_tl_user),
    (v_sched2, v_s3, 'present', v_tl_user), (v_sched2, v_s4, 'absent',  v_tl_user),
    (v_sched2, v_s5, 'present', v_tl_user), (v_sched2, v_s6, 'present', v_tl_user);

  INSERT INTO public.group_students (id, group_id, student_id, status, course_id) VALUES
    (v_gs1, v_old_group, v_s1, 'active', v_course_id),
    (v_gs2, v_old_group, v_s2, 'active', v_course_id),
    (v_gs3, v_old_group, v_s3, 'active', v_course_id),
    (v_gs4, v_old_group, v_s4, 'active', v_course_id),
    (v_gs5, v_old_group, v_s5, 'active', v_course_id),
    (v_gs6, v_old_group, v_s6, 'active', v_course_id);
  INSERT INTO public.student_enrollments (id, student_id, branch_id, group_id, course_id, status, group_student_id) VALUES
    (v_enr1, v_s1, v_branch1, v_old_group, v_course_id, 'ACTIVE', v_gs1),
    (v_enr2, v_s2, v_branch1, v_old_group, v_course_id, 'ACTIVE', v_gs2),
    (v_enr3, v_s3, v_branch1, v_old_group, v_course_id, 'ACTIVE', v_gs3),
    (v_enr4, v_s4, v_branch1, v_old_group, v_course_id, 'ACTIVE', v_gs4),
    (v_enr5, v_s5, v_branch1, v_old_group, v_course_id, 'ACTIVE', v_gs5),
    (v_enr6, v_s6, v_branch1, v_old_group, v_course_id, 'ACTIVE', v_gs6);

  INSERT INTO public.certificates (id, certificate_code, student_id, certificate_type, title, recipient_name, course_id)
    VALUES (v_cert1, 'QA-CERT-0001', v_s2, 'course_completion', 'QA Course Completion', 'Student Two', v_course_id);

  SELECT md5(string_agg(schedule_id::text||student_id::text||status, ',' ORDER BY schedule_id, student_id))
    INTO v_pre_att FROM public.attendance_records WHERE schedule_id IN (v_sched1, v_sched2);
  SELECT md5(string_agg(id::text||status||coalesce(course_id::text,''), ',' ORDER BY id))
    INTO v_pre_cert FROM public.certificates WHERE id = v_cert1;
  SELECT md5(string_agg(id::text||coalesce(group_id::text,'')||coalesce(course_id::text,'')||branch_id::text||coalesce(start_date::text,'')||coalesce(renewal_of::text,''), ',' ORDER BY id))
    INTO v_pre_enr FROM public.student_enrollments WHERE id IN (v_enr1,v_enr2,v_enr3,v_enr4,v_enr5,v_enr6);
  INSERT INTO qa_results VALUES (DEFAULT, 'Fixtures created', true, 'old_group=' || v_old_group);

  BEGIN
    v_payload := jsonb_build_object(
      'old_group_id', v_old_group,
      'new_group', jsonb_build_object('branch_id', v_branch1, 'name', 'QA Round 2 (incomplete)', 'type', 'class',
        'capacity', 15, 'waitlist_capacity', 0, 'day_of_week', 'saturday', 'time', '10:00',
        'start_date', (current_date + 30)::text, 'robocode_share_percent', 100, 'course_id', v_course_id),
      'decisions', jsonb_build_array(
        jsonb_build_object('student_id', v_s1, 'old_enrollment_id', v_enr1, 'old_group_student_id', v_gs1, 'decision', 'continue')
      )
    );
    SELECT public.commit_cohort_graduation(v_payload, v_tl_user, gen_random_uuid(), NULL) INTO v_result;
    INSERT INTO qa_results VALUES (DEFAULT, 'T1 coverage guard rejects incomplete decisions', false, 'expected exception, none raised');
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO qa_results VALUES (DEFAULT, 'T1 coverage guard rejects incomplete decisions', SQLERRM LIKE '%explicit decision%', SQLERRM);
  END;

  SELECT graduated_at IS NULL INTO v_bool FROM public.groups WHERE id = v_old_group;
  INSERT INTO qa_results VALUES (DEFAULT, 'T1 old cohort untouched after rejected call', v_bool, 'graduated_at should still be NULL');

  BEGIN
    v_payload := jsonb_build_object(
      'old_group_id', v_old_group,
      'new_group', jsonb_build_object('branch_id', v_branch1, 'name', 'QA Round 2 (bad transfer)', 'type', 'class',
        'capacity', 15, 'waitlist_capacity', 0, 'day_of_week', 'saturday', 'time', '10:00',
        'start_date', (current_date + 30)::text, 'robocode_share_percent', 100, 'course_id', v_course_id),
      'decisions', jsonb_build_array(
        jsonb_build_object('student_id', v_s1, 'old_enrollment_id', v_enr1, 'old_group_student_id', v_gs1, 'decision', 'continue'),
        jsonb_build_object('student_id', v_s2, 'old_enrollment_id', v_enr2, 'old_group_student_id', v_gs2, 'decision', 'graduate'),
        jsonb_build_object('student_id', v_s3, 'old_enrollment_id', v_enr3, 'old_group_student_id', v_gs3, 'decision', 'hold'),
        jsonb_build_object('student_id', v_s4, 'old_enrollment_id', v_enr4, 'old_group_student_id', v_gs4, 'decision', 'repeat'),
        jsonb_build_object('student_id', v_s5, 'old_enrollment_id', v_enr5, 'old_group_student_id', v_gs5, 'decision', 'transfer', 'transfer_group_id', gen_random_uuid()),
        jsonb_build_object('student_id', v_s6, 'old_enrollment_id', v_enr6, 'old_group_student_id', v_gs6, 'decision', 'drop')
      )
    );
    SELECT public.commit_cohort_graduation(v_payload, v_tl_user, gen_random_uuid(), NULL) INTO v_result;
    INSERT INTO qa_results VALUES (DEFAULT, 'T2 invalid transfer target rejected', false, 'expected exception, none raised');
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO qa_results VALUES (DEFAULT, 'T2 invalid transfer target rejected', SQLERRM LIKE '%transfer target%', SQLERRM);
  END;

  SELECT count(*) INTO v_count FROM public.groups WHERE graduated_from_group_id = v_old_group;
  INSERT INTO qa_results VALUES (DEFAULT, 'T2 rollback: zero new groups after failed attempt', v_count = 0, 'count=' || v_count);
  SELECT count(*) INTO v_count FROM public.cohort_graduation_decisions WHERE old_group_id = v_old_group;
  INSERT INTO qa_results VALUES (DEFAULT, 'T2 rollback: zero decision rows after failed attempt', v_count = 0, 'count=' || v_count);
  SELECT count(*) INTO v_count FROM public.student_enrollments WHERE renewal_of IN (v_enr1,v_enr2,v_enr3,v_enr4,v_enr5,v_enr6);
  INSERT INTO qa_results VALUES (DEFAULT, 'T2 rollback: zero new enrollments after failed attempt', v_count = 0, 'count=' || v_count);
  SELECT graduated_at IS NULL INTO v_bool FROM public.groups WHERE id = v_old_group;
  INSERT INTO qa_results VALUES (DEFAULT, 'T2 old cohort still ungraduated after failed attempt', v_bool, '');

  v_payload := jsonb_build_object(
    'old_group_id', v_old_group,
    'new_group', jsonb_build_object('branch_id', v_branch1, 'semester_id', NULL, 'series_id', NULL,
      'name', 'QA Robotics — Round 2', 'code', NULL, 'type', 'class',
      'capacity', 15, 'waitlist_capacity', 0, 'day_of_week', 'saturday', 'time', '10:00',
      'start_date', (current_date + 30)::text, 'robocode_share_percent', 100, 'course_id', v_course_id),
    'decisions', jsonb_build_array(
      jsonb_build_object('student_id', v_s1, 'old_enrollment_id', v_enr1, 'old_group_student_id', v_gs1, 'decision', 'continue'),
      jsonb_build_object('student_id', v_s2, 'old_enrollment_id', v_enr2, 'old_group_student_id', v_gs2, 'decision', 'graduate'),
      jsonb_build_object('student_id', v_s3, 'old_enrollment_id', v_enr3, 'old_group_student_id', v_gs3, 'decision', 'hold'),
      jsonb_build_object('student_id', v_s4, 'old_enrollment_id', v_enr4, 'old_group_student_id', v_gs4, 'decision', 'repeat'),
      jsonb_build_object('student_id', v_s5, 'old_enrollment_id', v_enr5, 'old_group_student_id', v_gs5, 'decision', 'transfer', 'transfer_group_id', v_other_group),
      jsonb_build_object('student_id', v_s6, 'old_enrollment_id', v_enr6, 'old_group_student_id', v_gs6, 'decision', 'drop')
    )
  );
  SELECT public.commit_cohort_graduation(v_payload, v_tl_user, v_req_a, NULL) INTO v_result;

  INSERT INTO qa_results VALUES (DEFAULT, 'T3 commit succeeded', v_result ? 'new_group_id', v_result::text);
  INSERT INTO qa_results VALUES (DEFAULT, 'T3 replayed=false on first commit', (v_result->>'replayed') = 'false', v_result->>'replayed');
  INSERT INTO qa_results VALUES (DEFAULT, 'T3 decision_counts correct',
    (v_result->'decision_counts'->>'continue')::int = 1 AND (v_result->'decision_counts'->>'graduate')::int = 1
    AND (v_result->'decision_counts'->>'hold')::int = 1 AND (v_result->'decision_counts'->>'repeat')::int = 1
    AND (v_result->'decision_counts'->>'transfer')::int = 1 AND (v_result->'decision_counts'->>'drop')::int = 1,
    v_result->'decision_counts'#>>'{}');

  SELECT status = 'forming' AND graduated_from_group_id = v_old_group INTO v_bool
    FROM public.groups WHERE id = (v_result->>'new_group_id')::uuid;
  INSERT INTO qa_results VALUES (DEFAULT, 'T3 new cohort is bare Draft, graduated_from set', v_bool, '');
  SELECT count(*) INTO v_count FROM public.group_courses WHERE group_id = (v_result->>'new_group_id')::uuid;
  INSERT INTO qa_results VALUES (DEFAULT, 'T3 new cohort has NO group_courses row', v_count = 0, 'count=' || v_count);
  SELECT count(*) INTO v_count FROM public.group_instructors WHERE group_id = (v_result->>'new_group_id')::uuid;
  INSERT INTO qa_results VALUES (DEFAULT, 'T3 new cohort has NO group_instructors row', v_count = 0, 'count=' || v_count);
  SELECT count(*) INTO v_count FROM public.schedules s JOIN public.group_courses gc ON gc.id = s.group_course_id WHERE gc.group_id = (v_result->>'new_group_id')::uuid;
  INSERT INTO qa_results VALUES (DEFAULT, 'T3 new cohort has NO schedules', v_count = 0, 'count=' || v_count);

  SELECT graduated_at IS NOT NULL AND graduated_to_group_id = (v_result->>'new_group_id')::uuid AND graduation_request_id = v_req_a
    INTO v_bool FROM public.groups WHERE id = v_old_group;
  INSERT INTO qa_results VALUES (DEFAULT, 'T3 old cohort graduated_at/graduated_to/request_id set', v_bool, '');

  SELECT status = 'graduated' INTO v_bool FROM public.group_students WHERE id = v_gs1;
  INSERT INTO qa_results VALUES (DEFAULT, 'T3 continue -> old group_students=graduated', v_bool, '');
  SELECT status = 'graduated' INTO v_bool FROM public.group_students WHERE id = v_gs2;
  INSERT INTO qa_results VALUES (DEFAULT, 'T3 graduate -> old group_students=graduated', v_bool, '');
  SELECT status = 'paused' INTO v_bool FROM public.group_students WHERE id = v_gs3;
  INSERT INTO qa_results VALUES (DEFAULT, 'T3 hold -> old group_students=paused', v_bool, '');
  SELECT status = 'dropped' AND notes LIKE '%Repeating%' INTO v_bool FROM public.group_students WHERE id = v_gs4;
  INSERT INTO qa_results VALUES (DEFAULT, 'T3 repeat -> old group_students=dropped w/ note', v_bool, '');
  SELECT status = 'dropped' AND notes LIKE '%Transferred%' INTO v_bool FROM public.group_students WHERE id = v_gs5;
  INSERT INTO qa_results VALUES (DEFAULT, 'T3 transfer -> old group_students=dropped w/ note', v_bool, '');
  SELECT status = 'dropped' AND notes IS NULL INTO v_bool FROM public.group_students WHERE id = v_gs6;
  INSERT INTO qa_results VALUES (DEFAULT, 'T3 drop -> old group_students=dropped, no note', v_bool, '');

  SELECT count(*) INTO v_count FROM public.student_enrollments WHERE renewal_of = v_enr1 AND group_id = (v_result->>'new_group_id')::uuid AND status='ACTIVE';
  INSERT INTO qa_results VALUES (DEFAULT, 'T3 continue -> new enrollment renewal_of=old, in new cohort', v_count = 1, 'count=' || v_count);
  SELECT count(*) INTO v_count FROM public.student_enrollments WHERE renewal_of = v_enr4 AND group_id = (v_result->>'new_group_id')::uuid AND status='ACTIVE';
  INSERT INTO qa_results VALUES (DEFAULT, 'T3 repeat -> new enrollment renewal_of=old, in new cohort', v_count = 1, 'count=' || v_count);
  SELECT count(*) INTO v_count FROM public.student_enrollments WHERE renewal_of = v_enr5 AND group_id = v_other_group AND status='ACTIVE';
  INSERT INTO qa_results VALUES (DEFAULT, 'T3 transfer -> new enrollment renewal_of=old, in OTHER (existing) cohort', v_count = 1, 'count=' || v_count);
  SELECT count(*) INTO v_count FROM public.student_enrollments WHERE renewal_of IN (v_enr2, v_enr3, v_enr6);
  INSERT INTO qa_results VALUES (DEFAULT, 'T3 graduate/hold/drop -> NO new enrollment created', v_count = 0, 'count=' || v_count);

  SELECT count(*) INTO v_count FROM public.group_students WHERE group_id = (v_result->>'new_group_id')::uuid AND status='active';
  INSERT INTO qa_results VALUES (DEFAULT, 'T3 new cohort has 2 active group_students (continue+repeat)', v_count = 2, 'count=' || v_count);
  SELECT count(*) INTO v_count FROM public.group_students WHERE group_id = v_other_group AND student_id = v_s5 AND status='active';
  INSERT INTO qa_results VALUES (DEFAULT, 'T3 transferred student added to OTHER cohort', v_count = 1, 'count=' || v_count);

  SELECT count(*) INTO v_count FROM public.student_financial_accounts
    WHERE enrollment_id IN (SELECT id FROM public.student_enrollments WHERE renewal_of IN (v_enr1,v_enr4,v_enr5));
  INSERT INTO qa_results VALUES (DEFAULT, 'T3 NO financial accounts created for new enrollments', v_count = 0, 'count=' || v_count);

  SELECT count(*) INTO v_count FROM public.cohort_graduation_decisions WHERE old_group_id = v_old_group;
  INSERT INTO qa_results VALUES (DEFAULT, 'T3 six cohort_graduation_decisions rows recorded', v_count = 6, 'count=' || v_count);

  SELECT count(*) INTO v_count FROM public.audit_logs WHERE action = 'graduate_cohort' AND entity_id = v_old_group;
  INSERT INTO qa_results VALUES (DEFAULT, 'T3 exactly one graduate_cohort audit_logs row', v_count = 1, 'count=' || v_count);

  SELECT md5(string_agg(schedule_id::text||student_id::text||status, ',' ORDER BY schedule_id, student_id))
    INTO v_post_att FROM public.attendance_records WHERE schedule_id IN (v_sched1, v_sched2);
  INSERT INTO qa_results VALUES (DEFAULT, 'T3 attendance_records byte-identical to pre-commit snapshot', v_pre_att = v_post_att, '');

  SELECT md5(string_agg(id::text||status||coalesce(course_id::text,''), ',' ORDER BY id))
    INTO v_post_cert FROM public.certificates WHERE id = v_cert1;
  INSERT INTO qa_results VALUES (DEFAULT, 'T3 certificate byte-identical to pre-commit snapshot', v_pre_cert = v_post_cert, '');
  SELECT count(*) INTO v_count FROM public.certificates WHERE course_id = v_course_id;
  INSERT INTO qa_results VALUES (DEFAULT, 'T3 no NEW certificates created (still only the 1 pre-existing)', v_count = 1, 'count=' || v_count);

  SELECT md5(string_agg(id::text||coalesce(group_id::text,'')||coalesce(course_id::text,'')||branch_id::text||coalesce(start_date::text,'')||coalesce(renewal_of::text,''), ',' ORDER BY id))
    INTO v_post_enr FROM public.student_enrollments WHERE id IN (v_enr1,v_enr2,v_enr3,v_enr4,v_enr5,v_enr6);
  INSERT INTO qa_results VALUES (DEFAULT, 'T3 OLD enrollments group/course/dates/renewal_of never rewritten', v_pre_enr = v_post_enr, '');

  SELECT status = 'COMPLETED' INTO v_bool FROM public.student_enrollments WHERE id = v_enr1;
  INSERT INTO qa_results VALUES (DEFAULT, 'T3 continue -> OLD enrollment status=COMPLETED', v_bool, '');
  SELECT status = 'COMPLETED' INTO v_bool FROM public.student_enrollments WHERE id = v_enr2;
  INSERT INTO qa_results VALUES (DEFAULT, 'T3 graduate -> OLD enrollment status=COMPLETED', v_bool, '');
  SELECT status = 'PAUSED' INTO v_bool FROM public.student_enrollments WHERE id = v_enr3;
  INSERT INTO qa_results VALUES (DEFAULT, 'T3 hold -> OLD enrollment status=PAUSED', v_bool, '');
  SELECT status = 'COMPLETED' INTO v_bool FROM public.student_enrollments WHERE id = v_enr4;
  INSERT INTO qa_results VALUES (DEFAULT, 'T3 repeat -> OLD enrollment status=COMPLETED', v_bool, '');
  SELECT status = 'TRANSFERRED' INTO v_bool FROM public.student_enrollments WHERE id = v_enr5;
  INSERT INTO qa_results VALUES (DEFAULT, 'T3 transfer -> OLD enrollment status=TRANSFERRED', v_bool, '');
  SELECT status = 'DROPPED' INTO v_bool FROM public.student_enrollments WHERE id = v_enr6;
  INSERT INTO qa_results VALUES (DEFAULT, 'T3 drop -> OLD enrollment status=DROPPED', v_bool, '');

  SELECT count(*) INTO v_count FROM public.groups;
  SELECT count(*) INTO v_count2 FROM public.student_enrollments;
  SELECT public.commit_cohort_graduation(v_payload, v_tl_user, v_req_a, NULL) INTO v_result;
  INSERT INTO qa_results VALUES (DEFAULT, 'T4 replay returns replayed=true', (v_result->>'replayed') = 'true', v_result->>'replayed');
  INSERT INTO qa_results VALUES (DEFAULT, 'T4 replay returns the SAME new_group_id',
    (v_result->>'new_group_id')::uuid = (SELECT graduated_to_group_id FROM public.groups WHERE id = v_old_group), '');
  INSERT INTO qa_results VALUES (DEFAULT, 'T4 no duplicate groups created on replay',
    (SELECT count(*) FROM public.groups) = v_count, 'groups=' || (SELECT count(*) FROM public.groups) || ' expected=' || v_count);
  INSERT INTO qa_results VALUES (DEFAULT, 'T4 no duplicate enrollments created on replay',
    (SELECT count(*) FROM public.student_enrollments) = v_count2, 'enr=' || (SELECT count(*) FROM public.student_enrollments) || ' expected=' || v_count2);
  SELECT count(*) INTO v_count FROM public.cohort_graduation_decisions WHERE old_group_id = v_old_group;
  INSERT INTO qa_results VALUES (DEFAULT, 'T4 still exactly six decision rows after replay', v_count = 6, 'count=' || v_count);
  SELECT count(*) INTO v_count FROM public.audit_logs WHERE action = 'graduate_cohort' AND entity_id = v_old_group;
  INSERT INTO qa_results VALUES (DEFAULT, 'T4 still exactly one audit row after replay', v_count = 1, 'count=' || v_count);

  BEGIN
    SELECT public.commit_cohort_graduation(v_payload, v_tl_user, v_req_b, NULL) INTO v_result;
    INSERT INTO qa_results VALUES (DEFAULT, 'T5 different request_id after graduation rejected', false, 'expected exception, none raised');
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO qa_results VALUES (DEFAULT, 'T5 different request_id after graduation rejected', SQLERRM LIKE '%already been graduated%', SQLERRM);
  END;

  SELECT public.user_has_permission(v_tl_user, 'graduate_cohort', v_branch1) INTO v_bool;
  INSERT INTO qa_results VALUES (DEFAULT, 'T6 team_leader (real, holds branch1) has graduate_cohort for branch1', v_bool, '');
  SELECT public.user_has_permission(v_tl2_user, 'graduate_cohort', v_branch1) INTO v_bool;
  INSERT INTO qa_results VALUES (DEFAULT, 'T6 team_leader scoped ONLY to branch2 lacks graduate_cohort for branch1', NOT v_bool, '');
  SELECT public.user_has_permission(v_tl2_user, 'graduate_cohort', v_branch2) INTO v_bool;
  INSERT INTO qa_results VALUES (DEFAULT, 'T6 team_leader scoped ONLY to branch2 HAS graduate_cohort for branch2', v_bool, '');
  SELECT public.user_has_permission(v_sa_user, 'graduate_cohort', v_branch1) INTO v_bool;
  INSERT INTO qa_results VALUES (DEFAULT, 'T6 super_admin (global role) has graduate_cohort for any branch', v_bool, '');
  SELECT public.user_has_permission(v_unauth_user, 'graduate_cohort', v_branch1) INTO v_bool;
  INSERT INTO qa_results VALUES (DEFAULT, 'T6 unauthorized user (plain account, no elevated role) lacks graduate_cohort', NOT v_bool, '');
  SELECT has_function_privilege('authenticated', 'public.commit_cohort_graduation(jsonb,uuid,uuid,uuid)', 'execute') INTO v_bool;
  INSERT INTO qa_results VALUES (DEFAULT, 'T6 commit_cohort_graduation NOT directly callable by authenticated role', NOT v_bool, '');
  SELECT has_function_privilege('anon', 'public.commit_cohort_graduation(jsonb,uuid,uuid,uuid)', 'execute') INTO v_bool;
  INSERT INTO qa_results VALUES (DEFAULT, 'T6 commit_cohort_graduation NOT directly callable by anon role', NOT v_bool, '');

  DECLARE v_draft1 uuid; v_draft2 uuid; v_updated_at1 timestamptz;
  BEGIN
    INSERT INTO public.cohort_graduation_drafts (old_group_id, step, new_group_draft, decisions, created_by, updated_by)
      VALUES (v_completed_group2, 3, '{}'::jsonb, '[]'::jsonb, v_tl_user, v_tl_user)
      RETURNING id, updated_at INTO v_draft1, v_updated_at1;
    INSERT INTO qa_results VALUES (DEFAULT, 'T7 draft insert succeeds for (cohort, TL)', true, v_draft1::text);

    BEGIN
      INSERT INTO public.cohort_graduation_drafts (old_group_id, step, new_group_draft, decisions, created_by, updated_by)
        VALUES (v_completed_group2, 1, '{}'::jsonb, '[]'::jsonb, v_tl_user, v_tl_user);
      INSERT INTO qa_results VALUES (DEFAULT, 'T7 second in_progress draft for SAME (cohort,user) rejected', false, 'expected unique violation');
    EXCEPTION WHEN unique_violation THEN
      INSERT INTO qa_results VALUES (DEFAULT, 'T7 second in_progress draft for SAME (cohort,user) rejected', true, SQLERRM);
    END;

    INSERT INTO public.cohort_graduation_drafts (old_group_id, step, new_group_draft, decisions, created_by, updated_by)
      VALUES (v_completed_group2, 2, '{}'::jsonb, '[]'::jsonb, v_tl2_user, v_tl2_user)
      RETURNING id INTO v_draft2;
    INSERT INTO qa_results VALUES (DEFAULT, 'T7 a DIFFERENT user gets their own independent draft', v_draft2 IS NOT NULL AND v_draft2 <> v_draft1, '');

    UPDATE public.cohort_graduation_drafts SET step = 4 WHERE id = v_draft1;
    SELECT (step = 4 AND updated_at IS NOT NULL) INTO v_bool FROM public.cohort_graduation_drafts WHERE id = v_draft1;
    INSERT INTO qa_results VALUES (DEFAULT, 'T7 draft update applies (step changed)', v_bool, '');
    SELECT EXISTS (
      SELECT 1 FROM pg_trigger WHERE tgrelid = 'public.cohort_graduation_drafts'::regclass
      AND tgname = 'trg_cgdraft_updated_at' AND NOT tgisinternal
    ) INTO v_bool;
    INSERT INTO qa_results VALUES (DEFAULT, 'T7 updated_at trigger is installed on cohort_graduation_drafts', v_bool, '');
  END;

  BEGIN
    UPDATE public.group_students SET notes = 'qa-tamper' WHERE id = v_gs7;
    INSERT INTO qa_results VALUES (DEFAULT, 'T8 archived cohort group_students still locked (Phase 1)', false, 'expected trigger exception, none raised');
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO qa_results VALUES (DEFAULT, 'T8 archived cohort group_students still locked (Phase 1)', SQLERRM LIKE '%Archived%', SQLERRM);
  END;
  BEGIN
    INSERT INTO public.group_courses (group_id, course_id, instructor_id, status) VALUES (v_archived_group, v_course_id, v_instr_id, 'active');
    INSERT INTO qa_results VALUES (DEFAULT, 'T8 cannot INSERT group_courses on archived cohort', false, 'expected trigger exception');
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO qa_results VALUES (DEFAULT, 'T8 cannot INSERT group_courses on archived cohort', SQLERRM LIKE '%Archived%', SQLERRM);
  END;
  BEGIN
    v_payload := jsonb_build_object('old_group_id', v_archived_group,
      'new_group', jsonb_build_object('branch_id', v_branch1, 'name', 'x', 'type', 'class', 'capacity', 1, 'waitlist_capacity', 0),
      'decisions', '[]'::jsonb);
    SELECT public.commit_cohort_graduation(v_payload, v_tl_user, gen_random_uuid(), NULL) INTO v_result;
    INSERT INTO qa_results VALUES (DEFAULT, 'T8 cannot graduate an Archived cohort', false, 'expected exception');
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO qa_results VALUES (DEFAULT, 'T8 cannot graduate an Archived cohort', SQLERRM LIKE '%Completed%', SQLERRM);
  END;

  BEGIN
    INSERT INTO public.group_students (group_id, student_id, status) VALUES (v_completed_group2, v_s1, 'active');
    UPDATE public.group_students SET notes = 'qa-edit-ok' WHERE group_id = v_completed_group2 AND student_id = v_s1;
    SELECT notes = 'qa-edit-ok' INTO v_bool FROM public.group_students WHERE group_id = v_completed_group2 AND student_id = v_s1;
    INSERT INTO qa_results VALUES (DEFAULT, 'T9 Completed (ungraduated) cohort group_students remains editable', v_bool, '');
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO qa_results VALUES (DEFAULT, 'T9 Completed (ungraduated) cohort group_students remains editable', false, SQLERRM);
  END;

  SELECT deleted_at IS NULL INTO v_bool FROM public.groups WHERE id = v_old_group;
  INSERT INTO qa_results VALUES (DEFAULT, 'T10 historical cohort still visible to P&L-style deleted_at IS NULL filter', v_bool, '');
  SELECT (deleted_at IS NULL AND status = 'completed' AND name = 'QA Robotics — Round 1') INTO v_bool FROM public.groups WHERE id = v_old_group;
  INSERT INTO qa_results VALUES (DEFAULT, 'T11 old cohort still findable/unhidden (search proxy)', v_bool, '');

  RAISE NOTICE 'QA script completed';
END;
$QA$;

SELECT check_name, passed, detail FROM qa_results ORDER BY n;

ROLLBACK;
