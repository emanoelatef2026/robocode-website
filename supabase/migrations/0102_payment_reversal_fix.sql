-- Migration 0102: Allow negative amounts in finance_payments for reversal entries
--
-- Root cause: finance_payments.amount had CHECK (amount > 0), which silently
-- blocked the negative debit entry that createReversal inserts.
-- The function returned { ok: true } despite the insert failing, leaving the
-- balance unchanged and no ledger entry created.
--
-- Fix: drop the positive-only constraint so reversal entries (amount < 0) can
-- be stored. recompute_account_balance already uses SUM(amount) which handles
-- both positive payments and negative reversals correctly.

BEGIN;

-- Drop the CHECK (amount > 0) constraint on finance_payments
ALTER TABLE public.finance_payments
  DROP CONSTRAINT IF EXISTS finance_payments_amount_check;

-- Verify recompute_account_balance sums all amounts (positive + negative).
-- No function change needed — SUM(fp.amount) already handles both signs.

NOTIFY pgrst, 'reload schema';

COMMIT;
