-- Applied migration version matches the remote history.
-- One class/attendance ledger; independent, explicitly confirmed teaching participation.
ALTER TABLE public.schedules ADD COLUMN IF NOT EXISTS attendance_revision integer NOT NULL DEFAULT 0;
CREATE UNIQUE INDEX one_ongoing_class_per_group_course ON public.schedules(group_course_id)
  WHERE status='ongoing' AND group_course_id IS NOT NULL;
CREATE TABLE public.session_participations (
  session_id uuid NOT NULL REFERENCES public.schedules(id),
  instructor_id uuid NOT NULL REFERENCES public.instructors(id),
  joined_at timestamptz,
  confirmed_at timestamptz,
  state text NOT NULL CHECK(state IN ('joined','confirmed','requested','rejected')),
  reason text,
  requested_at timestamptz,
  reviewed_at timestamptz,
  reviewed_by uuid REFERENCES public.users(id),
  PRIMARY KEY(session_id,instructor_id)
);
ALTER TABLE public.session_participations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.session_participations FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.session_participations TO service_role;
CREATE INDEX session_participations_pending ON public.session_participations(session_id) WHERE state='requested';

CREATE FUNCTION public.bump_shared_attendance_revision() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
  UPDATE public.schedules SET attendance_revision=attendance_revision+1 WHERE id=coalesce(NEW.schedule_id,OLD.schedule_id);
  RETURN NULL;
END; $$;
CREATE TRIGGER shared_attendance_revision AFTER INSERT OR UPDATE OR DELETE ON public.attendance_records
FOR EACH ROW EXECUTE FUNCTION public.bump_shared_attendance_revision();
REVOKE ALL ON FUNCTION public.bump_shared_attendance_revision() FROM PUBLIC,anon,authenticated;

-- Consistent lock order across start, join, attendance and completion: group then schedule.
CREATE FUNCTION public.lock_shared_instructor_session(p_actor uuid,p_instructor uuid,p_session uuid)
RETURNS public.schedules LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
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
  IF NOT FOUND OR NOT public.user_has_permission(p_actor,'manage_attendance',s.branch_id) THEN
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
END; $$;

CREATE FUNCTION public.record_session_participation(p_actor uuid,p_instructor uuid,p_session uuid,p_mode text,p_reason text DEFAULT NULL)
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
    INSERT INTO public.session_instructors(session_id,instructor_id,submitted_at)
      VALUES(s.id,p_instructor,clock_timestamp()) ON CONFLICT(session_id,instructor_id) DO NOTHING;
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

CREATE FUNCTION public.reconcile_shared_session_allocations(p_session uuid) RETURNS void
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE s public.schedules%ROWTYPE; gc public.group_courses%ROWTYPE;
BEGIN
  SELECT * INTO s FROM public.schedules WHERE id=p_session;
  IF s.status<>'completed' THEN RETURN; END IF;
  SELECT * INTO gc FROM public.group_courses WHERE id=s.group_course_id;
  UPDATE public.group_instructors gi SET allocation_status='completed',released_at=now()
    WHERE gi.group_id=gc.group_id AND gi.allocation_status='active' AND gi.to_session=s.session_number
      AND EXISTS (SELECT 1 FROM public.session_participations p WHERE p.session_id=s.id AND p.instructor_id=gi.instructor_id AND p.state='confirmed');
  IF NOT EXISTS (SELECT 1 FROM public.group_instructors WHERE group_id=gc.group_id AND allocation_status='active') THEN
    IF gc.total_sessions IS NOT NULL AND (SELECT max(to_session) FROM public.group_instructors WHERE group_id=gc.group_id)>=gc.total_sessions
      AND (SELECT completed_sessions FROM public.groups WHERE id=gc.group_id)>=gc.total_sessions THEN
      UPDATE public.groups SET status='completed' WHERE id=gc.group_id AND status IN ('active','handoff_pending');
      UPDATE public.group_courses SET status='completed',ended_at=now() WHERE id=gc.id AND status='active';
    ELSE
      UPDATE public.groups SET status='handoff_pending' WHERE id=gc.group_id AND status IN ('active','forming');
    END IF;
  END IF;
