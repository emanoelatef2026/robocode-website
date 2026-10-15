-- Identity is global across branches: exact normalized full name + phone.
-- Registration claims use a unique registry so concurrent requests cannot win.
CREATE SCHEMA IF NOT EXISTS private;
GRANT USAGE ON SCHEMA private TO service_role;
CREATE OR REPLACE FUNCTION public.student_identity_name(p_name TEXT) RETURNS TEXT
LANGUAGE sql IMMUTABLE STRICT SET search_path='' AS $$
  SELECT lower(regexp_replace(btrim(p_name),'\s+',' ','g'));
$$;
CREATE OR REPLACE FUNCTION public.student_identity_phone(p_phone TEXT) RETURNS TEXT
LANGUAGE sql IMMUTABLE SET search_path='' AS $$
  WITH x AS (SELECT regexp_replace(translate(coalesce(p_phone,''),'٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹','01234567890123456789'),'[^0-9]','','g') d)
  SELECT CASE WHEN d LIKE '0020%' THEN '0'||substr(d,5)
    WHEN length(d)=12 AND d LIKE '20%' THEN '0'||substr(d,3)
    WHEN length(d)=10 AND d LIKE '1%' THEN '0'||d ELSE d END FROM x;
$$;
ALTER TABLE public.students ADD COLUMN identity_name_key TEXT;
ALTER TABLE public.students ADD COLUMN identity_phone_key TEXT;
ALTER TABLE public.students ADD COLUMN merged_into_student_id UUID REFERENCES public.students(id);
CREATE INDEX idx_students_identity_lookup ON public.students(identity_name_key,identity_phone_key) WHERE deleted_at IS NULL;
CREATE INDEX idx_students_merged_into ON public.students(merged_into_student_id) WHERE merged_into_student_id IS NOT NULL;

CREATE TABLE private.student_identity_registry (
  name_key TEXT NOT NULL, phone_key TEXT NOT NULL,
  student_id UUID NOT NULL REFERENCES public.students(id),
  PRIMARY KEY(name_key,phone_key)
);
CREATE INDEX ON private.student_identity_registry(student_id);
CREATE TABLE private.student_merge_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), merged_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  canonical_student_id UUID NOT NULL, duplicate_student_id UUID NOT NULL UNIQUE,
  canonical_code TEXT, duplicate_code TEXT, before_snapshot JSONB NOT NULL
);
CREATE TABLE private.student_login_aliases (
  duplicate_user_id UUID PRIMARY KEY, canonical_user_id UUID NOT NULL REFERENCES public.users(id)
);
ALTER TABLE private.student_identity_registry ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.student_merge_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.student_login_aliases ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.student_identity_registry,private.student_merge_audit,private.student_login_aliases FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON private.student_identity_registry,private.student_merge_audit,private.student_login_aliases TO service_role;

UPDATE public.students s SET identity_name_key=public.student_identity_name(concat_ws(' ',p.first_name,p.last_name)),
  identity_phone_key=public.student_identity_phone(u.phone)
FROM public.users u JOIN public.profiles p ON p.user_id=u.id WHERE s.user_id=u.id;
INSERT INTO private.student_identity_registry(name_key,phone_key,student_id)
SELECT DISTINCT ON(identity_name_key,identity_phone_key) identity_name_key,identity_phone_key,id
FROM public.students WHERE deleted_at IS NULL AND identity_name_key<>'' AND length(identity_phone_key)>=7
ORDER BY identity_name_key,identity_phone_key,created_at,id;

