-- Version matches the applied remote migration. Server-only APIs; invoker privileges are intentional.
CREATE TABLE IF NOT EXISTS public.session_completion_effects (
  session_id uuid PRIMARY KEY REFERENCES public.schedules(id) ON DELETE CASCADE,
  group_id uuid NOT NULL REFERENCES public.groups(id),
  attendance jsonb NOT NULL,
  state text NOT NULL DEFAULT 'pending' CHECK (state IN ('pending','processing','done','failed')),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 8),
  available_at timestamptz NOT NULL DEFAULT now(),
  lease_token uuid,
  leased_until timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);
ALTER TABLE public.session_completion_effects ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.session_completion_effects FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.session_completion_effects TO service_role;
CREATE INDEX IF NOT EXISTS session_completion_effects_pending ON public.session_completion_effects(available_at)
  WHERE state IN ('pending','processing');

CREATE TABLE IF NOT EXISTS public.session_attendance_xp_events (
  session_id uuid NOT NULL REFERENCES public.schedules(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  amount integer NOT NULL CHECK (amount IN (10,25)),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(session_id, student_id)
);
ALTER TABLE public.session_attendance_xp_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.session_attendance_xp_events FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.session_attendance_xp_events TO service_role;

CREATE OR REPLACE FUNCTION public.save_instructor_session(
  p_actor_id uuid, p_instructor_id uuid, p_session_id uuid, p_group_id uuid,
  p_complete boolean, p_attendance jsonb DEFAULT NULL, p_topic text DEFAULT NULL
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
  SELECT * INTO s FROM public.schedules WHERE id = p_session_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Session not found' USING ERRCODE = '22023'; END IF;
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
    RETURN jsonb_build_object('status','completed','already_completed',true);
  END IF;
  IF a.allocation_status = 'completed' THEN
    RAISE EXCEPTION 'Instructor allocation is completed' USING ERRCODE = '42501';
  END IF;
  IF p_complete IS NULL OR s.status NOT IN ('ongoing','completed') OR
    (p_complete AND (s.status <> 'ongoing' OR s.started_at IS NULL)) THEN
    RAISE EXCEPTION 'Start an ongoing session before recording or completing attendance' USING ERRCODE = '22023';
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
    INSERT INTO public.session_instructors(session_id,instructor_id,submitted_at)
      VALUES(s.id,p_instructor_id,now()) ON CONFLICT(session_id,instructor_id)
      DO UPDATE SET submitted_at=excluded.submitted_at;
    UPDATE public.schedules SET status='completed',ended_at=now() WHERE id=s.id;
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
  RETURN jsonb_build_object('status',CASE WHEN p_complete THEN 'completed' ELSE s.status END,'already_completed',false);
END;
$$;
REVOKE ALL ON FUNCTION public.save_instructor_session(uuid,uuid,uuid,uuid,boolean,jsonb,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.save_instructor_session(uuid,uuid,uuid,uuid,boolean,jsonb,text) TO service_role;

CREATE OR REPLACE FUNCTION public.lease_session_effect(p_session_id uuid DEFAULT NULL)
RETURNS SETOF public.session_completion_effects LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $$
BEGIN
  UPDATE public.session_completion_effects SET state='failed',last_error='Final worker lease expired',
    leased_until=NULL,lease_token=NULL WHERE state='processing' AND attempts>=8 AND leased_until<now()
    AND (p_session_id IS NULL OR session_id=p_session_id);
  RETURN QUERY
  UPDATE public.session_completion_effects j SET state='processing',attempts=attempts+1,
    lease_token=gen_random_uuid(),leased_until=now()+interval '5 minutes'
  WHERE j.session_id = (
    SELECT q.session_id FROM public.session_completion_effects q
    WHERE (p_session_id IS NULL OR q.session_id=p_session_id) AND q.attempts<8
      AND ((q.state='pending' AND q.available_at<=now()) OR
        (q.state='processing' AND q.leased_until<now()))
    ORDER BY q.available_at,q.session_id FOR UPDATE SKIP LOCKED LIMIT 1
  ) RETURNING j.*;
END;
$$;

CREATE OR REPLACE FUNCTION public.fail_session_effect(p_session_id uuid,p_lease_token uuid,p_error text)
RETURNS void LANGUAGE sql SECURITY INVOKER SET search_path = ''
AS $$
  UPDATE public.session_completion_effects SET state=CASE WHEN attempts>=8 THEN 'failed' ELSE 'pending' END,
    available_at=now()+interval '1 minute'*power(2,least(attempts,8)),
    last_error=left(p_error,2000),leased_until=NULL,lease_token=NULL
    WHERE session_id=p_session_id AND lease_token=p_lease_token AND state='processing';
$$;

-- The unique event and award_xp commit together. A crash/retry cannot add XP twice.
CREATE OR REPLACE FUNCTION public.award_session_attendance_xp(p_session_id uuid,p_lease_token uuid)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $$
DECLARE j public.session_completion_effects%ROWTYPE; r record; v_amount integer;
BEGIN
  SELECT * INTO j FROM public.session_completion_effects WHERE session_id=p_session_id
    AND state='processing' AND lease_token=p_lease_token AND leased_until>now() FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Session effect lease lost'; END IF;
  FOR r IN SELECT * FROM jsonb_to_recordset(j.attendance) AS x(student_id uuid,status text) ORDER BY student_id LOOP
    IF r.status NOT IN ('present','late','makeup') THEN CONTINUE; END IF;
    PERFORM id FROM public.students WHERE id=r.student_id AND deleted_at IS NULL FOR UPDATE;
    IF NOT FOUND THEN CONTINUE; END IF;
    v_amount:=CASE WHEN r.status='present' THEN 25 ELSE 10 END;
    INSERT INTO public.session_attendance_xp_events(session_id,student_id,amount)
      VALUES(j.session_id,r.student_id,v_amount) ON CONFLICT DO NOTHING;
    IF FOUND THEN PERFORM public.award_xp(r.student_id,v_amount,true); END IF;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.finish_session_effect(p_session_id uuid,p_lease_token uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $$
BEGIN
  UPDATE public.session_completion_effects SET state='done',completed_at=now(),lease_token=NULL,leased_until=NULL,last_error=NULL
    WHERE session_id=p_session_id AND lease_token=p_lease_token AND state='processing' AND leased_until>now();
  RETURN FOUND;
END;
$$;
REVOKE ALL ON FUNCTION public.lease_session_effect(uuid),public.fail_session_effect(uuid,uuid,text),
  public.award_session_attendance_xp(uuid,uuid),public.finish_session_effect(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.lease_session_effect(uuid),public.fail_session_effect(uuid,uuid,text),
  public.award_session_attendance_xp(uuid,uuid),public.finish_session_effect(uuid,uuid) TO service_role;

-- Canonical TS services retain eligibility rules; only the indivisible writes
-- live here. Student row locks serialize simultaneous award checks.
CREATE OR REPLACE FUNCTION public.unlock_student_achievement(
  p_student_id uuid,p_portfolio_id uuid,p_title text,p_description text,p_type text,p_xp integer
) RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path=''
AS $$
DECLARE v_id uuid;
BEGIN
  PERFORM id FROM public.students WHERE id=p_student_id AND deleted_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN RETURN NULL; END IF;
  IF EXISTS (SELECT 1 FROM public.student_achievements WHERE student_id=p_student_id AND title=p_title) THEN RETURN NULL; END IF;
  INSERT INTO public.student_achievements(student_id,portfolio_id,title,description,achievement_type,date_awarded)
    VALUES(p_student_id,p_portfolio_id,p_title,p_description,p_type,current_date) RETURNING id INTO v_id;
  IF p_xp>0 THEN PERFORM public.award_xp(p_student_id,p_xp,false); END IF;
  RETURN v_id;
END;
$$;
CREATE OR REPLACE FUNCTION public.award_student_badge(p_student_id uuid,p_portfolio_id uuid,p_name text,p_description text)
RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path=''
AS $$
DECLARE v_id uuid;
BEGIN
  PERFORM id FROM public.students WHERE id=p_student_id AND deleted_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN RETURN NULL; END IF;
  IF EXISTS (SELECT 1 FROM public.student_badges WHERE student_id=p_student_id AND badge_name=p_name) THEN RETURN NULL; END IF;
  INSERT INTO public.student_badges(student_id,portfolio_id,badge_name,description)
    VALUES(p_student_id,p_portfolio_id,p_name,p_description) RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION public.unlock_student_achievement(uuid,uuid,text,text,text,integer),
  public.award_student_badge(uuid,uuid,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.unlock_student_achievement(uuid,uuid,text,text,text,integer),
  public.award_student_badge(uuid,uuid,text,text) TO service_role;

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
-- Atomic XP award function
-- Fixes race condition where concurrent awardXP calls lost XP via read-then-write.
-- The first UPDATE atomically increments total_xp under row lock,
-- then level + streak are recomputed from the definitive post-increment value.

CREATE OR REPLACE FUNCTION public.award_xp(
  p_student_id  UUID,
  p_amount      INTEGER,
  p_is_activity BOOLEAN DEFAULT false
)
RETURNS TABLE(new_total_xp INTEGER, new_level INTEGER, leveled_up BOOLEAN)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_old_level    INTEGER;
  v_new_xp       INTEGER;
  v_new_level    INTEGER;
  v_cur_streak   INTEGER;
  v_best_streak  INTEGER;
  v_last_act     DATE;
  v_today        DATE := CURRENT_DATE;
  v_diff_days    INTEGER;
  v_new_streak   INTEGER;
BEGIN
  IF p_amount <= 0 THEN
    SELECT s.total_xp, s.current_level
    INTO v_new_xp, v_old_level
    FROM public.students s WHERE s.id = p_student_id AND s.deleted_at IS NULL;
    RETURN QUERY SELECT COALESCE(v_new_xp, 0), COALESCE(v_old_level, 1), false::BOOLEAN;
    RETURN;
  END IF;

  -- Atomic increment (row-level lock prevents lost-update race)
  UPDATE public.students
  SET total_xp = total_xp + p_amount
  WHERE id = p_student_id AND deleted_at IS NULL
  RETURNING total_xp, current_level, current_streak, best_streak, last_activity_date
  INTO v_new_xp, v_old_level, v_cur_streak, v_best_streak, v_last_act;

  IF NOT FOUND THEN
    RETURN QUERY SELECT 0::INTEGER, 1::INTEGER, false::BOOLEAN;
    RETURN;
  END IF;

  -- Compute new level from definitive post-increment total
  v_new_level := CASE
    WHEN v_new_xp >= 29000 THEN 15
    WHEN v_new_xp >= 24500 THEN 14
    WHEN v_new_xp >= 20500 THEN 13
    WHEN v_new_xp >= 17000 THEN 12
    WHEN v_new_xp >= 14000 THEN 11
    WHEN v_new_xp >= 11500 THEN 10
    WHEN v_new_xp >=  9200 THEN  9
    WHEN v_new_xp >=  7200 THEN  8
    WHEN v_new_xp >=  5500 THEN  7
    WHEN v_new_xp >=  4000 THEN  6
    WHEN v_new_xp >=  2800 THEN  5
    WHEN v_new_xp >=  1800 THEN  4
    WHEN v_new_xp >=  1000 THEN  3
    WHEN v_new_xp >=   500 THEN  2
    ELSE 1
  END;

  IF p_is_activity THEN
    IF v_last_act IS NULL THEN
      v_new_streak := 1;
    ELSE
      v_diff_days := v_today - v_last_act;
      IF v_diff_days = 0 THEN
        v_new_streak := v_cur_streak;
      ELSIF v_diff_days = 1 THEN
        v_new_streak := v_cur_streak + 1;
      ELSE
        v_new_streak := 1;
      END IF;
    END IF;

    UPDATE public.students SET
      current_level      = v_new_level,
      current_streak     = v_new_streak,
      best_streak        = GREATEST(v_best_streak, v_new_streak),
      last_activity_date = v_today
    WHERE id = p_student_id;
  ELSE
    UPDATE public.students SET current_level = v_new_level WHERE id = p_student_id;
  END IF;

  RETURN QUERY SELECT v_new_xp, v_new_level, (v_new_level > v_old_level)::BOOLEAN;
END;
$$;
REVOKE ALL ON FUNCTION public.award_xp(uuid,integer,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.award_xp(uuid,integer,boolean) TO service_role;
NOTIFY pgrst,'reload schema';
