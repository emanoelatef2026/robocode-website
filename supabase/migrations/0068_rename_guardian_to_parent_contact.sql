-- Migration 0068: Rename student_guardians → student_parent_contacts
--
-- Domain decision: all parent-facing terminology standardizes on "parent" / "parent contact".
-- The "guardian" label is removed from table names and code. Relationship enum values
-- ('father','mother','guardian','other') are kept unchanged — 'guardian' is a valid
-- legal-relationship type, not a label to purge.
--
-- After this migration: student_parent_contacts is the canonical contact table.
-- The student_guardians name no longer exists.

ALTER TABLE public.student_guardians RENAME TO student_parent_contacts;

-- Rename indexes to match new table name
ALTER INDEX IF EXISTS idx_student_guardians_student_id RENAME TO idx_student_parent_contacts_student_id;
ALTER INDEX IF EXISTS idx_student_guardians_phone1     RENAME TO idx_student_parent_contacts_phone1;
ALTER INDEX IF EXISTS idx_student_guardians_phone2     RENAME TO idx_student_parent_contacts_phone2;
