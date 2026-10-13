-- Live regression check using the reported student's existing record.
-- EVERY modification is rolled back; no sample students/contracts are created.
BEGIN;
SET LOCAL lock_timeout = '5s';
DO $$
DECLARE
  v_contract UUID;
  v_student UUID;
  v_record UUID;
  v_other UUID;
  v_used INTEGER;
  v_left INTEGER;
BEGIN
  SELECT se.id, se.student_id INTO STRICT v_contract, v_student
  FROM public.student_enrollments se
  JOIN public.students st ON st.id = se.student_id
  JOIN public.groups g ON g.id = se.group_id
  WHERE st.student_code = 'STU-000230' AND g.code = 'GRP-000091' AND se.status = 'ACTIVE';
  SELECT ac.attendance_record_id INTO STRICT v_record
  FROM public.attendance_consumptions ac WHERE ac.enrollment_id = v_contract;
  SELECT se.id INTO STRICT v_other FROM public.student_enrollments se
  WHERE se.student_id = v_student AND se.id <> v_contract AND se.consumed_sessions = 0 LIMIT 1;

  -- Reproduce the original flow: attendance first, consumption second.
  DELETE FROM public.attendance_consumptions WHERE attendance_record_id = v_record;
  UPDATE public.attendance_records SET status = 'present' WHERE id = v_record;
  SELECT consumed_sessions INTO v_used FROM public.student_enrollments WHERE id = v_contract;
  IF v_used <> 0 THEN RAISE EXCEPTION 'Attendance without ledger must consume 0, got %', v_used; END IF;

  PERFORM public.consume_attendance_sessions_batch(ARRAY[v_record], ARRAY[v_contract], ARRAY[v_student]);
  SELECT consumed_sessions, remaining_sessions INTO v_used, v_left FROM public.student_enrollments WHERE id = v_contract;
  IF v_used <> 1 OR v_left <> 11 THEN RAISE EXCEPTION 'First save must be 1/12, got %, %', v_used, v_left; END IF;

  PERFORM public.consume_attendance_sessions_batch(ARRAY[v_record], ARRAY[v_contract], ARRAY[v_student]);
  PERFORM public.consume_attendance_sessions_batch(ARRAY[v_record], ARRAY[v_contract], ARRAY[v_student]);
  PERFORM public.increment_consumed_sessions_batch(ARRAY[v_contract]);
  UPDATE public.student_enrollments SET consumed_sessions = 99 WHERE id = v_contract;
  SELECT consumed_sessions INTO v_used FROM public.student_enrollments WHERE id = v_contract;
  IF v_used <> 1 THEN RAISE EXCEPTION 'Retries/legacy writers must stay at 1, got %', v_used; END IF;

  UPDATE public.attendance_records SET status = 'absent' WHERE id = v_record;
  SELECT consumed_sessions INTO v_used FROM public.student_enrollments WHERE id = v_contract;
  IF v_used <> 1 THEN RAISE EXCEPTION 'Absent still consumes one slot'; END IF;
  UPDATE public.attendance_records SET status = 'excused' WHERE id = v_record;
  SELECT consumed_sessions INTO v_used FROM public.student_enrollments WHERE id = v_contract;
  IF v_used <> 1 THEN RAISE EXCEPTION 'Excused still consumes one slot'; END IF;

  UPDATE public.attendance_records SET invalidated_at = now() WHERE id = v_record;
  SELECT consumed_sessions INTO v_used FROM public.student_enrollments WHERE id = v_contract;
  IF v_used <> 0 THEN RAISE EXCEPTION 'Invalidated attendance must consume 0'; END IF;
  PERFORM public.recompute_session_consumption(v_contract);
  SELECT consumed_sessions INTO v_used FROM public.student_enrollments WHERE id = v_contract;
  IF v_used <> 0 THEN RAISE EXCEPTION 'Repair must not restore invalid consumption'; END IF;
  UPDATE public.attendance_records SET invalidated_at = NULL, status = 'present' WHERE id = v_record;

  UPDATE public.attendance_consumptions SET enrollment_id = v_other WHERE attendance_record_id = v_record;
  SELECT consumed_sessions INTO v_used FROM public.student_enrollments WHERE id = v_contract;
  IF v_used <> 0 THEN RAISE EXCEPTION 'Moving a ledger row must clear the old contract'; END IF;
  SELECT consumed_sessions INTO v_used FROM public.student_enrollments WHERE id = v_other;
  IF v_used <> 1 THEN RAISE EXCEPTION 'Moving a ledger row must update its new contract'; END IF;
  UPDATE public.attendance_consumptions SET enrollment_id = v_contract WHERE attendance_record_id = v_record;
  PERFORM public.recompute_session_consumption(v_contract);
  SELECT consumed_sessions, remaining_sessions INTO v_used, v_left FROM public.student_enrollments WHERE id = v_contract;
  IF v_used <> 1 OR v_left <> 11 THEN RAISE EXCEPTION 'Final recompute must be 1 used / 11 left'; END IF;
  SELECT consumed_sessions INTO v_used FROM public.student_enrollments WHERE id = v_other;
  IF v_used <> 0 THEN RAISE EXCEPTION 'Other contract must return to its original balance'; END IF;
END;
$$;
ROLLBACK;
SELECT 'PASS: original double-count flow, retries, legacy writes, absent/excused, invalidation, ledger transfer and recompute; all test writes rolled back' AS verification;
