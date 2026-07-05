-- ────────────────────────────────────────────────────────────────────────────
-- Phase XXVIII — Recurring Expenses + Expanded Expense Types
-- ────────────────────────────────────────────────────────────────────────────

-- 1. Expand financial_expenses.expense_type to include academy-specific types
--    Drop the old check, add the new one.
ALTER TABLE financial_expenses
  DROP CONSTRAINT IF EXISTS financial_expenses_expense_type_check;

ALTER TABLE financial_expenses
  ADD CONSTRAINT financial_expenses_expense_type_check
  CHECK (expense_type IN (
    'INSTRUCTOR','GROUP_RENT','MATERIALS','WORKSHOP','COMPETITION',
    'CAMP','TRANSPORTATION','ADS','MARKETING','EQUIPMENT',
    'BRANCH_RENT','UTILITIES','INTERNET','PRINTING','MAINTENANCE',
    'ACCOUNTANT','MANAGEMENT','SOFTWARE','TOOLS','CONSULTING','LEGAL','TAXES','OTHER'
  ));

-- 2. Recurring expenses table
CREATE TABLE IF NOT EXISTS recurring_expenses (
  id            uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_scope text          NOT NULL CHECK (expense_scope IN ('GROUP','BRANCH','ACADEMY')),
  expense_type  text          NOT NULL CHECK (expense_type IN (
    'INSTRUCTOR','GROUP_RENT','MATERIALS','WORKSHOP','COMPETITION',
    'CAMP','TRANSPORTATION','ADS','MARKETING','EQUIPMENT',
    'BRANCH_RENT','UTILITIES','INTERNET','PRINTING','MAINTENANCE',
    'ACCOUNTANT','MANAGEMENT','SOFTWARE','TOOLS','CONSULTING','LEGAL','TAXES','OTHER'
  )),
  group_id      uuid          REFERENCES groups(id)   ON DELETE SET NULL,
  branch_id     uuid          REFERENCES branches(id) ON DELETE SET NULL,
  amount        numeric(12,2) NOT NULL CHECK (amount > 0),
  start_date    date          NOT NULL,
  end_date      date,
  is_active     boolean       NOT NULL DEFAULT true,
  notes         text,
  created_by    uuid          REFERENCES auth.users(id),
  created_at    timestamptz   NOT NULL DEFAULT now(),
  updated_at    timestamptz   NOT NULL DEFAULT now()
);

-- Scope integrity
ALTER TABLE recurring_expenses
  ADD CONSTRAINT re_group_scope_requires_group_id
  CHECK (expense_scope != 'GROUP'  OR group_id  IS NOT NULL);

ALTER TABLE recurring_expenses
  ADD CONSTRAINT re_branch_scope_requires_branch_id
  CHECK (expense_scope != 'BRANCH' OR branch_id IS NOT NULL);

-- Indexes
CREATE INDEX idx_recurring_expenses_group_id   ON recurring_expenses(group_id)   WHERE group_id  IS NOT NULL;
CREATE INDEX idx_recurring_expenses_branch_id  ON recurring_expenses(branch_id)  WHERE branch_id IS NOT NULL;
CREATE INDEX idx_recurring_expenses_scope      ON recurring_expenses(expense_scope);
CREATE INDEX idx_recurring_expenses_active     ON recurring_expenses(is_active)   WHERE is_active = true;

-- RLS
ALTER TABLE recurring_expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_full_access"
  ON recurring_expenses TO service_role
  USING (true) WITH CHECK (true);

-- Timestamp trigger
CREATE TRIGGER trg_recurring_expenses_updated_at
  BEFORE UPDATE ON recurring_expenses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