CREATE OR REPLACE FUNCTION private.claim_student_identity(p_student_id UUID) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_name TEXT; v_phone TEXT; v_claim UUID; v_deleted TIMESTAMPTZ;
BEGIN
  SELECT s.deleted_at,public.student_identity_name(concat_ws(' ',p.first_name,p.last_name)),
    public.student_identity_phone(u.phone) INTO v_deleted,v_name,v_phone
  FROM public.students s LEFT JOIN public.users u ON u.id=s.user_id LEFT JOIN public.profiles p ON p.user_id=s.user_id
  WHERE s.id=p_student_id;
  DELETE FROM private.student_identity_registry WHERE student_id=p_student_id
    AND (v_deleted IS NOT NULL OR name_key IS DISTINCT FROM v_name OR phone_key IS DISTINCT FROM v_phone);
  UPDATE public.students SET identity_name_key=v_name,identity_phone_key=v_phone WHERE id=p_student_id;
  IF v_deleted IS NOT NULL THEN
    -- Pending review duplicates must remain protected if their registry owner
    -- is archived through the normal delete workflow.
    INSERT INTO private.student_identity_registry(name_key,phone_key,student_id)
    SELECT v_name,v_phone,s.id FROM public.students s WHERE s.deleted_at IS NULL
      AND s.identity_name_key=v_name AND s.identity_phone_key=v_phone
      AND v_name<>'' AND length(v_phone)>=7 ORDER BY s.created_at,s.id LIMIT 1
    ON CONFLICT(name_key,phone_key) DO NOTHING;
    RETURN;
  END IF;
  IF coalesce(v_name,'')='' OR length(v_phone)<7 THEN RETURN; END IF;
  INSERT INTO private.student_identity_registry AS reg(name_key,phone_key,student_id)
  VALUES(v_name,v_phone,p_student_id)
  ON CONFLICT(name_key,phone_key) DO UPDATE SET student_id=EXCLUDED.student_id
  WHERE reg.student_id=EXCLUDED.student_id RETURNING student_id INTO v_claim;
  IF v_claim IS NULL THEN
    RAISE EXCEPTION USING ERRCODE='23505', CONSTRAINT='uq_student_identity_name_phone',
      MESSAGE='A student with this full name and phone number already exists. Use the existing student instead.';
  END IF;
END;
$$;
CREATE OR REPLACE FUNCTION private.student_identity_student_trigger() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN PERFORM private.claim_student_identity(NEW.id); RETURN NEW; END;
$$;
CREATE TRIGGER student_identity_claim_insert AFTER INSERT ON public.students FOR EACH ROW EXECUTE FUNCTION private.student_identity_student_trigger();
CREATE TRIGGER student_identity_claim_update AFTER UPDATE OF user_id,deleted_at ON public.students FOR EACH ROW
WHEN (OLD.user_id IS DISTINCT FROM NEW.user_id OR OLD.deleted_at IS DISTINCT FROM NEW.deleted_at)
EXECUTE FUNCTION private.student_identity_student_trigger();
CREATE OR REPLACE FUNCTION private.student_identity_user_trigger() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r RECORD; v_user UUID;
BEGIN
  IF TG_TABLE_NAME='profiles' THEN v_user:=NEW.user_id; ELSE v_user:=NEW.id; END IF;
  FOR r IN SELECT id FROM public.students WHERE user_id=v_user AND deleted_at IS NULL LOOP
    PERFORM private.claim_student_identity(r.id);
  END LOOP;
  RETURN NEW;
END;
$$;
CREATE TRIGGER student_identity_phone_change AFTER UPDATE OF phone ON public.users FOR EACH ROW
WHEN (OLD.phone IS DISTINCT FROM NEW.phone) EXECUTE FUNCTION private.student_identity_user_trigger();
CREATE TRIGGER student_identity_name_change AFTER UPDATE OF first_name,last_name ON public.profiles FOR EACH ROW
WHEN (OLD.first_name IS DISTINCT FROM NEW.first_name OR OLD.last_name IS DISTINCT FROM NEW.last_name)
EXECUTE FUNCTION private.student_identity_user_trigger();
CREATE TRIGGER student_identity_profile_insert AFTER INSERT ON public.profiles FOR EACH ROW EXECUTE FUNCTION private.student_identity_user_trigger();
REVOKE ALL ON FUNCTION private.claim_student_identity(UUID),private.student_identity_student_trigger(),private.student_identity_user_trigger() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION private.claim_student_identity(UUID) TO service_role;

CREATE OR REPLACE FUNCTION public.find_student_identity(p_name TEXT,p_phone TEXT,p_exclude_id UUID DEFAULT NULL)
RETURNS TABLE(id UUID,student_code TEXT,branch_id UUID)
LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$
  SELECT s.id,s.student_code,s.branch_id FROM public.students s
  WHERE s.deleted_at IS NULL AND s.identity_name_key=public.student_identity_name(p_name)
    AND s.identity_phone_key=public.student_identity_phone(p_phone)
    AND length(s.identity_phone_key)>=7 AND (p_exclude_id IS NULL OR s.id<>p_exclude_id)
  ORDER BY s.created_at,s.id LIMIT 1;
