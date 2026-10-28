-- Fixed, private trigger pipeline. No passwords, notes, credentials, request
-- bodies, receipts or arbitrary JSON payloads enter this activity feed.
CREATE SCHEMA IF NOT EXISTS private;
-- Some installations predate the optional observability migration.
CREATE TABLE IF NOT EXISTS public.system_event_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),type text NOT NULL,severity text NOT NULL DEFAULT 'error',
  module text NOT NULL,message text NOT NULL,actor_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  branch_id uuid,entity_type text,entity_id uuid,payload jsonb NOT NULL DEFAULT '{}',
  resolved boolean NOT NULL DEFAULT false,resolved_at timestamptz,created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.system_event_logs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.system_event_logs FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.system_event_logs TO service_role;
CREATE INDEX IF NOT EXISTS activity_system_events_recent ON public.system_event_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS activity_system_actor ON public.system_event_logs(actor_user_id) WHERE actor_user_id IS NOT NULL;
CREATE TABLE public.admin_activity_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), source_key text NOT NULL UNIQUE,
  actor_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL, actor_name text NOT NULL,
  category text NOT NULL CHECK(category IN ('sessions','finance','people','groups','learning','security','system')),
  priority text NOT NULL CHECK(priority IN ('urgent','action','info')),
  action text NOT NULL, entity_type text NOT NULL, entity_id uuid,
  entity_label text NOT NULL, context_id uuid, branch_id uuid,
  before_data jsonb NOT NULL DEFAULT '{}', after_data jsonb NOT NULL DEFAULT '{}',
  target_href text NOT NULL, requires_action boolean NOT NULL DEFAULT false,
  resolved_at timestamptz, resolved_by uuid REFERENCES public.users(id),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  delivered boolean NOT NULL DEFAULT false, delivery_error text
);
ALTER TABLE public.admin_activity_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.admin_activity_events FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.admin_activity_events TO service_role;
CREATE INDEX admin_activity_recent ON public.admin_activity_events(created_at DESC,id);
CREATE INDEX admin_activity_filter ON public.admin_activity_events(category,priority,created_at DESC);
CREATE INDEX admin_activity_unresolved ON public.admin_activity_events(created_at DESC) WHERE requires_action AND resolved_at IS NULL;
CREATE INDEX admin_activity_delivery ON public.admin_activity_events(created_at) WHERE NOT delivered;
CREATE INDEX admin_activity_actor ON public.admin_activity_events(actor_user_id,created_at DESC) WHERE actor_user_id IS NOT NULL;
CREATE INDEX admin_activity_resolver ON public.admin_activity_events(resolved_by) WHERE resolved_by IS NOT NULL;
CREATE INDEX notifications_activity_event ON public.notifications((data->>'activity_id')) WHERE type='ADMIN_ACTIVITY';

CREATE FUNCTION private.activity_safe_fields(p_value jsonb) RETURNS jsonb
LANGUAGE sql IMMUTABLE SET search_path='' AS $$
 SELECT coalesce(jsonb_object_agg(key,value),'{}'::jsonb) FROM jsonb_each(CASE WHEN jsonb_typeof(p_value)='object' THEN p_value ELSE '{}'::jsonb END)
 WHERE key=ANY(ARRAY['status','state','role','type','amount','total_amount','discount_amount','net_amount','payment_method','payment_date',
   'start_date','end_date','scheduled_at','duration_minutes','enrolled_sessions','consumed_sessions','remaining_sessions','financial_status','reversal_type',
   'capacity','robocode_share_percent','robocode_share_pct','salary_per_session','assistant_salary_per_session','session_rate','agreed_rate',
   'student_id','group_id','course_id','instructor_id','session_id','schedule_id','permission_id','role_id','branch_id','category','active','is_active',
   'from_session','to_session','allocation_status','rating','score','criterion','visible_to_student','visible_to_parent','deleted_at','invalidated_at','kind','severity'])
   AND jsonb_typeof(value) IN ('string','number','boolean','null') AND length(value::text)<=160;
$$;

