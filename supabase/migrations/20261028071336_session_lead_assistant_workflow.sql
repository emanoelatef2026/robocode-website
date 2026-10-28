-- Per-class teaching roles. Existing instructor salary remains the lead rate.
ALTER TABLE public.instructors ADD COLUMN assistant_salary_per_session numeric CHECK (assistant_salary_per_session >= 0);
ALTER TABLE public.schedules ADD COLUMN lead_instructor_id uuid REFERENCES public.instructors(id);
ALTER TABLE public.session_participations ADD COLUMN teaching_role text NOT NULL DEFAULT 'assistant' CHECK (teaching_role IN ('lead','assistant'));
ALTER TABLE public.session_participations ADD COLUMN agreed_rate numeric CHECK (agreed_rate >= 0);
-- The first recorded join is the starter in the previous shared-class workflow.
UPDATE public.schedules s SET lead_instructor_id = (
  SELECT p.instructor_id FROM public.session_participations p WHERE p.session_id=s.id AND p.joined_at IS NOT NULL
  ORDER BY p.joined_at,p.instructor_id LIMIT 1
) WHERE s.status IN ('ongoing','completed') AND s.group_course_id IS NOT NULL;
UPDATE public.session_participations p SET teaching_role='lead' FROM public.schedules s
  WHERE s.id=p.session_id AND s.lead_instructor_id=p.instructor_id;

CREATE FUNCTION public.session_teaching_rate(p_instructor uuid,p_session uuid,p_role text) RETURNS numeric
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE v_group uuid; v_assigned_role text; v_group_rate numeric; v_rate numeric;
BEGIN
  SELECT gc.group_id INTO v_group FROM public.schedules s JOIN public.group_courses gc ON gc.id=s.group_course_id WHERE s.id=p_session;
  SELECT role,session_rate INTO v_assigned_role,v_group_rate FROM public.group_instructors WHERE group_id=v_group AND instructor_id=p_instructor;
  SELECT CASE WHEN p_role='lead' THEN salary_per_session ELSE assistant_salary_per_session END INTO v_rate FROM public.instructors WHERE id=p_instructor;
  IF v_assigned_role=p_role AND v_group_rate IS NOT NULL THEN RETURN v_group_rate; END IF;
  IF p_role='assistant' AND v_rate IS NULL THEN RAISE EXCEPTION 'Set this instructor''s assistant rate before approving participation.' USING ERRCODE='22023'; END IF;
  RETURN coalesce(v_rate,0);
END; $$;

