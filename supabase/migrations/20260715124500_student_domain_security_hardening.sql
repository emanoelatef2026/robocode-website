-- Migration: student_domain_security_hardening
-- Purpose: Fix advisor findings introduced by 20260715123000_student_domain_foundation.sql.
--   New trigger functions default to PUBLIC EXECUTE + mutable search_path unless pinned,
--   which is exactly the anon-executable SECURITY DEFINER pattern this repo already
--   hardened against once (see 20260705202917_security_hardening.sql). Trigger functions
--   are never meant to be called directly via RPC — only fired by the trigger itself.

ALTER FUNCTION public.audit_student_note_change()        SET search_path = '';
ALTER FUNCTION public.audit_student_evaluation_change()   SET search_path = '';
ALTER FUNCTION public.audit_student_competition_change()  SET search_path = '';

REVOKE EXECUTE ON FUNCTION public.audit_student_evaluation_change()   FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.audit_student_competition_change()  FROM PUBLIC, anon, authenticated;
