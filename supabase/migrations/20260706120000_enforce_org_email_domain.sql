-- Migration: 20260706120000_enforce_org_email_domain
-- Purpose: Every login email in the system (students, parents, instructors,
--          team leaders, admins) must be an @robocodeschools.com address —
--          both retroactively and for every future account creation.
-- Run after: scripts/backfill-org-emails.ts --apply has been run and every
--            public.users.email row is already @robocodeschools.com — the
--            VALIDATE CONSTRAINT step below will fail loudly otherwise.

-- ─── Trigger guard: block any non-compliant auth.users insert/update ─────────
-- handle_new_auth_user() fires AFTER INSERT OR UPDATE ON auth.users for every
-- account creation path (admin API, direct SQL, anything) — the single choke
-- point for enforcing this atomically.
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NEW.email NOT ILIKE '%@robocodeschools.com' THEN
    RAISE EXCEPTION 'Login email must be an @robocodeschools.com address (got: %)', NEW.email;
  END IF;

  INSERT INTO public.users (id, email, created_at, updated_at)
  VALUES (NEW.id, NEW.email, now(), now())
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    updated_at = now();
  RETURN NEW;
END;
$$;

-- ─── DB-level check constraint on public.users (defense in depth) ────────────
ALTER TABLE public.users
  ADD CONSTRAINT users_email_domain_check
  CHECK (email ILIKE '%@robocodeschools.com') NOT VALID;

ALTER TABLE public.users
  VALIDATE CONSTRAINT users_email_domain_check;
