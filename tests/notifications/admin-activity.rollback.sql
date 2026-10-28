-- Synthetic identities only; run in BEGIN/ROLLBACK after the activity migration.
SELECT set_config('request.jwt.claims','{"role":"service_role"}',true);
CREATE FUNCTION private.activity_fixture_delivery_failure() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF current_setting('activity.test_fail_delivery',true)='true' AND NEW.recipient_id::text=current_setting('activity.test_recipient',true) THEN
    RAISE EXCEPTION 'Synthetic delivery failure'; END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER activity_fixture_delivery_failure BEFORE INSERT ON public.notifications FOR EACH ROW EXECUTE FUNCTION private.activity_fixture_delivery_failure();
DO $test$
DECLARE admin_user uuid:=gen_random_uuid(); staff_user uuid:=gen_random_uuid(); outsider uuid:=gen_random_uuid(); group_id uuid:=gen_random_uuid(); student_id uuid:=gen_random_uuid(); contract uuid:=gen_random_uuid(); payment uuid; account uuid; branch uuid; course uuid; admin_role uuid; event_id uuid; notif uuid; result jsonb; unread bigint;
BEGIN
  SELECT id INTO branch FROM public.branches WHERE deleted_at IS NULL LIMIT 1;
  SELECT id INTO admin_role FROM public.roles WHERE name='super_admin';
  INSERT INTO auth.users(id,email,raw_user_meta_data,raw_app_meta_data,aud,role)
    SELECT id,'activity-'||id||'@robocodeschools.com','{}','{}','authenticated','authenticated' FROM unnest(ARRAY[admin_user,staff_user,outsider]) x(id);
  INSERT INTO public.user_roles(user_id,role_id,branch_id) VALUES(admin_user,admin_role,branch);
  PERFORM set_config('request.headers',jsonb_build_object('x-activity-actor',staff_user)::text,true);
  INSERT INTO public.groups(id,branch_id,name,status) VALUES(group_id,branch,'Synthetic activity group','active');
  SELECT id INTO event_id FROM public.admin_activity_events WHERE entity_id=group_id AND action='groups.created';
  ASSERT event_id IS NOT NULL,'Group action not recorded';
  ASSERT (SELECT actor_user_id FROM public.admin_activity_events WHERE id=event_id)=staff_user,'Verified server actor missing';
  ASSERT EXISTS(SELECT 1 FROM public.notifications WHERE recipient_id=admin_user AND type='ADMIN_ACTIVITY' AND data->>'activity_id'=event_id::text),'Admin not notified';
  ASSERT NOT EXISTS(SELECT 1 FROM public.notifications WHERE recipient_id=outsider AND type='ADMIN_ACTIVITY'),'Activity leaked to non-admin';
  UPDATE public.groups SET capacity=8 WHERE id=group_id;
  UPDATE public.groups SET capacity=10 WHERE id=group_id;
  SELECT id INTO notif FROM public.notifications WHERE recipient_id=admin_user AND data->>'activity_id' IN (SELECT id::text FROM public.admin_activity_events WHERE entity_id=group_id AND action='groups.updated');
  ASSERT (SELECT (data->>'count')::integer FROM public.notifications WHERE id=notif)=2,'Similar updates not grouped';
  ASSERT public.mark_admin_notification_read(admin_user,notif,NULL),'Own notification not readable';
  UPDATE public.groups SET capacity=12 WHERE id=group_id;
  ASSERT NOT EXISTS(SELECT 1 FROM public.notification_reads WHERE notification_id=notif AND user_id=admin_user),'New grouped activity stayed read';
  ASSERT NOT public.mark_admin_notification_read(outsider,notif,NULL),'Another user could read admin notification';
  ASSERT NOT public.mark_admin_notification_read(admin_user,notif,'2000-01-01'),'A stale read swallowed a newer grouped operation';
  result:=public.admin_activity_feed(admin_user,'groups',NULL,NULL,NULL,0,NULL);
  ASSERT (result->>'total')::integer>=4,'Activity pagination lost events';
  BEGIN
    PERFORM public.admin_activity_feed(outsider);
    RAISE EXCEPTION 'Non-admin accessed feed' USING ERRCODE='P0004';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  -- Explicit whitelist strips credentials, free text, receipts and nested data.
  result:=private.activity_safe_fields('{"amount":100,"password":"private-value","notes":"private-value","receipt_image":"private-value","metadata":{"token":"private-value"}}');
  ASSERT result='{"amount":100}'::jsonb,'Sensitive data leaked';
  UPDATE public.groups SET robocode_share_percent=75 WHERE id=group_id;
  ASSERT EXISTS(SELECT 1 FROM public.admin_activity_events WHERE entity_id=group_id AND (after_data->>'robocode_share_percent')::numeric=75),'Share ratio absent';
  INSERT INTO public.system_event_logs(type,severity,module,message,payload,actor_user_id) VALUES('SECURITY_DENIAL','warning','synthetic','Private error details','{"password":"private-value"}',staff_user) RETURNING id INTO event_id;
  ASSERT EXISTS(SELECT 1 FROM public.admin_activity_events WHERE source_key='system:'||event_id AND priority='urgent'),'Security denial missing';
  ASSERT NOT EXISTS(SELECT 1 FROM public.notifications WHERE recipient_id=admin_user AND (body LIKE '%private-value%' OR body LIKE '%Private error details%')),'Private error leaked into bell';
  SELECT id INTO course FROM public.courses WHERE deleted_at IS NULL LIMIT 1;
  INSERT INTO public.students(id,user_id,branch_id) VALUES(student_id,outsider,branch);
  INSERT INTO public.student_enrollments(id,student_id,branch_id,group_id,course_id,status,enrolled_sessions,total_amount,discount_amount,created_by)
    VALUES(contract,student_id,branch,group_id,course,'ACTIVE',12,1000,100,staff_user);
  SELECT id INTO account FROM public.student_financial_accounts WHERE enrollment_id=contract LIMIT 1;
  IF account IS NULL THEN INSERT INTO public.student_financial_accounts(student_id,branch_id,enrollment_id,total_amount) VALUES(student_id,branch,contract,1000) RETURNING id INTO account; END IF;
  INSERT INTO public.finance_payments(student_id,account_id,enrollment_id,amount,payment_date,payment_method,created_by,notes)
    VALUES(student_id,account,contract,100,current_date,'cash',staff_user,'private-value') RETURNING id INTO payment;
  ASSERT EXISTS(SELECT 1 FROM public.admin_activity_events WHERE entity_id=payment AND after_data->>'amount' IS NOT NULL),'Payment missing';
  UPDATE public.finance_payments SET amount=120 WHERE id=payment;
  ASSERT EXISTS(SELECT 1 FROM public.admin_activity_events WHERE entity_id=payment AND priority='urgent' AND (after_data->>'amount')::numeric=120),'Payment correction not urgent';
  UPDATE public.student_enrollments SET discount_amount=150 WHERE id=contract;
  ASSERT EXISTS(SELECT 1 FROM public.admin_activity_events WHERE entity_id=contract AND priority='urgent' AND (after_data->>'discount_amount')::numeric=150),'Discount change missing';
  INSERT INTO public.parent_messages(parent_user_id,student_id,branch_id,category,message,status) VALUES(outsider,student_id,branch,'academic_concern','private-value','submitted') RETURNING id INTO event_id;
  ASSERT EXISTS(SELECT 1 FROM public.admin_activity_events WHERE entity_id=event_id AND requires_action AND resolved_at IS NULL),'Parent complaint did not require action';
  UPDATE public.parent_messages SET status='resolved' WHERE id=event_id;
  ASSERT NOT EXISTS(SELECT 1 FROM public.admin_activity_events WHERE entity_id=event_id AND requires_action AND resolved_at IS NULL),'Resolved complaint stayed pending';
  PERFORM set_config('request.jwt.claims',jsonb_build_object('role','authenticated','sub',outsider)::text,true);
  UPDATE public.groups SET capacity=13 WHERE id=group_id;
  ASSERT EXISTS(SELECT 1 FROM public.admin_activity_events WHERE entity_id=group_id AND (after_data->>'capacity')::integer=13 AND actor_user_id=outsider),'Untrusted header overrode authenticated identity';
  PERFORM set_config('request.jwt.claims','{"role":"service_role"}',true);
  -- A bell delivery outage cannot roll back or lose the durable event.
  PERFORM set_config('activity.test_recipient',admin_user::text,true);
  PERFORM set_config('activity.test_fail_delivery','true',true);
  event_id:=private.activity_record('synthetic-retry:'||gen_random_uuid(),staff_user,'system','urgent','synthetic.failure','system_event_logs',gen_random_uuid(),'Synthetic alert',NULL,branch,'{}','{}','/admin/system-events',true);
  ASSERT EXISTS(SELECT 1 FROM public.admin_activity_events WHERE id=event_id AND NOT delivered AND delivery_error IS NOT NULL),'Failed delivery lost the event';
  PERFORM set_config('activity.test_fail_delivery','false',true);
  PERFORM private.activity_publish(event_id);
  PERFORM private.activity_publish(event_id);
  ASSERT (SELECT count(*) FROM public.notifications WHERE recipient_id=admin_user AND data->>'activity_id'=event_id::text)=1,'Delivery retry duplicated notification';
  PERFORM public.mark_all_admin_notifications_read(admin_user);
  ASSERT public.notification_unread_count(admin_user)=0,'Mark all left unread items';
  ASSERT NOT has_table_privilege('authenticated','public.admin_activity_events','SELECT'),'Activity table exposed';
  ASSERT NOT has_function_privilege('authenticated','public.admin_activity_feed(uuid,text,text,text,text,integer,uuid)','EXECUTE'),'Privileged feed exposed';
END; $test$;
SELECT 'PASS: actor attribution, admin-only delivery, grouping, unread reset, stale reads, data redaction, feed authorization, security alerts and retry idempotency' AS verification;
