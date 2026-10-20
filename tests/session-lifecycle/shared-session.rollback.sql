-- Synthetic integration fixture. MUST run inside BEGIN / ROLLBACK, after migrations.
-- No real identities or real attendance are modified.
SELECT set_config('request.jwt.claims','{"role":"service_role"}',true);
SELECT set_config('request.jwt.claim.role','service_role',true);
-- Fail one synthetic request's notification to verify the request rolls back too.
CREATE FUNCTION pg_temp.fail_participation_notice() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.type='SESSION_PARTICIPATION_REQUESTED'
    AND current_setting('test.fail_participation_notice',true)='yes' THEN
    RAISE EXCEPTION 'Synthetic notification failure' USING ERRCODE='P0001';
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER test_fail_participation_notice BEFORE INSERT ON public.notifications
  FOR EACH ROW EXECUTE FUNCTION pg_temp.fail_participation_notice();
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
  instructor2 uuid:=gen_random_uuid(); instructor3 uuid:=gen_random_uuid(); admin_role uuid; revision integer;
  super_user uuid:=gen_random_uuid(); foreign_leader uuid:=gen_random_uuid(); super_role uuid; foreign_branch uuid; notice_key text;
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
    FROM unnest(ARRAY[actor,other_actor,u1,u2,u3,super_user,foreign_leader]) x(id);
  INSERT INTO public.users(id,email)
    SELECT id,'atomic-session-'||id||'@robocodeschools.com'
    FROM unnest(ARRAY[actor,other_actor,u1,u2,u3,super_user,foreign_leader]) x(id) ON CONFLICT(id) DO NOTHING;
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


  SELECT id INTO admin_role FROM public.roles WHERE name='team_leader' LIMIT 1;
  SELECT id INTO super_role FROM public.roles WHERE name='super_admin' LIMIT 1;
  SELECT id INTO foreign_branch FROM public.branches WHERE deleted_at IS NULL AND id<>branch ORDER BY id LIMIT 1;
  ASSERT foreign_branch IS NOT NULL,'Fixture needs two branches';
  INSERT INTO public.user_roles(user_id,role_id,branch_id)
    VALUES(super_user,super_role,branch),(super_user,admin_role,branch),(foreign_leader,admin_role,foreign_branch);
  INSERT INTO public.user_roles(user_id,role_id,branch_id) VALUES(other_actor,role_id,branch),(u1,admin_role,branch),(u3,role_id,branch);
  INSERT INTO public.instructors(id,user_id,branch_id) VALUES(instructor2,other_actor,branch),(instructor3,u3,branch);
  UPDATE public.group_courses SET total_sessions=12 WHERE id=gc;
  UPDATE public.group_instructors SET to_session=12 WHERE group_id=grp;
  INSERT INTO public.group_instructors(group_id,instructor_id,from_session,to_session,allocation_status)
    VALUES(grp,instructor2,1,12,'active'),(grp,instructor3,1,12,'active');
  INSERT INTO public.schedules(group_course_id,branch_id,scheduled_at,duration_minutes,type,topic,status)
    SELECT gc,branch,now()+(n-4)*interval '7 days',90,'regular','Planned','scheduled' FROM generate_series(1,12) n ORDER BY n;
  UPDATE public.schedules SET status='completed',started_at=scheduled_at,ended_at=scheduled_at+interval '90 minutes'
    WHERE group_course_id=gc AND session_number<=3;
  SELECT id INTO planned FROM public.schedules WHERE group_course_id=gc AND session_number=4;
  -- Cross-branch teachers need no branch role or instructor_branches pivot for
  -- the assigned group. Management reviewers still belong to the group branch.
  UPDATE public.user_roles SET branch_id=foreign_branch WHERE user_id IN(actor,other_actor,u3);
  UPDATE public.instructors SET branch_id=foreign_branch WHERE id IN(instructor,instructor2,instructor3);
  ASSERT NOT public.user_has_permission(actor,'manage_attendance',branch),'Fixture accidentally granted group-branch permissions';
  -- Identity, activity and explicit per-user revocations still win over assignment.
  BEGIN
    PERFORM public.open_shared_instructor_session(other_actor,instructor,gc,planned,NULL,'Spoofed identity');
    RAISE EXCEPTION 'Expected spoofed identity rejection' USING ERRCODE='P0004';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  UPDATE public.instructors SET status='inactive' WHERE id=instructor;
  BEGIN
    PERFORM public.open_shared_instructor_session(actor,instructor,gc,planned,NULL,'Inactive teacher');
    RAISE EXCEPTION 'Expected inactive teacher rejection' USING ERRCODE='P0004';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  UPDATE public.instructors SET status='active' WHERE id=instructor;
  UPDATE public.instructors SET deleted_at=now() WHERE id=instructor;
  BEGIN
    PERFORM public.open_shared_instructor_session(actor,instructor,gc,planned,NULL,'Deleted teacher');
    RAISE EXCEPTION 'Expected deleted teacher rejection' USING ERRCODE='P0004';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  UPDATE public.instructors SET deleted_at=NULL WHERE id=instructor;
  INSERT INTO public.user_permissions(user_id,permission_id)
    SELECT actor,id FROM public.permissions WHERE name='manage_groups';
  BEGIN
    PERFORM public.open_shared_instructor_session(actor,instructor,gc,planned,NULL,'Revoked attendance permission');
    RAISE EXCEPTION 'Expected explicit permission revocation rejection' USING ERRCODE='P0004';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  DELETE FROM public.user_permissions WHERE user_id=actor;
  -- Explicit grant must work too; co-teachers below still use role defaults.
  INSERT INTO public.user_permissions(user_id,permission_id)
    SELECT actor,id FROM public.permissions WHERE name='manage_attendance';
  result:=public.open_shared_instructor_session(actor,instructor,gc,planned,NULL,'Shared fourth lesson');
  sess:=(result->>'sessionId')::uuid;
  ASSERT sess=planned,'Expected planned fourth lesson';
  ASSERT NOT public.instructor_can_teach_group(actor,instructor,grp,'manage_instructors'),'Teaching assignment granted management access';
  ASSERT NOT public.instructor_can_teach_group(actor,instructor,grp,'manage_evaluations'),'Attendance grant bypassed evaluation revocation';
  INSERT INTO public.user_permissions(user_id,permission_id)
    SELECT actor,id FROM public.permissions WHERE name='manage_evaluations';
  ASSERT public.instructor_can_teach_group(actor,instructor,grp,'manage_evaluations'),'Explicit evaluation grant did not work across branches';
  ASSERT NOT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=actor AND branch_id=branch),'Opening a class granted broad branch access';
  ASSERT NOT EXISTS(SELECT 1 FROM public.instructor_branches WHERE instructor_id=instructor AND branch_id=branch),'Opening a class required or created a branch pivot';
  UPDATE public.group_instructors SET allocation_status='released' WHERE group_id=grp AND instructor_id=instructor;
  BEGIN
    PERFORM public.lock_shared_instructor_session(actor,instructor,sess);
    RAISE EXCEPTION 'Expected stale lead pointer not to bypass release' USING ERRCODE='P0004';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  UPDATE public.group_instructors SET allocation_status='active' WHERE group_id=grp AND instructor_id=instructor;
  BEGIN
    DELETE FROM public.group_instructors WHERE group_id=grp AND instructor_id=instructor2;
    BEGIN
      PERFORM public.record_session_participation(other_actor,instructor2,sess,'join');
      RAISE EXCEPTION 'Expected unassigned teacher rejection' USING ERRCODE='P0004';
    EXCEPTION WHEN insufficient_privilege THEN NULL; END;
    RAISE EXCEPTION 'Rollback synthetic removal' USING ERRCODE='P0001';
  EXCEPTION WHEN raise_exception THEN NULL; END;
  BEGIN
    DELETE FROM public.group_instructors WHERE group_id=grp AND instructor_id=instructor;
    ASSERT public.instructor_can_teach_group(actor,instructor,grp),'Legacy course lead fallback lost access';
    PERFORM public.lock_shared_instructor_session(actor,instructor,sess);
    RAISE EXCEPTION 'Rollback synthetic lead-only case' USING ERRCODE='P0001';
  EXCEPTION WHEN raise_exception THEN NULL; END;
  BEGIN
    DELETE FROM public.user_roles WHERE user_id=actor;
    BEGIN
      PERFORM public.lock_shared_instructor_session(actor,instructor,sess);
      RAISE EXCEPTION 'Expected removed account role rejection' USING ERRCODE='P0004';
    EXCEPTION WHEN insufficient_privilege THEN NULL; END;
    RAISE EXCEPTION 'Rollback synthetic role removal' USING ERRCODE='P0001';
  EXCEPTION WHEN raise_exception THEN NULL; END;
  UPDATE public.group_instructors SET allocation_status='released' WHERE group_id=grp AND instructor_id=instructor2;
  BEGIN
    PERFORM public.record_session_participation(other_actor,instructor2,sess,'join');
    RAISE EXCEPTION 'Expected released assignment rejection' USING ERRCODE='P0004';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  UPDATE public.group_instructors SET allocation_status='active',from_session=5 WHERE group_id=grp AND instructor_id=instructor2;
  BEGIN
    PERFORM public.record_session_participation(other_actor,instructor2,sess,'join');
    RAISE EXCEPTION 'Expected allocation range rejection' USING ERRCODE='P0004';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  UPDATE public.group_instructors SET from_session=1 WHERE group_id=grp AND instructor_id=instructor2;
  result:=public.open_shared_instructor_session(other_actor,instructor2,gc,planned,NULL,'Ignored topic');
  ASSERT (result->>'sessionId')::uuid=sess,'Co-teacher started a second class';
  ASSERT (SELECT count(*) FROM public.schedules WHERE group_course_id=gc)=12,'Extra class created';
  ASSERT (SELECT count(*) FROM public.session_participations WHERE session_id=sess)=2,'Second instructor not joined';
  BEGIN
    INSERT INTO public.schedules(group_course_id,branch_id,scheduled_at,duration_minutes,type,topic,status)
      VALUES(gc,branch,now(),90,'regular','Illegal duplicate ongoing class','ongoing');
    RAISE EXCEPTION 'Expected duplicate ongoing class constraint';
  EXCEPTION WHEN unique_violation THEN NULL; END;
  ASSERT NOT EXISTS (SELECT 1 FROM public.session_instructors WHERE session_id=sess),'Joining credited payroll without confirmation';
  -- Legacy/manual assignment can create an unsubmitted teaching row in advance.
  INSERT INTO public.session_instructors(session_id,instructor_id) VALUES(sess,instructor);
  PERFORM public.record_session_participation(actor,instructor,sess,'confirm');
  ASSERT (SELECT submitted_at FROM public.session_instructors WHERE session_id=sess AND instructor_id=instructor) IS NOT NULL,'Preassigned instructor confirmation was not submitted';
  ASSERT (SELECT status FROM public.schedules WHERE id=sess)='ongoing','Participation ended shared class';
  ASSERT (SELECT consumed_sessions FROM public.student_enrollments WHERE id=contract)=0,'Participation charged student';
  payload:=jsonb_build_array(jsonb_build_object('student_id',student1,'status','absent'),jsonb_build_object('student_id',student2,'status','late'));
  DELETE FROM public.user_permissions WHERE user_id=actor AND permission_id IN(SELECT id FROM public.permissions WHERE name='manage_attendance');
  BEGIN
    PERFORM public.save_shared_instructor_session(actor,instructor,sess,grp,false,payload,'Revoked permission after start',0);
    RAISE EXCEPTION 'Expected save to respect live permission revocation' USING ERRCODE='P0004';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  INSERT INTO public.user_permissions(user_id,permission_id)
    SELECT actor,id FROM public.permissions WHERE name='manage_attendance';
  PERFORM public.save_shared_instructor_session(actor,instructor,sess,grp,false,payload,'Shared fourth lesson',0);
  SELECT attendance_revision INTO revision FROM public.schedules WHERE id=sess;
  ASSERT revision>0,'Attendance revision did not advance';
  BEGIN
    PERFORM public.save_shared_instructor_session(other_actor,instructor2,sess,grp,false,payload,'Stale overwrite',0);
    RAISE EXCEPTION 'Expected stale attendance rejection';
  EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
  BEGIN
    PERFORM public.save_instructor_session(other_actor,instructor2,sess,grp,false,payload,'Legacy overwrite');
    RAISE EXCEPTION 'Expected unversioned shared attendance rejection';
  EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
  ASSERT (SELECT topic FROM public.schedules WHERE id=sess)='Shared fourth lesson','Stale topic overwrote latest attendance';
  PERFORM public.save_shared_instructor_session(actor,instructor,sess,grp,true,payload,'Shared fourth lesson',revision);
  ASSERT (SELECT count(*) FROM public.session_instructors WHERE session_id=sess)=1,'Unconfirmed co-teacher credited before confirmation';
  ASSERT (SELECT completed_sessions FROM public.groups WHERE id=grp)=4,'Shared class counted twice for group';
  ASSERT (SELECT consumed_sessions FROM public.student_enrollments WHERE id=contract)=1,'Student charged more than once';
  ASSERT (SELECT count(*) FROM public.session_completion_effects WHERE session_id=sess)=1,'Duplicate reward job';
  PERFORM public.record_session_participation(other_actor,instructor2,sess,'confirm');
  ASSERT (SELECT count(*) FROM public.session_instructors WHERE session_id=sess)=2,'Joined co-teacher could not confirm after class ended';
  PERFORM public.save_instructor_session(other_actor,instructor2,sess,grp,true,payload,'Must not overwrite');
  ASSERT (SELECT count(*) FROM public.session_instructors WHERE session_id=sess)=2,'Participation retry duplicated payroll';
  ASSERT (SELECT consumed_sessions FROM public.student_enrollments WHERE id=contract)=1,'Second instructor charged contract again';
  BEGIN
    PERFORM public.open_shared_instructor_session(other_actor,instructor2,gc,planned,NULL,'Stale start');
    RAISE EXCEPTION 'Expected stale start rejection';
  EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
  ASSERT NOT EXISTS (SELECT 1 FROM public.schedules WHERE group_course_id=gc AND status='ongoing'),'Stale page started next class';
  BEGIN
    PERFORM public.record_session_participation(u3,instructor3,sess,'confirm');
    RAISE EXCEPTION 'Expected late participation approval requirement';
  EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
  ASSERT NOT EXISTS (SELECT 1 FROM public.notifications WHERE type='SESSION_PARTICIPATION_REQUESTED'
    AND data->>'session_id'=sess::text),'Ordinary join/confirmation generated an approval notification';
  PERFORM set_config('test.fail_participation_notice','yes',true);
  BEGIN
    PERFORM public.record_session_participation(u3,instructor3,sess,'request','Helped with practical exercises');
    RAISE EXCEPTION 'Expected notification failure' USING ERRCODE='P0004';
  EXCEPTION WHEN raise_exception THEN NULL; END;
  ASSERT NOT EXISTS (SELECT 1 FROM public.session_participations WHERE session_id=sess AND instructor_id=instructor3),'Notification failure left a request without its notification';
  PERFORM set_config('test.fail_participation_notice','no',true);
  PERFORM public.record_session_participation(u3,instructor3,sess,'request','Helped with practical exercises');
  notice_key:='session_participation_request:'||sess::text||':'||instructor3::text;
  ASSERT (SELECT count(*) FROM public.notifications WHERE dedup_key=notice_key AND recipient_id=u1)=1,'Branch leader did not receive request notification';
  ASSERT (SELECT count(*) FROM public.notifications WHERE dedup_key=notice_key AND recipient_id=super_user)=1,'Super admin with multiple roles did not get exactly one notification';
  ASSERT NOT EXISTS (SELECT 1 FROM public.notifications WHERE dedup_key=notice_key AND recipient_id IN(foreign_leader,actor,other_actor,u2,u3)),'Request notification leaked outside management/branch scope';
  ASSERT EXISTS (SELECT 1 FROM public.notifications WHERE dedup_key=notice_key AND recipient_id=super_user
    AND type='SESSION_PARTICIPATION_REQUESTED' AND href='/admin/instructors#participation-approvals'
    AND data->>'session_id'=sess::text AND data->>'instructor_id'=instructor3::text
    AND body LIKE '%Synthetic atomic session fixture%'),'Admin request notification context/link incorrect';
  ASSERT EXISTS (SELECT 1 FROM public.notifications WHERE dedup_key=notice_key AND recipient_id=u1
    AND href='/portal/team-leader/instructors#participation-approvals'),'Team leader request notification link incorrect';
  PERFORM public.record_session_participation(u3,instructor3,sess,'request','Retry of practical exercise request');
  PERFORM public.notify_session_participation_request(sess,instructor3);
  PERFORM public.notify_session_participation_request(sess,instructor3);
  ASSERT (SELECT count(*) FROM public.notifications WHERE dedup_key=notice_key AND recipient_id=super_user)=1,'Request retry/backfill duplicated notification';
  ASSERT NOT EXISTS (SELECT 1 FROM public.session_instructors WHERE session_id=sess AND instructor_id=instructor3),'Unapproved claim credited payroll';
  INSERT INTO public.session_instructors(session_id,instructor_id) VALUES(sess,instructor3);
  BEGIN
    PERFORM public.review_session_participation(other_actor,sess,instructor3,true);
    RAISE EXCEPTION 'Expected instructor approval rejection';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  PERFORM public.review_session_participation(u1,sess,instructor3,true);
  PERFORM public.notify_session_participation_request(sess,instructor3);
  ASSERT (SELECT count(*) FROM public.notifications WHERE dedup_key=notice_key AND recipient_id=super_user)=1,'Approval generated another request notification';
  ASSERT (SELECT submitted_at FROM public.session_instructors WHERE session_id=sess AND instructor_id=instructor3) IS NOT NULL,'Approved preassigned participation was not submitted';
  PERFORM public.review_session_participation(u1,sess,instructor3,true);
  ASSERT (SELECT count(*) FROM public.session_instructors WHERE session_id=sess)=3,'Admin approval missing or duplicated payroll';
  ASSERT (SELECT completed_sessions FROM public.groups WHERE id=grp)=4,'Approval changed class count';
  ASSERT (SELECT consumed_sessions FROM public.student_enrollments WHERE id=contract)=1,'Approval changed student consumption';
  SELECT id INTO sid FROM public.schedules WHERE group_course_id=gc AND session_number=1;
  PERFORM public.record_session_participation(u3,instructor3,sid,'request','Participated in the earlier workshop');
  PERFORM public.review_session_participation(u1,sid,instructor3,false);
  BEGIN
    PERFORM public.record_session_participation(u3,instructor3,sid,'confirm');
    RAISE EXCEPTION 'Expected rejected claim to stay rejected';
  EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
  ASSERT NOT has_function_privilege('authenticated','public.record_session_participation(uuid,uuid,uuid,text,text)','EXECUTE'),'Participation RPC exposed';
  -- A late confirmation for an old course must not complete a reused group-level
  -- allocation belonging to the group's next active course.
  INSERT INTO public.session_participations(session_id,instructor_id,joined_at,state)
    SELECT sid,instructor2,started_at,'joined' FROM public.schedules WHERE id=sid;
  UPDATE public.group_courses SET status='completed' WHERE id=gc;
  INSERT INTO public.group_courses(group_id,course_id,instructor_id,status,total_sessions)
    VALUES(grp,other_course,instructor2,'active',12);
  UPDATE public.group_instructors SET from_session=1,to_session=1,allocation_status='active' WHERE group_id=grp AND instructor_id=instructor2;
  PERFORM public.record_session_participation(other_actor,instructor2,sid,'confirm');
  ASSERT (SELECT allocation_status FROM public.group_instructors WHERE group_id=grp AND instructor_id=instructor2)='active','Historical participation completed the current course allocation';
  ASSERT NOT has_function_privilege('authenticated','public.review_session_participation(uuid,uuid,uuid,boolean)','EXECUTE'),'Approval RPC exposed';
  ASSERT NOT has_function_privilege('authenticated','public.notify_session_participation_request(uuid,uuid)','EXECUTE'),'Request notification helper exposed';
  ASSERT NOT has_function_privilege('authenticated','public.instructor_can_teach_group(uuid,uuid,uuid,text)','EXECUTE'),'Teaching helper exposed to browser';
  ASSERT NOT has_function_privilege('anon','public.instructor_can_teach_group(uuid,uuid,uuid,text)','EXECUTE'),'Teaching helper exposed anonymously';
  RAISE NOTICE 'PASS: shared class, two instructors, one charge, revisions, late claims and retries';
END;
$fixture$;
