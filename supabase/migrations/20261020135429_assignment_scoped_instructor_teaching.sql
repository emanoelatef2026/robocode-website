-- Teaching authorization is scoped to an assigned group, not to a home branch.
-- Never expand user_roles, branch management access, attendance or payroll history.
CREATE FUNCTION public.instructor_can_teach_group(p_actor uuid,p_instructor uuid,p_group uuid,p_permission text DEFAULT 'manage_attendance')
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.instructors i JOIN public.groups g ON g.id=p_group
    WHERE p_permission IN ('manage_attendance','manage_evaluations')
      AND i.id=p_instructor AND i.user_id=p_actor AND i.status='active'
      AND i.deleted_at IS NULL AND g.deleted_at IS NULL
      AND (
        EXISTS (SELECT 1 FROM public.group_instructors gi WHERE gi.group_id=g.id
          AND gi.instructor_id=i.id AND gi.allocation_status IN ('active','completed'))
        OR (
          NOT EXISTS (SELECT 1 FROM public.group_instructors gi WHERE gi.group_id=g.id AND gi.instructor_id=i.id)
          AND EXISTS (SELECT 1 FROM public.group_courses gc WHERE gc.group_id=g.id AND gc.instructor_id=i.id)
        )
      )
      AND EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id=p_actor)
      AND CASE
        -- Match resolveUserPermissions: explicit configurable permissions replace
        -- role defaults, except for super admins. No branch scope is granted here.
        WHEN EXISTS (SELECT 1 FROM public.user_permissions up WHERE up.user_id=p_actor)
          AND NOT EXISTS (SELECT 1 FROM public.user_roles ur JOIN public.roles r ON r.id=ur.role_id
            WHERE ur.user_id=p_actor AND r.name='super_admin')
        THEN EXISTS (SELECT 1 FROM public.user_permissions up JOIN public.permissions p ON p.id=up.permission_id
          WHERE up.user_id=p_actor AND p.name=p_permission)
        ELSE EXISTS (SELECT 1 FROM public.user_roles ur JOIN public.role_permissions rp ON rp.role_id=ur.role_id
          JOIN public.permissions p ON p.id=rp.permission_id
          WHERE ur.user_id=p_actor AND p.name=p_permission)
      END
  );
