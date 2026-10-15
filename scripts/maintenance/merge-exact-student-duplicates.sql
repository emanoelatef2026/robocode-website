-- Reviewed 15 October 2026. DRY RUN BY DEFAULT: final ROLLBACK is intentional.
-- Retains distinct financial contracts/payments. Private audit stores originals.
-- User explicitly excluded the two clusters with conflicting ages.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='60s';
CREATE TEMP TABLE merge_plan ON COMMIT DROP AS
WITH scored AS (
  SELECT s.id,s.student_code,s.identity_name_key,s.identity_phone_key,s.created_at,
    (SELECT count(*) FROM jsonb_each(to_jsonb(s)-ARRAY['id','user_id','student_code','branch_id','created_at','updated_at','status','enrollment_date','identity_name_key','identity_phone_key','merged_into_student_id']) e
      WHERE e.value NOT IN ('null','""','0','{}','[]'))
    + CASE WHEN EXISTS(SELECT 1 FROM public.student_enrollments WHERE student_id=s.id) THEN 2 ELSE 0 END
    + CASE WHEN EXISTS(SELECT 1 FROM public.attendance_records WHERE student_id=s.id) THEN 2 ELSE 0 END
    + CASE WHEN EXISTS(SELECT 1 FROM public.student_portfolios WHERE student_id=s.id) THEN 1 ELSE 0 END
    + CASE WHEN EXISTS(SELECT 1 FROM public.certificates WHERE student_id=s.id) THEN 1 ELSE 0 END
    + CASE WHEN EXISTS(SELECT 1 FROM public.finance_payments WHERE student_id=s.id) THEN 1 ELSE 0 END score
  FROM public.students s WHERE s.deleted_at IS NULL AND s.identity_name_key<>'' AND length(s.identity_phone_key)>=7
    AND NOT EXISTS(SELECT 1 FROM public.students other WHERE other.deleted_at IS NULL
      AND other.identity_name_key=s.identity_name_key AND other.identity_phone_key=s.identity_phone_key
      AND other.age IS NOT NULL AND s.age IS NOT NULL AND other.age<>s.age)
), ranked AS (
  SELECT *,first_value(id) OVER(PARTITION BY identity_name_key,identity_phone_key ORDER BY score DESC,created_at,id) keep_id,
    first_value(student_code) OVER(PARTITION BY identity_name_key,identity_phone_key ORDER BY score DESC,created_at,id) keep_code
  FROM scored
)
SELECT keep_id,id duplicate_id,keep_code,student_code duplicate_code,identity_name_key,score duplicate_score FROM ranked WHERE id<>keep_id;
CREATE TEMP TABLE merge_results(result JSONB) ON COMMIT DROP;
DO $$ DECLARE r RECORD;
BEGIN
  IF (SELECT count(*) FROM merge_plan)<>9 THEN RAISE EXCEPTION 'Plan changed since review: inspect before committing.'; END IF;
  FOR r IN SELECT * FROM merge_plan ORDER BY identity_name_key,duplicate_code LOOP
    INSERT INTO merge_results SELECT public.merge_duplicate_student(r.keep_id,r.duplicate_id,FALSE);
  END LOOP;
  IF EXISTS(SELECT 1 FROM public.students s WHERE s.id IN(SELECT duplicate_id FROM merge_plan) AND s.deleted_at IS NULL) THEN
    RAISE EXCEPTION 'Duplicate record remained visible.';
  END IF;
  IF EXISTS(SELECT 1 FROM public.attendance_consumptions ac
    JOIN public.attendance_records ar ON ar.id=ac.attendance_record_id
    JOIN public.student_enrollments se ON se.id=ac.enrollment_id
    WHERE ac.student_id IN(SELECT keep_id FROM merge_plan)
      AND (ac.student_id<>ar.student_id OR ac.student_id<>se.student_id)) THEN
    RAISE EXCEPTION 'Attendance consumption ownership check failed.';
  END IF;
  IF EXISTS(SELECT 1 FROM public.student_financial_accounts fa JOIN public.student_enrollments se ON se.id=fa.enrollment_id
    WHERE fa.student_id IN(SELECT keep_id FROM merge_plan) AND fa.student_id<>se.student_id) THEN
    RAISE EXCEPTION 'Financial account ownership check failed.';
  END IF;
END;
$$;
SELECT jsonb_agg(result) AS verified_merge_results FROM merge_results;
ROLLBACK;
