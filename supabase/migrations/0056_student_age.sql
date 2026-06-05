-- Sprint 54 Final: Add age column to students table
-- Age is required at enrollment; stored directly to avoid DOB-dependency
-- DOB remains optional in profiles.date_of_birth

ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS age integer
  CONSTRAINT students_age_range CHECK (age IS NULL OR (age >= 3 AND age <= 25));

-- Index for age-range filtering
CREATE INDEX IF NOT EXISTS idx_students_age ON public.students(age) WHERE age IS NOT NULL;
