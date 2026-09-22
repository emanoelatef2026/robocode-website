-- Fixes the historical contract-reconciliation RPC without changing any
-- contract, attendance, or payment data.  `schedule_id` is an OUT parameter
-- of the function, so all attendance columns must be table-qualified.
--
-- Existing attendance is eligible only when it has no consumption entry. A
-- record already consumed by an older contract is never moved or charged again.

CREATE OR REPLACE FUNCTION public.apply_historical_reconciliation_records(
  p_schedule_ids UUID[],
  p_funded_count INT,
  p_student_id UUID,
  p_enrollment_id UUID,
  p_recorded_by UUID
)
RETURNS TABLE (attendance_record_id UUID, schedule_id UUID, funded BOOLEAN)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  i INT;
  len INT;
  v_record_id UUID;
  v_already_funded BOOLEAN;
  v_record_ids UUID[] := ARRAY[]::UUID[];
  v_schedule_ids UUID[] := ARRAY[]::UUID[];
  v_funded_flags BOOLEAN[] := ARRAY[]::BOOLEAN[];
  v_funded_record_ids UUID[] := ARRAY[]::UUID[];
  v_funded_enrollment_ids UUID[] := ARRAY[]::UUID[];
  v_funded_student_ids UUID[] := ARRAY[]::UUID[];
BEGIN
  len := array_length(p_schedule_ids, 1);
  IF len IS NULL THEN RETURN; END IF;

  FOR i IN 1..len LOOP
    v_record_id := NULL;

    INSERT INTO public.attendance_records (schedule_id, student_id, status, notes, recorded_by)
    VALUES (p_schedule_ids[i], p_student_id, 'present', 'Historical enrollment reconciliation', p_recorded_by)
    ON CONFLICT ON CONSTRAINT attendance_records_schedule_student_unique DO NOTHING
    RETURNING id INTO v_record_id;

    IF v_record_id IS NULL THEN
      SELECT ar.id
      INTO v_record_id
      FROM public.attendance_records AS ar
      WHERE ar.schedule_id = p_schedule_ids[i]
        AND ar.student_id = p_student_id;
    END IF;

    IF v_record_id IS NULL THEN CONTINUE; END IF;

    SELECT EXISTS (
      SELECT 1
      FROM public.attendance_consumptions AS ac
      WHERE ac.attendance_record_id = v_record_id
    )
    INTO v_already_funded;

    v_record_ids := array_append(v_record_ids, v_record_id);
    v_schedule_ids := array_append(v_schedule_ids, p_schedule_ids[i]);

    IF i <= p_funded_count AND NOT v_already_funded THEN
      v_funded_flags := array_append(v_funded_flags, TRUE);
      v_funded_record_ids := array_append(v_funded_record_ids, v_record_id);
      v_funded_enrollment_ids := array_append(v_funded_enrollment_ids, p_enrollment_id);
      v_funded_student_ids := array_append(v_funded_student_ids, p_student_id);
    ELSE
      v_funded_flags := array_append(v_funded_flags, v_already_funded);
    END IF;
  END LOOP;

  IF array_length(v_funded_record_ids, 1) > 0 THEN
    PERFORM public.consume_attendance_sessions_batch(
      v_funded_record_ids,
      v_funded_enrollment_ids,
      v_funded_student_ids
    );
  END IF;

  FOR i IN 1..COALESCE(array_length(v_record_ids, 1), 0) LOOP
    RETURN QUERY SELECT v_record_ids[i], v_schedule_ids[i], v_funded_flags[i];
  END LOOP;
END;
$$;

-- Keep this RPC server-only, consistent with the original security hardening.
REVOKE EXECUTE ON FUNCTION public.apply_historical_reconciliation_records(UUID[], INT, UUID, UUID, UUID) FROM anon, authenticated, PUBLIC;
NOTIFY pgrst, 'reload schema';
