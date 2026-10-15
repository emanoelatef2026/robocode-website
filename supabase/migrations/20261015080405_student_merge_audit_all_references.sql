-- Include alternate foreign-key columns (e.g. leads.converted_student_id),
-- not only tables using the conventional student_id column, in recovery data.
CREATE OR REPLACE FUNCTION private.enrich_student_merge_snapshot() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r RECORD; v_rows JSONB;
BEGIN
  FOR r IN SELECT c.conrelid::regclass table_name,a.attname col
    FROM pg_constraint c JOIN pg_attribute a ON a.attrelid=c.conrelid AND a.attnum=c.conkey[1]
    JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace
    WHERE c.contype='f' AND c.confrelid='public.students'::regclass AND n.nspname='public' AND a.attname<>'student_id'
      AND t.relname<>'students' LOOP
    EXECUTE format('select jsonb_agg(to_jsonb(x)) from %s x where %I in($1,$2)',r.table_name,r.col)
      INTO v_rows USING NEW.canonical_student_id,NEW.duplicate_student_id;
    IF v_rows IS NOT NULL THEN NEW.before_snapshot:=NEW.before_snapshot||jsonb_build_object(r.table_name::TEXT,v_rows); END IF;
  END LOOP;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.enrich_student_merge_snapshot() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER student_merge_snapshot_all_references BEFORE INSERT ON private.student_merge_audit
FOR EACH ROW EXECUTE FUNCTION private.enrich_student_merge_snapshot();