$$;
REVOKE ALL ON FUNCTION public.instructor_can_teach_group(uuid,uuid,uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.instructor_can_teach_group(uuid,uuid,uuid,text) TO service_role;

-- Preserve all lifecycle, allocation, revision, billing and audit checks below.
CREATE OR REPLACE FUNCTION public.lock_shared_instructor_session(p_actor uuid, p_instructor uuid, p_session uuid)
 RETURNS schedules
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
DECLARE s public.schedules%ROWTYPE; gc public.group_courses%ROWTYPE; a public.group_instructors%ROWTYPE;
BEGIN
  SELECT * INTO s FROM public.schedules WHERE id=p_session;
  IF NOT FOUND THEN RAISE EXCEPTION 'Session not found' USING ERRCODE='22023'; END IF;
  SELECT * INTO gc FROM public.group_courses WHERE id=s.group_course_id;
  PERFORM id FROM public.groups WHERE id=gc.group_id AND deleted_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Group not found' USING ERRCODE='22023'; END IF;
  SELECT * INTO s FROM public.schedules WHERE id=p_session FOR UPDATE;
  IF s.group_course_id IS DISTINCT FROM gc.id THEN RAISE EXCEPTION 'Session changed; refresh first' USING ERRCODE='22023'; END IF;
  PERFORM id FROM public.instructors WHERE id=p_instructor AND user_id=p_actor AND status='active' AND deleted_at IS NULL FOR SHARE;
  IF NOT FOUND OR NOT public.instructor_can_teach_group(p_actor,p_instructor,gc.group_id) THEN
    RAISE EXCEPTION 'Actor is not an authorized instructor' USING ERRCODE='42501';
  END IF;
  SELECT * INTO a FROM public.group_instructors WHERE group_id=gc.group_id AND instructor_id=p_instructor FOR SHARE;
  IF (a.instructor_id IS NULL AND gc.instructor_id IS DISTINCT FROM p_instructor) OR
    (a.instructor_id IS NOT NULL AND (a.allocation_status='released' OR
      (s.status<>'completed' AND a.allocation_status<>'active') OR
      (s.session_number IS NOT NULL AND (s.session_number<a.from_session OR (a.to_session IS NOT NULL AND s.session_number>a.to_session))))) THEN
    RAISE EXCEPTION 'Session outside instructor allocation' USING ERRCODE='42501';
  END IF;
  RETURN s;
END; $function$;

CREATE OR REPLACE FUNCTION public.save_shared_instructor_session(p_actor_id uuid, p_instructor_id uuid, p_session_id uuid, p_group_id uuid, p_complete boolean, p_attendance jsonb, p_topic text, p_expected_revision integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
DECLARE
  s public.schedules%ROWTYPE;
  gc public.group_courses%ROWTYPE;
  a public.group_instructors%ROWTYPE;
  v_members uuid[];
  v_submitted uuid[];
  v_topic text;
  v_day date;
  r record;
  e public.student_enrollments%ROWTYPE;
  v_has_group boolean;
BEGIN
  s := public.lock_shared_instructor_session(p_actor_id,p_instructor_id,p_session_id);
  SELECT * INTO gc FROM public.group_courses WHERE id = s.group_course_id;
  IF gc.group_id IS DISTINCT FROM p_group_id THEN
    RAISE EXCEPTION 'Session does not belong to this group' USING ERRCODE = '42501';
  END IF;
  -- FOR UPDATE conflicts with FK membership inserts as well as other finalizers.
  PERFORM id FROM public.groups WHERE id = gc.group_id FOR UPDATE;
  SELECT * INTO gc FROM public.group_courses WHERE id = s.group_course_id FOR SHARE;
  -- Recheck the supplied server identity after taking the schedule lock.
  PERFORM id FROM public.instructors WHERE id = p_instructor_id AND user_id = p_actor_id
    AND deleted_at IS NULL AND status = 'active' FOR SHARE;
  IF NOT FOUND OR NOT public.instructor_can_teach_group(p_actor_id,p_instructor_id,gc.group_id) THEN
    RAISE EXCEPTION 'Actor is not an authorized instructor' USING ERRCODE = '42501';
  END IF;
  PERFORM instructor_id FROM public.group_instructors WHERE group_id=gc.group_id ORDER BY instructor_id FOR UPDATE;
  SELECT * INTO a FROM public.group_instructors
    WHERE group_id = gc.group_id AND instructor_id = p_instructor_id;
  IF a.instructor_id IS NULL AND gc.instructor_id IS DISTINCT FROM p_instructor_id THEN
    RAISE EXCEPTION 'Instructor is not assigned to this group' USING ERRCODE = '42501';
  END IF;
  IF a.instructor_id IS NOT NULL AND (
    a.allocation_status = 'released' OR
    (s.session_number IS NOT NULL AND
      (s.session_number < a.from_session OR (a.to_session IS NOT NULL AND s.session_number > a.to_session)))
  ) THEN RAISE EXCEPTION 'Session outside instructor allocation' USING ERRCODE = '42501'; END IF;
  -- Completed allocations may retry their own completed session, with no writes.
  IF p_complete AND s.status = 'completed' THEN
    IF EXISTS (SELECT 1 FROM public.session_participations WHERE session_id=s.id AND instructor_id=p_instructor_id AND joined_at IS NOT NULL) THEN
      PERFORM public.record_session_participation(p_actor_id,p_instructor_id,s.id,'confirm');
    END IF;
    RETURN jsonb_build_object('status','completed','already_completed',true,'attendance_revision',s.attendance_revision);
  END IF;
  IF a.allocation_status = 'completed' THEN
    RAISE EXCEPTION 'Instructor allocation is completed' USING ERRCODE = '42501';
  END IF;
  IF p_complete IS NULL OR s.status NOT IN ('ongoing','completed') OR
    (p_complete AND (s.status <> 'ongoing' OR s.started_at IS NULL)) THEN
    RAISE EXCEPTION 'Start an ongoing session before recording or completing attendance' USING ERRCODE = '22023';
  END IF;
  IF s.status='completed' THEN RAISE EXCEPTION 'Completed attendance is read-only. Contact your administrator for corrections.' USING ERRCODE='22023'; END IF;
  IF (p_expected_revision IS NOT NULL AND p_expected_revision<>s.attendance_revision)
    OR (p_expected_revision IS NULL AND (SELECT count(*) FROM public.session_participations WHERE session_id=s.id AND joined_at IS NOT NULL)>1) THEN
    RAISE EXCEPTION 'Attendance changed or another instructor joined. Reload the latest shared attendance before saving.' USING ERRCODE='22023';
  END IF;
  v_topic := btrim(coalesce(p_topic,s.topic,''));
  IF v_topic = '' OR lower(v_topic) = 'no topic' THEN
    RAISE EXCEPTION 'Session topic is required' USING ERRCODE = '22023';
  END IF;
  -- Lock the membership snapshot; exact set comparisons reject extra, missing or duplicate IDs.
  PERFORM student_id FROM public.group_students WHERE group_id = gc.group_id
    ORDER BY student_id FOR SHARE;
  SELECT coalesce(array_agg(student_id ORDER BY student_id), ARRAY[]::uuid[]) INTO v_members
    FROM public.group_students gs JOIN public.students st ON st.id=gs.student_id
    WHERE gs.group_id = gc.group_id AND gs.status = 'active' AND st.deleted_at IS NULL;
  IF p_attendance IS NOT NULL THEN
    IF jsonb_typeof(p_attendance) <> 'array' OR jsonb_array_length(p_attendance) > 1000 THEN
      RAISE EXCEPTION 'Attendance must be an array' USING ERRCODE = '22023';
    END IF;
    IF EXISTS (SELECT 1 FROM jsonb_array_elements(p_attendance) x
      WHERE jsonb_typeof(x) <> 'object' OR x->>'student_id' IS NULL OR
        x->>'status' IS NULL OR x->>'status' NOT IN ('present','absent','late','excused','makeup')
        OR (x->>'late_minutes' IS NOT NULL AND
          (x->>'late_minutes' !~ '^[0-9]+$' OR length(x->>'late_minutes') > 3))
        OR length(coalesce(x->>'notes','')) > 10000) THEN
      RAISE EXCEPTION 'Choose a valid attendance status for every student' USING ERRCODE = '22023';
    END IF;
    SELECT coalesce(array_agg((x->>'student_id')::uuid ORDER BY (x->>'student_id')::uuid),ARRAY[]::uuid[])
      INTO v_submitted FROM jsonb_array_elements(p_attendance) x;
    IF cardinality(v_submitted) <> (SELECT count(DISTINCT id) FROM unnest(v_submitted) x(id))
      OR NOT (v_submitted <@ v_members)
      OR (p_complete AND v_submitted IS DISTINCT FROM v_members)
      OR cardinality(v_submitted)=0 THEN
      RAISE EXCEPTION 'Attendance must contain unique active group members; completion requires everyone' USING ERRCODE = '22023';
    END IF;
    IF EXISTS (SELECT 1 FROM jsonb_array_elements(p_attendance) x WHERE (x->>'late_minutes')::integer > 480) THEN
      RAISE EXCEPTION 'Invalid late minutes' USING ERRCODE = '22023';
    END IF;
  END IF;
  -- Lock ALL candidate and existing-ledger contracts in UUID order before attendance
  -- triggers can synchronize any counter. Selection and remaining checks happen after locks.
  PERFORM se.id FROM public.student_enrollments se WHERE
    (se.student_id = ANY(v_members) AND se.status = 'ACTIVE' AND
      (se.group_id = gc.group_id OR se.course_id = gc.course_id))
    OR se.id IN (SELECT ac.enrollment_id FROM public.attendance_consumptions ac
      JOIN public.attendance_records ar ON ar.id = ac.attendance_record_id WHERE ar.schedule_id = s.id)
    ORDER BY se.id FOR UPDATE;
  IF p_attendance IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM public.attendance_records ar WHERE ar.schedule_id = s.id
      AND ar.student_id = ANY(v_members) AND ar.invalidated_at IS NOT NULL) THEN
      RAISE EXCEPTION 'Invalidated attendance cannot be overwritten' USING ERRCODE = '22023';
    END IF;
    INSERT INTO public.attendance_records(schedule_id,student_id,status,late_minutes,notes,recorded_by,recorded_at)
      SELECT s.id,(x->>'student_id')::uuid,x->>'status',(x->>'late_minutes')::integer,
        nullif(x->>'notes',''),p_actor_id,now() FROM jsonb_array_elements(p_attendance) x
      ON CONFLICT(schedule_id,student_id) DO UPDATE SET
        status=excluded.status,late_minutes=excluded.late_minutes,notes=excluded.notes,
        recorded_by=excluded.recorded_by,recorded_at=excluded.recorded_at;
  END IF;
  UPDATE public.schedules SET topic = v_topic WHERE id = s.id;
  IF p_complete THEN
    IF cardinality(v_members)=0 THEN
      RAISE EXCEPTION 'No active students to complete this session' USING ERRCODE = '22023';
    END IF;
    IF EXISTS (SELECT 1 FROM unnest(v_members) m(student_id)
      WHERE NOT EXISTS (SELECT 1 FROM public.attendance_records ar WHERE ar.schedule_id = s.id
        AND ar.student_id = m.student_id AND ar.invalidated_at IS NULL
        AND ar.status IN ('present','absent','late','excused','makeup'))) THEN
      RAISE EXCEPTION 'Every active student needs valid attendance before ending' USING ERRCODE = '22023';
    END IF;
    v_day := (s.scheduled_at AT TIME ZONE 'UTC')::date;
    FOR r IN SELECT ar.id,ar.student_id FROM public.attendance_records ar
      WHERE ar.schedule_id = s.id AND ar.student_id = ANY(v_members)
        AND ar.invalidated_at IS NULL AND ar.status IN ('present','absent','late','excused','makeup')
        AND NOT EXISTS (SELECT 1 FROM public.attendance_consumptions ac WHERE ac.attendance_record_id = ar.id)
      ORDER BY ar.student_id
    LOOP
      SELECT EXISTS (SELECT 1 FROM public.student_enrollments se WHERE se.student_id=r.student_id
        AND se.status='ACTIVE' AND se.group_id=gc.group_id) INTO v_has_group;
      -- Mirror resolveAttendanceEnrollment + resolveFifoEnrollment exactly:
      -- explicit group pool wins; otherwise SAME course only. Window+capacity
      -- candidates first, then in-window exhausted/open-ended, then oldest.
      SELECT * INTO e FROM public.student_enrollments se WHERE se.student_id=r.student_id
        AND se.status='ACTIVE' AND
          ((v_has_group AND se.group_id=gc.group_id) OR (NOT v_has_group AND se.course_id=gc.course_id))
      ORDER BY CASE
        WHEN coalesce(se.start_date,v_day) <= v_day AND (se.end_date IS NULL OR se.end_date >= v_day)
          AND (se.enrolled_sessions=0 OR se.remaining_sessions>0) THEN 0
        WHEN coalesce(se.start_date,v_day) <= v_day AND (se.end_date IS NULL OR se.end_date >= v_day) THEN 1
        ELSE 2 END, se.start_date, se.created_at, se.id LIMIT 1;
      IF e.id IS NOT NULL AND e.enrolled_sessions>0 AND e.remaining_sessions>0
        AND (v_has_group OR coalesce(e.start_date,v_day)<=v_day)
        AND (e.end_date IS NULL OR e.end_date>=v_day) THEN
        PERFORM public.consume_attendance_sessions_batch(ARRAY[r.id],ARRAY[e.id],ARRAY[r.student_id]);
      END IF;
    END LOOP;
    PERFORM public.record_session_participation(p_actor_id,p_instructor_id,s.id,'confirm');
    UPDATE public.schedules SET status='completed',ended_at=clock_timestamp() WHERE id=s.id;
    PERFORM public.reconcile_shared_session_allocations(s.id);
    IF a.to_session IS NOT NULL AND a.to_session=s.session_number AND a.allocation_status='active' THEN
      UPDATE public.group_instructors SET allocation_status='completed',released_at=now()
        WHERE group_id=gc.group_id AND instructor_id=p_instructor_id;
      IF NOT EXISTS (SELECT 1 FROM public.group_instructors WHERE group_id=gc.group_id AND allocation_status='active') THEN
        IF gc.total_sessions IS NOT NULL
          AND (SELECT max(to_session) FROM public.group_instructors WHERE group_id=gc.group_id)>=gc.total_sessions
          AND (SELECT completed_sessions FROM public.groups WHERE id=gc.group_id)>=gc.total_sessions THEN
          UPDATE public.groups SET status='completed' WHERE id=gc.group_id AND status IN ('active','handoff_pending');
          UPDATE public.group_courses SET status='completed',ended_at=now() WHERE id=gc.id AND status='active';
        ELSE
          UPDATE public.groups SET status='handoff_pending' WHERE id=gc.group_id AND status IN ('active','forming');
        END IF;
      END IF;
    END IF;
    INSERT INTO public.session_completion_effects(session_id,group_id,attendance)
      SELECT s.id,gc.group_id,coalesce(jsonb_agg(jsonb_build_object('student_id',ar.student_id,'status',ar.status)
        ORDER BY ar.student_id),'[]'::jsonb) FROM public.attendance_records ar
      WHERE ar.schedule_id=s.id AND ar.student_id=ANY(v_members) AND ar.invalidated_at IS NULL;
  END IF;
  PERFORM public.write_audit_log(p_performed_by=>p_actor_id,
    p_action=>CASE WHEN p_complete THEN 'session.end' ELSE 'record_attendance' END,
    p_entity_type=>'schedule',p_entity_id=>s.id,
    p_new_values=>jsonb_build_object('completed',p_complete,'student_count',cardinality(v_members)),
    p_branch_id=>s.branch_id);
  RETURN jsonb_build_object('status',CASE WHEN p_complete THEN 'completed' ELSE s.status END,'already_completed',false,'attendance_revision',(SELECT attendance_revision FROM public.schedules WHERE id=s.id));
END;
$function$;

CREATE OR REPLACE FUNCTION public.start_instructor_group_session(p_actor_id uuid, p_instructor_id uuid, p_group_course_id uuid, p_topic text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
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
  IF NOT FOUND OR NOT public.instructor_can_teach_group(p_actor_id,p_instructor_id,gc.group_id) THEN
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
$function$;
