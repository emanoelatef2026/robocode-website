-- Create the manager's in-app notification in the same transaction as the claim.
CREATE FUNCTION public.notify_session_participation_request(p_session uuid,p_instructor uuid)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE s public.schedules%ROWTYPE; v_name text; v_group text; v_key text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.session_participations
    WHERE session_id=p_session AND instructor_id=p_instructor AND state='requested') THEN RETURN; END IF;
  SELECT * INTO s FROM public.schedules WHERE id=p_session;
  IF s.id IS NULL THEN RETURN; END IF;
  SELECT g.name INTO v_group FROM public.group_courses gc JOIN public.groups g ON g.id=gc.group_id WHERE gc.id=s.group_course_id;
  SELECT nullif(btrim(concat_ws(' ',p.first_name,p.last_name)),'') INTO v_name
    FROM public.instructors i LEFT JOIN public.profiles p ON p.user_id=i.user_id WHERE i.id=p_instructor;
  v_key:='session_participation_request:'||p_session::text||':'||p_instructor::text;
  INSERT INTO public.notifications(recipient_id,type,title,body,href,dedup_key,data)
    SELECT ur.user_id,'SESSION_PARTICIPATION_REQUESTED','Teaching participation approval requested',
      format('%s requested participation in %s — session #%s (%s).',
        coalesce(v_name,'Instructor'),coalesce(v_group,'Group'),coalesce(s.session_number::text,'—'),
        to_char(s.scheduled_at AT TIME ZONE 'Africa/Cairo','DD Mon YYYY')),
      CASE WHEN bool_or(r.name='super_admin') THEN '/admin/instructors#participation-approvals'
        ELSE '/portal/team-leader/instructors#participation-approvals' END,
      v_key,jsonb_build_object('session_id',p_session,'instructor_id',p_instructor,'branch_id',s.branch_id)
    FROM public.user_roles ur JOIN public.roles r ON r.id=ur.role_id
    WHERE (r.name='super_admin' OR (r.name='team_leader' AND ur.branch_id=s.branch_id))
      AND EXISTS (SELECT 1 FROM public.role_permissions rp JOIN public.permissions permission ON permission.id=rp.permission_id
        WHERE rp.role_id=ur.role_id AND permission.name='manage_instructors')
    GROUP BY ur.user_id
    ON CONFLICT(recipient_id,dedup_key) WHERE dedup_key IS NOT NULL DO NOTHING;
END; $$;
REVOKE ALL ON FUNCTION public.notify_session_participation_request(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.notify_session_participation_request(uuid,uuid) TO service_role;

CREATE FUNCTION public.on_session_participation_requested() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
  IF NEW.state='requested' AND (TG_OP='INSERT' OR OLD.state IS DISTINCT FROM 'requested') THEN
    PERFORM public.notify_session_participation_request(NEW.session_id,NEW.instructor_id);
  END IF;
  RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.on_session_participation_requested() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.on_session_participation_requested() TO service_role;
CREATE TRIGGER session_participation_requested_notification
  AFTER INSERT OR UPDATE OF state ON public.session_participations
  FOR EACH ROW EXECUTE FUNCTION public.on_session_participation_requested();

-- Existing pending claims get exactly one notification as well; resolved claims do not.
DO $$ BEGIN
  PERFORM public.notify_session_participation_request(session_id,instructor_id)
    FROM public.session_participations WHERE state='requested';
END; $$;