$$;
CREATE OR REPLACE FUNCTION public.resolve_merged_student_login(p_user_id UUID) RETURNS UUID
LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$
  SELECT canonical_user_id FROM private.student_login_aliases WHERE duplicate_user_id=p_user_id;
$$;
REVOKE ALL ON FUNCTION public.find_student_identity(TEXT,TEXT,UUID),public.resolve_merged_student_login(UUID) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.find_student_identity(TEXT,TEXT,UUID),public.resolve_merged_student_login(UUID) TO service_role;

-- Administrative, service-only operation. Unknown collisions abort the entire
-- pair instead of deleting data or silently combining financial contracts.
CREATE OR REPLACE FUNCTION public.merge_duplicate_student(p_keep UUID,p_duplicate UUID,p_allow_age_conflict BOOLEAN DEFAULT FALSE)
RETURNS JSONB LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE k public.students%ROWTYPE; d public.students%ROWTYPE; r RECORD; v_row JSONB;
  v_snapshot JSONB:='{}'; v_data JSONB; v_other UUID; v_record UUID; v_portfolio UUID;
  v_kept UUID; v_drop UUID; v_n INTEGER; v_enrollments INTEGER; v_payments INTEGER; v_amount NUMERIC;
BEGIN
  IF p_keep IS NULL OR p_duplicate IS NULL OR p_keep=p_duplicate THEN RAISE EXCEPTION 'Choose two different students.'; END IF;
  PERFORM id FROM public.students WHERE id IN(p_keep,p_duplicate) ORDER BY id FOR UPDATE;
  SELECT * INTO k FROM public.students WHERE id=p_keep;
  SELECT * INTO d FROM public.students WHERE id=p_duplicate;
  IF d.merged_into_student_id=p_keep THEN RETURN jsonb_build_object('already_merged',true); END IF;
  IF k.id IS NULL OR d.id IS NULL OR k.deleted_at IS NOT NULL OR d.deleted_at IS NOT NULL THEN RAISE EXCEPTION 'Student unavailable.'; END IF;
  IF k.identity_name_key IS DISTINCT FROM d.identity_name_key OR k.identity_phone_key IS DISTINCT FROM d.identity_phone_key
    OR coalesce(k.identity_name_key,'')='' OR length(k.identity_phone_key)<7 THEN RAISE EXCEPTION 'Name and phone do not match.'; END IF;
  IF NOT p_allow_age_conflict AND k.age IS NOT NULL AND d.age IS NOT NULL AND k.age<>d.age THEN RAISE EXCEPTION 'Age conflict needs review.'; END IF;
  IF k.date_of_birth IS NOT NULL AND d.date_of_birth IS NOT NULL AND k.date_of_birth<>d.date_of_birth THEN RAISE EXCEPTION 'Birth date conflict needs review.'; END IF;
  SELECT count(*) INTO v_enrollments FROM public.student_enrollments WHERE student_id IN(p_keep,p_duplicate);
  SELECT count(*),coalesce(sum(amount),0) INTO v_payments,v_amount FROM public.finance_payments WHERE student_id IN(p_keep,p_duplicate);
  v_snapshot:=jsonb_build_object('students',jsonb_build_array(to_jsonb(k),to_jsonb(d)));
  SELECT jsonb_agg(to_jsonb(u)) INTO v_data FROM public.users u WHERE id IN(k.user_id,d.user_id);
  v_snapshot:=v_snapshot||jsonb_build_object('users',v_data);
  SELECT jsonb_agg(to_jsonb(p)) INTO v_data FROM public.profiles p WHERE user_id IN(k.user_id,d.user_id);
  v_snapshot:=v_snapshot||jsonb_build_object('profiles',v_data);
  FOR r IN SELECT c.table_name FROM information_schema.columns c JOIN information_schema.tables t USING(table_schema,table_name)
    WHERE c.table_schema='public' AND c.column_name='student_id' AND t.table_type='BASE TABLE' AND c.table_name NOT LIKE '\_backup%' LOOP
    EXECUTE format('select jsonb_agg(to_jsonb(t)) from public.%I t where student_id in($1,$2)',r.table_name) INTO v_data USING p_keep,p_duplicate;
    IF v_data IS NOT NULL THEN v_snapshot:=v_snapshot||jsonb_build_object(r.table_name,v_data); END IF;
  END LOOP;
  INSERT INTO private.student_merge_audit(canonical_student_id,duplicate_student_id,canonical_code,duplicate_code,before_snapshot)
  VALUES(p_keep,p_duplicate,k.student_code,d.student_code,v_snapshot);
  -- Registry ownership is switched only after all child data has been moved.
  DELETE FROM private.student_identity_registry WHERE student_id IN(p_keep,p_duplicate);

  -- Collapse only duplicate roster entries, remapping every contract first.
  FOR r IN SELECT gs.* FROM public.group_students gs WHERE gs.student_id=p_duplicate LOOP
    SELECT id INTO v_other FROM public.group_students WHERE student_id=p_keep AND group_id=r.group_id;
    IF v_other IS NOT NULL THEN
      UPDATE public.student_enrollments SET group_student_id=v_other WHERE group_student_id=r.id;
      UPDATE public.group_students SET status=CASE WHEN status='active' OR r.status='active' THEN 'active' ELSE status END,
        joined_at=least(joined_at,r.joined_at),left_at=CASE WHEN status='active' OR r.status='active' THEN NULL ELSE left_at END,
        notes=concat_ws(E'\n',nullif(notes,''),nullif(r.notes,'')) WHERE id=v_other;
      DELETE FROM public.group_students WHERE id=r.id;
    END IF;
  END LOOP;
  -- Preserve old-group history, but only one current same-course membership.
  FOR r IN SELECT id,row_number() OVER(PARTITION BY course_id ORDER BY
      (student_id=p_keep) DESC,joined_at DESC,id) rn
    FROM public.group_students WHERE student_id IN(p_keep,p_duplicate) AND status='active' AND course_id IS NOT NULL LOOP
    IF r.rn>1 THEN UPDATE public.group_students SET status='dropped',left_at=now(),
      notes=concat_ws(E'\n',notes,'Duplicate identity merged; preserved historical membership.') WHERE id=r.id; END IF;
  END LOOP;

  -- Attendance is unique per lesson. Never discard two funded records.
  FOR r IN SELECT a.id,a.schedule_id FROM public.attendance_records a WHERE a.student_id=p_duplicate LOOP
    SELECT id INTO v_other FROM public.attendance_records WHERE student_id=p_keep AND schedule_id=r.schedule_id;
    IF v_other IS NULL THEN CONTINUE; END IF;
    SELECT count(*) INTO v_n FROM public.attendance_consumptions WHERE attendance_record_id IN(r.id,v_other);
    IF v_n>1 THEN RAISE EXCEPTION 'Two funded attendance records for one lesson need manual financial review.'; END IF;
    IF EXISTS(SELECT 1 FROM public.attendance_consumptions WHERE attendance_record_id=r.id) THEN v_kept:=r.id;v_drop:=v_other;
    ELSE v_kept:=v_other;v_drop:=r.id; END IF;
    UPDATE public.attendance_records a SET notes=concat_ws(E'\n',nullif(a.notes,''),
      (SELECT nullif(notes,'') FROM public.attendance_records WHERE id=v_drop)) WHERE a.id=v_kept;
    DELETE FROM public.attendance_records WHERE id=v_drop;
  END LOOP;

  -- Keep all distinct guardian links; duplicate links share the same parent.
  DELETE FROM public.parent_students old USING public.parent_students kept
  WHERE old.student_id=p_duplicate AND kept.student_id=p_keep AND old.parent_id=kept.parent_id;
  -- A portfolio container can be combined without deleting any projects/badges.
  SELECT id INTO v_portfolio FROM public.student_portfolios WHERE student_id=p_keep;
  SELECT id INTO v_other FROM public.student_portfolios WHERE student_id=p_duplicate;
  IF v_portfolio IS NOT NULL AND v_other IS NOT NULL THEN
    FOR r IN SELECT conrelid::regclass table_name,a.attname col FROM pg_constraint c
      JOIN pg_attribute a ON a.attrelid=c.conrelid AND a.attnum=c.conkey[1]
      WHERE c.contype='f' AND c.confrelid='public.student_portfolios'::regclass LOOP
      EXECUTE format('update %s set %I=$1 where %I=$2',r.table_name,r.col,r.col) USING v_portfolio,v_other;
    END LOOP;
    DELETE FROM public.student_portfolios WHERE id=v_other;
  END IF;

  -- Discover every FK instead of maintaining an incomplete hand-written list.
  -- Also move legacy student references which lack a foreign key.
  FOR r IN SELECT DISTINCT table_name,col FROM (
      SELECT c.conrelid::regclass::text table_name,a.attname col FROM pg_constraint c
      JOIN pg_attribute a ON a.attrelid=c.conrelid AND a.attnum=c.conkey[1]
      WHERE c.contype='f' AND c.confrelid='public.students'::regclass
      UNION ALL SELECT 'public.'||x,'student_id' FROM unnest(ARRAY['attendance_consumptions','student_projects','welcome_message_logs']) x
    ) refs WHERE NOT(table_name IN('students','public.students') AND col='merged_into_student_id') LOOP
    EXECUTE format('update %s set %I=$1 where %I=$2',r.table_name,r.col,r.col) USING p_keep,p_duplicate;
  END LOOP;
  UPDATE public.students SET age=coalesce(k.age,d.age),date_of_birth=coalesce(k.date_of_birth,d.date_of_birth),
    school_grade=coalesce(nullif(k.school_grade,''),d.school_grade),grade=coalesce(nullif(k.grade,''),d.grade),
    address=coalesce(nullif(k.address,''),d.address),emergency_contact=coalesce(d.emergency_contact,'{}')||coalesce(k.emergency_contact,'{}'),
    notes=concat_ws(E'\n',nullif(k.notes,''),CASE WHEN k.notes IS DISTINCT FROM d.notes THEN nullif(d.notes,'') END),
    total_xp=greatest(k.total_xp,d.total_xp),current_level=greatest(k.current_level,d.current_level),
    current_streak=greatest(k.current_streak,d.current_streak),best_streak=greatest(k.best_streak,d.best_streak),
    last_activity_date=greatest(k.last_activity_date,d.last_activity_date) WHERE id=p_keep;
  UPDATE public.profiles kept SET date_of_birth=coalesce(kept.date_of_birth,old.date_of_birth),
    display_name=coalesce(nullif(kept.display_name,''),old.display_name),bio=coalesce(nullif(kept.bio,''),old.bio),
    gender=coalesce(nullif(kept.gender,''),old.gender),nationality=coalesce(nullif(kept.nationality,''),old.nationality)
  FROM public.profiles old WHERE kept.user_id=k.user_id AND old.user_id=d.user_id;
  UPDATE public.users kept SET avatar_url=coalesce(nullif(kept.avatar_url,''),old.avatar_url),
    recovery_email=coalesce(nullif(kept.recovery_email,''),old.recovery_email)
  FROM public.users old WHERE kept.id=k.user_id AND old.id=d.user_id;
  IF d.user_id IS NOT NULL AND k.user_id IS NOT NULL AND d.user_id<>k.user_id THEN
    INSERT INTO private.student_login_aliases VALUES(d.user_id,k.user_id)
    ON CONFLICT(duplicate_user_id) DO UPDATE SET canonical_user_id=EXCLUDED.canonical_user_id;
    UPDATE private.student_login_aliases SET canonical_user_id=k.user_id WHERE canonical_user_id=d.user_id;
  END IF;
  UPDATE public.students SET deleted_at=now(),merged_into_student_id=p_keep WHERE id=p_duplicate;
  PERFORM private.claim_student_identity(p_keep);
  IF (SELECT count(*) FROM public.student_enrollments WHERE student_id=p_keep)<>v_enrollments THEN RAISE EXCEPTION 'Contract preservation check failed.'; END IF;
  IF (SELECT count(*) FROM public.finance_payments WHERE student_id=p_keep)<>v_payments OR
    (SELECT coalesce(sum(amount),0) FROM public.finance_payments WHERE student_id=p_keep)<>v_amount THEN
    RAISE EXCEPTION 'Payment preservation check failed.';
  END IF;
  RETURN jsonb_build_object('kept',k.student_code,'merged',d.student_code,'contracts_preserved',v_enrollments,'payments_preserved',v_payments);
END;
$$;
REVOKE ALL ON FUNCTION public.merge_duplicate_student(UUID,UUID,BOOLEAN) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.merge_duplicate_student(UUID,UUID,BOOLEAN) TO service_role;
NOTIFY pgrst,'reload schema';