CREATE FUNCTION private.activity_actor() RETURNS uuid LANGUAGE plpgsql STABLE SET search_path='' AS $$
DECLARE actor text; claims jsonb:=coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb;
BEGIN
  IF coalesce(claims->>'role',current_setting('request.jwt.claim.role',true))='service_role' THEN
    actor:=coalesce(nullif(current_setting('request.headers',true),''),'{}')::jsonb->>'x-activity-actor';
  ELSE actor:=claims->>'sub'; END IF;
  IF actor ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    AND EXISTS(SELECT 1 FROM public.users WHERE id=actor::uuid) THEN RETURN actor::uuid; END IF;
  RETURN NULL;
END; $$;

CREATE FUNCTION private.activity_publish(p_id uuid) RETURNS void LANGUAGE plpgsql SET search_path='' AS $$
DECLARE e public.admin_activity_events%ROWTYPE; recipient uuid; key text; notif uuid; body text; tally integer;
BEGIN
  SELECT * INTO e FROM public.admin_activity_events WHERE id=p_id FOR UPDATE;
  IF NOT FOUND OR e.delivered THEN RETURN; END IF;
  BEGIN
    -- Participation requests already have an atomic, actionable staff notification.
    IF NOT (e.entity_type='session_participations' AND e.action='session_participations.requested') THEN
      FOR recipient IN SELECT DISTINCT ur.user_id FROM public.user_roles ur JOIN public.roles r ON r.id=ur.role_id WHERE r.name='super_admin' LOOP
        key:='admin_activity:'||CASE WHEN e.priority='info' OR e.category='system' THEN
          concat_ws(':',e.category,e.action,coalesce(e.actor_user_id::text,'system'),coalesce(e.context_id::text,e.entity_id::text,'all'),floor(extract(epoch FROM e.created_at)/300)::text)
          ELSE e.id::text END;
        body:=e.actor_name||' · '||e.entity_label;
        INSERT INTO public.notifications AS n(recipient_id,type,title,body,href,dedup_key,data)
          VALUES(recipient,'ADMIN_ACTIVITY',replace(initcap(replace(e.action,'_',' ')),'.',' · '),body,e.target_href,key,
            jsonb_build_object('activity_id',e.id,'category',e.category,'priority',e.priority,'count',1,'requires_action',e.requires_action))
          ON CONFLICT(recipient_id,dedup_key) WHERE dedup_key IS NOT NULL DO UPDATE SET
            body=excluded.body,href=excluded.href,created_at=clock_timestamp(),
            data=excluded.data||jsonb_build_object('count',coalesce((n.data->>'count')::integer,1)+1)
          RETURNING id INTO notif;
        -- A new operation in a grouped notification must become unread again.
        DELETE FROM public.notification_reads WHERE notification_id=notif AND user_id=recipient;
      END LOOP;
    END IF;
    UPDATE public.admin_activity_events SET delivered=true,delivery_error=NULL WHERE id=e.id;
  EXCEPTION WHEN OTHERS THEN
    -- Persist the event even if bell delivery fails; the worker retries it.
    UPDATE public.admin_activity_events SET delivery_error=SQLSTATE WHERE id=e.id;
  END;
END; $$;

CREATE FUNCTION private.activity_record(p_source text,p_actor uuid,p_category text,p_priority text,p_action text,p_table text,p_entity uuid,p_label text,p_context uuid,p_branch uuid,p_before jsonb,p_after jsonb,p_href text,p_requires boolean DEFAULT false)
RETURNS uuid LANGUAGE plpgsql SET search_path='' AS $$
DECLARE event_id uuid; person text;
BEGIN
  SELECT nullif(btrim(concat_ws(' ',first_name,last_name)),'') INTO person FROM public.profiles WHERE user_id=p_actor;
  INSERT INTO public.admin_activity_events(source_key,actor_user_id,actor_name,category,priority,action,entity_type,entity_id,entity_label,context_id,branch_id,before_data,after_data,target_href,requires_action)
    VALUES(p_source,p_actor,coalesce(left(person,100),CASE WHEN p_actor IS NULL THEN 'System / background operation' ELSE 'Account '||left(p_actor::text,8) END),p_category,p_priority,left(p_action,100),p_table,p_entity,left(p_label,180),p_context,p_branch,
      private.activity_safe_fields(p_before),private.activity_safe_fields(p_after),p_href,p_requires)
    ON CONFLICT(source_key) DO NOTHING RETURNING id INTO event_id;
  IF event_id IS NOT NULL THEN PERFORM private.activity_publish(event_id); END IF;
  RETURN event_id;
