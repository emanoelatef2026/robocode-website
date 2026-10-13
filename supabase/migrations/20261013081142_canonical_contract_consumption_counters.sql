-- Applied migration version matches the remote Supabase migration history.
-- The old attendance trigger counted a lesson before the ledger was written;
-- consume_attendance_sessions_batch then incremented it again (1 lesson -> 2).
-- The ledger is now the only authority, including manual attendance, retries,
-- invalidation and deletion. No attendance, payments or contracts are removed.

CREATE OR REPLACE FUNCTION public.contract_consumption_count(p_enrollment_id UUID)
RETURNS INTEGER LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path = ''
AS $$
  SELECT COUNT(*)::INTEGER
  FROM public.attendance_consumptions ac
  JOIN public.attendance_records ar ON ar.id = ac.attendance_record_id
  JOIN public.schedules s ON s.id = ar.schedule_id
  WHERE ac.enrollment_id = p_enrollment_id
    AND ar.invalidated_at IS NULL
    AND ar.status IN ('present', 'absent', 'late', 'makeup', 'excused')
    AND s.status <> 'cancelled';
$$;

-- A legacy writer cannot overwrite the counter with a lifetime total or an
-- extra increment. remaining_sessions stays the existing GENERATED column.
CREATE OR REPLACE FUNCTION public.enforce_contract_consumption_count()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  NEW.consumed_sessions := public.contract_consumption_count(NEW.id);
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_enforce_contract_consumption_count ON public.student_enrollments;
CREATE TRIGGER trg_enforce_contract_consumption_count
BEFORE UPDATE OF consumed_sessions ON public.student_enrollments
FOR EACH ROW EXECUTE FUNCTION public.enforce_contract_consumption_count();

CREATE OR REPLACE FUNCTION public.sync_contract_consumption_counters(p_enrollment_ids UUID[])
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_id UUID;
  v_count INTEGER;
BEGIN
  -- Serialize updates to the same contract. The count is read AFTER obtaining
  -- the lock, so concurrent saves cannot publish an older ledger snapshot.
  FOR v_id IN SELECT DISTINCT x.id FROM unnest(p_enrollment_ids) AS x(id)
    WHERE x.id IS NOT NULL ORDER BY x.id
  LOOP
    PERFORM se.id FROM public.student_enrollments se WHERE se.id = v_id FOR UPDATE;
    IF NOT FOUND THEN CONTINUE; END IF;
    v_count := public.contract_consumption_count(v_id);
    UPDATE public.student_enrollments se SET consumed_sessions = v_count
    WHERE se.id = v_id AND se.consumed_sessions IS DISTINCT FROM v_count;
    IF FOUND THEN PERFORM public.sync_enrollment_financial_status(v_id); END IF;
  END LOOP;
END;
$$;

-- Keep the existing attendance trigger, but make it synchronize ledger counts
-- instead of guessing a contract from the current group/date.
CREATE OR REPLACE FUNCTION public.trg_sync_consumed_sessions()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_enrollment_ids UUID[] := ARRAY[]::UUID[];
  v_record_ids UUID[] := ARRAY[]::UUID[];
BEGIN
  IF TG_TABLE_NAME = 'attendance_consumptions' THEN
    IF TG_OP <> 'INSERT' THEN v_enrollment_ids := array_append(v_enrollment_ids, OLD.enrollment_id); END IF;
    IF TG_OP <> 'DELETE' THEN v_enrollment_ids := array_append(v_enrollment_ids, NEW.enrollment_id); END IF;
  ELSE
    IF TG_OP <> 'INSERT' THEN v_record_ids := array_append(v_record_ids, OLD.id); END IF;
    IF TG_OP <> 'DELETE' THEN v_record_ids := array_append(v_record_ids, NEW.id); END IF;
    SELECT array_agg(DISTINCT ac.enrollment_id) INTO v_enrollment_ids
    FROM public.attendance_consumptions ac WHERE ac.attendance_record_id = ANY(v_record_ids);
  END IF;
  PERFORM public.sync_contract_consumption_counters(v_enrollment_ids);
  RETURN COALESCE(NEW, OLD);
