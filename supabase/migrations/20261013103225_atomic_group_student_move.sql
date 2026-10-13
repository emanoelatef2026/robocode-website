-- A move is one transaction, not remove + add in separate server requests.
CREATE OR REPLACE FUNCTION public.move_group_students_atomic(
  p_source_group_id UUID, p_target_group_id UUID, p_student_ids UUID[],
  p_contract_mode TEXT, p_allowed_branch_ids UUID[]
) RETURNS VOID
LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $$
DECLARE
  v_source public.groups%ROWTYPE; v_target public.groups%ROWTYPE;
  v_ids UUID[]; v_course UUID; v_gc UUID; v_instructor UUID;
  v_student UUID; v_membership UUID; v_contract UUID; v_count INTEGER;
BEGIN
  IF p_source_group_id IS NULL OR p_target_group_id IS NULL OR p_source_group_id=p_target_group_id THEN
    RAISE EXCEPTION 'Choose a different destination group.';
  END IF;
  IF p_contract_mode IS NULL OR p_contract_mode NOT IN ('new','continue') THEN
    RAISE EXCEPTION 'Choose how to handle the existing contract.';
  END IF;
  SELECT array_agg(DISTINCT id ORDER BY id) INTO v_ids FROM unnest(p_student_ids) x(id) WHERE id IS NOT NULL;
  IF coalesce(cardinality(v_ids),0)=0 THEN RAISE EXCEPTION 'Choose at least one student.'; END IF;

  -- Serialize opposite-direction moves and capacity checks in a stable order.
  PERFORM g.id FROM public.groups g WHERE g.id IN (p_source_group_id,p_target_group_id) ORDER BY g.id FOR UPDATE;
  SELECT * INTO v_source FROM public.groups WHERE id=p_source_group_id AND deleted_at IS NULL;
  SELECT * INTO v_target FROM public.groups WHERE id=p_target_group_id AND deleted_at IS NULL;
  IF v_source.id IS NULL OR v_target.id IS NULL THEN RAISE EXCEPTION 'Group not found.'; END IF;
  IF v_target.status IN ('cancelled','archived') THEN RAISE EXCEPTION 'The destination group is no longer available.'; END IF;
  IF p_allowed_branch_ids IS NOT NULL AND
    (NOT v_source.branch_id=ANY(p_allowed_branch_ids) OR NOT v_target.branch_id=ANY(p_allowed_branch_ids)) THEN
    RAISE EXCEPTION 'No access to one of these branches.';
  END IF;
  PERFORM st.id FROM public.students st WHERE st.id=ANY(v_ids) ORDER BY st.id FOR UPDATE;
  IF EXISTS (SELECT 1 FROM unnest(v_ids) x(id) WHERE NOT EXISTS (
    SELECT 1 FROM public.students st WHERE st.id=x.id AND st.deleted_at IS NULL)) THEN
    RAISE EXCEPTION 'A selected student is no longer available.';
  END IF;
  -- Dropped rows support retrying a move interrupted by the former two-request flow.
  IF EXISTS (SELECT 1 FROM unnest(v_ids) x(id) WHERE NOT EXISTS (
    SELECT 1 FROM public.group_students gs WHERE gs.group_id=p_source_group_id
      AND gs.student_id=x.id AND gs.status IN ('active','dropped'))) THEN
    RAISE EXCEPTION 'A selected student does not belong to the source group. Refresh and try again.';
  END IF;
  SELECT gc.id,gc.course_id,gc.instructor_id INTO v_gc,v_course,v_instructor
  FROM public.group_courses gc WHERE gc.group_id=p_target_group_id AND gc.status='active';
  IF p_allowed_branch_ids IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.group_students gs JOIN public.groups g ON g.id=gs.group_id
    WHERE gs.student_id=ANY(v_ids) AND gs.status='active'
      AND (gs.group_id=p_source_group_id OR gs.course_id=v_course)
      AND NOT g.branch_id=ANY(p_allowed_branch_ids)
  ) THEN RAISE EXCEPTION 'An existing membership is outside your accessible branches.'; END IF;

  SELECT count(*) INTO v_count FROM public.group_students gs WHERE gs.group_id=p_target_group_id
    AND gs.status='active' AND NOT gs.student_id=ANY(v_ids);
  IF v_target.capacity>0 AND v_count+cardinality(v_ids)>v_target.capacity THEN
    RAISE EXCEPTION 'Moving these students would exceed the destination group capacity.';
  END IF;

  FOREACH v_student IN ARRAY v_ids LOOP
    v_contract:=NULL;
    IF p_contract_mode='continue' THEN
      SELECT se.id INTO v_contract FROM public.student_enrollments se
      WHERE se.student_id=v_student AND se.status='ACTIVE'
        AND (se.course_id=v_course OR (se.group_id=p_source_group_id AND se.course_id IS NULL))
        AND (p_allowed_branch_ids IS NULL OR se.branch_id=ANY(p_allowed_branch_ids))
      ORDER BY (se.group_id=p_source_group_id) DESC NULLS LAST,se.created_at,se.id LIMIT 1 FOR UPDATE;
      IF v_contract IS NULL THEN RAISE EXCEPTION 'No active contract for this course. Choose Start new contract, or review the student contract first.'; END IF;
    END IF;

    -- Close same-course memberships BEFORE insert, but in the SAME transaction.
    -- Any later error restores them automatically, including the source row.
    UPDATE public.group_students gs SET status='dropped',left_at=now()
    WHERE gs.student_id=v_student AND gs.status='active' AND gs.group_id<>p_target_group_id
      AND (gs.group_id=p_source_group_id OR gs.course_id=v_course);
    INSERT INTO public.group_students AS gs (group_id,student_id,status,enrollment_type,course_id,joined_at,left_at)
    VALUES (p_target_group_id,v_student,'active','primary',v_course,now(),NULL)
    ON CONFLICT (group_id,student_id) DO UPDATE SET status='active',course_id=EXCLUDED.course_id,
      joined_at=CASE WHEN gs.status='active' THEN gs.joined_at ELSE EXCLUDED.joined_at END,left_at=NULL
    RETURNING id INTO v_membership;

    IF v_contract IS NOT NULL THEN
      UPDATE public.student_enrollments SET group_id=p_target_group_id,group_student_id=v_membership,
        branch_id=v_target.branch_id,group_course_id=v_gc,instructor_id=v_instructor,course_id=v_course
      WHERE id=v_contract;
      UPDATE public.student_financial_accounts SET group_id=p_target_group_id WHERE enrollment_id=v_contract;
    END IF;
    -- 'new' deliberately preserves all previous contracts and payments.
    -- Staff explicitly create/prices the next contract through Payment.
  END LOOP;
END;
$$;
REVOKE ALL ON FUNCTION public.move_group_students_atomic(UUID,UUID,UUID[],TEXT,UUID[]) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.move_group_students_atomic(UUID,UUID,UUID[],TEXT,UUID[]) TO service_role;
NOTIFY pgrst, 'reload schema';