END; $$;

-- Definer is confined to a non-exposed schema: RLS-protected student writes also
-- need the internal trigger to record activity and notify super admins. No SQL or
-- recipient is supplied by a caller; only the fixed trigger tables below run it.
CREATE FUNCTION private.capture_admin_activity() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE old_row jsonb:='{}'; new_row jsonb:='{}'; row_data jsonb; before_safe jsonb; after_safe jsonb;
  actor uuid; entity uuid; context uuid; branch uuid; student uuid; group_id uuid; instructor uuid;
  category text:='people'; priority text:='info'; verb text; label text; href text; source text; needs boolean:=false; status_value text;
BEGIN
  IF TG_OP<>'INSERT' THEN old_row:=to_jsonb(OLD); END IF;
  IF TG_OP<>'DELETE' THEN new_row:=to_jsonb(NEW); END IF;
  before_safe:=private.activity_safe_fields(old_row); after_safe:=private.activity_safe_fields(new_row);
  IF TG_OP='UPDATE' AND before_safe=after_safe AND TG_TABLE_NAME NOT IN ('users','profiles','students','parents','instructors','groups','courses','student_videos','student_projects','assignments') THEN RETURN NEW; END IF;
  IF TG_OP='UPDATE' AND (old_row-ARRAY['updated_at','last_seen_at'])=(new_row-ARRAY['updated_at','last_seen_at']) THEN RETURN NEW; END IF;
  row_data:=CASE WHEN TG_OP='DELETE' THEN old_row ELSE new_row END;
  actor:=private.activity_actor();
  IF actor IS NULL AND TG_OP='INSERT' THEN actor:=coalesce(nullif(row_data->>'created_by',''),nullif(row_data->>'recorded_by',''),nullif(row_data->>'author_id',''),nullif(row_data->>'granted_by',''))::uuid; END IF;
  IF actor IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.users WHERE id=actor) THEN actor:=NULL; END IF;
  entity:=nullif(row_data->>'id','')::uuid;
  student:=nullif(row_data->>'student_id','')::uuid; group_id:=nullif(row_data->>'group_id','')::uuid;
  branch:=nullif(row_data->>'branch_id','')::uuid; instructor:=nullif(row_data->>'instructor_id','')::uuid;
  context:=coalesce(nullif(row_data->>'schedule_id',''),nullif(row_data->>'session_id',''))::uuid;
  IF context IS NOT NULL THEN
    SELECT gc.group_id,s.branch_id INTO group_id,branch FROM public.schedules s JOIN public.group_courses gc ON gc.id=s.group_course_id WHERE s.id=context;
  END IF;
  IF group_id IS NOT NULL THEN SELECT g.branch_id INTO branch FROM public.groups g WHERE g.id=group_id; END IF;
  IF branch IS NULL AND student IS NOT NULL THEN SELECT st.branch_id INTO branch FROM public.students st WHERE st.id=student; END IF;
  verb:=CASE TG_OP WHEN 'INSERT' THEN 'created' WHEN 'DELETE' THEN 'deleted' ELSE 'updated' END;
  IF TG_OP='UPDATE' AND old_row->>'deleted_at' IS NULL AND new_row->>'deleted_at' IS NOT NULL THEN verb:='deleted'; END IF;
  status_value:=coalesce(row_data->>'state',row_data->>'status');
  label:=replace(TG_TABLE_NAME,'_',' '); href:='/admin/system-events';
  CASE
  WHEN TG_TABLE_NAME IN ('finance_payments','finance_payment_reversals','student_enrollments','student_financial_accounts','staff_payment_records') THEN
    category:='finance'; href:=CASE WHEN student IS NOT NULL THEN '/admin/students/'||student ELSE '/admin/finance-center' END;
    IF TG_TABLE_NAME='finance_payment_reversals' OR TG_OP<>'INSERT' THEN priority:='urgent'; END IF;
    IF TG_TABLE_NAME='student_enrollments' THEN
      -- Derived consumption/balance updates are already explained by attendance/payment.
      IF TG_OP='UPDATE' AND (before_safe-ARRAY['consumed_sessions','remaining_sessions','net_amount'])=(after_safe-ARRAY['consumed_sessions','remaining_sessions','net_amount'])
        AND old_row->>'total_amount'=new_row->>'total_amount' AND old_row->>'discount_amount'=new_row->>'discount_amount' THEN priority:='info'; verb:='consumption_updated'; END IF;
      label:='Contract '||coalesce(row_data->>'contract_code',left(entity::text,8));
    ELSE label:=replace(TG_TABLE_NAME,'_',' ')||' · EGP '||coalesce(row_data->>'amount','0'); END IF;
  WHEN TG_TABLE_NAME IN ('schedules','attendance_records','session_participations','session_change_requests','session_recordings') THEN
    category:='sessions';
    IF TG_TABLE_NAME='schedules' THEN
      context:=entity;
      SELECT gc.group_id INTO group_id FROM public.group_courses gc WHERE gc.id=nullif(row_data->>'group_course_id','')::uuid;
      IF TG_OP='UPDATE' AND old_row->>'status' IS DISTINCT FROM new_row->>'status' THEN verb:=status_value; END IF;
      IF TG_OP='UPDATE' AND (before_safe-ARRAY['consumed_sessions','remaining_sessions'])=(after_safe-ARRAY['consumed_sessions','remaining_sessions']) AND old_row->>'status'=new_row->>'status'
        AND old_row->>'topic'=new_row->>'topic' AND old_row->>'notes'=new_row->>'notes' AND old_row->'resources_links'=new_row->'resources_links' AND old_row->>'meeting_url'=new_row->>'meeting_url' THEN RETURN NEW; END IF;
    END IF;
    IF TG_TABLE_NAME='session_participations' THEN
      entity:=context;
      IF TG_OP='UPDATE' AND old_row->>'state'=new_row->>'state' THEN RETURN NEW; END IF;
      IF TG_OP<>'DELETE' THEN verb:=coalesce(status_value,verb); needs:=status_value='requested'; END IF;
      IF needs THEN priority:='action'; END IF;
    END IF;
    IF TG_TABLE_NAME='session_change_requests' THEN
      IF TG_OP='UPDATE' AND old_row->>'status'=new_row->>'status' THEN RETURN NEW; END IF;
      IF TG_OP<>'DELETE' THEN verb:=coalesce(status_value,verb); END IF;
    END IF;
    href:=CASE WHEN group_id IS NOT NULL THEN '/admin/groups/'||group_id ELSE '/admin/sessions' END;
    IF needs THEN href:='/admin/instructors#participation-approvals'; END IF;
    label:=CASE WHEN group_id IS NOT NULL THEN coalesce((SELECT name FROM public.groups WHERE id=group_id),'Group') ELSE 'Class' END||' · '||replace(TG_TABLE_NAME,'_',' ');
  WHEN TG_TABLE_NAME IN ('groups','group_students','group_instructors') THEN
    category:='groups'; group_id:=CASE WHEN TG_TABLE_NAME='groups' THEN entity ELSE group_id END;
    href:='/admin/groups/'||group_id;
    label:=coalesce((SELECT g.name FROM public.groups g WHERE g.id=group_id),'Group')||' · '||replace(TG_TABLE_NAME,'_',' ');
  WHEN TG_TABLE_NAME IN ('user_roles','user_permissions') THEN category:='security'; priority:='urgent'; entity:=nullif(row_data->>'user_id','')::uuid; href:='/admin/staff';
  WHEN TG_TABLE_NAME IN ('student_evaluations','assignments','student_projects','student_videos','courses','student_notes','assignment_submissions') THEN
    category:='learning'; href:=CASE WHEN student IS NOT NULL THEN '/admin/students/'||student WHEN TG_TABLE_NAME='courses' THEN '/admin/courses/'||entity ELSE '/admin/assignments' END;
    -- Private note content never enters either the bell or the event snapshots.
  WHEN TG_TABLE_NAME IN ('parent_feedback','parent_messages') THEN category:='people'; priority:=CASE WHEN status_value='resolved' THEN 'info' ELSE 'action' END; needs:=status_value IS DISTINCT FROM 'resolved'; href:='/portal/team-leader/parent-feedback'||CASE WHEN TG_TABLE_NAME='parent_feedback' THEN '?tab=satisfaction' ELSE '?tab=messages' END; label:=CASE WHEN TG_TABLE_NAME='parent_messages' THEN 'Parent message · '||coalesce(row_data->>'category','general') ELSE 'Parent feedback' END;
  WHEN TG_TABLE_NAME='leads' THEN category:='people'; href:='/admin/leads/'||entity; label:='Lead · '||coalesce(row_data->>'child_name','New enquiry');
  WHEN TG_TABLE_NAME='branches' THEN category:='groups'; href:='/admin/branches'; label:='Branch · '||coalesce(row_data->>'name','Branch');
  ELSE
    href:=CASE TG_TABLE_NAME WHEN 'students' THEN '/admin/students/'||entity WHEN 'parents' THEN '/admin/parents/'||entity WHEN 'instructors' THEN '/admin/instructors/'||entity ELSE '/admin/staff' END;
  END CASE;
  IF TG_TABLE_NAME='instructors' AND (old_row->>'salary_per_session' IS DISTINCT FROM new_row->>'salary_per_session' OR old_row->>'assistant_salary_per_session' IS DISTINCT FROM new_row->>'assistant_salary_per_session') AND TG_OP='UPDATE' THEN priority:='urgent'; END IF;
  IF TG_TABLE_NAME='group_instructors' AND TG_OP='UPDATE' AND old_row->>'session_rate' IS DISTINCT FROM new_row->>'session_rate' THEN priority:='urgent'; END IF;
  IF TG_OP='DELETE' OR verb='deleted' THEN priority:='urgent'; END IF;
  IF TG_OP='DELETE' THEN needs:=false; END IF;
  IF verb='deleted' THEN href:=CASE TG_TABLE_NAME WHEN 'students' THEN '/admin/students' WHEN 'groups' THEN '/admin/groups' WHEN 'instructors' THEN '/admin/instructors' WHEN 'parents' THEN '/admin/parents' ELSE '/admin/system-events' END; END IF;
  IF TG_TABLE_NAME='students' THEN student:=entity; END IF;
  IF student IS NOT NULL THEN
    label:=coalesce((SELECT nullif(btrim(concat_ws(' ',p.first_name,p.last_name)),'') FROM public.students st JOIN public.profiles p ON p.user_id=st.user_id WHERE st.id=student),'Student')||' · '||label;
  ELSIF TG_TABLE_NAME IN ('parents','instructors') THEN
    label:=coalesce((SELECT nullif(btrim(concat_ws(' ',p.first_name,p.last_name)),'') FROM public.profiles p WHERE p.user_id=nullif(row_data->>'user_id','')::uuid),'Account')||' · '||label;
  END IF;
  IF instructor IS NOT NULL AND TG_TABLE_NAME IN ('group_instructors','session_participations') THEN
    label:=coalesce((SELECT nullif(btrim(concat_ws(' ',p.first_name,p.last_name)),'') FROM public.instructors i JOIN public.profiles p ON p.user_id=i.user_id WHERE i.id=instructor),'Instructor')||' · '||label;
  END IF;
  source:=concat_ws(':','row',txid_current(),TG_TABLE_NAME,coalesce(row_data->>'id',row_data->>'user_id',context::text),instructor::text,verb,md5(before_safe::text||after_safe::text));
  PERFORM private.activity_record(source,actor,category,priority,TG_TABLE_NAME||'.'||verb,TG_TABLE_NAME,entity,label,coalesce(context,group_id,student,entity),branch,before_safe,after_safe,href,needs);
  IF TG_TABLE_NAME IN ('session_participations','session_change_requests') AND ((TG_OP='UPDATE' AND status_value IN ('confirmed','approved','rejected')) OR TG_OP='DELETE') THEN
    UPDATE public.admin_activity_events SET resolved_at=clock_timestamp(),resolved_by=actor
      WHERE entity_type=TG_TABLE_NAME AND context_id=context AND requires_action AND resolved_at IS NULL
      AND (TG_TABLE_NAME<>'session_participations' OR after_data->>'instructor_id'=instructor::text);
  END IF;
  IF TG_TABLE_NAME='parent_messages' AND (status_value='resolved' OR TG_OP='DELETE') THEN
    UPDATE public.admin_activity_events SET resolved_at=clock_timestamp(),resolved_by=actor WHERE entity_type='parent_messages' AND entity_id=entity AND requires_action AND resolved_at IS NULL;
  END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; END IF; RETURN NEW;
