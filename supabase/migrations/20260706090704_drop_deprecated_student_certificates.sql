-- student_certificates was superseded by the `certificates` table in
-- migration 0031 (certificate_consolidation) and marked DEPRECATED there.
-- Confirmed empty (0 rows) and unreferenced by any FK or application code
-- before this drop (see docs/LMS_FULL_REVIEW_2026-07-05.md §3.4, §8 Phase 6).

DROP TABLE IF EXISTS public.student_certificates;
