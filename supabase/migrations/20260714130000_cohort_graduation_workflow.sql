-- Migration: 20260714130000_cohort_graduation_workflow
-- Purpose: Phase 2 of the Group/Cohort Academic Lifecycle feature — the
--          Graduation Wizard. Activates the previously-dormant
--          student_enrollments.renewal_of and groups.series_id (Phase 0/
--          docs/GROUP_SERIES_RULES.md) via one atomic, idempotent commit.
--          See docs/DOMAIN_RULES.md Rules 5, 9, 10, 12.
--
-- Scope:
--   1. groups: graduated_at / graduated_to_group_id / graduated_from_group_id
--      / graduation_request_id — the idempotency + lineage columns.
--   2. cohort_graduation_decisions — per-student decision audit trail.
--   3. cohort_graduation_drafts — resumable wizard state, ONE PER (cohort,
--      user) so nobody's in-progress work is ever silently overwritten.
--   4. commit_cohort_graduation() — the one atomic write. Deliberately does
--      NOT touch group_courses/group_instructors/schedules or create any
--      student_financial_accounts row — the next cohort is always created
--      bare (Draft, unbilled) and finished via already-existing, separate,
--      explicit flows (Edit Group; the Enrollment & Contract wizard).
--   5. graduate_cohort permission (team_leader + super_admin).
--
-- Explicitly NOT in this migration: no new groups.status enum value: a
-- graduated cohort's status stays 'completed' forever (Archiving, Rule 1,
-- remains a separate, later, unrelated action). No changes to
-- student_financial_accounts, certificates, attendance_records, or any
-- Phase 0/0.5/1 object.

-- ─── 1. groups: idempotency + lineage columns ────────────────────────────────

ALTER TABLE public.groups
  ADD COLUMN IF NOT EXISTS graduated_at             TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS graduated_to_group_id     UUID REFERENCES public.groups(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS graduated_from_group_id   UUID REFERENCES public.groups(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS graduation_request_id     UUID;

COMMENT ON COLUMN public.groups.graduated_at IS
  'Set exactly once, when this Completed cohort''s Graduation Wizard is committed. Presence is the stage guard against double-graduation — see commit_cohort_graduation(). docs/DOMAIN_RULES.md Rule 14.';
COMMENT ON COLUMN public.groups.graduated_to_group_id IS
  'Points at the next cohort created by this cohort''s graduation commit. NULL until graduated_at is set; never changes after.';
COMMENT ON COLUMN public.groups.graduated_from_group_id IS
  'Reverse pointer, set on the NEW cohort at creation: which (now-graduated) cohort produced this one. Lets the UI show "Draft – Setup Required" without a join against every other groups row.';
COMMENT ON COLUMN public.groups.graduation_request_id IS
  'The idempotency key supplied by the client at commit time. A retried commit_cohort_graduation() call carrying the SAME request_id after graduated_at is already set is treated as a safe replay (returns the original result) rather than an error — protects against double-clicks / network retries of the same logical request.';

CREATE INDEX IF NOT EXISTS idx_groups_graduated_to   ON public.groups(graduated_to_group_id)   WHERE graduated_to_group_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_groups_graduated_from ON public.groups(graduated_from_group_id) WHERE graduated_from_group_id IS NOT NULL;

-- ─── 2. cohort_graduation_decisions: per-student decision trail ─────────────

CREATE TABLE IF NOT EXISTS public.cohort_graduation_decisions (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  old_group_id       UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  new_group_id       UUID REFERENCES public.groups(id) ON DELETE SET NULL,
  student_id         UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  decision           TEXT NOT NULL CHECK (decision IN ('continue','graduate','hold','drop','transfer','repeat')),
  old_enrollment_id  UUID REFERENCES public.student_enrollments(id) ON DELETE SET NULL,
  new_enrollment_id  UUID REFERENCES public.student_enrollments(id) ON DELETE SET NULL,
  performed_by       UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cgd_old_group ON public.cohort_graduation_decisions(old_group_id);
CREATE INDEX IF NOT EXISTS idx_cgd_student   ON public.cohort_graduation_decisions(student_id);

ALTER TABLE public.cohort_graduation_decisions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cgd_read_by_permission" ON public.cohort_graduation_decisions;
CREATE POLICY "cgd_read_by_permission" ON public.cohort_graduation_decisions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.groups g WHERE g.id = old_group_id
      AND public.user_has_permission(auth.uid(), 'graduate_cohort', g.branch_id)
    )
    OR public.user_has_permission(auth.uid(), 'manage_system')
  );
-- No client INSERT/UPDATE/DELETE policy: only written inside
-- commit_cohort_graduation() (SECURITY DEFINER), invoked exclusively via the
-- service-role Server Action — same model as write_audit_log.

GRANT SELECT ON public.cohort_graduation_decisions TO authenticated;

-- ─── 3. cohort_graduation_drafts: resumable wizard state, per (cohort, user) ─

CREATE TABLE IF NOT EXISTS public.cohort_graduation_drafts (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  old_group_id        UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  step                INT  NOT NULL DEFAULT 1,
  new_group_draft     JSONB NOT NULL DEFAULT '{}',
  decisions           JSONB NOT NULL DEFAULT '[]',
  request_id          UUID,
  status              TEXT NOT NULL DEFAULT 'in_progress'
                        CHECK (status IN ('in_progress','committed','discarded','stale')),
  committed_group_id  UUID REFERENCES public.groups(id) ON DELETE SET NULL,
  created_by          UUID REFERENCES public.users(id) ON DELETE SET NULL,
  updated_by          UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.cohort_graduation_drafts IS
  'Resumable Graduation Wizard progress. One in_progress row per (old_group_id, created_by) — never shared/overwritten across users (round 3 adjustment). status=stale means the underlying cohort was graduated by a DIFFERENT draft while this one was still open.';

-- One active draft PER (cohort, user).
CREATE UNIQUE INDEX IF NOT EXISTS idx_cgdraft_one_in_progress_per_user
  ON public.cohort_graduation_drafts(old_group_id, created_by) WHERE status = 'in_progress';

CREATE INDEX IF NOT EXISTS idx_cgdraft_old_group        ON public.cohort_graduation_drafts(old_group_id);
CREATE INDEX IF NOT EXISTS idx_cgdraft_old_group_status ON public.cohort_graduation_drafts(old_group_id, status);

DROP TRIGGER IF EXISTS trg_cgdraft_updated_at ON public.cohort_graduation_drafts;
CREATE OR REPLACE FUNCTION public.set_cohort_graduation_draft_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
CREATE TRIGGER trg_cgdraft_updated_at
  BEFORE UPDATE ON public.cohort_graduation_drafts
  FOR EACH ROW EXECUTE FUNCTION public.set_cohort_graduation_draft_updated_at();

ALTER TABLE public.cohort_graduation_drafts ENABLE ROW LEVEL SECURITY;

-- Read: anyone with graduate_cohort for the cohort's branch can see ALL drafts
-- for that cohort (so "another user has a draft in progress" can be surfaced) —
-- but write is restricted to the owning row via the WITH CHECK below.
DROP POLICY IF EXISTS "cgdraft_read_by_permission" ON public.cohort_graduation_drafts;
CREATE POLICY "cgdraft_read_by_permission" ON public.cohort_graduation_drafts
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.groups g WHERE g.id = old_group_id
      AND public.user_has_permission(auth.uid(), 'graduate_cohort', g.branch_id)
    )
    OR public.user_has_permission(auth.uid(), 'manage_system')
  );