END; $$;

CREATE FUNCTION private.capture_admin_audit() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE priority text:='info'; category text:='people'; href text:='/admin/system-events';
BEGIN
  -- These operations have row-level coverage; do not notify twice for one action.
  IF (NEW.action IN ('create','update','delete') AND NEW.entity_type IN ('student','students','parent','parents','instructor','instructors','group','groups','course','courses','student_enrollments','user','users','assignment','assignments','lead','leads','branch','branches'))
    OR NEW.action IN ('record_attendance','session.start','session.start_direct','session.end','session.cancel','session.postpone','session.assistant.request','session.assistant.review','session.change.review','session.legacy.claim_lead','assign_group','enroll_student','add_allocation','edit_allocation_range')
    OR NEW.action ~ '^student_(note|evaluation|competition)\.' THEN RETURN NEW; END IF;
  IF NEW.action ~* '(^|[._])(read|view|search|list)([._]|$)' THEN RETURN NEW; END IF;
  IF NEW.action ~* '(password|credential|permission|role|access)' THEN category:='security'; priority:='urgent'; END IF;
  IF NEW.action ~* '(payment|refund|revers|discount|consum|contract|enrollment)' THEN category:='finance'; priority:='urgent'; END IF;
  PERFORM private.activity_record('audit:'||NEW.id,NEW.performed_by,category,priority,NEW.action,NEW.entity_type,NEW.entity_id,
    replace(NEW.entity_type,'_',' '),NEW.entity_id,NEW.branch_id,NEW.old_values,NEW.new_values,href,false);
  RETURN NEW;
