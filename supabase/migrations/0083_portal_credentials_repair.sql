-- ─── 0083: Portal credentials repair & diagnostics ──────────────────────────
-- Idempotent. Safe to run multiple times.
-- Re-asserts portal_password column and refreshes schema cache in case
-- migration 0082 was applied before the NOTIFY was added.

ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS portal_password TEXT;

-- Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';

-- ── Diagnostic function ────────────────────────────────────────────────────────
-- Returns all non-deleted students with their portal credential status.
-- Use this to find students who have auth accounts but no portal_password set.
-- NOTE: portal_password can only be backfilled by an admin resetting the password
--       via the portal — we cannot reverse-derive it from auth.users (hashed).
CREATE OR REPLACE FUNCTION public.repair_student_portal_accounts()
RETURNS TABLE (
  student_id   UUID,
  student_name TEXT,
  email        TEXT,
  has_account  BOOL,
  has_password BOOL,
  status       TEXT
)
LANGUAGE sql SECURITY DEFINER
AS $$
  SELECT
    s.id AS student_id,
    COALESCE(
      p.first_name || ' ' || p.last_name,
      s.id::text
    ) AS student_name,
    u.email,
    (s.user_id IS NOT NULL)                                    AS has_account,
    (s.portal_password IS NOT NULL AND s.portal_password <> '') AS has_password,
    CASE
      WHEN s.user_id IS NULL                                        THEN 'no_account'
      WHEN u.email   IS NULL                                        THEN 'no_access'
      WHEN s.portal_password IS NULL OR s.portal_password = ''      THEN 'password_missing'
      ELSE 'active'
    END AS status
  FROM  public.students  s
  LEFT JOIN public.users    u ON u.id = s.user_id
  LEFT JOIN public.profiles p ON p.user_id = s.user_id
  WHERE s.deleted_at IS NULL
  ORDER BY has_password, s.created_at DESC;
$$;
