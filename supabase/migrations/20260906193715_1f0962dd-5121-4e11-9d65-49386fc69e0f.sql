-- Where a character lives, as an atlas key rather than as prose.
--
-- The home was already stored, but only inside the display string in
-- character_finance.housing ("Rented Cargo Container, Combat Zone"). That is
-- fine for a sheet and useless to everything else: a campaign cannot be started
-- at a sentence. The printed rule still lives in `housing`; this is the address.
ALTER TABLE public.character_finance
  ADD COLUMN IF NOT EXISTS home_place_key text,
  ADD COLUMN IF NOT EXISTS home_district_key text;

COMMENT ON COLUMN public.character_finance.home_place_key IS
  'Night City Atlas location key for the character''s starting home (e.g. "x3"). Null for characters saved before the address was asked for.';
COMMENT ON COLUMN public.character_finance.home_district_key IS
  'Night City Atlas district key for the character''s starting home (e.g. "rancho_coronado").';