END; $$;
CREATE TRIGGER super_admin_audit_activity AFTER INSERT ON public.audit_logs FOR EACH ROW EXECUTE FUNCTION private.capture_admin_audit();

CREATE FUNCTION private.capture_admin_system_event() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  IF TG_OP='UPDATE' THEN
    IF NEW.resolved AND NOT OLD.resolved THEN UPDATE public.admin_activity_events SET resolved_at=clock_timestamp() WHERE source_key='system:'||NEW.id; END IF;
    RETURN NEW;
  END IF;
  IF NEW.severity NOT IN ('error','critical') AND NEW.type<>'SECURITY_DENIAL' THEN RETURN NEW; END IF;
  PERFORM private.activity_record('system:'||NEW.id,NEW.actor_user_id,CASE WHEN NEW.type='SECURITY_DENIAL' THEN 'security' ELSE 'system' END,'urgent',NEW.type,'system_event_logs',NEW.id,
    'System alert · '||left(NEW.module,80),NEW.entity_id,NEW.branch_id,'{}',jsonb_build_object('severity',NEW.severity),'/admin/system-events',true);
  RETURN NEW;
END; $$;
CREATE TRIGGER super_admin_system_activity AFTER INSERT OR UPDATE OF resolved ON public.system_event_logs FOR EACH ROW EXECUTE FUNCTION private.capture_admin_system_event();

