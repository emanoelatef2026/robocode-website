-- Real database regression, all writes rolled back. No auth accounts created.
BEGIN;
SET LOCAL lock_timeout='5s';
DO $$
DECLARE v_existing public.students%ROWTYPE; v_user UUID; v_student UUID;
  v_constraint TEXT; v_rejected BOOLEAN; v_name TEXT; v_phone TEXT;
BEGIN
  SELECT * INTO STRICT v_existing FROM public.students WHERE deleted_at IS NULL
    AND identity_name_key<>'' AND length(identity_phone_key)>=7 ORDER BY created_at,id LIMIT 1;
  SELECT p.user_id INTO STRICT v_user FROM public.profiles p
    WHERE NOT EXISTS(SELECT 1 FROM public.students s WHERE s.user_id=p.user_id) ORDER BY p.user_id LIMIT 1;
  SELECT concat_ws(' ',first_name,last_name) INTO v_name FROM public.profiles WHERE user_id=v_existing.user_id;
  SELECT phone INTO v_phone FROM public.users WHERE id=v_existing.user_id;
  UPDATE public.profiles SET first_name=v_name,last_name='' WHERE user_id=v_user;
  UPDATE public.users SET phone='+20'||substr(public.student_identity_phone(v_phone),2) WHERE id=v_user;
  v_rejected:=FALSE;
  BEGIN
    INSERT INTO public.students(user_id,branch_id,status) VALUES(v_user,v_existing.branch_id,'active');
  EXCEPTION WHEN unique_violation THEN
    GET STACKED DIAGNOSTICS v_constraint=CONSTRAINT_NAME;
    v_rejected:=v_constraint='uq_student_identity_name_phone';
  END;
  IF NOT v_rejected THEN RAISE EXCEPTION 'Exact identity was not blocked by the database guard.'; END IF;
  -- Same phone is allowed for another child with a genuinely different name.
  UPDATE public.profiles SET first_name=v_name||' Identity Regression Only' WHERE user_id=v_user;
  INSERT INTO public.students(user_id,branch_id,status) VALUES(v_user,v_existing.branch_id,'active') RETURNING id INTO v_student;
  v_rejected:=FALSE;
  BEGIN
    UPDATE public.profiles SET first_name=v_name WHERE user_id=v_user;
  EXCEPTION WHEN unique_violation THEN
    GET STACKED DIAGNOSTICS v_constraint=CONSTRAINT_NAME;
    v_rejected:=v_constraint='uq_student_identity_name_phone';
  END;
  IF NOT v_rejected THEN RAISE EXCEPTION 'Renaming an existing student bypassed the duplicate guard.'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.students WHERE id=v_student AND identity_name_key LIKE '%identity regression only') THEN
    RAISE EXCEPTION 'A rejected rename partially changed the registered identity.';
  END IF;
END;
$$;
ROLLBACK;
SELECT 'PASS: exact normalized name/phone rejected, same phone for another child allowed, profile rename rejected atomically; all test writes rolled back' verification;