END;
$$;
DROP TRIGGER IF EXISTS trg_consumption_sync_sessions ON public.attendance_consumptions;
CREATE TRIGGER trg_consumption_sync_sessions
AFTER INSERT OR UPDATE OR DELETE ON public.attendance_consumptions
FOR EACH ROW EXECUTE FUNCTION public.trg_sync_consumed_sessions();

CREATE OR REPLACE FUNCTION public.consume_attendance_sessions_batch(
  p_record_ids UUID[], p_enrollment_ids UUID[], p_student_ids UUID[]
)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE i INTEGER; len INTEGER;
BEGIN
  len := cardinality(p_record_ids);
  IF len IS NULL OR len = 0 THEN RETURN; END IF;
  IF cardinality(p_enrollment_ids) IS DISTINCT FROM len OR cardinality(p_student_ids) IS DISTINCT FROM len THEN
    RAISE EXCEPTION 'Attendance consumption arrays must have equal lengths';
  END IF;
  PERFORM se.id FROM public.student_enrollments se
  WHERE se.id = ANY(p_enrollment_ids) ORDER BY se.id FOR UPDATE;
  FOR i IN 1..len LOOP
    IF NOT EXISTS (
      SELECT 1 FROM public.attendance_records ar
      JOIN public.student_enrollments se ON se.id = p_enrollment_ids[i] AND se.student_id = ar.student_id
      JOIN public.schedules s ON s.id = ar.schedule_id
      WHERE ar.id = p_record_ids[i] AND ar.student_id = p_student_ids[i]
        AND ar.invalidated_at IS NULL AND s.status <> 'cancelled'
        AND ar.status IN ('present', 'absent', 'late', 'makeup', 'excused')
    ) THEN RAISE EXCEPTION 'Attendance record and contract must belong to the same student and be consumable'; END IF;
    INSERT INTO public.attendance_consumptions (attendance_record_id, enrollment_id, student_id)
    VALUES (p_record_ids[i], p_enrollment_ids[i], p_student_ids[i])
    ON CONFLICT (attendance_record_id) DO NOTHING;
  END LOOP;
  -- This also repairs a stale cache on a duplicate retry. Never increment.
  PERFORM public.sync_contract_consumption_counters(p_enrollment_ids);
END;
$$;

CREATE OR REPLACE FUNCTION public.increment_consumed_sessions_batch(p_enrollment_ids UUID[])
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$ BEGIN PERFORM public.sync_contract_consumption_counters(p_enrollment_ids); END; $$;

CREATE OR REPLACE FUNCTION public.recompute_session_consumption(p_enrollment_id UUID DEFAULT NULL)
RETURNS TABLE(enrollment_id UUID, old_consumed INTEGER, new_consumed INTEGER, fixed BOOLEAN)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT se.id, se.consumed_sessions FROM public.student_enrollments se
    WHERE se.enrolled_sessions > 0 AND (p_enrollment_id IS NULL OR se.id = p_enrollment_id)
    ORDER BY se.id FOR UPDATE
  LOOP
    enrollment_id := r.id;
    old_consumed := r.consumed_sessions;
    PERFORM public.sync_contract_consumption_counters(ARRAY[r.id]);
    SELECT se.consumed_sessions INTO new_consumed FROM public.student_enrollments se WHERE se.id = r.id;
    fixed := old_consumed IS DISTINCT FROM new_consumed;
    RETURN NEXT;
  END LOOP;
END;
$$;

-- Server-only helpers and existing RPCs; no new access for browser clients.
REVOKE ALL ON FUNCTION public.contract_consumption_count(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.enforce_contract_consumption_count() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sync_contract_consumption_counters(UUID[]) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.trg_sync_consumed_sessions() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.consume_attendance_sessions_batch(UUID[], UUID[], UUID[]) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.increment_consumed_sessions_batch(UUID[]) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.recompute_session_consumption(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.contract_consumption_count(UUID), public.sync_contract_consumption_counters(UUID[]),
  public.consume_attendance_sessions_batch(UUID[], UUID[], UUID[]), public.increment_consumed_sessions_batch(UUID[]),
  public.recompute_session_consumption(UUID) TO service_role;

NOTIFY pgrst, 'reload schema';