DROP POLICY IF EXISTS "cgdraft_write_own" ON public.cohort_graduation_drafts;
CREATE POLICY "cgdraft_write_own" ON public.cohort_graduation_drafts
  FOR ALL USING (
    created_by = auth.uid()
    OR public.user_has_permission(auth.uid(), 'manage_system')
  ) WITH CHECK (
    created_by = auth.uid()
    OR public.user_has_permission(auth.uid(), 'manage_system')
  );

GRANT SELECT, INSERT, UPDATE ON public.cohort_graduation_drafts TO authenticated;

-- ─── 4. commit_cohort_graduation(): the one atomic write ─────────────────────
--
-- Follows the cancel_schedule_with_cascade() precedent (migration 0099): a
-- single plpgsql function call is one implicit transaction — any
-- RAISE EXCEPTION rolls back every effect automatically. Deliberately does
-- NOT touch group_courses / group_instructors / schedules (course/instructor/
-- schedule setup is a separate, explicit, already-existing flow — Edit
-- Group), and NEVER creates a student_financial_accounts row (real pricing
-- is set later via the existing Enrollment & Contract flow).

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
    -- A retry carrying the SAME request_id that already succeeded is a safe
    -- replay, not an error — return the original result instead of
    -- re-executing a single INSERT. This check happens BEFORE any writes
    -- below, so a replay never re-runs the decision loop.
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

    v_new_enrollment_id := NULL;

    IF v_decision->>'decision' IN ('continue','repeat','transfer') THEN
      -- New enrollment: renewal_of chains to the prior enrollment (Rule 5/10).
      -- No student_financial_accounts row here — deliberate (see header).
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

COMMENT ON FUNCTION public.commit_cohort_graduation(JSONB, UUID, UUID, UUID) IS
  'Phase 2 Graduation Wizard commit. Atomic (single-transaction) creation of the next bare cohort plus every continuing/repeating/transferring student''s new student_enrollments (renewal_of-chained) and group_students rows, and the old cohort''s group_students status transitions. Never touches group_courses/group_instructors/schedules or creates student_financial_accounts. Idempotent: same-request_id retries after success replay the original result; a genuinely new request after graduated_at is set is rejected.';

GRANT EXECUTE ON FUNCTION public.commit_cohort_graduation(JSONB, UUID, UUID, UUID) TO authenticated;

-- ─── 5. RBAC: graduate_cohort ─────────────────────────────────────────────────

INSERT INTO public.permissions (name, description, category) VALUES
  ('graduate_cohort', 'Run the end-of-semester Graduation Wizard on a Completed cohort (view, draft, and commit)', 'academic')
ON CONFLICT (name) DO UPDATE SET description = EXCLUDED.description, category = EXCLUDED.category;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r, public.permissions p
WHERE r.name IN ('team_leader', 'super_admin') AND p.name = 'graduate_cohort'
ON CONFLICT DO NOTHING;

-- ─── 6. Notify PostgREST to reload schema ────────────────────────────────────
NOTIFY pgrst, 'reload schema';
