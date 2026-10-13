-- All status and ledger changes in this regression are rolled back.
BEGIN;
SET LOCAL lock_timeout = '5s';
DO $$
DECLARE v_contract UUID; v_student UUID; v_record UUID; v_schedule UUID;
  v_actor UUID; v_status TEXT; v_used INTEGER; v_left INTEGER; v_links INTEGER;
BEGIN
  SELECT se.id, se.student_id INTO STRICT v_contract, v_student
  FROM public.student_enrollments se JOIN public.students st ON st.id=se.student_id
  JOIN public.groups g ON g.id=se.group_id
  WHERE st.student_code='STU-000230' AND g.code='GRP-000091' AND se.status='ACTIVE';
  SELECT ar.id, ar.schedule_id, ar.recorded_by INTO STRICT v_record, v_schedule, v_actor
  FROM public.attendance_records ar JOIN public.attendance_consumptions ac ON ac.attendance_record_id=ar.id
  WHERE ac.enrollment_id=v_contract;

  -- Exercise first-time loading, then retries with every offered status.
  DELETE FROM public.attendance_consumptions WHERE attendance_record_id=v_record;
  FOREACH v_status IN ARRAY ARRAY['absent','absent','late','excused','makeup','present'] LOOP
    PERFORM * FROM public.apply_historical_reconciliation_records_with_statuses(
      ARRAY[v_schedule],1,v_student,v_contract,v_actor,ARRAY[v_status]);
    IF (SELECT status FROM public.attendance_records WHERE id=v_record) <> v_status THEN
      RAISE EXCEPTION 'Selected status was not saved: %',v_status;
    END IF;
    SELECT consumed_sessions,remaining_sessions INTO v_used,v_left FROM public.student_enrollments WHERE id=v_contract;
    SELECT count(*) INTO v_links FROM public.attendance_consumptions WHERE attendance_record_id=v_record;
    IF v_used<>1 OR v_left<>11 OR v_links<>1 THEN
      RAISE EXCEPTION 'Status/retry duplicated consumption: used %, left %, links %',v_used,v_left,v_links;
    END IF;
  END LOOP;
END;
$$;
ROLLBACK;
SELECT 'PASS: first historical load, absent/late/excused/makeup/present, repeated save; one consumed slot, all writes rolled back' AS verification;