CREATE FUNCTION private.sync_activity_resolution() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  IF NEW.resolved_at IS NOT NULL THEN
    UPDATE public.notifications SET data=jsonb_set(data,'{requires_action}','false') WHERE type='ADMIN_ACTIVITY' AND data->>'activity_id'=NEW.id::text;
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER sync_activity_resolution AFTER UPDATE OF resolved_at ON public.admin_activity_events FOR EACH ROW EXECUTE FUNCTION private.sync_activity_resolution();

DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['finance_payments','finance_payment_reversals','student_enrollments','student_financial_accounts','staff_payment_records','schedules','attendance_records','session_participations','session_change_requests','session_recordings','groups','group_students','group_instructors','users','profiles','students','parents','instructors','user_roles','user_permissions','student_evaluations','student_notes','assignments','assignment_submissions','student_projects','student_videos','courses','parent_feedback','parent_messages','leads','branches'] LOOP
    IF to_regclass('public.'||t) IS NOT NULL THEN EXECUTE format('CREATE TRIGGER super_admin_activity AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION private.capture_admin_activity()',t); END IF;
  END LOOP;
END; $$;

CREATE FUNCTION private.require_activity_admin(actor uuid) RETURNS void LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
  IF actor IS NULL OR NOT EXISTS(SELECT 1 FROM public.user_roles ur JOIN public.roles r ON r.id=ur.role_id WHERE ur.user_id=actor AND r.name='super_admin') THEN
    RAISE EXCEPTION 'Super admin access required.' USING ERRCODE='42501'; END IF;
