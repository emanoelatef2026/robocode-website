-- Applied version matches remote history. Confirm an existing unsubmitted assignment
-- without duplicating the payroll row or replacing an earlier submission timestamp.
CREATE OR REPLACE FUNCTION public.record_session_participation(p_actor uuid,p_instructor uuid,p_session uuid,p_mode text,p_reason text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE s public.schedules%ROWTYPE; p public.session_participations%ROWTYPE; v_group uuid;
BEGIN
  s:=public.lock_shared_instructor_session(p_actor,p_instructor,p_session);
  SELECT group_id INTO v_group FROM public.group_courses WHERE id=s.group_course_id;
  SELECT * INTO p FROM public.session_participations WHERE session_id=s.id AND instructor_id=p_instructor FOR UPDATE;
  IF p_mode NOT IN ('join','confirm','request') OR p_mode IS NULL OR s.status NOT IN ('ongoing','completed') THEN
    RAISE EXCEPTION 'Participation requires an ongoing or completed session' USING ERRCODE='22023';
  END IF;
  IF p.state='confirmed' THEN RETURN jsonb_build_object('groupId',v_group,'sessionId',s.id,'state','confirmed'); END IF;
  IF p_mode='join' THEN
    IF s.status<>'ongoing' THEN RAISE EXCEPTION 'This session has ended. Request participation approval instead.' USING ERRCODE='22023'; END IF;
    INSERT INTO public.session_participations(session_id,instructor_id,joined_at,state)
      VALUES(s.id,p_instructor,clock_timestamp(),'joined') ON CONFLICT DO NOTHING;
  ELSIF p_mode='confirm' THEN
    IF s.status='completed' AND (p.joined_at IS NULL OR p.joined_at>s.ended_at OR p.state IN ('requested','rejected')) THEN
      RAISE EXCEPTION 'Request approval for a session you did not join before it ended.' USING ERRCODE='22023';
    END IF;
    INSERT INTO public.session_participations(session_id,instructor_id,joined_at,confirmed_at,state)
      VALUES(s.id,p_instructor,clock_timestamp(),clock_timestamp(),'confirmed')
      ON CONFLICT(session_id,instructor_id) DO UPDATE SET confirmed_at=excluded.confirmed_at,state='confirmed';
    INSERT INTO public.session_instructors AS existing(session_id,instructor_id,submitted_at)
      VALUES(s.id,p_instructor,clock_timestamp()) ON CONFLICT(session_id,instructor_id) DO UPDATE SET submitted_at=coalesce(existing.submitted_at,excluded.submitted_at);
    -- Confirming the final taught lesson completes this instructor's own allocation,
    -- independently of which participant closed the shared class.
    IF s.status='completed' THEN
      UPDATE public.group_instructors SET allocation_status='completed',released_at=now()
        WHERE group_id=v_group AND instructor_id=p_instructor AND allocation_status='active' AND to_session=s.session_number;
      PERFORM public.reconcile_shared_session_allocations(s.id);
    END IF;
  ELSE
    IF s.status<>'completed' OR length(btrim(coalesce(p_reason,'')))<5 OR length(p_reason)>2000 THEN
      RAISE EXCEPTION 'A completed session and a reason (5–2000 characters) are required.' USING ERRCODE='22023';
    END IF;
    IF p.state='rejected' THEN RAISE EXCEPTION 'This request was rejected. Contact your team leader.' USING ERRCODE='22023'; END IF;
    INSERT INTO public.session_participations(session_id,instructor_id,state,reason,requested_at)
      VALUES(s.id,p_instructor,'requested',btrim(p_reason),clock_timestamp()) ON CONFLICT DO NOTHING;
  END IF;
  PERFORM public.write_audit_log(p_performed_by=>p_actor,p_action=>'session.participation.'||p_mode,
    p_entity_type=>'schedule',p_entity_id=>s.id,p_new_values=>jsonb_build_object('instructor_id',p_instructor),p_branch_id=>s.branch_id);
  RETURN jsonb_build_object('groupId',v_group,'sessionId',s.id,'state',
    (SELECT state FROM public.session_participations WHERE session_id=s.id AND instructor_id=p_instructor));
END; $$;

CREATE OR REPLACE FUNCTION public.review_session_participation(p_actor uuid,p_session uuid,p_instructor uuid,p_approve boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE s public.schedules%ROWTYPE; v_group uuid; p public.session_participations%ROWTYPE;
BEGIN
  SELECT gc.group_id INTO v_group FROM public.schedules sc JOIN public.group_courses gc ON gc.id=sc.group_course_id WHERE sc.id=p_session;
  PERFORM id FROM public.groups WHERE id=v_group FOR UPDATE;
  SELECT * INTO s FROM public.schedules WHERE id=p_session FOR UPDATE;
  IF s.id IS NULL OR p_approve IS NULL OR NOT public.user_has_permission(p_actor,'manage_instructors',s.branch_id)
    OR NOT EXISTS (SELECT 1 FROM public.user_roles ur JOIN public.roles r ON r.id=ur.role_id
      WHERE ur.user_id=p_actor AND (r.name='super_admin' OR (r.name='team_leader' AND ur.branch_id=s.branch_id))) THEN
    RAISE EXCEPTION 'Only the authorized team leader or super admin can review participation.' USING ERRCODE='42501';
  END IF;
  SELECT * INTO p FROM public.session_participations WHERE session_id=s.id AND instructor_id=p_instructor FOR UPDATE;
  IF p.session_id IS NULL OR s.status<>'completed' THEN RAISE EXCEPTION 'Completed participation request not found' USING ERRCODE='22023'; END IF;
  IF p.state<>'requested' THEN RETURN jsonb_build_object('groupId',v_group,'sessionId',s.id,'state',p.state); END IF;
  UPDATE public.session_participations SET state=CASE WHEN p_approve THEN 'confirmed' ELSE 'rejected' END,
    confirmed_at=CASE WHEN p_approve THEN clock_timestamp() ELSE NULL END,reviewed_at=clock_timestamp(),reviewed_by=p_actor
    WHERE session_id=s.id AND instructor_id=p_instructor;
  IF p_approve THEN
    INSERT INTO public.session_instructors AS existing(session_id,instructor_id,submitted_at)
      VALUES(s.id,p_instructor,clock_timestamp()) ON CONFLICT(session_id,instructor_id) DO UPDATE SET submitted_at=coalesce(existing.submitted_at,excluded.submitted_at);
  END IF;
  PERFORM public.write_audit_log(p_performed_by=>p_actor,p_action=>'session.participation.review',
    p_entity_type=>'schedule',p_entity_id=>s.id,p_new_values=>jsonb_build_object('instructor_id',p_instructor,'approved',p_approve),p_branch_id=>s.branch_id);
  RETURN jsonb_build_object('groupId',v_group,'sessionId',s.id,'state',CASE WHEN p_approve THEN 'confirmed' ELSE 'rejected' END);
END; $$;
