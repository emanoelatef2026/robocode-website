-- Add 'trial_session' as a valid lead source so ad-hoc students
-- from ended trial sessions can be auto-created as leads.

ALTER TABLE public.leads
  DROP CONSTRAINT leads_source_check;

ALTER TABLE public.leads
  ADD CONSTRAINT leads_source_check
  CHECK (source = ANY (ARRAY[
    'website'::text,
    'facebook_ad'::text,
    'instagram_ad'::text,
    'whatsapp'::text,
    'referral'::text,
    'walk_in'::text,
    'other'::text,
    'trial_session'::text
  ]));