END; $$;

CREATE FUNCTION public.admin_activity_feed(p_actor uuid,p_category text DEFAULT NULL,p_priority text DEFAULT NULL,p_state text DEFAULT NULL,p_search text DEFAULT NULL,p_offset integer DEFAULT 0,p_event uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE result jsonb; total bigint;
BEGIN
  PERFORM private.require_activity_admin(p_actor);
  SELECT count(*) INTO total FROM public.admin_activity_events e WHERE
    (p_category IS NULL OR e.category=p_category) AND (p_priority IS NULL OR e.priority=p_priority)
    AND (p_state IS DISTINCT FROM 'pending' OR (e.requires_action AND e.resolved_at IS NULL))
    AND (p_state IS DISTINCT FROM 'resolved' OR e.resolved_at IS NOT NULL)
    AND (p_event IS NULL OR e.id=p_event)
    AND (p_search IS NULL OR e.actor_name ILIKE '%'||left(p_search,100)||'%' OR e.entity_label ILIKE '%'||left(p_search,100)||'%' OR e.action ILIKE '%'||left(p_search,100)||'%');
  SELECT coalesce(jsonb_agg(to_jsonb(x)),'[]') INTO result FROM (
    SELECT e.id,e.actor_name,e.category,e.priority,e.action,e.entity_type,e.entity_label,e.before_data,e.after_data,e.target_href,e.requires_action,e.resolved_at,e.created_at
    FROM public.admin_activity_events e WHERE (p_category IS NULL OR e.category=p_category) AND (p_priority IS NULL OR e.priority=p_priority)
      AND (p_state IS DISTINCT FROM 'pending' OR (e.requires_action AND e.resolved_at IS NULL)) AND (p_state IS DISTINCT FROM 'resolved' OR e.resolved_at IS NOT NULL)
      AND (p_event IS NULL OR e.id=p_event)
      AND (p_search IS NULL OR e.actor_name ILIKE '%'||left(p_search,100)||'%' OR e.entity_label ILIKE '%'||left(p_search,100)||'%' OR e.action ILIKE '%'||left(p_search,100)||'%')
    ORDER BY e.created_at DESC,e.id DESC LIMIT 50 OFFSET greatest(0,least(coalesce(p_offset,0),100000))
  )x;
  RETURN jsonb_build_object('events',result,'total',total);
END; $$;

CREATE FUNCTION public.acknowledge_admin_activity(p_actor uuid,p_event uuid) RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE e public.admin_activity_events%ROWTYPE;
BEGIN
  PERFORM private.require_activity_admin(p_actor);
  SELECT * INTO e FROM public.admin_activity_events WHERE id=p_event FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Activity not found.' USING ERRCODE='22023'; END IF;
  IF e.priority='action' AND e.entity_type IN ('session_participations','session_change_requests','parent_messages') THEN RAISE EXCEPTION 'Review the actual request; acknowledging an alert does not approve or resolve it.' USING ERRCODE='22023'; END IF;
  UPDATE public.admin_activity_events SET resolved_at=coalesce(resolved_at,clock_timestamp()),resolved_by=coalesce(resolved_by,p_actor) WHERE id=e.id;
END; $$;

CREATE TABLE private.activity_scan_state(id boolean PRIMARY KEY DEFAULT true CHECK(id),checked_at timestamptz NOT NULL);
INSERT INTO private.activity_scan_state VALUES(true,'epoch');
CREATE FUNCTION public.refresh_admin_activity(p_actor uuid DEFAULT NULL) RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE r record;
BEGIN
  IF p_actor IS NOT NULL THEN PERFORM private.require_activity_admin(p_actor); END IF;
  FOR r IN SELECT id FROM public.admin_activity_events WHERE NOT delivered ORDER BY created_at LIMIT 50 LOOP PERFORM private.activity_publish(r.id); END LOOP;
  IF NOT pg_try_advisory_xact_lock(768445921) THEN RETURN; END IF;
  UPDATE private.activity_scan_state SET checked_at=clock_timestamp() WHERE id AND checked_at<clock_timestamp()-interval '15 minutes';
  IF NOT FOUND THEN RETURN; END IF;
  FOR r IN SELECT s.id,s.branch_id,gc.group_id,g.name FROM public.schedules s JOIN public.group_courses gc ON gc.id=s.group_course_id JOIN public.groups g ON g.id=gc.group_id
    WHERE s.status='ongoing' AND s.started_at IS NOT NULL AND s.started_at+make_interval(mins=>coalesce(s.duration_minutes,90)+60)<clock_timestamp() LIMIT 50 LOOP
    PERFORM private.activity_record('stale_session:'||r.id||':'||current_date,NULL,'sessions','action','session.overdue','schedules',r.id,r.name,r.id,r.branch_id,'{}','{}','/admin/groups/'||r.group_id,true);
  END LOOP;
  UPDATE public.admin_activity_events e SET resolved_at=clock_timestamp() WHERE e.action='session.overdue' AND e.resolved_at IS NULL
    AND EXISTS(SELECT 1 FROM public.schedules s WHERE s.id=e.entity_id AND s.status<>'ongoing');
END; $$;

CREATE FUNCTION public.notification_unread_count(p_user uuid) RETURNS bigint LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$
 SELECT count(*) FROM public.notifications n WHERE n.recipient_id=p_user AND NOT EXISTS(SELECT 1 FROM public.notification_reads r WHERE r.notification_id=n.id AND r.user_id=p_user);
$$;
CREATE FUNCTION public.mark_admin_notification_read(p_user uuid,p_notification uuid,p_expected_at timestamptz DEFAULT NULL) RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE n public.notifications%ROWTYPE;
BEGIN
 SELECT * INTO n FROM public.notifications WHERE id=p_notification AND recipient_id=p_user FOR UPDATE;
 IF NOT FOUND OR (p_expected_at IS NOT NULL AND n.created_at>p_expected_at) THEN RETURN false; END IF;
 INSERT INTO public.notification_reads(notification_id,user_id) VALUES(n.id,p_user) ON CONFLICT(notification_id,user_id) DO NOTHING;
 RETURN true;
END; $$;
CREATE FUNCTION public.mark_all_admin_notifications_read(p_user uuid) RETURNS void LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$
 WITH cutoff AS MATERIALIZED (SELECT clock_timestamp() AS at), locked AS MATERIALIZED (SELECT n.id FROM public.notifications n,cutoff WHERE n.recipient_id=p_user AND n.created_at<=cutoff.at FOR UPDATE OF n)
 INSERT INTO public.notification_reads(notification_id,user_id) SELECT id,p_user FROM locked ON CONFLICT(notification_id,user_id) DO NOTHING;
$$;
REVOKE ALL ON FUNCTION private.activity_safe_fields(jsonb),private.activity_actor(),private.activity_publish(uuid),private.activity_record(text,uuid,text,text,text,text,uuid,text,uuid,uuid,jsonb,jsonb,text,boolean),private.capture_admin_activity(),private.capture_admin_audit(),private.capture_admin_system_event(),private.require_activity_admin(uuid),private.sync_activity_resolution() FROM PUBLIC,anon,authenticated;
GRANT USAGE ON SCHEMA private TO service_role;
GRANT EXECUTE ON FUNCTION private.activity_safe_fields(jsonb),private.require_activity_admin(uuid),private.activity_publish(uuid),private.activity_record(text,uuid,text,text,text,text,uuid,text,uuid,uuid,jsonb,jsonb,text,boolean) TO service_role;
GRANT ALL ON private.activity_scan_state TO service_role;
REVOKE ALL ON FUNCTION public.admin_activity_feed(uuid,text,text,text,text,integer,uuid),public.acknowledge_admin_activity(uuid,uuid),public.refresh_admin_activity(uuid),public.notification_unread_count(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.admin_activity_feed(uuid,text,text,text,text,integer,uuid),public.acknowledge_admin_activity(uuid,uuid),public.refresh_admin_activity(uuid),public.notification_unread_count(uuid) TO service_role;
REVOKE ALL ON FUNCTION public.mark_admin_notification_read(uuid,uuid,timestamptz),public.mark_all_admin_notifications_read(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.mark_admin_notification_read(uuid,uuid,timestamptz),public.mark_all_admin_notifications_read(uuid) TO service_role;
