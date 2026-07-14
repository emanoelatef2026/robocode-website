-- Migration: 20260714131500_fix_old_enrollment_status_transition
-- Root-cause fix for a real bug discovered during Phase 2 production
-- acceptance QA: commit_cohort_graduation() updated the OLD cohort's
-- group_students.status per decision, but never touched the OLD
-- student_enrollments row's status — it stayed 'ACTIVE' forever. This is a
-- real correctness gap, not just a QA-fixture artifact:
-- `uq_student_enrollments_active_course` (a live unique index on
-- (student_id, course_id) WHERE status='ACTIVE') means any real
-- Continue/Repeat decision into a next cohort running the SAME course (by
-- far the common case — "the next round of the same class") would fail
-- this constraint, because the old ACTIVE row and the new ACTIVE row would
-- collide on the same (student_id, course_id) pair.
--
-- Fix: transition the OLD enrollment's status to reflect what actually
-- happened, using the table's own status CHECK values
-- (ACTIVE/PAUSED/TRANSFERRED/COMPLETED/DROPPED) — continue/graduate/repeat
-- close out as COMPLETED (the enrollment period legitimately ended),
-- hold -> PAUSED, drop -> DROPPED, transfer -> TRANSFERRED. This does NOT
-- violate docs/DOMAIN_RULES.md Rule 5 ("never rewrite a historical
-- enrollment"): group_id, course_id, dates, renewal_of, and all financial
-- linkage on the OLD row are untouched — only its own lifecycle status
-- field changes, exactly mirroring how group_students.status is already
-- allowed to transition on a Completed cohort (Rule 12). Guarded to
-- WHERE status = 'ACTIVE' so this is idempotent and a no-op on replay.

CREATE OR REPLACE FUNCTION public.commit_cohort_graduation(
  p_payload      JSONB,
  p_performed_by UUID,
  p_request_id   UUID,
  p_draft_id     UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_old_group_id      UUID := (p_payload->>'old_group_id')::UUID;
  v_old_branch_id      UUID;
  v_old_status         TEXT;
  v_graduated_at       TIMESTAMPTZ;
  v_graduated_to       UUID;
  v_prior_request_id   UUID;
  v_new_group          JSONB := p_payload->'new_group';
  v_new_group_id       UUID;
  v_active_count       INT;
  v_decision           JSONB;
  v_target_group_id    UUID;
  v_target_course_id   UUID;
  v_new_enrollment_id  UUID;
  v_new_group_student_id UUID;
  v_counts             JSONB := '{}'::JSONB;
  v_replay_counts      JSONB;
BEGIN
  IF v_old_group_id IS NULL THEN
    RAISE EXCEPTION 'old_group_id is required.' USING ERRCODE = 'P0001';
  END IF;
  IF p_request_id IS NULL THEN
    RAISE EXCEPTION 'p_request_id is required.' USING ERRCODE = 'P0001';
  END IF;

  -- 1. Lock + stage guard + replay guard ---------------------------------------
  SELECT branch_id, status, graduated_at, graduated_to_group_id, graduation_request_id
    INTO v_old_branch_id, v_old_status, v_graduated_at, v_graduated_to, v_prior_request_id
    FROM public.groups WHERE id = v_old_group_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cohort % not found.', v_old_group_id USING ERRCODE = 'P0001';
  END IF;

  IF v_graduated_at IS NOT NULL THEN
    IF v_prior_request_id IS NOT NULL AND v_prior_request_id = p_request_id THEN
      SELECT jsonb_object_agg(decision, cnt) INTO v_replay_counts
        FROM (
          SELECT decision, count(*) AS cnt FROM public.cohort_graduation_decisions
          WHERE old_group_id = v_old_group_id GROUP BY decision
        ) t;
      RETURN jsonb_build_object(
        'new_group_id', v_graduated_to,
        'decision_counts', COALESCE(v_replay_counts, '{}'::JSONB),
        'replayed', true
      );
    END IF;
    RAISE EXCEPTION 'Cohort has already been graduated at %.', v_graduated_at USING ERRCODE = 'P0001';
  END IF;

  IF v_old_status <> 'completed' THEN
    RAISE EXCEPTION 'Cohort must be Completed before it can be graduated.' USING ERRCODE = 'P0001';
  END IF;

  -- 2. Coverage guard: every active student must have an explicit decision ----
  SELECT count(*) INTO v_active_count FROM public.group_students
    WHERE group_id = v_old_group_id AND status = 'active';
  IF v_active_count <> jsonb_array_length(p_payload->'decisions') THEN
    RAISE EXCEPTION 'Every active student must have an explicit decision (% active, % decided).',
      v_active_count, jsonb_array_length(p_payload->'decisions') USING ERRCODE = 'P0001';
  END IF;

  -- 3. Bare next-cohort row — NO course/instructor/schedule writes here. -------
  INSERT INTO public.groups (
    branch_id, semester_id, series_id, name, code, type,
    capacity, waitlist_capacity, day_of_week, time, start_date,
    robocode_share_percent, status, graduated_from_group_id
  ) VALUES (
    (v_new_group->>'branch_id')::UUID, (v_new_group->>'semester_id')::UUID,
    (v_new_group->>'series_id')::UUID, v_new_group->>'name', v_new_group->>'code',
    COALESCE(v_new_group->>'type', 'class'),
    (v_new_group->>'capacity')::INT, COALESCE((v_new_group->>'waitlist_capacity')::INT, 0),
    v_new_group->>'day_of_week', v_new_group->>'time', (v_new_group->>'start_date')::DATE,
    COALESCE((v_new_group->>'robocode_share_percent')::NUMERIC, 100),
    'forming', v_old_group_id
  ) RETURNING id INTO v_new_group_id;

  -- 4. Per-student decisions ----------------------------------------------------
  FOR v_decision IN SELECT * FROM jsonb_array_elements(p_payload->'decisions') LOOP
    IF v_decision->>'decision' = 'transfer' THEN
      v_target_group_id := (v_decision->>'transfer_group_id')::UUID;
      IF v_target_group_id IS NULL OR EXISTS (
        SELECT 1 FROM public.groups WHERE id = v_target_group_id AND status = 'archived'
      ) OR NOT EXISTS (
        SELECT 1 FROM public.groups WHERE id = v_target_group_id
      ) THEN
        RAISE EXCEPTION 'Invalid or archived transfer target for student %.', v_decision->>'student_id'
          USING ERRCODE = 'P0001';
      END IF;
      SELECT gc.course_id INTO v_target_course_id
        FROM public.group_courses gc WHERE gc.group_id = v_target_group_id AND gc.status = 'active' LIMIT 1;
    ELSIF v_decision->>'decision' IN ('continue','repeat') THEN
      v_target_group_id  := v_new_group_id;
      v_target_course_id := (v_new_group->>'course_id')::UUID;
    ELSE
      v_target_group_id  := NULL;
      v_target_course_id := NULL;
    END IF;

    -- Old-cohort transition. Completed cohorts stay writable for this column
    -- set (docs/DOMAIN_RULES.md Rule 12) — only Archived locks it, and this
    -- cohort is guaranteed status='completed' by the guard above.
    UPDATE public.group_students SET
      status = CASE v_decision->>'decision'
                 WHEN 'graduate' THEN 'graduated' WHEN 'continue' THEN 'graduated'
                 WHEN 'hold'     THEN 'paused'    ELSE 'dropped' END,  -- drop / transfer / repeat
      left_at = now(),
      notes = CASE v_decision->>'decision'
                 WHEN 'repeat'   THEN 'Repeating course in next cohort.'
                 WHEN 'transfer' THEN 'Transferred to group ' || v_target_group_id::TEXT || '.'
                 ELSE notes END
    WHERE id = (v_decision->>'old_group_student_id')::UUID
      AND group_id = v_old_group_id;

    -- Close out the OLD student_enrollments row's own lifecycle status (fix:
    -- see migration header). Only `status` changes — group_id, course_id,
    -- dates, renewal_of, financial linkage are all left exactly as they were.
    UPDATE public.student_enrollments SET
      status = CASE v_decision->>'decision'
                 WHEN 'hold'     THEN 'PAUSED'
                 WHEN 'drop'     THEN 'DROPPED'
                 WHEN 'transfer' THEN 'TRANSFERRED'
                 ELSE 'COMPLETED' END  -- continue / graduate / repeat
    WHERE id = (v_decision->>'old_enrollment_id')::UUID
      AND status = 'ACTIVE';

    v_new_enrollment_id := NULL;

    IF v_decision->>'decision' IN ('continue','repeat','transfer') THEN
      -- New enrollment: renewal_of chains to the prior enrollment (Rule 5/10).
      -- No student_financial_accounts row here — deliberate (see original migration header).
      INSERT INTO public.student_enrollments (
        student_id, branch_id, group_id, course_id, status, enrollment_type,
        renewal_of, start_date, created_by
      ) VALUES (
        (v_decision->>'student_id')::UUID,
        (SELECT branch_id FROM public.groups WHERE id = v_target_group_id),
        v_target_group_id, v_target_course_id, 'ACTIVE', 'primary',
        (v_decision->>'old_enrollment_id')::UUID,
        (v_new_group->>'start_date')::DATE, p_performed_by
      ) RETURNING id INTO v_new_enrollment_id;

      INSERT INTO public.group_students (group_id, student_id, status, joined_at, enrollment_type, course_id)
      VALUES (v_target_group_id, (v_decision->>'student_id')::UUID, 'active',
              COALESCE((v_new_group->>'start_date')::DATE, CURRENT_DATE), 'primary', v_target_course_id)
      RETURNING id INTO v_new_group_student_id;

      UPDATE public.student_enrollments SET group_student_id = v_new_group_student_id
      WHERE id = v_new_enrollment_id;
    END IF;

    INSERT INTO public.cohort_graduation_decisions (
      old_group_id, new_group_id, student_id, decision, old_enrollment_id, new_enrollment_id, performed_by
    ) VALUES (
      v_old_group_id,
      CASE WHEN v_decision->>'decision' IN ('continue','repeat','transfer') THEN v_target_group_id ELSE NULL END,
      (v_decision->>'student_id')::UUID, v_decision->>'decision',
      (v_decision->>'old_enrollment_id')::UUID, v_new_enrollment_id, p_performed_by
    );

    v_counts := jsonb_set(v_counts, ARRAY[v_decision->>'decision'],
      to_jsonb(COALESCE((v_counts->>(v_decision->>'decision'))::INT, 0) + 1));
  END LOOP;

  -- 5. Idempotency latch (stage + replay) + draft closure ----------------------
  UPDATE public.groups
  SET graduated_at = now(), graduated_to_group_id = v_new_group_id, graduation_request_id = p_request_id
  WHERE id = v_old_group_id;

  IF p_draft_id IS NOT NULL THEN
    UPDATE public.cohort_graduation_drafts
    SET status = 'committed', committed_group_id = v_new_group_id, updated_at = now()
    WHERE id = p_draft_id AND status = 'in_progress';
  END IF;

  -- 6. Audit --------------------------------------------------------------------
  PERFORM public.write_audit_log(
    p_performed_by, 'graduate_cohort', 'group', v_old_group_id,
    jsonb_build_object('status', v_old_status, 'graduated_at', NULL),
    jsonb_build_object('graduated_at', now(), 'new_group_id', v_new_group_id, 'decision_counts', v_counts),
    v_old_branch_id
  );

  RETURN jsonb_build_object('new_group_id', v_new_group_id, 'decision_counts', v_counts, 'replayed', false);
END;
$$;
