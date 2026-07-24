-- Historical Enrollment Reconciliation
--
-- Atomic "create historical attendance + consume contract sessions" primitive.
-- Mirrors consume_attendance_sessions_batch (0078_attendance_stabilization.sql)
-- for the consumption half — this function does NOT reimplement that logic,
-- it calls it. The new part is the attendance_records INSERT: no existing RPC
-- creates attendance rows, only consume_attendance_sessions_batch links
-- already-existing ones.
--
-- Idempotent: ON CONFLICT (schedule_id, student_id) DO NOTHING + a re-SELECT
-- means calling this twice with the same schedule_ids never double-creates or
-- double-consumes (attendance_consumptions' own UNIQUE constraint backstops
-- consumption idempotency too).

CREATE OR REPLACE FUNCTION public.apply_historical_reconciliation_records(
  p_schedule_ids   UUID[],   -- ordered oldest → newest
  p_funded_count   INT,      -- first N of p_schedule_ids get a consumption entry
  p_student_id     UUID,
  p_enrollment_id  UUID,
  p_recorded_by    UUID
)
RETURNS TABLE (
  attendance_record_id UUID,
  schedule_id           UUID,
  funded                BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  i                    INT;
  len                  INT;
  v_record_id          UUID;
  v_record_ids         UUID[] := ARRAY[]::UUID[];
  v_out_schedule_ids   UUID[] := ARRAY[]::UUID[];
  v_funded_flags       BOOLEAN[] := ARRAY[]::BOOLEAN[];
  v_funded_record_ids  UUID[] := ARRAY[]::UUID[];
  v_funded_enroll_ids  UUID[] := ARRAY[]::UUID[];
  v_funded_student_ids UUID[] := ARRAY[]::UUID[];
BEGIN
  len := array_length(p_schedule_ids, 1);
  IF len IS NULL THEN RETURN; END IF;

  FOR i IN 1..len LOOP
    v_record_id := NULL;

    INSERT INTO public.attendance_records (schedule_id, student_id, status, notes, recorded_by)
    VALUES (p_schedule_ids[i], p_student_id, 'present', 'Historical enrollment reconciliation', p_recorded_by)
    ON CONFLICT (schedule_id, student_id) DO NOTHING
    RETURNING id INTO v_record_id;

    IF v_record_id IS NULL THEN
      -- Already existed (idempotent retry, or a race with another write) —
      -- reuse it, but never treat a pre-existing record as newly funded here.
      SELECT id INTO v_record_id
      FROM public.attendance_records
      WHERE schedule_id = p_schedule_ids[i] AND student_id = p_student_id;

      IF v_record_id IS NOT NULL THEN
        v_record_ids       := array_append(v_record_ids, v_record_id);
        v_out_schedule_ids := array_append(v_out_schedule_ids, p_schedule_ids[i]);
        v_funded_flags     := array_append(v_funded_flags, EXISTS(
          SELECT 1 FROM public.attendance_consumptions WHERE attendance_record_id = v_record_id
        ));
      END IF;
    ELSE
      v_record_ids       := array_append(v_record_ids, v_record_id);
      v_out_schedule_ids := array_append(v_out_schedule_ids, p_schedule_ids[i]);

      IF i <= p_funded_count THEN
        v_funded_flags       := array_append(v_funded_flags, TRUE);
        v_funded_record_ids  := array_append(v_funded_record_ids, v_record_id);
        v_funded_enroll_ids  := array_append(v_funded_enroll_ids, p_enrollment_id);
        v_funded_student_ids := array_append(v_funded_student_ids, p_student_id);
      ELSE
        v_funded_flags := array_append(v_funded_flags, FALSE);
      END IF;
    END IF;
  END LOOP;

  IF array_length(v_funded_record_ids, 1) > 0 THEN
    PERFORM public.consume_attendance_sessions_batch(v_funded_record_ids, v_funded_enroll_ids, v_funded_student_ids);
  END IF;

  FOR i IN 1..COALESCE(array_length(v_record_ids, 1), 0) LOOP
    RETURN QUERY SELECT v_record_ids[i], v_out_schedule_ids[i], v_funded_flags[i];
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.apply_historical_reconciliation_records(UUID[], INT, UUID, UUID, UUID) TO authenticated;

NOTIFY pgrst, 'reload schema';