END; $$;
REVOKE ALL ON FUNCTION public.reconcile_shared_session_allocations(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.reconcile_shared_session_allocations(uuid) TO service_role;

CREATE FUNCTION public.review_session_participation(p_actor uuid,p_session uuid,p_instructor uuid,p_approve boolean)
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
    INSERT INTO public.session_instructors(session_id,instructor_id,submitted_at)
      VALUES(s.id,p_instructor,clock_timestamp()) ON CONFLICT(session_id,instructor_id) DO NOTHING;
  END IF;
  PERFORM public.write_audit_log(p_performed_by=>p_actor,p_action=>'session.participation.review',
    p_entity_type=>'schedule',p_entity_id=>s.id,p_new_values=>jsonb_build_object('instructor_id',p_instructor,'approved',p_approve),p_branch_id=>s.branch_id);
  RETURN jsonb_build_object('groupId',v_group,'sessionId',s.id,'state',CASE WHEN p_approve THEN 'confirmed' ELSE 'rejected' END);
END; $$;

CREATE FUNCTION public.open_shared_instructor_session(p_actor uuid,p_instructor uuid,p_course uuid,p_expected_session uuid,p_expected_previous uuid,p_topic text)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE v_group uuid; v_ongoing uuid; v_next uuid; v_previous uuid; result jsonb;
BEGIN
  SELECT group_id INTO v_group FROM public.group_courses WHERE id=p_course;
  PERFORM id FROM public.groups WHERE id=v_group AND deleted_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Group not found' USING ERRCODE='22023'; END IF;
  SELECT id INTO v_ongoing FROM public.schedules WHERE group_course_id=p_course AND status='ongoing' ORDER BY created_at,id LIMIT 1;
  IF v_ongoing IS NOT NULL THEN
    RETURN public.record_session_participation(p_actor,p_instructor,v_ongoing,'join');
  END IF;
  SELECT id INTO v_next FROM public.schedules WHERE group_course_id=p_course AND status='scheduled'
    ORDER BY session_number NULLS LAST,scheduled_at,id LIMIT 1;
  SELECT id INTO v_previous FROM public.schedules WHERE group_course_id=p_course AND status='completed'
    ORDER BY ended_at DESC NULLS LAST,created_at DESC,id LIMIT 1;
  IF v_next IS DISTINCT FROM p_expected_session OR (v_next IS NULL AND v_previous IS DISTINCT FROM p_expected_previous) THEN
    RAISE EXCEPTION 'Session list changed. Refresh before starting; no new class was created.' USING ERRCODE='22023';
  END IF;
  result:=public.start_instructor_group_session(p_actor,p_instructor,p_course,p_topic);
  RETURN public.record_session_participation(p_actor,p_instructor,(result->>'sessionId')::uuid,'join');
END; $$;

REVOKE ALL ON FUNCTION public.lock_shared_instructor_session(uuid,uuid,uuid),
  public.record_session_participation(uuid,uuid,uuid,text,text), public.review_session_participation(uuid,uuid,uuid,boolean),
  public.open_shared_instructor_session(uuid,uuid,uuid,uuid,uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.lock_shared_instructor_session(uuid,uuid,uuid),
  public.record_session_participation(uuid,uuid,uuid,text,text), public.review_session_participation(uuid,uuid,uuid,boolean),
  public.open_shared_instructor_session(uuid,uuid,uuid,uuid,uuid,text) TO service_role;
CREATE OR REPLACE FUNCTION public.save_shared_instructor_session(
  p_actor_id uuid, p_instructor_id uuid, p_session_id uuid, p_group_id uuid,
  p_complete boolean, p_attendance jsonb, p_topic text, p_expected_revision integer
) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $$
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
  IF NOT FOUND OR NOT public.user_has_permission(p_actor_id, 'manage_attendance', s.branch_id) THEN
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
$$;

REVOKE ALL ON FUNCTION public.save_shared_instructor_session(uuid,uuid,uuid,uuid,boolean,jsonb,text,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.save_shared_instructor_session(uuid,uuid,uuid,uuid,boolean,jsonb,text,integer) TO service_role;
-- Keep the old endpoint during deployment; multi-instructor writes require a fresh revision.
CREATE OR REPLACE FUNCTION public.save_instructor_session(
 p_actor_id uuid,p_instructor_id uuid,p_session_id uuid,p_group_id uuid,
 p_complete boolean,p_attendance jsonb DEFAULT NULL,p_topic text DEFAULT NULL
) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$
 SELECT public.save_shared_instructor_session(p_actor_id,p_instructor_id,p_session_id,p_group_id,p_complete,p_attendance,p_topic,NULL);
$$;
REVOKE ALL ON FUNCTION public.save_instructor_session(uuid,uuid,uuid,uuid,boolean,jsonb,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.save_instructor_session(uuid,uuid,uuid,uuid,boolean,jsonb,text) TO service_role;
