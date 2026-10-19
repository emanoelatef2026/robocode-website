-- Run ONLY inside main's outer BEGIN / ROLLBACK transaction, after migration SQL.
-- Uses synthetic people and groups; only branch/course/permission IDs are reused
-- as static metadata. Never copies profiles, attendance, contracts or PII.
-- No result rows contain identities. Any failed assertion aborts the transaction.
SELECT set_config('request.jwt.claims','{"role":"service_role"}',true);
SELECT set_config('request.jwt.claim.role','service_role',true);
CREATE TEMP TABLE session_fixture_guard (enabled boolean NOT NULL);
INSERT INTO session_fixture_guard VALUES(false);
CREATE OR REPLACE FUNCTION pg_temp.fail_fixture_session_audit()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.action='session.end' AND NEW.entity_id::text=current_setting('test.atomic_session_id',true)
    AND (SELECT enabled FROM pg_temp.session_fixture_guard) THEN
    RAISE EXCEPTION 'synthetic critical audit failure' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER test_atomic_session_audit_failure BEFORE INSERT ON public.audit_logs
FOR EACH ROW EXECUTE FUNCTION pg_temp.fail_fixture_session_audit();

DO $fixture$
DECLARE
  actor uuid:=gen_random_uuid(); other_actor uuid:=gen_random_uuid();
  u1 uuid:=gen_random_uuid(); u2 uuid:=gen_random_uuid(); u3 uuid:=gen_random_uuid();
  instructor uuid:=gen_random_uuid(); student1 uuid:=gen_random_uuid(); student2 uuid:=gen_random_uuid();
  outsider uuid:=gen_random_uuid(); grp uuid:=gen_random_uuid(); gc uuid:=gen_random_uuid();
  contract uuid:=gen_random_uuid(); unrelated uuid:=gen_random_uuid(); role_id uuid:=gen_random_uuid();
  branch uuid; course uuid; other_course uuid; sess uuid; other_sess uuid;
  payload jsonb; result jsonb; job public.session_completion_effects%ROWTYPE; xp integer;
  before_att integer; before_audit integer; sid uuid; planned uuid; planned_date timestamptz;
