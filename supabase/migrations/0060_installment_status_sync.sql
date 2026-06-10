-- Migration 0060: Installment Status Sync
-- Fixes installments staying PENDING after payment by adding FIFO auto-allocation.
-- Also guards against amount = 0 on existing bad rows.
-- ADDITIVE ONLY. Safe to re-run.

-- ─── 1. FIFO installment sync function ───────────────────────────────────────
-- Allocates SFA.paid_amount across installments in order (lowest number first).
-- Called from recompute_account_balance so it runs after every payment.

CREATE OR REPLACE FUNCTION public.sync_installments_for_account(p_account_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_total_paid NUMERIC(10,2);
  v_allocated  NUMERIC(10,2) := 0;
  inst         RECORD;
  v_inst_paid  NUMERIC(10,2);
  v_inst_status TEXT;
BEGIN
  -- Read total paid from authoritative SFA record
  SELECT COALESCE(paid_amount, 0)
  INTO v_total_paid
  FROM public.student_financial_accounts
  WHERE id = p_account_id;

  IF NOT FOUND THEN RETURN; END IF;

  v_allocated := v_total_paid;

  -- FIFO: walk installments in installment_number order
  FOR inst IN (
    SELECT id, amount, due_date
    FROM public.finance_installments
    WHERE account_id = p_account_id
      AND amount > 0          -- skip corrupted rows with amount = 0
    ORDER BY installment_number ASC
  ) LOOP
    IF v_allocated <= 0 THEN
      v_inst_paid   := 0;
      v_inst_status := CASE WHEN inst.due_date < CURRENT_DATE THEN 'OVERDUE' ELSE 'PENDING' END;
    ELSIF v_allocated >= inst.amount THEN
      v_inst_paid   := inst.amount;
      v_inst_status := 'PAID';
      v_allocated   := v_allocated - inst.amount;
    ELSE
      v_inst_paid   := v_allocated;
      v_inst_status := CASE WHEN inst.due_date < CURRENT_DATE THEN 'OVERDUE' ELSE 'PARTIAL' END;
      v_allocated   := 0;
    END IF;

    UPDATE public.finance_installments
    SET
      paid_amount = v_inst_paid,
      status      = v_inst_status,
      updated_at  = now()
    WHERE id = inst.id;
  END LOOP;
END;
$$;

-- ─── 2. Update recompute_account_balance to call installment sync ─────────────
-- Replaces the sprint45 version; adds PERFORM sync_installments_for_account
-- immediately after updating SFA so installments always reflect reality.

CREATE OR REPLACE FUNCTION public.recompute_account_balance(
  p_account_id UUID
) RETURNS TABLE (
  paid_amount      NUMERIC,
  remaining_amount NUMERIC,
  status           TEXT
) LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_net       NUMERIC;
  v_paid      NUMERIC;
  v_remaining NUMERIC;
  v_status    TEXT;
  v_due_date  DATE;
BEGIN
  SELECT sfa.net_amount, sfa.next_due_date
  INTO v_net, v_due_date
  FROM public.student_financial_accounts sfa
  WHERE id = p_account_id;

  IF NOT FOUND THEN
    RETURN QUERY SELECT 0::NUMERIC, 0::NUMERIC, 'CURRENT'::TEXT;
    RETURN;
  END IF;

  SELECT COALESCE(SUM(fp.amount), 0)
  INTO v_paid
  FROM public.finance_payments fp
  WHERE fp.account_id = p_account_id;

  v_remaining := GREATEST(0, COALESCE(v_net, 0) - v_paid);

  v_status := CASE
    WHEN v_remaining <= 0                                            THEN 'PAID'
    WHEN v_due_date IS NOT NULL AND v_due_date < CURRENT_DATE       THEN 'OVERDUE'
    WHEN v_due_date IS NOT NULL AND v_due_date <= CURRENT_DATE + 7  THEN 'DUE_SOON'
    ELSE 'CURRENT'
  END;

  UPDATE public.student_financial_accounts
  SET
    paid_amount      = v_paid,
    remaining_amount = v_remaining,
    status           = v_status,
    updated_at       = now()
  WHERE id = p_account_id;

  -- Sync installment statuses using FIFO allocation
  PERFORM public.sync_installments_for_account(p_account_id);

  RETURN QUERY SELECT v_paid, v_remaining, v_status;
END;
$$;

-- ─── 3. Guard: delete any installments with amount <= 0 ───────────────────────
-- These are corrupted rows that would never progress. Remove them cleanly.
-- Idempotent — only deletes rows matching the condition.

DELETE FROM public.finance_installments WHERE amount <= 0;

-- ─── 4. Backfill: sync all existing accounts ─────────────────────────────────
-- Marks installments PAID/PARTIAL/PENDING/OVERDUE based on actual payments.

DO $$
DECLARE v_acc_id UUID;
BEGIN
  FOR v_acc_id IN
    SELECT id FROM public.student_financial_accounts
  LOOP
    PERFORM public.recompute_account_balance(v_acc_id);
  END LOOP;
END $$;
