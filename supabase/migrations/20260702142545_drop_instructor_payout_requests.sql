-- Phase XLI.1 — Remove the instructor-initiated payout-request workflow.
-- Payment info (wallet_number/instapay_number/payment_link/payment_method/
-- bank_account_number) already lives on instructors and remains the single
-- source of truth. "Paid" amounts remain tracked in staff_payment_records.
-- No data in instructor_payout_requests needs preserving — approved/paid
-- requests already produced their staff_payment_records row.

DROP TABLE IF EXISTS public.instructor_payout_requests;

NOTIFY pgrst, 'reload schema';
