-- ══════════════════════════════════════════════════════════════════════════════
-- Cleanup 2026-07-06: drop legacy finance tables.
-- All verified EMPTY (0 rows) and unreferenced by application code.
-- The live finance system uses: finance_payments, finance_installments,
-- student_financial_accounts, finance_adjustments, finance_payment_reversals.
-- Guarded: abort if any table unexpectedly contains rows.
-- ══════════════════════════════════════════════════════════════════════════════
do $$
begin
  if (select count(*) from payments) > 0
     or (select count(*) from installments) > 0
     or (select count(*) from installment_plans) > 0
     or (select count(*) from invoice_items) > 0
     or (select count(*) from invoices) > 0
     or (select count(*) from session_payments) > 0 then
    raise exception 'Legacy table is not empty — aborting drop';
  end if;
end $$;

drop table payments;
drop table installments;
drop table installment_plans;
drop table invoice_items;
drop table invoices;
drop table session_payments;
