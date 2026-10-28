-- Synthetic identities only. Run with the workflow migration inside BEGIN / ROLLBACK.
SELECT set_config('request.jwt.claims','{"role":"service_role"}',true);
SELECT set_config('request.jwt.claim.role','service_role',true);
DO $fixture$
DECLARE
  lead_user uuid:=gen_random_uuid(); helper_user uuid:=gen_random_uuid(); admin_user uuid:=gen_random_uuid(); student_user uuid:=gen_random_uuid();
  lead_id uuid:=gen_random_uuid(); helper_id uuid:=gen_random_uuid(); student_id uuid:=gen_random_uuid(); group_id uuid:=gen_random_uuid(); gc uuid:=gen_random_uuid();
  test_role uuid:=gen_random_uuid(); branch uuid; other_branch uuid; tl_role uuid; course uuid; super_role uuid; sid uuid; request_id uuid; result jsonb; attendance jsonb; revision integer; contract uuid:=gen_random_uuid();
BEGIN
  SELECT id INTO branch FROM public.branches WHERE deleted_at IS NULL ORDER BY id LIMIT 1;
  SELECT id INTO course FROM public.courses WHERE deleted_at IS NULL ORDER BY id LIMIT 1;
  SELECT id INTO super_role FROM public.roles WHERE name='super_admin';
  INSERT INTO auth.users(id,email,raw_user_meta_data,raw_app_meta_data,aud,role)
    SELECT id,'workflow-'||id||'@robocodeschools.com','{}','{}','authenticated','authenticated' FROM unnest(ARRAY[lead_user,helper_user,admin_user,student_user]) x(id);
  INSERT INTO public.users(id,email) SELECT id,'workflow-'||id||'@robocodeschools.com' FROM unnest(ARRAY[lead_user,helper_user,admin_user,student_user]) x(id) ON CONFLICT(id) DO NOTHING;
  INSERT INTO public.roles(id,name) VALUES(test_role,'workflow-'||test_role);
  INSERT INTO public.role_permissions(role_id,permission_id) SELECT test_role,id FROM public.permissions WHERE name IN ('manage_attendance','manage_courses','manage_evaluations');
  INSERT INTO public.user_roles(user_id,role_id,branch_id) VALUES(lead_user,test_role,branch),(helper_user,test_role,branch),(admin_user,super_role,branch);
  INSERT INTO public.instructors(id,user_id,branch_id,salary_per_session,assistant_salary_per_session)
    VALUES(lead_id,lead_user,branch,200,80),(helper_id,helper_user,branch,150,60);
  INSERT INTO public.students(id,user_id,branch_id) VALUES(student_id,student_user,branch);
  INSERT INTO public.groups(id,branch_id,name,status) VALUES(group_id,branch,'Synthetic workflow test','active');
  INSERT INTO public.group_courses(id,group_id,course_id,instructor_id,status,total_sessions) VALUES(gc,group_id,course,lead_id,'active',12);
  INSERT INTO public.group_instructors(group_id,instructor_id,role,from_session,to_session,allocation_status,session_rate)
    VALUES(group_id,lead_id,'lead',1,12,'active',210),(group_id,helper_id,'assistant',1,12,'active',70);
  INSERT INTO public.group_students(group_id,student_id,status) VALUES(group_id,student_id,'active');
  INSERT INTO public.student_enrollments(id,student_id,branch_id,group_id,course_id,status,enrolled_sessions,start_date)
    VALUES(contract,student_id,branch,group_id,course,'ACTIVE',12,current_date-1);
  INSERT INTO public.schedules(id,group_course_id,branch_id,scheduled_at,duration_minutes,type,topic,status)
    VALUES(gen_random_uuid(),gc,branch,now(),90,'regular','Synthetic lesson','scheduled') RETURNING id INTO sid;
  BEGIN
    PERFORM public.open_role_instructor_session(helper_user,helper_id,gc,sid,NULL,'Lesson','assistant');
    RAISE EXCEPTION 'Assistant unexpectedly opened a class' USING ERRCODE='P0004';
  EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
  ASSERT NOT EXISTS(SELECT 1 FROM public.schedules WHERE group_course_id=gc AND status='ongoing'),'Assistant created an ongoing class';
  -- The assigned assistant explicitly substitutes as lead, receiving THEIR lead rate.
  result:=public.open_role_instructor_session(helper_user,helper_id,gc,sid,NULL,'Lesson','lead');
  ASSERT (result->>'sessionId')::uuid=sid,'Wrong scheduled class opened';
  ASSERT (SELECT lead_instructor_id FROM public.schedules WHERE id=sid)=helper_id,'Starter not recorded as lead';
  ASSERT (SELECT agreed_rate FROM public.session_participations WHERE session_id=sid AND instructor_id=helper_id)=150,'Substitute received assistant rate';
  PERFORM public.open_role_instructor_session(helper_user,helper_id,gc,sid,NULL,'Retry','lead');
  BEGIN
    PERFORM public.open_role_instructor_session(lead_user,lead_id,gc,sid,NULL,'Second opening','lead');
    RAISE EXCEPTION 'Second lead unexpectedly opened the class' USING ERRCODE='P0004';
  EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
  ASSERT (SELECT count(*) FROM public.schedules WHERE group_course_id=gc AND status='ongoing')=1,'Duplicate class created';
  result:=public.record_session_participation(lead_user,lead_id,sid,'request');
  ASSERT result->>'state'='requested','Assistant did not enter pending state';
  PERFORM public.record_session_participation(lead_user,lead_id,sid,'confirm');
  ASSERT (SELECT state FROM public.session_participations WHERE session_id=sid AND instructor_id=lead_id)='requested','Assistant self-approved';
  ASSERT NOT EXISTS(SELECT 1 FROM public.session_instructors WHERE session_id=sid AND instructor_id=lead_id AND submitted_at IS NOT NULL),'Pending assistant became payable';
  ASSERT EXISTS(SELECT 1 FROM public.notifications WHERE recipient_id=admin_user AND type='SESSION_PARTICIPATION_REQUESTED' AND data->>'session_id'=sid::text),'Admin did not receive notification';
  BEGIN
    PERFORM public.save_shared_instructor_session(lead_user,lead_id,sid,group_id,true,NULL,'Lesson',0);
    RAISE EXCEPTION 'Assistant unexpectedly ended the class' USING ERRCODE='P0004';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  attendance:=jsonb_build_array(jsonb_build_object('student_id',student_id,'status','present','notes',NULL,'late_minutes',NULL));
  result:=public.stage_session_change(lead_user,lead_id,sid,group_id,'attendance',jsonb_build_object('attendance',attendance,'topic','Lesson'));
  request_id:=(result->>'changeId')::uuid;
  ASSERT NOT EXISTS(SELECT 1 FROM public.attendance_records WHERE schedule_id=sid),'Proposal published attendance';
  ASSERT EXISTS(SELECT 1 FROM public.notifications WHERE recipient_id=helper_user AND dedup_key='session_change:'||request_id),'Lead not notified';
  BEGIN
    PERFORM public.review_session_change(lead_user,lead_id,request_id,true);
    RAISE EXCEPTION 'Assistant approved own changes' USING ERRCODE='P0004';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  PERFORM public.review_session_change(helper_user,helper_id,request_id,true);
  PERFORM public.review_session_change(helper_user,helper_id,request_id,true);
  ASSERT (SELECT count(*) FROM public.attendance_records WHERE schedule_id=sid)=1,'Approval replay duplicated attendance';
  ASSERT (SELECT consumed_sessions FROM public.student_enrollments WHERE id=contract)=0,'Saving before completion consumed a contract slot';
  -- Administration can approve during the lesson, independently of content review.
  UPDATE public.instructors SET assistant_salary_per_session=NULL WHERE id=lead_id;
  BEGIN
    PERFORM public.review_session_participation(admin_user,sid,lead_id,true);
    RAISE EXCEPTION 'Missing assistant rate silently approved' USING ERRCODE='P0004';
  EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
  ASSERT (SELECT state FROM public.session_participations WHERE session_id=sid AND instructor_id=lead_id)='requested','Failed approval changed participation';
  UPDATE public.instructors SET assistant_salary_per_session=80 WHERE id=lead_id;
  PERFORM public.review_session_participation(admin_user,sid,lead_id,true);
  ASSERT (SELECT agreed_rate FROM public.session_participations WHERE session_id=sid AND instructor_id=lead_id)=80,'Assistant received assigned lead rate';
  UPDATE public.instructors SET assistant_salary_per_session=95 WHERE id=lead_id;
  SELECT id INTO tl_role FROM public.roles WHERE name='team_leader';
  UPDATE public.user_roles SET role_id=tl_role WHERE user_id=admin_user;
  PERFORM public.review_session_participation(admin_user,sid,lead_id,true);
  SELECT id INTO other_branch FROM public.branches WHERE id<>branch AND deleted_at IS NULL LIMIT 1;
  IF other_branch IS NOT NULL THEN
    UPDATE public.user_roles SET branch_id=other_branch WHERE user_id=admin_user;
    BEGIN
      PERFORM public.review_session_participation(admin_user,sid,lead_id,true);
      RAISE EXCEPTION 'Other-branch team leader reviewed participation' USING ERRCODE='P0004';
    EXCEPTION WHEN insufficient_privilege THEN NULL; END;
    UPDATE public.user_roles SET branch_id=branch WHERE user_id=admin_user;
  END IF;
  ASSERT (SELECT agreed_rate FROM public.session_participations WHERE session_id=sid AND instructor_id=lead_id)=80,'Approved rate changed on retry';
  result:=public.stage_session_change(lead_user,lead_id,sid,group_id,'homework_create',jsonb_build_object('title','Test homework','type','homework','submission_type','text','max_score',100,'allow_late',true,'resubmission_allowed',false,'max_resubmissions',1,'portfolio_eligible',false));
  ASSERT NOT EXISTS(SELECT 1 FROM public.assignments WHERE schedule_id=sid),'Pending homework was published';
  PERFORM public.review_session_change(helper_user,helper_id,(result->>'changeId')::uuid,true);
  ASSERT (SELECT count(*) FROM public.assignments WHERE schedule_id=sid AND title='Test homework')=1,'Approved homework missing';
  result:=public.stage_session_change(lead_user,lead_id,sid,group_id,'evaluation',jsonb_build_object('student_id',student_id,'ratings',jsonb_build_array(jsonb_build_object('criterion','PARTICIPATION','rating',4)),'feedback','Great work','visible_to_student',true,'visible_to_parent',true));
  ASSERT NOT EXISTS(SELECT 1 FROM public.student_evaluations WHERE schedule_id=sid),'Pending evaluation was published';
  ASSERT NOT EXISTS(SELECT 1 FROM public.notifications WHERE recipient_id=student_user AND dedup_key='session_change_published:'||(result->>'changeId')),'Pending evaluation notified student';
  PERFORM public.review_session_change(helper_user,helper_id,(result->>'changeId')::uuid,true);
  ASSERT EXISTS(SELECT 1 FROM public.notifications WHERE recipient_id=student_user AND dedup_key='session_change_published:'||(result->>'changeId')),'Approved evaluation did not notify student';
  ASSERT (SELECT count(*) FROM public.student_evaluations WHERE schedule_id=sid AND rating=4 AND author_id=lead_user)=1,'Approved evaluation author or score wrong';
  result:=public.stage_session_change(lead_user,lead_id,sid,group_id,'resources','{"resources":[]}'::jsonb);
  request_id:=(result->>'changeId')::uuid;
  result:=public.stage_session_change(lead_user,lead_id,sid,group_id,'resources','{"resources":[]}'::jsonb);
  ASSERT (result->>'changeId')::uuid=request_id,'Retried request duplicated';
  UPDATE public.schedules SET resources_links='[{"title":"Newer","url":"https://example.invalid"}]' WHERE id=sid;
  BEGIN
    PERFORM public.review_session_change(helper_user,helper_id,request_id,true);
    RAISE EXCEPTION 'Stale content overwrote newer changes' USING ERRCODE='P0004';
  EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
  PERFORM public.review_session_change(helper_user,helper_id,request_id,false);
  SELECT attendance_revision INTO revision FROM public.schedules WHERE id=sid;
  PERFORM public.save_shared_instructor_session(helper_user,helper_id,sid,group_id,true,attendance,'Lesson',revision);
  PERFORM public.save_shared_instructor_session(helper_user,helper_id,sid,group_id,true,attendance,'Lesson',revision);
  ASSERT (SELECT consumed_sessions FROM public.student_enrollments WHERE id=contract)=1,'Ending the shared class double charged student';
  ASSERT (SELECT count(*) FROM public.session_instructors WHERE session_id=sid AND submitted_at IS NOT NULL)=2,'Teaching ledger was duplicated or lost';
  -- Correcting a completed shared class must not consume another contract slot.
  attendance:=jsonb_build_array(jsonb_build_object('student_id',student_id,'status','absent','notes','Corrected after review','late_minutes',NULL));
  SELECT attendance_revision INTO revision FROM public.schedules WHERE id=sid;
  result:=public.stage_session_change(lead_user,lead_id,sid,group_id,'attendance',jsonb_build_object('attendance',attendance,'topic','Lesson','expected_revision',revision));
  PERFORM public.review_session_change(helper_user,helper_id,(result->>'changeId')::uuid,true);
  ASSERT (SELECT status FROM public.attendance_records WHERE schedule_id=sid)='absent','Historical correction not applied';
  ASSERT (SELECT consumed_sessions FROM public.student_enrollments WHERE id=contract)=1,'Historical correction charged twice';
  BEGIN
    PERFORM public.stage_session_change(lead_user,lead_id,sid,group_id,'attendance',jsonb_build_object('attendance',attendance,'expected_revision',-1));
    RAISE EXCEPTION 'Stale attendance draft was accepted' USING ERRCODE='P0004';
  EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
  ASSERT NOT has_function_privilege('authenticated','public.review_session_change(uuid,uuid,uuid,boolean)','EXECUTE'),'Review RPC exposed to untrusted callers';
  -- Older open classes can be explicitly resumed without creating another one.
  INSERT INTO public.schedules(id,group_course_id,branch_id,scheduled_at,duration_minutes,type,topic,status)
    VALUES(gen_random_uuid(),gc,branch,now()+interval '7 days',90,'regular','Legacy open class','ongoing') RETURNING id INTO sid;
  BEGIN
    PERFORM public.open_role_instructor_session(lead_user,lead_id,gc,sid,NULL,'Legacy','assistant');
    RAISE EXCEPTION 'Assistant claimed an ownerless class' USING ERRCODE='P0004';
  EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
  PERFORM public.open_role_instructor_session(helper_user,helper_id,gc,sid,NULL,'Legacy','lead');
  PERFORM public.open_role_instructor_session(helper_user,helper_id,gc,sid,NULL,'Legacy','lead');
  ASSERT (SELECT lead_instructor_id FROM public.schedules WHERE id=sid)=helper_id,'Explicit legacy lead not recorded';
  ASSERT (SELECT count(*) FROM public.schedules WHERE group_course_id=gc AND status='ongoing')=1,'Legacy resume created a duplicate';
END; $fixture$;
SELECT 'PASS: lead substitution/rates, pending assistant count/no pay, admin notification/approval, staged attendance/homework/evaluations, lead review, stale conflict, retries and single student consumption' AS verification;
