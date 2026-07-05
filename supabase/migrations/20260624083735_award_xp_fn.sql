-- Atomic XP award function
-- Fixes race condition where concurrent awardXP calls lost XP via read-then-write.
-- The first UPDATE atomically increments total_xp under row lock,
-- then level + streak are recomputed from the definitive post-increment value.

CREATE OR REPLACE FUNCTION award_xp(
  p_student_id  UUID,
  p_amount      INTEGER,
  p_is_activity BOOLEAN DEFAULT false
)
RETURNS TABLE(new_total_xp INTEGER, new_level INTEGER, leveled_up BOOLEAN)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_old_level    INTEGER;
  v_new_xp       INTEGER;
  v_new_level    INTEGER;
  v_cur_streak   INTEGER;
  v_best_streak  INTEGER;
  v_last_act     DATE;
  v_today        DATE := CURRENT_DATE;
  v_diff_days    INTEGER;
  v_new_streak   INTEGER;
BEGIN
  IF p_amount <= 0 THEN
    SELECT s.total_xp, s.current_level
    INTO v_new_xp, v_old_level
    FROM students s WHERE s.id = p_student_id AND s.deleted_at IS NULL;
    RETURN QUERY SELECT COALESCE(v_new_xp, 0), COALESCE(v_old_level, 1), false::BOOLEAN;
    RETURN;
  END IF;

  -- Atomic increment (row-level lock prevents lost-update race)
  UPDATE students
  SET total_xp = total_xp + p_amount
  WHERE id = p_student_id AND deleted_at IS NULL
  RETURNING total_xp, current_level, current_streak, best_streak, last_activity_date
  INTO v_new_xp, v_old_level, v_cur_streak, v_best_streak, v_last_act;

  IF NOT FOUND THEN
    RETURN QUERY SELECT 0::INTEGER, 1::INTEGER, false::BOOLEAN;
    RETURN;
  END IF;

  -- Compute new level from definitive post-increment total
  v_new_level := CASE
    WHEN v_new_xp >= 29000 THEN 15
    WHEN v_new_xp >= 24500 THEN 14
    WHEN v_new_xp >= 20500 THEN 13
    WHEN v_new_xp >= 17000 THEN 12
    WHEN v_new_xp >= 14000 THEN 11
    WHEN v_new_xp >= 11500 THEN 10
    WHEN v_new_xp >=  9200 THEN  9
    WHEN v_new_xp >=  7200 THEN  8
    WHEN v_new_xp >=  5500 THEN  7
    WHEN v_new_xp >=  4000 THEN  6
    WHEN v_new_xp >=  2800 THEN  5
    WHEN v_new_xp >=  1800 THEN  4
    WHEN v_new_xp >=  1000 THEN  3
    WHEN v_new_xp >=   500 THEN  2
    ELSE 1
  END;

  IF p_is_activity THEN
    IF v_last_act IS NULL THEN
      v_new_streak := 1;
    ELSE
      v_diff_days := v_today - v_last_act;
      IF v_diff_days = 0 THEN
        v_new_streak := v_cur_streak;
      ELSIF v_diff_days = 1 THEN
        v_new_streak := v_cur_streak + 1;
      ELSE
        v_new_streak := 1;
      END IF;
    END IF;

    UPDATE students SET
      current_level      = v_new_level,
      current_streak     = v_new_streak,
      best_streak        = GREATEST(v_best_streak, v_new_streak),
      last_activity_date = v_today
    WHERE id = p_student_id;
  ELSE
    UPDATE students SET current_level = v_new_level WHERE id = p_student_id;
  END IF;

  RETURN QUERY SELECT v_new_xp, v_new_level, (v_new_level > v_old_level)::BOOLEAN;
END;
$$;
