-- Synthetic integration fixture. MUST run inside BEGIN / ROLLBACK, after migrations.
-- No real identities or real attendance are modified.
SELECT set_config('request.jwt.claims','{"role":"service_role"}',true);
SELECT set_config('request.jwt.claim.role','service_role',true);
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


  SELECT id INTO admin_role FROM public.roles WHERE name='team_leader' LIMIT 1;
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
  result:=public.open_shared_instructor_session(actor,instructor,gc,planned,NULL,'Shared fourth lesson');
  sess:=(result->>'sessionId')::uuid;
  ASSERT sess=planned,'Expected planned fourth lesson';
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
  PERFORM public.record_session_participation(u3,instructor3,sess,'request','Helped with practical exercises');
  ASSERT NOT EXISTS (SELECT 1 FROM public.session_instructors WHERE session_id=sess AND instructor_id=instructor3),'Unapproved claim credited payroll';
  INSERT INTO public.session_instructors(session_id,instructor_id) VALUES(sess,instructor3);
  BEGIN
    PERFORM public.review_session_participation(other_actor,sess,instructor3,true);
    RAISE EXCEPTION 'Expected instructor approval rejection';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  PERFORM public.review_session_participation(u1,sess,instructor3,true);
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
  ASSERT NOT has_function_privilege('authenticated','public.review_session_participation(uuid,uuid,uuid,boolean)','EXECUTE'),'Approval RPC exposed';
  RAISE NOTICE 'PASS: shared class, two instructors, one charge, revisions, late claims and retries';
END;
$fixture$;
