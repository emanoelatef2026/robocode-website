-- ============================================================================
-- Fix generate_contract_code(): security_hardening (20260705202917) pinned
-- search_path = '' on this trigger function, but its body called
-- nextval('contract_code_seq') unqualified, so it now fails with
-- "relation contract_code_seq does not exist" on every contract creation.
-- Schema-qualify the sequence reference instead of relying on search_path.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.generate_contract_code()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path TO ''
AS $function$
BEGIN
IF NEW.contract_code IS NULL THEN
NEW.contract_code :=
'CNT-' ||
EXTRACT(YEAR FROM now())::TEXT ||
'-' ||
LPAD(nextval('public.contract_code_seq')::TEXT, 6, '0');
END IF;

RETURN NEW;
END;
$function$;
