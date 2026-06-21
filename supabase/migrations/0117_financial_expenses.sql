-- ────────────────────────────────────────────────────────────────────────────
-- Phase XXVII — Financial Expenses Table
-- Unified expense tracking for Group, Branch and Academy level P&L
-- ────────────────────────────────────────────────────────────────────────────

-- Main table
CREATE TABLE IF NOT EXISTS financial_expenses (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_scope text        NOT NULL CHECK (expense_scope IN ('GROUP','BRANCH','ACADEMY')),
  expense_type  text        NOT NULL CHECK (expense_type IN (
    'INSTRUCTOR','GROUP_RENT','MATERIALS','WORKSHOP','COMPETITION',
    'CAMP','TRANSPORTATION','ADS','MARKETING','EQUIPMENT',
    'BRANCH_RENT','UTILITIES','INTERNET','PRINTING','MAINTENANCE','OTHER'
  )),
  group_id      uuid        REFERENCES groups(id)    ON DELETE SET NULL,
  branch_id     uuid        REFERENCES branches(id)  ON DELETE SET NULL,
  amount        numeric(12,2) NOT NULL CHECK (amount > 0),
  expense_date  date        NOT NULL,
  notes         text,
  created_by    uuid        REFERENCES auth.users(id),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- Scope integrity: GROUP scope must have group_id; BRANCH scope must have branch_id
ALTER TABLE financial_expenses
  ADD CONSTRAINT fe_group_scope_requires_group_id
  CHECK (expense_scope != 'GROUP'  OR group_id  IS NOT NULL);

ALTER TABLE financial_expenses
  ADD CONSTRAINT fe_branch_scope_requires_branch_id
  CHECK (expense_scope != 'BRANCH' OR branch_id IS NOT NULL);

-- Performance indexes
CREATE INDEX idx_financial_expenses_group_id    ON financial_expenses(group_id)    WHERE group_id  IS NOT NULL;
CREATE INDEX idx_financial_expenses_branch_id   ON financial_expenses(branch_id)   WHERE branch_id IS NOT NULL;
CREATE INDEX idx_financial_expenses_expense_date ON financial_expenses(expense_date);
CREATE INDEX idx_financial_expenses_scope_type  ON financial_expenses(expense_scope, expense_type);

-- RLS
ALTER TABLE financial_expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_full_access"
  ON financial_expenses TO service_role
  USING (true) WITH CHECK (true);

-- Timestamps trigger (reuse existing function if available)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc
    WHERE proname = 'update_updated_at_column'
  ) THEN
    CREATE OR REPLACE FUNCTION update_updated_at_column()
    RETURNS TRIGGER LANGUAGE plpgsql AS $fn$
    BEGIN NEW.updated_at = now(); RETURN NEW; END;
    $fn$;
  END IF;
END $$;

CREATE TRIGGER trg_financial_expenses_updated_at
  BEFORE UPDATE ON financial_expenses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