BEGIN
  SELECT id INTO branch FROM public.branches WHERE deleted_at IS NULL ORDER BY id LIMIT 1;
  SELECT id INTO course FROM public.courses WHERE deleted_at IS NULL ORDER BY id LIMIT 1;
  SELECT id INTO other_course FROM public.courses WHERE deleted_at IS NULL AND id<>course ORDER BY id LIMIT 1;
  IF branch IS NULL OR course IS NULL OR other_course IS NULL THEN
    RAISE EXCEPTION 'Fixture needs a branch and two static curriculum courses';
  END IF;
  -- Auth trigger may already create public.users; ON CONFLICT affects only these new IDs.
  INSERT INTO auth.users(id,email,raw_user_meta_data,raw_app_meta_data,aud,role)
    SELECT id,'atomic-session-'||id||'@robocodeschools.com','{}','{}','authenticated','authenticated'
    FROM unnest(ARRAY[actor,other_actor,u1,u2,u3]) x(id);
  INSERT INTO public.users(id,email)
    SELECT id,'atomic-session-'||id||'@robocodeschools.com'
    FROM unnest(ARRAY[actor,other_actor,u1,u2,u3]) x(id) ON CONFLICT(id) DO NOTHING;
  INSERT INTO public.roles(id,name) VALUES(role_id,'test-atomic-session-'||role_id);
  INSERT INTO public.role_permissions(role_id,permission_id)
    SELECT role_id,p.id FROM public.permissions p WHERE p.name='manage_attendance';
  INSERT INTO public.user_roles(user_id,role_id,branch_id) VALUES(actor,role_id,branch);
  INSERT INTO public.instructors(id,user_id,branch_id) VALUES(instructor,actor,branch);
  INSERT INTO public.students(id,user_id,branch_id)
    VALUES(student1,u1,branch),(student2,u2,branch),(outsider,u3,branch);
  INSERT INTO public.groups(id,branch_id,name,status) VALUES(grp,branch,'Synthetic atomic session fixture','active');
  INSERT INTO public.group_courses(id,group_id,course_id,instructor_id,status,total_sessions)
    VALUES(gc,grp,course,instructor,'active',10);
  INSERT INTO public.group_instructors(group_id,instructor_id,from_session,to_session,allocation_status)
    VALUES(grp,instructor,1,1,'active');
  INSERT INTO public.group_students(group_id,student_id,status) VALUES(grp,student1,'active'),(grp,student2,'active');
  INSERT INTO public.student_enrollments(id,student_id,branch_id,group_id,course_id,status,enrolled_sessions,start_date)
    VALUES(contract,student1,branch,grp,course,'ACTIVE',5,current_date-1),
      (unrelated,student2,branch,NULL,other_course,'ACTIVE',5,current_date-100);

  -- Exact regression: a 12-lesson plan with three delivered lessons starts #4,
  -- not #13. Roll back this subcase before the completion/reward fixture below.
  BEGIN
    UPDATE public.group_courses SET total_sessions=12 WHERE id=gc;
    UPDATE public.group_instructors SET to_session=12 WHERE group_id=grp;
    INSERT INTO public.schedules(group_course_id,branch_id,scheduled_at,duration_minutes,type,topic,status)
      SELECT gc,branch,now()+(n-4)*interval '7 days',90,'regular','Planned topic','scheduled'
      FROM generate_series(1,12) n ORDER BY n;
    UPDATE public.schedules SET status='completed',started_at=scheduled_at,ended_at=scheduled_at+interval '90 minutes'
      WHERE group_course_id=gc AND session_number<=3;
    SELECT id,scheduled_at INTO planned,planned_date FROM public.schedules WHERE group_course_id=gc AND session_number=4;
    result:=public.start_instructor_group_session(actor,instructor,gc,'Fourth lesson');
    ASSERT (result->>'sessionId')::uuid=planned,'Three completed lessons must start scheduled #4';
    ASSERT (SELECT scheduled_at FROM public.schedules WHERE id=planned)=planned_date,'Start changed planned date';
    ASSERT (SELECT count(*) FROM public.schedules WHERE group_course_id=gc)=12,'Start created a thirteenth lesson';
    ASSERT (SELECT count(*) FROM public.schedules WHERE group_course_id=gc AND status='completed')=3,'Start changed delivered lessons';
    ASSERT (SELECT count(*) FROM public.schedules WHERE group_course_id=gc AND status='scheduled')=8,'Start changed future lessons';
    result:=public.start_instructor_group_session(actor,instructor,gc,'Repeated click');
    ASSERT (result->>'sessionId')::uuid=planned,'Repeated start did not return #4';
    ASSERT (SELECT topic FROM public.schedules WHERE id=planned)='Fourth lesson','Repeated start changed topic';
    ASSERT NOT EXISTS (SELECT 1 FROM public.attendance_records WHERE schedule_id=planned),'Start recorded attendance';
    ASSERT (SELECT consumed_sessions FROM public.student_enrollments WHERE id=contract)=0,'Start consumed contract';
    RAISE EXCEPTION 'Rollback exact start regression subcase' USING ERRCODE='ZX001';
  EXCEPTION WHEN SQLSTATE 'ZX001' THEN NULL; END;
  ASSERT NOT EXISTS (SELECT 1 FROM public.schedules WHERE group_course_id=gc),'Regression subcase did not roll back';

  -- Pre-generated schedules must be started, not counted as delivered lessons
  -- and bypassed by inserting #11 beyond this instructor's allocation of #1.
  INSERT INTO public.schedules(group_course_id,branch_id,scheduled_at,duration_minutes,type,topic,status)
    SELECT gc,branch,now()+n*interval '7 days',90,'regular','Planned topic','scheduled'
    FROM generate_series(1,10) n ORDER BY n;
  SELECT id INTO planned FROM public.schedules WHERE group_course_id=gc AND session_number=1;
  UPDATE public.group_instructors SET from_session=2,to_session=2 WHERE group_id=grp;
  BEGIN
    PERFORM public.start_instructor_group_session(actor,instructor,gc,'Must not skip #1');
    RAISE EXCEPTION 'Expected scheduled session allocation rejection';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  ASSERT NOT EXISTS (SELECT 1 FROM public.schedules WHERE group_course_id=gc AND status='ongoing'),'Out-of-range start changed schedule';
  UPDATE public.group_instructors SET from_session=1,to_session=1 WHERE group_id=grp;
  BEGIN
    PERFORM public.start_instructor_group_session(actor,instructor,gc,' ');
    RAISE EXCEPTION 'Expected blank topic rejection';
  EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
  result:=public.start_instructor_group_session(actor,instructor,gc,'Original topic');
  sess:=(result->>'sessionId')::uuid;
  ASSERT sess=planned,'Start did not reuse earliest scheduled lesson';
  ASSERT (SELECT session_number FROM public.schedules WHERE id=sess)=1,'Scheduled number changed';
  ASSERT (SELECT topic FROM public.schedules WHERE id=sess)='Original topic','Scheduled topic not saved';
  ASSERT (SELECT started_at FROM public.schedules WHERE id=sess) IS NOT NULL,'Scheduled lesson not started';
  ASSERT (SELECT count(*) FROM public.schedules WHERE group_course_id=gc AND status='scheduled')=9,'Future schedules changed';
  PERFORM set_config('test.atomic_session_id',sess::text,true);
  -- Network retry returns exactly the original session, ignoring new topic.
  result:=public.start_instructor_group_session(actor,instructor,gc,'Retried topic');
  ASSERT (result->>'sessionId')::uuid=sess,'Group start retry duplicated session';
  ASSERT (SELECT count(*) FROM public.schedules WHERE group_course_id=gc)=10,'Duplicate group start';
  payload:=jsonb_build_array(jsonb_build_object('student_id',student1,'status','absent'),
    jsonb_build_object('student_id',student2,'status','late'));

  BEGIN
    PERFORM public.save_instructor_session(other_actor,instructor,sess,grp,true,payload,'Unauthorized');
    RAISE EXCEPTION 'Expected actor mismatch rejection';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    PERFORM public.save_instructor_session(actor,instructor,sess,gen_random_uuid(),true,payload,'Wrong group');
    RAISE EXCEPTION 'Expected wrong-group rejection';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    PERFORM public.save_instructor_session(actor,instructor,sess,grp,false,
      jsonb_build_array(jsonb_build_object('student_id',student1,'status',NULL)),'Missing status');
    RAISE EXCEPTION 'Expected missing-status rejection';
  EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
  BEGIN
    PERFORM public.save_instructor_session(actor,instructor,sess,grp,false,
      jsonb_build_array(jsonb_build_object('student_id',outsider,'status','present')),'Wrong member');
    RAISE EXCEPTION 'Expected outsider rejection';
  EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
  BEGIN
    PERFORM public.save_instructor_session(actor,instructor,sess,grp,true,jsonb_build_array(payload->0),'Partial');
    RAISE EXCEPTION 'Expected incomplete-roster rejection';
  EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
  -- Save one marked student: no participation, consumption or outbox yet.
  PERFORM public.save_instructor_session(actor,instructor,sess,grp,false,jsonb_build_array(payload->0),'Saved partial');
  ASSERT (SELECT count(*) FROM public.attendance_records WHERE schedule_id=sess)=1,'Partial save missing';
  ASSERT NOT EXISTS (SELECT 1 FROM public.attendance_consumptions WHERE enrollment_id=contract),'Save-only consumed contract';
  ASSERT NOT EXISTS (SELECT 1 FROM public.session_instructors WHERE session_id=sess),'Save-only counted payroll';
  ASSERT NOT EXISTS (SELECT 1 FROM public.session_completion_effects WHERE session_id=sess),'Save-only queued completion';

  -- Fail at audit, AFTER attendance, topic, consumption, participation, status,
  -- allocation and outbox writes. The entire call must roll back.
  UPDATE session_fixture_guard SET enabled=true;
  SELECT count(*) INTO before_audit FROM public.audit_logs WHERE entity_id=sess;
  BEGIN
    PERFORM public.save_instructor_session(actor,instructor,sess,grp,true,payload,'Must roll back');
    RAISE EXCEPTION 'Expected synthetic critical write failure';
  EXCEPTION WHEN check_violation THEN
    IF SQLERRM<>'synthetic critical audit failure' THEN RAISE; END IF;
  END;
  ASSERT (SELECT count(*) FROM public.attendance_records WHERE schedule_id=sess)=1,'Attendance write escaped rollback';
  ASSERT (SELECT topic FROM public.schedules WHERE id=sess)='Saved partial','Topic escaped rollback';
  ASSERT (SELECT status FROM public.schedules WHERE id=sess)='ongoing','Status escaped rollback';
  ASSERT (SELECT ended_at FROM public.schedules WHERE id=sess) IS NULL,'Ended timestamp escaped rollback';
  ASSERT NOT EXISTS (SELECT 1 FROM public.attendance_consumptions WHERE enrollment_id=contract),'Consumption escaped rollback';
  ASSERT (SELECT consumed_sessions FROM public.student_enrollments WHERE id=contract)=0,'Counter escaped rollback';
  ASSERT NOT EXISTS (SELECT 1 FROM public.session_instructors WHERE session_id=sess),'Payroll escaped rollback';
  ASSERT NOT EXISTS (SELECT 1 FROM public.session_completion_effects WHERE session_id=sess),'Outbox escaped rollback';
  ASSERT (SELECT allocation_status FROM public.group_instructors WHERE group_id=grp AND instructor_id=instructor)='active','Allocation escaped rollback';
  ASSERT (SELECT count(*) FROM public.audit_logs WHERE entity_id=sess)=before_audit,'Audit escaped rollback';
  UPDATE session_fixture_guard SET enabled=false;

  PERFORM public.save_instructor_session(actor,instructor,sess,grp,true,payload,'Completed topic');
  ASSERT (SELECT consumed_sessions FROM public.student_enrollments WHERE id=contract)=1,'Absent did not consume exactly once';
  ASSERT (SELECT remaining_sessions FROM public.student_enrollments WHERE id=contract)=4,'Generated counter mismatch';
  ASSERT (SELECT consumed_sessions FROM public.student_enrollments WHERE id=unrelated)=0,'Unrelated contract charged';
  ASSERT (SELECT allocation_status FROM public.group_instructors WHERE group_id=grp AND instructor_id=instructor)='completed','Allocation not completed';
  ASSERT (SELECT count(*) FROM public.session_instructors WHERE session_id=sess)=1,'Payroll participation missing';
  SELECT count(*) INTO before_audit FROM public.audit_logs WHERE entity_id=sess;
  -- Allocation is now completed. Retry must return BEFORE payload validation or any write.
  result:=public.save_instructor_session(actor,instructor,sess,grp,true,'null'::jsonb,'Replay must not write');
  ASSERT result->>'already_completed'='true','Completed retry not idempotent';
  ASSERT (SELECT topic FROM public.schedules WHERE id=sess)='Completed topic','Retry changed topic';
  ASSERT (SELECT count(*) FROM public.audit_logs WHERE entity_id=sess)=before_audit,'Retry replayed audit';
  ASSERT (SELECT count(*) FROM public.session_completion_effects WHERE session_id=sess)=1,'Retry queued another job';
  BEGIN
    PERFORM public.save_instructor_session(actor,instructor,sess,grp,false,payload,'Completed allocation edit');
    RAISE EXCEPTION 'Expected completed allocation edit rejection';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;

  -- Edit live attendance directly for synthetic students only. Reward eligibility
  -- must remain the frozen completion snapshot: student1 absent, student2 late.
  UPDATE public.attendance_records SET status='present' WHERE schedule_id=sess AND student_id=student1;
  UPDATE public.attendance_records SET status='absent' WHERE schedule_id=sess AND student_id=student2;
  SELECT * INTO job FROM public.lease_session_effect(sess);
  ASSERT job.session_id=sess,'Worker did not lease job';
  ASSERT NOT EXISTS (SELECT 1 FROM public.lease_session_effect(sess)),'Concurrent worker obtained same job';
  PERFORM public.award_session_attendance_xp(sess,job.lease_token);
  PERFORM public.award_session_attendance_xp(sess,job.lease_token);
  ASSERT (SELECT total_xp FROM public.students WHERE id=student1)=0,'Edits changed frozen absent eligibility';
  ASSERT (SELECT total_xp FROM public.students WHERE id=student2)=10,'Late attendance XP duplicated/missing';
  ASSERT (SELECT count(*) FROM public.session_attendance_xp_events WHERE session_id=sess)=1,'XP event duplicated';
  sid:=public.unlock_student_achievement(student2,NULL,'Synthetic reward','Fixture','attendance',25);
  ASSERT sid IS NOT NULL,'Achievement missing';
  ASSERT public.unlock_student_achievement(student2,NULL,'Synthetic reward','Fixture','attendance',25) IS NULL,'Achievement retry duplicated';
  ASSERT (SELECT total_xp FROM public.students WHERE id=student2)=35,'Achievement bonus duplicated';
  sid:=public.award_student_badge(student2,NULL,'Synthetic badge','Fixture');
  ASSERT sid IS NOT NULL,'Badge missing';
  ASSERT public.award_student_badge(student2,NULL,'Synthetic badge','Fixture') IS NULL,'Badge retry duplicated';
  PERFORM public.fail_session_effect(sess,job.lease_token,'Synthetic retry');
  UPDATE public.session_completion_effects SET available_at=now()-interval '1 second' WHERE session_id=sess;
  SELECT * INTO job FROM public.lease_session_effect(sess);
  PERFORM public.award_session_attendance_xp(sess,job.lease_token);
  ASSERT (SELECT total_xp FROM public.students WHERE id=student2)=35,'Retried job replayed XP';
  ASSERT public.finish_session_effect(sess,job.lease_token),'Job did not finish';
  ASSERT NOT EXISTS (SELECT 1 FROM public.lease_session_effect(sess)),'Done job leased again';
  -- Final-attempt crash is recoverable to failed, never permanently processing.
  UPDATE public.session_completion_effects SET state='processing',attempts=8,leased_until=now()-interval '1 second' WHERE session_id=sess;
  PERFORM public.lease_session_effect(sess);
  ASSERT (SELECT state FROM public.session_completion_effects WHERE session_id=sess)='failed','Expired final lease stuck';
  ASSERT NOT has_table_privilege('authenticated','public.session_completion_effects','SELECT'),'Outbox exposed';
  ASSERT NOT has_function_privilege('authenticated','public.save_instructor_session(uuid,uuid,uuid,uuid,boolean,jsonb,text)','EXECUTE'),'Finalizer exposed';
  ASSERT NOT has_function_privilege('authenticated','public.start_instructor_group_session(uuid,uuid,uuid,text)','EXECUTE'),'Starter exposed';
  -- No remaining planned sessions: retain direct creation and allocation bounds.
  DELETE FROM public.schedules WHERE group_course_id=gc AND status='scheduled';
  UPDATE public.group_courses SET status='active' WHERE id=gc;
  UPDATE public.group_instructors SET from_session=2,to_session=2,allocation_status='active' WHERE group_id=grp;
  result:=public.start_instructor_group_session(actor,instructor,gc,'Unplanned second session');
  ASSERT (SELECT session_number FROM public.schedules WHERE id=(result->>'sessionId')::uuid)=2,'Direct creation no longer works';
  RAISE NOTICE 'PASS: atomic session synthetic fixture, rollback, retries, frozen rewards, service-only access';
END;
$fixture$;
-- MAIN MUST ISSUE ROLLBACK. This file intentionally does not COMMIT.
