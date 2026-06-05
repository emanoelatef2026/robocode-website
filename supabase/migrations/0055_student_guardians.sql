-- Sprint 54: Student Guardians table
-- Multi-parent/guardian support replacing single emergency_contact JSONB

-- ── Table ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.student_guardians (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id       uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  name             text NOT NULL DEFAULT '',
  relation         text NOT NULL DEFAULT 'guardian'
                   CHECK (relation IN ('father','mother','guardian','other')),
  phone1           text,
  phone2           text,
  whatsapp_preferred boolean NOT NULL DEFAULT false,
  is_primary       boolean NOT NULL DEFAULT false,
  is_emergency     boolean NOT NULL DEFAULT true,
  notes            text,
  created_at       timestamptz NOT NULL DEFAULT now()
);

-- ── Indexes ───────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_student_guardians_student_id ON public.student_guardians(student_id);
CREATE INDEX IF NOT EXISTS idx_student_guardians_phone1     ON public.student_guardians(phone1) WHERE phone1 IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_student_guardians_phone2     ON public.student_guardians(phone2) WHERE phone2 IS NOT NULL;

-- ── RLS ───────────────────────────────────────────────────────────────────────
ALTER TABLE public.student_guardians ENABLE ROW LEVEL SECURITY;

-- Service role has full access
CREATE POLICY IF NOT EXISTS "service_full_access"
  ON public.student_guardians
  USING (true)
  WITH CHECK (true);

-- ── Migrate existing emergency_contact JSONB data ─────────────────────────────
-- Only migrate rows that have at least one phone number and don't already have a guardian record
INSERT INTO public.student_guardians (student_id, name, relation, phone1, phone2, is_primary, is_emergency)
SELECT
  s.id                                                    AS student_id,
  COALESCE(s.emergency_contact->>'name', 'Guardian')      AS name,
  'guardian'                                              AS relation,
  NULLIF(TRIM(s.emergency_contact->>'phone1'), '')        AS phone1,
  NULLIF(TRIM(s.emergency_contact->>'phone2'), '')        AS phone2,
  true                                                    AS is_primary,
  true                                                    AS is_emergency
FROM public.students s
WHERE
  s.deleted_at IS NULL
  AND s.emergency_contact IS NOT NULL
  AND (
    s.emergency_contact->>'phone1' IS NOT NULL
    OR s.emergency_contact->>'phone2' IS NOT NULL
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.student_guardians g WHERE g.student_id = s.id
  );
