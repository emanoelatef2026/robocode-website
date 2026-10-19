-- Start an existing planned lesson before considering insertion of a new one.
CREATE OR REPLACE FUNCTION public.start_instructor_group_session(
  p_actor_id uuid,p_instructor_id uuid,p_group_course_id uuid,p_topic text
) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=''
AS $$
DECLARE gc public.group_courses%ROWTYPE; a public.group_instructors%ROWTYPE;
  v_branch uuid; v_id uuid; v_next integer; v_number integer;
BEGIN
  SELECT * INTO gc FROM public.group_courses WHERE id=p_group_course_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Group course not found' USING ERRCODE='22023'; END IF;
  SELECT branch_id INTO v_branch FROM public.groups WHERE id=gc.group_id AND deleted_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Group not found' USING ERRCODE='22023'; END IF;
  SELECT * INTO gc FROM public.group_courses WHERE id=p_group_course_id FOR SHARE;
  PERFORM id FROM public.instructors WHERE id=p_instructor_id AND user_id=p_actor_id
    AND deleted_at IS NULL AND status='active' FOR SHARE;
  IF NOT FOUND OR NOT public.user_has_permission(p_actor_id,'manage_attendance',v_branch) THEN
    RAISE EXCEPTION 'Actor is not an authorized instructor' USING ERRCODE='42501';
  END IF;
  SELECT * INTO a FROM public.group_instructors WHERE group_id=gc.group_id AND instructor_id=p_instructor_id FOR SHARE;
  IF gc.instructor_id IS DISTINCT FROM p_instructor_id AND a.instructor_id IS NULL THEN
    RAISE EXCEPTION 'Instructor is not assigned to this group' USING ERRCODE='42501';
  END IF;
  IF gc.status<>'active' OR (a.instructor_id IS NOT NULL AND a.allocation_status<>'active') THEN
    RAISE EXCEPTION 'Group course or allocation is not active' USING ERRCODE='42501';
  END IF;
  -- A retried request returns the original ongoing session under the group lock.
  SELECT id,session_number INTO v_id,v_number FROM public.schedules
    WHERE group_course_id=gc.id AND status='ongoing' ORDER BY created_at,id LIMIT 1;
  IF v_id IS NOT NULL THEN
    IF a.instructor_id IS NOT NULL AND v_number IS NOT NULL AND
      (v_number<a.from_session OR (a.to_session IS NOT NULL AND v_number>a.to_session)) THEN
      RAISE EXCEPTION 'Ongoing session outside instructor allocation' USING ERRCODE='42501';
    END IF;
    RETURN jsonb_build_object('sessionId',v_id,'groupId',gc.group_id);
  END IF;
  -- Prefer the next already planned lesson. Future schedules are not delivered
  -- lessons: MAX()+1 alone would jump beyond a fully scheduled allocation.
  SELECT id,session_number INTO v_id,v_number FROM public.schedules
    WHERE group_course_id=gc.id AND status='scheduled'
    ORDER BY session_number ASC NULLS LAST,scheduled_at,id LIMIT 1 FOR UPDATE;
  IF v_id IS NOT NULL THEN
    IF a.instructor_id IS NOT NULL AND v_number IS NOT NULL AND
      (v_number<a.from_session OR (a.to_session IS NOT NULL AND v_number>a.to_session)) THEN
      RAISE EXCEPTION 'Next scheduled session outside instructor allocation' USING ERRCODE='42501';
    END IF;
    IF p_topic IS NULL OR btrim(p_topic)='' OR lower(btrim(p_topic))='no topic' THEN
      RAISE EXCEPTION 'Topic is required to start a session' USING ERRCODE='22023';
    END IF;
    UPDATE public.schedules SET status='ongoing',started_at=now(),topic=btrim(p_topic)
      WHERE id=v_id;
    PERFORM public.write_audit_log(p_performed_by=>p_actor_id,p_action=>'session.start',
      p_entity_type=>'schedule',p_entity_id=>v_id,
      p_new_values=>jsonb_build_object('group_course_id',gc.id,'reused_scheduled',true),p_branch_id=>v_branch);
    RETURN jsonb_build_object('sessionId',v_id,'groupId',gc.group_id);
  END IF;
  SELECT coalesce(max(session_number),0)+1 INTO v_next FROM public.schedules WHERE group_course_id=gc.id AND status<>'cancelled';
  IF a.instructor_id IS NOT NULL AND (v_next<a.from_session OR (a.to_session IS NOT NULL AND v_next>a.to_session)) THEN
    RAISE EXCEPTION 'Next session outside instructor allocation' USING ERRCODE='42501';
  END IF;
  IF p_topic IS NULL OR btrim(p_topic)='' OR lower(btrim(p_topic))='no topic' THEN
    RAISE EXCEPTION 'Topic is required to start a session' USING ERRCODE='22023';
  END IF;
  INSERT INTO public.schedules(group_course_id,branch_id,scheduled_at,started_at,duration_minutes,type,topic,status,created_by)
    VALUES(gc.id,v_branch,now(),now(),90,'regular',btrim(p_topic),'ongoing',p_actor_id) RETURNING id INTO v_id;
  PERFORM public.write_audit_log(p_performed_by=>p_actor_id,p_action=>'session.start_direct',
    p_entity_type=>'schedule',p_entity_id=>v_id,p_new_values=>jsonb_build_object('group_course_id',gc.id),p_branch_id=>v_branch);
  RETURN jsonb_build_object('sessionId',v_id,'groupId',gc.group_id);
END;
$$;
REVOKE ALL ON FUNCTION public.start_instructor_group_session(uuid,uuid,uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.start_instructor_group_session(uuid,uuid,uuid,text) TO service_role;
