-- Migration 0062: Instructor Operations Center
-- Adds extended profile fields to instructors + instructor_certifications + instructor_notes tables

-- ─── Extended instructor fields ───────────────────────────────────────────────
ALTER TABLE public.instructors
  ADD COLUMN IF NOT EXISTS bio               TEXT,
  ADD COLUMN IF NOT EXISTS alt_phone         TEXT,
  ADD COLUMN IF NOT EXISTS instagram_url     TEXT,
  ADD COLUMN IF NOT EXISTS facebook_url      TEXT,
  ADD COLUMN IF NOT EXISTS whatsapp_number   TEXT,
  ADD COLUMN IF NOT EXISTS salary_per_session NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS currency          TEXT NOT NULL DEFAULT 'EGP',
  ADD COLUMN IF NOT EXISTS instapay_number   TEXT,
  ADD COLUMN IF NOT EXISTS payment_notes     TEXT,
  ADD COLUMN IF NOT EXISTS working_days      TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS max_weekly_load   INT;

-- ─── Instructor certifications ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.instructor_certifications (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instructor_id UUID NOT NULL REFERENCES public.instructors(id) ON DELETE CASCADE,
  certification TEXT NOT NULL,
  level         TEXT CHECK (level IN ('beginner', 'intermediate', 'advanced')),
  status        TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'pending')),
  issued_at     DATE,
  expires_at    DATE,
  notes         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── Instructor notes ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.instructor_notes (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instructor_id UUID NOT NULL REFERENCES public.instructors(id) ON DELETE CASCADE,
  author_id     UUID NOT NULL REFERENCES public.users(id),
  content       TEXT NOT NULL,
  category      TEXT NOT NULL DEFAULT 'general'
                CHECK (category IN ('general','strengths','weaknesses','communication','reliability','classroom_management')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── Indexes ──────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_instructor_certs_instructor_id  ON public.instructor_certifications(instructor_id);
CREATE INDEX IF NOT EXISTS idx_instructor_notes_instructor_id  ON public.instructor_notes(instructor_id);
CREATE INDEX IF NOT EXISTS idx_instructor_notes_author_id      ON public.instructor_notes(author_id);