CREATE OR REPLACE FUNCTION public.record_session_participation(p_actor uuid,p_instructor uuid,p_session uuid,p_mode text,p_reason text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE s public.schedules%ROWTYPE; p public.session_participations%ROWTYPE; v_group uuid;
BEGIN
  s:=public.lock_shared_instructor_session(p_actor,p_instructor,p_session);
  SELECT group_id INTO v_group FROM public.group_courses WHERE id=s.group_course_id;
  IF p_mode IS NULL OR p_mode NOT IN ('join','confirm','request') OR s.status NOT IN ('ongoing','completed') THEN
    RAISE EXCEPTION 'Choose an ongoing or completed class.' USING ERRCODE='22023'; END IF;
  SELECT * INTO p FROM public.session_participations WHERE session_id=s.id AND instructor_id=p_instructor FOR UPDATE;
  IF s.lead_instructor_id=p_instructor THEN
    INSERT INTO public.session_participations AS existing(session_id,instructor_id,joined_at,confirmed_at,state,teaching_role,agreed_rate)
      VALUES(s.id,p_instructor,clock_timestamp(),clock_timestamp(),'confirmed','lead',public.session_teaching_rate(p_instructor,s.id,'lead'))
      ON CONFLICT(session_id,instructor_id) DO UPDATE SET state='confirmed',teaching_role='lead',confirmed_at=coalesce(existing.confirmed_at,excluded.confirmed_at),agreed_rate=coalesce(existing.agreed_rate,excluded.agreed_rate);
    INSERT INTO public.session_instructors AS existing(session_id,instructor_id,submitted_at) VALUES(s.id,p_instructor,clock_timestamp())
      ON CONFLICT(session_id,instructor_id) DO UPDATE SET submitted_at=coalesce(existing.submitted_at,excluded.submitted_at);
    RETURN jsonb_build_object('groupId',v_group,'sessionId',s.id,'state','confirmed','teachingRole','lead');
  END IF;
  -- Assistants cannot self-confirm, even by calling the old API directly.
  IF p.state IN ('confirmed','requested') THEN RETURN jsonb_build_object('groupId',v_group,'sessionId',s.id,'state',p.state,'teachingRole','assistant'); END IF;
  IF p.state='rejected' THEN RAISE EXCEPTION 'Participation was declined. Contact your team leader.' USING ERRCODE='22023'; END IF;
  IF length(coalesce(p_reason,''))>2000 THEN RAISE EXCEPTION 'Reason is too long.' USING ERRCODE='22023'; END IF;
  INSERT INTO public.session_participations(session_id,instructor_id,joined_at,state,teaching_role,reason,requested_at)
    VALUES(s.id,p_instructor,clock_timestamp(),'requested','assistant',nullif(btrim(p_reason),''),clock_timestamp())
    ON CONFLICT(session_id,instructor_id) DO UPDATE SET state='requested',teaching_role='assistant',requested_at=clock_timestamp(),reason=excluded.reason;
  PERFORM public.write_audit_log(p_performed_by=>p_actor,p_action=>'session.assistant.request',p_entity_type=>'schedule',p_entity_id=>s.id,p_branch_id=>s.branch_id);
  RETURN jsonb_build_object('groupId',v_group,'sessionId',s.id,'state','requested','teachingRole','assistant');
END; $$;

CREATE OR REPLACE FUNCTION public.review_session_participation(p_actor uuid,p_session uuid,p_instructor uuid,p_approve boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE s public.schedules%ROWTYPE; v_group uuid; p public.session_participations%ROWTYPE; v_rate numeric;
BEGIN
  SELECT gc.group_id INTO v_group FROM public.schedules sc JOIN public.group_courses gc ON gc.id=sc.group_course_id WHERE sc.id=p_session;
  PERFORM id FROM public.groups WHERE id=v_group FOR UPDATE;
  SELECT * INTO s FROM public.schedules WHERE id=p_session FOR UPDATE;
  IF s.id IS NULL OR p_approve IS NULL OR NOT public.user_has_permission(p_actor,'manage_instructors',s.branch_id)
    OR NOT EXISTS (SELECT 1 FROM public.user_roles ur JOIN public.roles r ON r.id=ur.role_id WHERE ur.user_id=p_actor AND (r.name='super_admin' OR (r.name='team_leader' AND ur.branch_id=s.branch_id))) THEN
    RAISE EXCEPTION 'Only the authorized team leader or super admin can review participation.' USING ERRCODE='42501'; END IF;
  SELECT * INTO p FROM public.session_participations WHERE session_id=s.id AND instructor_id=p_instructor FOR UPDATE;
  IF p.session_id IS NULL OR s.status NOT IN ('ongoing','completed') THEN RAISE EXCEPTION 'Participation request not found.' USING ERRCODE='22023'; END IF;
  IF p.state<>'requested' THEN RETURN jsonb_build_object('groupId',v_group,'sessionId',s.id,'state',p.state); END IF;
  IF p_approve THEN v_rate:=public.session_teaching_rate(p_instructor,s.id,'assistant'); END IF;
  UPDATE public.session_participations SET state=CASE WHEN p_approve THEN 'confirmed' ELSE 'rejected' END,
    agreed_rate=v_rate,confirmed_at=CASE WHEN p_approve THEN clock_timestamp() ELSE NULL END,reviewed_at=clock_timestamp(),reviewed_by=p_actor
    WHERE session_id=s.id AND instructor_id=p_instructor;
  IF p_approve THEN
    INSERT INTO public.session_instructors AS existing(session_id,instructor_id,submitted_at) VALUES(s.id,p_instructor,clock_timestamp())
      ON CONFLICT(session_id,instructor_id) DO UPDATE SET submitted_at=coalesce(existing.submitted_at,excluded.submitted_at);
    IF s.status='completed' THEN PERFORM public.reconcile_shared_session_allocations(s.id); END IF;
  END IF;
  INSERT INTO public.notifications(recipient_id,type,title,body,href,dedup_key)
    SELECT user_id,'ANNOUNCEMENT',CASE WHEN p_approve THEN 'Assistant participation approved' ELSE 'Assistant participation declined' END,
      CASE WHEN p_approve THEN 'Your assistant participation is approved. Earnings count once the class is completed.' ELSE 'Contact your team leader for details.' END,
      '/portal/instructor/groups/'||v_group||'/sessions/'||s.id,'assistant_review:'||s.id||':'||p_instructor
      FROM public.instructors WHERE id=p_instructor ON CONFLICT(recipient_id,dedup_key) WHERE dedup_key IS NOT NULL DO NOTHING;
  PERFORM public.write_audit_log(p_performed_by=>p_actor,p_action=>'session.assistant.review',p_entity_type=>'schedule',p_entity_id=>s.id,p_new_values=>jsonb_build_object('instructor_id',p_instructor,'approved',p_approve),p_branch_id=>s.branch_id);
  RETURN jsonb_build_object('groupId',v_group,'sessionId',s.id,'state',CASE WHEN p_approve THEN 'confirmed' ELSE 'rejected' END);
END; $$;

-- Retain the proven allocation/topic/next-session logic behind a role-aware entry point.
ALTER FUNCTION public.start_instructor_group_session(uuid,uuid,uuid,text) RENAME TO start_instructor_group_session_before_roles;
CREATE FUNCTION public.open_role_instructor_session(p_actor uuid,p_instructor uuid,p_course uuid,p_expected_session uuid,p_expected_previous uuid,p_topic text,p_role text)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE v_group uuid; v_current public.schedules%ROWTYPE; v_next uuid; v_previous uuid; result jsonb;
BEGIN
  IF p_role IS NULL OR p_role NOT IN ('lead','assistant') THEN RAISE EXCEPTION 'Choose lead or assistant.' USING ERRCODE='22023'; END IF;
  SELECT group_id INTO v_group FROM public.group_courses WHERE id=p_course;
  PERFORM id FROM public.groups WHERE id=v_group AND deleted_at IS NULL FOR UPDATE;
  IF NOT FOUND OR NOT public.instructor_can_teach_group(p_actor,p_instructor,v_group) THEN RAISE EXCEPTION 'Instructor is not assigned to this group.' USING ERRCODE='42501'; END IF;
  SELECT * INTO v_current FROM public.schedules WHERE group_course_id=p_course AND status='ongoing' ORDER BY created_at,id LIMIT 1 FOR UPDATE;
  IF v_current.id IS NOT NULL THEN
    -- Legacy open classes without a recorded starter need an explicit lead
    -- choice. Claim the existing class under the same lock, never create one.
    IF v_current.lead_instructor_id IS NULL THEN
      IF p_role<>'lead' OR p_expected_session IS DISTINCT FROM v_current.id THEN
        RAISE EXCEPTION 'This legacy class needs an assigned instructor to resume it explicitly as lead.' USING ERRCODE='22023'; END IF;
      UPDATE public.schedules SET lead_instructor_id=p_instructor WHERE id=v_current.id;
      PERFORM public.write_audit_log(p_performed_by=>p_actor,p_action=>'session.legacy.claim_lead',p_entity_type=>'schedule',p_entity_id=>v_current.id,p_branch_id=>v_current.branch_id);
      RETURN public.record_session_participation(p_actor,p_instructor,v_current.id,'confirm');
    END IF;
    IF v_current.lead_instructor_id=p_instructor THEN RETURN jsonb_build_object('sessionId',v_current.id,'groupId',v_group,'teachingRole','lead'); END IF;
    IF p_role='assistant' THEN RETURN public.record_session_participation(p_actor,p_instructor,v_current.id,'request'); END IF;
    RAISE EXCEPTION 'Another instructor already started this class. Request assistant participation instead.' USING ERRCODE='22023';
  END IF;
  IF p_role='assistant' THEN RAISE EXCEPTION 'Ask the lead instructor to start this class, or start as lead if you are teaching in their place.' USING ERRCODE='22023'; END IF;
  SELECT id INTO v_next FROM public.schedules WHERE group_course_id=p_course AND status='scheduled' ORDER BY session_number NULLS LAST,scheduled_at,id LIMIT 1;
  SELECT id INTO v_previous FROM public.schedules WHERE group_course_id=p_course AND status='completed' ORDER BY ended_at DESC NULLS LAST,created_at DESC,id LIMIT 1;
  IF v_next IS DISTINCT FROM p_expected_session OR (v_next IS NULL AND v_previous IS DISTINCT FROM p_expected_previous) THEN RAISE EXCEPTION 'Session list changed. Refresh before starting.' USING ERRCODE='22023'; END IF;
  result:=public.start_instructor_group_session_before_roles(p_actor,p_instructor,p_course,p_topic);
  UPDATE public.schedules SET lead_instructor_id=p_instructor WHERE id=(result->>'sessionId')::uuid;
  RETURN public.record_session_participation(p_actor,p_instructor,(result->>'sessionId')::uuid,'confirm');
END; $$;
CREATE OR REPLACE FUNCTION public.open_shared_instructor_session(p_actor uuid,p_instructor uuid,p_course uuid,p_expected_session uuid,p_expected_previous uuid,p_topic text)
RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$
  SELECT public.open_role_instructor_session(p_actor,p_instructor,p_course,p_expected_session,p_expected_previous,p_topic,'lead');
$$;
CREATE FUNCTION public.start_instructor_group_session(p_actor_id uuid,p_instructor_id uuid,p_group_course_id uuid,p_topic text)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE v_group uuid; v_next uuid; v_previous uuid;
BEGIN
  SELECT group_id INTO v_group FROM public.group_courses WHERE id=p_group_course_id;
  PERFORM id FROM public.groups WHERE id=v_group FOR UPDATE;
  SELECT id INTO v_next FROM public.schedules WHERE group_course_id=p_group_course_id AND status='scheduled' ORDER BY session_number NULLS LAST,scheduled_at,id LIMIT 1;
  SELECT id INTO v_previous FROM public.schedules WHERE group_course_id=p_group_course_id AND status='completed' ORDER BY ended_at DESC NULLS LAST,created_at DESC,id LIMIT 1;
  RETURN public.open_role_instructor_session(p_actor_id,p_instructor_id,p_group_course_id,v_next,v_previous,p_topic,'lead');
END; $$;

-- Guard all legacy save callers too: assistants may never end the shared class.
ALTER FUNCTION public.save_shared_instructor_session(uuid,uuid,uuid,uuid,boolean,jsonb,text,integer) RENAME TO save_shared_instructor_session_before_roles;
CREATE FUNCTION public.save_shared_instructor_session(p_actor_id uuid,p_instructor_id uuid,p_session_id uuid,p_group_id uuid,p_complete boolean,p_attendance jsonb,p_topic text,p_expected_revision integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE s public.schedules%ROWTYPE;
BEGIN
  s:=public.lock_shared_instructor_session(p_actor_id,p_instructor_id,p_session_id);
  IF s.lead_instructor_id IS DISTINCT FROM p_instructor_id THEN RAISE EXCEPTION 'Only the lead instructor may save directly or end this class. Submit your changes for review.' USING ERRCODE='42501'; END IF;
  RETURN public.save_shared_instructor_session_before_roles(p_actor_id,p_instructor_id,p_session_id,p_group_id,p_complete,p_attendance,p_topic,p_expected_revision);
END; $$;

CREATE TABLE public.session_change_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.schedules(id),
  instructor_id uuid NOT NULL REFERENCES public.instructors(id),
  kind text NOT NULL CHECK(kind IN ('attendance','session_details','resources','recording_add','recording_remove','homework_create','homework_update','evaluation','student_note')),
  payload jsonb NOT NULL,
  base_value jsonb,
  status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')),
  created_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz, reviewed_by uuid REFERENCES public.users(id)
);
ALTER TABLE public.session_change_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.session_change_requests FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.session_change_requests TO service_role;
CREATE INDEX session_changes_pending ON public.session_change_requests(session_id,created_at) WHERE status='pending';
CREATE UNIQUE INDEX session_changes_dedup ON public.session_change_requests(session_id,instructor_id,kind,md5(payload::text)) WHERE status='pending';

CREATE FUNCTION public.session_change_base(p_session uuid,p_kind text,p_payload jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE s public.schedules%ROWTYPE; result jsonb;
BEGIN
  SELECT * INTO s FROM public.schedules WHERE id=p_session;
  IF p_kind='attendance' THEN RETURN jsonb_build_object('revision',s.attendance_revision); END IF;
  IF p_kind='resources' THEN RETURN coalesce(s.resources_links,'[]'::jsonb); END IF;
  IF p_kind='session_details' THEN
    SELECT coalesce(jsonb_object_agg(k,to_jsonb(s)->k),'{}'::jsonb) INTO result FROM jsonb_object_keys(p_payload) k;
    RETURN result;
  END IF;
  IF p_kind='homework_update' THEN SELECT to_jsonb(a) INTO result FROM public.assignments a WHERE id=(p_payload->>'assignment_id')::uuid AND schedule_id=p_session; RETURN result; END IF;
  IF p_kind='recording_remove' THEN SELECT to_jsonb(r) INTO result FROM public.session_recordings r WHERE id=(p_payload->>'recording_id')::uuid AND schedule_id=p_session; RETURN result; END IF;
  RETURN 'null'::jsonb;
END; $$;

CREATE FUNCTION public.stage_session_change(p_actor uuid,p_instructor uuid,p_session uuid,p_group uuid,p_kind text,p_payload jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE s public.schedules%ROWTYPE; v_group uuid; v_id uuid; v_lead_user uuid; v_base jsonb; v_student uuid;
BEGIN
  s:=public.lock_shared_instructor_session(p_actor,p_instructor,p_session);
  SELECT group_id INTO v_group FROM public.group_courses WHERE id=s.group_course_id;
  IF v_group IS DISTINCT FROM p_group OR s.status NOT IN ('ongoing','completed') THEN RAISE EXCEPTION 'Choose an ongoing or completed class in this group.' USING ERRCODE='22023'; END IF;
  IF s.lead_instructor_id=p_instructor THEN RETURN jsonb_build_object('direct',true); END IF;
  IF s.lead_instructor_id IS NULL THEN RAISE EXCEPTION 'This historical class needs an administrator to identify its lead instructor before changes can be reviewed.' USING ERRCODE='22023'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.session_participations WHERE session_id=s.id AND instructor_id=p_instructor AND state IN ('requested','confirmed')) THEN
    RAISE EXCEPTION 'Request assistant participation before submitting changes.' USING ERRCODE='42501'; END IF;
  IF p_kind IS NULL OR p_kind NOT IN ('attendance','session_details','resources','recording_add','recording_remove','homework_create','homework_update','evaluation','student_note')
    OR jsonb_typeof(p_payload)<>'object' OR octet_length(p_payload::text)>250000 THEN RAISE EXCEPTION 'Invalid change request.' USING ERRCODE='22023'; END IF;
  IF p_kind LIKE 'homework_%' AND NOT (CASE WHEN EXISTS(SELECT 1 FROM public.user_permissions WHERE user_id=p_actor)
    THEN EXISTS(SELECT 1 FROM public.user_permissions up JOIN public.permissions permission ON permission.id=up.permission_id WHERE up.user_id=p_actor AND permission.name='manage_courses')
    ELSE public.user_has_permission(p_actor,'manage_courses',NULL) END) THEN RAISE EXCEPTION 'Homework permission required.' USING ERRCODE='42501'; END IF;
  IF p_kind='evaluation' AND NOT public.instructor_can_teach_group(p_actor,p_instructor,v_group,'manage_evaluations') THEN RAISE EXCEPTION 'Evaluation permission required.' USING ERRCODE='42501'; END IF;
  IF p_kind IN ('evaluation','student_note') THEN
    v_student:=(p_payload->>'student_id')::uuid;
    IF NOT EXISTS(SELECT 1 FROM public.group_students WHERE group_id=v_group AND student_id=v_student AND status='active') THEN RAISE EXCEPTION 'Student is not in this group.' USING ERRCODE='42501'; END IF;
  END IF;
  v_base:=public.session_change_base(s.id,p_kind,p_payload);
  IF p_kind='attendance' AND p_payload->>'expected_revision' IS NOT NULL AND (p_payload->>'expected_revision')::integer<>s.attendance_revision THEN
    RAISE EXCEPTION 'Attendance changed. Reload the latest class before proposing changes.' USING ERRCODE='22023'; END IF;
  IF p_kind IN ('homework_update','recording_remove') AND v_base IS NULL THEN RAISE EXCEPTION 'The item does not belong to this class.' USING ERRCODE='42501'; END IF;
  SELECT id INTO v_id FROM public.session_change_requests WHERE session_id=s.id AND instructor_id=p_instructor AND kind=p_kind AND payload=p_payload AND status='pending';
  IF v_id IS NULL THEN
    INSERT INTO public.session_change_requests(session_id,instructor_id,kind,payload,base_value) VALUES(s.id,p_instructor,p_kind,p_payload,v_base) RETURNING id INTO v_id;
    SELECT user_id INTO v_lead_user FROM public.instructors WHERE id=s.lead_instructor_id;
    INSERT INTO public.notifications(recipient_id,type,title,body,href,dedup_key,data)
      VALUES(v_lead_user,'ANNOUNCEMENT','Assistant changes need your review','Review the proposed '||replace(p_kind,'_',' ')||' changes. Nothing has been published yet.',
        '/portal/instructor/groups/'||v_group||'/sessions/'||s.id||'#change-requests','session_change:'||v_id,jsonb_build_object('session_id',s.id,'change_id',v_id))
      ON CONFLICT(recipient_id,dedup_key) WHERE dedup_key IS NOT NULL DO NOTHING;
  END IF;
  RETURN jsonb_build_object('direct',false,'changeId',v_id,'sessionId',s.id,'groupId',v_group);
END; $$;

CREATE FUNCTION public.review_session_change(p_actor uuid,p_instructor uuid,p_request uuid,p_approve boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE s public.schedules%ROWTYPE; c public.session_change_requests%ROWTYPE; v_group uuid; payload jsonb; item jsonb; v_id uuid; v_user uuid; v_base jsonb;
BEGIN
  SELECT session_id INTO v_id FROM public.session_change_requests WHERE id=p_request;
  s:=public.lock_shared_instructor_session(p_actor,p_instructor,v_id);
  SELECT group_id INTO v_group FROM public.group_courses WHERE id=s.group_course_id;
  IF s.lead_instructor_id IS DISTINCT FROM p_instructor OR p_approve IS NULL THEN RAISE EXCEPTION 'Only the lead instructor can review these changes.' USING ERRCODE='42501'; END IF;
  SELECT * INTO c FROM public.session_change_requests WHERE id=p_request FOR UPDATE;
  IF c.status<>'pending' THEN RETURN jsonb_build_object('groupId',v_group,'sessionId',s.id,'state',c.status); END IF;
  IF NOT EXISTS(SELECT 1 FROM public.session_participations WHERE session_id=s.id AND instructor_id=c.instructor_id AND state IN ('requested','confirmed')) THEN RAISE EXCEPTION 'Assistant participation is no longer eligible.' USING ERRCODE='42501'; END IF;
  payload:=c.payload;
  IF p_approve THEN
    IF s.status NOT IN ('ongoing','completed') THEN RAISE EXCEPTION 'Only ongoing or completed classes can accept changes.' USING ERRCODE='22023'; END IF;
    SELECT user_id INTO v_user FROM public.instructors WHERE id=c.instructor_id;
    IF NOT public.instructor_can_teach_group(v_user,c.instructor_id,v_group) THEN
      RAISE EXCEPTION 'Assistant is no longer assigned to this group.' USING ERRCODE='42501'; END IF;
    IF c.kind='evaluation' AND NOT public.instructor_can_teach_group(v_user,c.instructor_id,v_group,'manage_evaluations') THEN
      RAISE EXCEPTION 'Assistant no longer has evaluation permission.' USING ERRCODE='42501'; END IF;
    v_base:=public.session_change_base(s.id,c.kind,payload);
    IF c.base_value IS DISTINCT FROM v_base THEN RAISE EXCEPTION 'This class changed after the request. Reject it and ask the assistant to resubmit against the latest version.' USING ERRCODE='22023'; END IF;
    SELECT user_id INTO v_user FROM public.instructors WHERE id=c.instructor_id;
    CASE c.kind
    WHEN 'attendance' THEN
      IF s.status='ongoing' THEN
        PERFORM public.save_shared_instructor_session_before_roles(p_actor,p_instructor,s.id,v_group,false,payload->'attendance',payload->>'topic',s.attendance_revision);
      ELSE
        IF s.status<>'completed' THEN RAISE EXCEPTION 'Cancelled classes cannot be edited.' USING ERRCODE='22023'; END IF;
        -- Historical review changes an existing attendance fact, never creates a
        -- second class/record or consumes a second contract slot.
        IF jsonb_typeof(payload->'attendance')<>'array' OR jsonb_array_length(payload->'attendance')=0
          OR EXISTS(SELECT 1 FROM jsonb_array_elements(payload->'attendance') a WHERE a->>'status' NOT IN ('present','absent','late','excused','makeup') OR a->>'status' IS NULL
            OR NOT EXISTS(SELECT 1 FROM public.attendance_records ar WHERE ar.schedule_id=s.id AND ar.student_id=(a->>'student_id')::uuid AND ar.invalidated_at IS NULL)) THEN
          RAISE EXCEPTION 'Historical attendance changes must reference valid existing attendance records.' USING ERRCODE='22023'; END IF;
        UPDATE public.attendance_records ar SET status=a->>'status',notes=nullif(a->>'notes',''),late_minutes=(a->>'late_minutes')::integer,recorded_by=p_actor,recorded_at=clock_timestamp()
          FROM jsonb_array_elements(payload->'attendance') a WHERE ar.schedule_id=s.id AND ar.student_id=(a->>'student_id')::uuid AND ar.invalidated_at IS NULL;
      END IF;
    WHEN 'session_details' THEN
      IF EXISTS(SELECT 1 FROM jsonb_object_keys(payload) k WHERE k NOT IN ('topic','notes','meeting_url','room','duration_minutes')) THEN RAISE EXCEPTION 'Invalid session fields.' USING ERRCODE='22023'; END IF;
      UPDATE public.schedules SET topic=CASE WHEN payload ? 'topic' THEN payload->>'topic' ELSE topic END,
        notes=CASE WHEN payload ? 'notes' THEN payload->>'notes' ELSE notes END,
        meeting_url=CASE WHEN payload ? 'meeting_url' THEN payload->>'meeting_url' ELSE meeting_url END,
        room=CASE WHEN payload ? 'room' THEN payload->>'room' ELSE room END,
        duration_minutes=CASE WHEN payload ? 'duration_minutes' THEN (payload->>'duration_minutes')::integer ELSE duration_minutes END WHERE id=s.id;
    WHEN 'resources' THEN UPDATE public.schedules SET resources_links=payload->'resources' WHERE id=s.id;
    WHEN 'recording_add' THEN
      INSERT INTO public.session_recordings(schedule_id,branch_id,external_url,title,provider,recorded_by,visible_to_students,visible_to_parents)
        VALUES(s.id,s.branch_id,payload->>'external_url',payload->>'title',payload->>'provider',v_user,true,false);
    WHEN 'recording_remove' THEN DELETE FROM public.session_recordings WHERE id=(payload->>'recording_id')::uuid AND schedule_id=s.id;
    WHEN 'homework_create' THEN
      IF nullif(payload->>'module_id','') IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.course_modules m JOIN public.group_courses gc ON gc.course_id=m.course_id WHERE m.id=(payload->>'module_id')::uuid AND gc.id=s.group_course_id) THEN RAISE EXCEPTION 'Module is not in this course.' USING ERRCODE='42501'; END IF;
      INSERT INTO public.assignments(module_id,schedule_id,title,description,instructions,type,submission_type,max_score,due_at,status,allow_late,resubmission_allowed,max_resubmissions,portfolio_eligible,rubric,created_by)
        VALUES(nullif(payload->>'module_id','')::uuid,s.id,payload->>'title',payload->>'description',payload->>'instructions',payload->>'type',payload->>'submission_type',(payload->>'max_score')::numeric,nullif(payload->>'due_at','')::timestamptz,'published',(payload->>'allow_late')::boolean,(payload->>'resubmission_allowed')::boolean,(payload->>'max_resubmissions')::integer,(payload->>'portfolio_eligible')::boolean,'[]'::jsonb,v_user);
    WHEN 'homework_update' THEN
      IF nullif(payload->>'module_id','') IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.course_modules m JOIN public.group_courses gc ON gc.course_id=m.course_id WHERE m.id=(payload->>'module_id')::uuid AND gc.id=s.group_course_id) THEN RAISE EXCEPTION 'Module is not in this course.' USING ERRCODE='42501'; END IF;
      UPDATE public.assignments SET module_id=nullif(payload->>'module_id','')::uuid,title=payload->>'title',description=payload->>'description',instructions=payload->>'instructions',
        type=payload->>'type',submission_type=payload->>'submission_type',max_score=(payload->>'max_score')::numeric,due_at=nullif(payload->>'due_at','')::timestamptz,
        allow_late=(payload->>'allow_late')::boolean,resubmission_allowed=(payload->>'resubmission_allowed')::boolean,max_resubmissions=(payload->>'max_resubmissions')::integer,portfolio_eligible=(payload->>'portfolio_eligible')::boolean
        WHERE id=(payload->>'assignment_id')::uuid AND schedule_id=s.id;
    WHEN 'evaluation' THEN
      IF NOT EXISTS(SELECT 1 FROM public.group_students WHERE group_id=v_group AND student_id=(payload->>'student_id')::uuid AND status='active') THEN RAISE EXCEPTION 'Student is no longer in this group.' USING ERRCODE='42501'; END IF;
      FOR item IN SELECT * FROM jsonb_array_elements(payload->'ratings') LOOP
        INSERT INTO public.student_evaluations(student_id,branch_id,group_id,schedule_id,criterion,custom_label,rating,score,feedback,author_id,visible_to_student,visible_to_parent)
          VALUES((payload->>'student_id')::uuid,s.branch_id,v_group,s.id,item->>'criterion',CASE WHEN item->>'criterion'='CUSTOM' THEN payload->>'custom_label' ELSE NULL END,
            (item->>'rating')::integer,(item->>'rating')::integer*20,payload->>'feedback',v_user,(payload->>'visible_to_student')::boolean,(payload->>'visible_to_parent')::boolean);
      END LOOP;
    WHEN 'student_note' THEN
      IF NOT EXISTS(SELECT 1 FROM public.group_students WHERE group_id=v_group AND student_id=(payload->>'student_id')::uuid AND status='active') THEN RAISE EXCEPTION 'Student is no longer in this group.' USING ERRCODE='42501'; END IF;
      INSERT INTO public.student_notes(student_id,author_id,content,category,severity,visibility,schedule_id)
        VALUES((payload->>'student_id')::uuid,v_user,payload->>'content',payload->>'category',payload->>'severity',payload->>'visibility',s.id);
    ELSE RAISE EXCEPTION 'Unsupported change.' USING ERRCODE='22023';
    END CASE;
    -- Notify the audience only after publication, never when a proposal is staged.
    IF c.kind IN ('homework_create','resources','evaluation') THEN
      INSERT INTO public.notifications(recipient_id,type,title,body,dedup_key)
      SELECT audience.user_id,'ANNOUNCEMENT',
        CASE c.kind WHEN 'evaluation' THEN 'New evaluation available' WHEN 'homework_create' THEN 'New homework available' ELSE 'New session resources available' END,
        'Your instructor has published an update. Open your portal to view it.', 'session_change_published:'||c.id
      FROM (
        SELECT st.user_id FROM public.group_students gs JOIN public.students st ON st.id=gs.student_id
          WHERE gs.group_id=v_group AND gs.status='active' AND st.user_id IS NOT NULL
          AND (c.kind<>'evaluation' OR (gs.student_id=(payload->>'student_id')::uuid AND coalesce((payload->>'visible_to_student')::boolean,false)))
        UNION
        SELECT parent.user_id FROM public.group_students gs JOIN public.parent_students ps ON ps.student_id=gs.student_id
          JOIN public.parents parent ON parent.id=ps.parent_id
          WHERE gs.group_id=v_group AND gs.status='active' AND ps.can_receive_notifications=true AND parent.user_id IS NOT NULL
          AND (c.kind<>'evaluation' OR (gs.student_id=(payload->>'student_id')::uuid AND coalesce((payload->>'visible_to_parent')::boolean,false)))
      ) audience
      ON CONFLICT(recipient_id,dedup_key) WHERE dedup_key IS NOT NULL DO NOTHING;
    END IF;
  END IF;
  UPDATE public.session_change_requests SET status=CASE WHEN p_approve THEN 'approved' ELSE 'rejected' END,reviewed_at=clock_timestamp(),reviewed_by=p_actor WHERE id=c.id;
  SELECT user_id INTO v_user FROM public.instructors WHERE id=c.instructor_id;
  INSERT INTO public.notifications(recipient_id,type,title,body,href,dedup_key) VALUES(v_user,'ANNOUNCEMENT',CASE WHEN p_approve THEN 'Your class changes were approved' ELSE 'Your class changes were declined' END,replace(c.kind,'_',' '),'/portal/instructor/groups/'||v_group||'/sessions/'||s.id,'session_change_review:'||c.id)
    ON CONFLICT(recipient_id,dedup_key) WHERE dedup_key IS NOT NULL DO NOTHING;
  PERFORM public.write_audit_log(p_performed_by=>p_actor,p_action=>'session.change.review',p_entity_type=>'schedule',p_entity_id=>s.id,p_new_values=>jsonb_build_object('request_id',c.id,'approved',p_approve,'author_id',v_user),p_branch_id=>s.branch_id);
  RETURN jsonb_build_object('groupId',v_group,'sessionId',s.id,'state',CASE WHEN p_approve THEN 'approved' ELSE 'rejected' END);
END; $$;
REVOKE ALL ON FUNCTION public.session_change_base(uuid,text,jsonb), public.stage_session_change(uuid,uuid,uuid,uuid,text,jsonb),public.review_session_change(uuid,uuid,uuid,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.session_change_base(uuid,text,jsonb), public.stage_session_change(uuid,uuid,uuid,uuid,text,jsonb),public.review_session_change(uuid,uuid,uuid,boolean) TO service_role;

CREATE FUNCTION public.assert_session_lead(p_actor uuid,p_instructor uuid,p_session uuid,p_group uuid) RETURNS boolean
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE s public.schedules%ROWTYPE;
BEGIN
  s:=public.lock_shared_instructor_session(p_actor,p_instructor,p_session);
  IF s.lead_instructor_id IS DISTINCT FROM p_instructor OR NOT EXISTS(SELECT 1 FROM public.group_courses WHERE id=s.group_course_id AND group_id=p_group) THEN
    RAISE EXCEPTION 'Only the lead instructor can end, cancel or postpone this class.' USING ERRCODE='42501'; END IF;
  RETURN true;
END; $$;
REVOKE ALL ON FUNCTION public.assert_session_lead(uuid,uuid,uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.assert_session_lead(uuid,uuid,uuid,uuid) TO service_role;

REVOKE ALL ON FUNCTION public.session_teaching_rate(uuid,uuid,text), public.open_role_instructor_session(uuid,uuid,uuid,uuid,uuid,text,text), public.start_instructor_group_session(uuid,uuid,uuid,text), public.start_instructor_group_session_before_roles(uuid,uuid,uuid,text),public.save_shared_instructor_session(uuid,uuid,uuid,uuid,boolean,jsonb,text,integer),public.save_shared_instructor_session_before_roles(uuid,uuid,uuid,uuid,boolean,jsonb,text,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.session_teaching_rate(uuid,uuid,text), public.open_role_instructor_session(uuid,uuid,uuid,uuid,uuid,text,text), public.start_instructor_group_session(uuid,uuid,uuid,text), public.start_instructor_group_session_before_roles(uuid,uuid,uuid,text),public.save_shared_instructor_session(uuid,uuid,uuid,uuid,boolean,jsonb,text,integer),public.save_shared_instructor_session_before_roles(uuid,uuid,uuid,uuid,boolean,jsonb,text,integer) TO service_role;
