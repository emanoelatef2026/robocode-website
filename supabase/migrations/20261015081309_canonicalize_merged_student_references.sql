-- Stale forms/imports must not attach new history to an archived duplicate.
CREATE OR REPLACE FUNCTION private.canonical_student_reference() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_id UUID; v_next UUID; i INTEGER;
BEGIN
  v_id:=(to_jsonb(NEW)->>TG_ARGV[0])::UUID;
  IF v_id IS NULL THEN RETURN NEW; END IF;
  FOR i IN 1..16 LOOP
    -- Wait for an in-flight merge before resolving the destination. A simple
    -- unlocked read could see the old ID, then wait on its FK check too late.
    SELECT merged_into_student_id INTO v_next FROM public.students WHERE id=v_id FOR KEY SHARE;
    IF v_next IS NULL THEN
      NEW:=jsonb_populate_record(NEW,jsonb_build_object(TG_ARGV[0],v_id));
      RETURN NEW;
    END IF;
    v_id:=v_next;
  END LOOP;
  RAISE EXCEPTION 'Student merge chain needs administrative review.';
END;
$$;
REVOKE ALL ON FUNCTION private.canonical_student_reference() FROM PUBLIC,anon,authenticated;
DO $$ DECLARE r RECORD;
BEGIN
  FOR r IN SELECT DISTINCT table_name,col FROM (
      SELECT c.conrelid::regclass::TEXT table_name,a.attname col FROM pg_constraint c
      JOIN pg_attribute a ON a.attrelid=c.conrelid AND a.attnum=c.conkey[1]
      JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace
      WHERE c.contype='f' AND c.confrelid='public.students'::regclass AND n.nspname='public'
        AND t.relname<>'students' AND t.relname NOT LIKE '\_backup%'
      UNION ALL SELECT 'public.'||x,'student_id' FROM unnest(ARRAY['attendance_consumptions','student_projects','welcome_message_logs']) x
    ) refs LOOP
    EXECUTE format('CREATE TRIGGER %I BEFORE INSERT OR UPDATE OF %I ON %s FOR EACH ROW EXECUTE FUNCTION private.canonical_student_reference(%L)',
      'canonical_merged_'||r.col,r.col,r.table_name,r.col);
  END LOOP;
END;
$$;
