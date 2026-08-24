-- Luck Pool (Cyberpunk RED: points equal to the LUCK STAT, refilled each
-- session, spent before a Check to add +1 per point).
--
-- Deliberately NULLable rather than NOT NULL DEFAULT 0. A campaign that
-- predates this column has never recorded a pool, and reading that as "zero
-- points" would silently take Luck away from a character mid-run. NULL means
-- "never recorded", which the app reads as a full pool; the first refill or
-- spend writes a real number.
ALTER TABLE public.campaign_vitals
  ADD COLUMN IF NOT EXISTS luck_current integer;

COMMENT ON COLUMN public.campaign_vitals.luck_current IS
  'Luck Points remaining this session. NULL = never recorded, read as a full pool (the character''s LUCK STAT).';
