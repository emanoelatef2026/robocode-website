-- Post-merge regression. Existing records are unchanged after ROLLBACK.
BEGIN;
SET LOCAL ROLE service_role;
SET LOCAL lock_timeout='5s';
DO $$
DECLARE v_keep UUID;v_old UUID;v_group UUID;v_saved UUID;v_user UUID;v_old_user UUID;v_rejected BOOLEAN;
BEGIN
  SELECT a.canonical_student_id,a.duplicate_student_id,k.user_id,d.user_id INTO STRICT v_keep,v_old,v_user,v_old_user
    FROM private.student_merge_audit a JOIN public.students k ON k.id=a.canonical_student_id
    JOIN public.students d ON d.id=a.duplicate_student_id
    WHERE EXISTS(SELECT 1 FROM public.group_students gs WHERE gs.student_id=k.id)
    ORDER BY a.duplicate_code LIMIT 1;
  IF public.resolve_merged_student_login(v_old_user) IS DISTINCT FROM v_user THEN RAISE EXCEPTION 'Old login no longer resolves to surviving account.'; END IF;
  IF NOT coalesce((public.merge_duplicate_student(v_keep,v_old)->>'already_merged')::BOOLEAN,FALSE) THEN RAISE EXCEPTION 'Merge retry was not idempotent.'; END IF;
  SELECT group_id INTO STRICT v_group FROM public.group_students WHERE student_id=v_keep LIMIT 1;
  INSERT INTO public.group_students AS gs(group_id,student_id,status,enrollment_type)
  VALUES(v_group,v_old,'active','primary') ON CONFLICT(group_id,student_id) DO UPDATE SET notes=gs.notes RETURNING student_id INTO v_saved;
  IF v_saved<>v_keep OR EXISTS(SELECT 1 FROM public.group_students WHERE student_id=v_old) THEN RAISE EXCEPTION 'Stale form created history under archived student.'; END IF;
  SELECT k.id,d.id INTO STRICT v_keep,v_old FROM public.students k JOIN public.students d
    ON d.identity_name_key=k.identity_name_key AND d.identity_phone_key=k.identity_phone_key AND d.id<>k.id
    WHERE k.deleted_at IS NULL AND d.deleted_at IS NULL AND k.age IS NOT NULL AND d.age IS NOT NULL AND k.age<>d.age
    ORDER BY k.student_code,d.student_code LIMIT 1;
  v_rejected:=FALSE;
  BEGIN
    PERFORM public.merge_duplicate_student(v_keep,v_old,FALSE);
  EXCEPTION WHEN raise_exception THEN v_rejected:=SQLERRM='Age conflict needs review.';
  END;
  IF NOT v_rejected THEN RAISE EXCEPTION 'Excluded age conflict was not protected.'; END IF;
END;
$$;
ROLLBACK;
SELECT 'PASS: old login resolves correctly, merge replay is idempotent, stale roster writes target the canonical student, age-conflict pair remains untouched' verification;
