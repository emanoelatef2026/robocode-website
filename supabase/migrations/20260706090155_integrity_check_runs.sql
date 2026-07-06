-- Phase 6 — Continuous governance: table to persist daily data-integrity
-- check results (app/api/cron/integrity-check). One row per cron run;
-- `breached` lists which checks exceeded their threshold (empty = healthy).

CREATE TABLE IF NOT EXISTS public.integrity_check_runs (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  run_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  ok         BOOLEAN     NOT NULL,
  counts     JSONB       NOT NULL,
  breached   TEXT[]      NOT NULL DEFAULT '{}',
  duration_ms INTEGER    NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_integrity_check_runs_run_at
  ON public.integrity_check_runs (run_at DESC);

ALTER TABLE public.integrity_check_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY integrity_check_runs_service_role ON public.integrity_check_runs
  FOR ALL TO service_role USING (true) WITH CHECK (true);
