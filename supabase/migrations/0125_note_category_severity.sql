-- Add category and severity to student_notes
-- Category: GENERAL | ACADEMIC | BEHAVIOR | PARENT_FOLLOWUP
-- Severity: LOW | MEDIUM | HIGH

ALTER TABLE student_notes
  ADD COLUMN IF NOT EXISTS category  TEXT NOT NULL DEFAULT 'GENERAL'
    CHECK (category IN ('GENERAL','ACADEMIC','BEHAVIOR','PARENT_FOLLOWUP')),
  ADD COLUMN IF NOT EXISTS severity  TEXT NOT NULL DEFAULT 'LOW'
    CHECK (severity IN ('LOW','MEDIUM','HIGH'));
