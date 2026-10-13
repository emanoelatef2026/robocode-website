-- Preserve backward compatibility for older callers. The new RPC wraps the
-- existing atomic reconciliation and writes staff-selected statuses in the
-- same transaction. Present -> Absent keeps exactly one ledger consumption.
CREATE OR REPLACE FUNCTION public.apply_historical_reconciliation_records_with_statuses(
  p_schedule_ids UUID[], p_funded_count INTEGER, p_student_id UUID,
  p_enrollment_id UUID, p_recorded_by UUID, p_statuses TEXT[]
)
RETURNS TABLE(attendance_record_id UUID, schedule_id UUID, funded BOOLEAN, attendance_status TEXT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE r RECORD; v_status TEXT; v_index INTEGER; v_len INTEGER;
BEGIN
  v_len := cardinality(p_schedule_ids);
  IF v_len IS NULL OR v_len = 0 THEN RETURN; END IF;
  IF cardinality(p_statuses) IS DISTINCT FROM v_len OR p_funded_count < 0 OR p_funded_count > v_len THEN
    RAISE EXCEPTION 'Choose a status for each selected session and a valid funded count';
  END IF;
  IF EXISTS (SELECT 1 FROM unnest(p_statuses) AS x(status) WHERE x.status IS NULL OR x.status NOT IN ('present','absent','late','excused','makeup')) THEN
    RAISE EXCEPTION 'Invalid attendance status';
  END IF;
  PERFORM se.id FROM public.student_enrollments se
  WHERE se.id = p_enrollment_id AND se.student_id = p_student_id AND se.status = 'ACTIVE' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Active contract does not belong to this student'; END IF;
  IF EXISTS (SELECT 1 FROM public.schedules s WHERE s.id = ANY(p_schedule_ids) AND s.status <> 'completed') THEN
    RAISE EXCEPTION 'Only completed group sessions can be loaded';
  END IF;
  PERFORM ar.id FROM public.attendance_records ar
  WHERE ar.student_id = p_student_id AND ar.schedule_id = ANY(p_schedule_ids) ORDER BY ar.id FOR UPDATE;
  IF EXISTS (SELECT 1 FROM public.attendance_records ar WHERE ar.student_id = p_student_id
    AND ar.schedule_id = ANY(p_schedule_ids) AND ar.invalidated_at IS NOT NULL) THEN
    RAISE EXCEPTION 'Invalidated attendance cannot be loaded';
  END IF;
  IF EXISTS (SELECT 1 FROM public.attendance_consumptions ac JOIN public.attendance_records ar ON ar.id = ac.attendance_record_id
    WHERE ar.student_id = p_student_id AND ar.schedule_id = ANY(p_schedule_ids) AND ac.enrollment_id <> p_enrollment_id) THEN
    RAISE EXCEPTION 'A selected session is already charged to another contract';
  END IF;

  FOR r IN SELECT old.* FROM public.apply_historical_reconciliation_records(
    p_schedule_ids, p_funded_count, p_student_id, p_enrollment_id, p_recorded_by
  ) AS old LOOP
    v_index := array_position(p_schedule_ids, r.schedule_id);
    v_status := p_statuses[v_index];
    UPDATE public.attendance_records ar SET status = v_status
    WHERE ar.id = r.attendance_record_id AND ar.student_id = p_student_id;
    RETURN QUERY SELECT r.attendance_record_id::UUID, r.schedule_id::UUID, r.funded::BOOLEAN, v_status;
  END LOOP;
END;
$$;
REVOKE ALL ON FUNCTION public.apply_historical_reconciliation_records_with_statuses(UUID[], INTEGER, UUID, UUID, UUID, TEXT[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_historical_reconciliation_records_with_statuses(UUID[], INTEGER, UUID, UUID, UUID, TEXT[]) TO service_role;
NOTIFY pgrst, 'reload schema';
