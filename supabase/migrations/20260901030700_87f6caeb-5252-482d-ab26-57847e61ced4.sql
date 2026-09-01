ALTER TABLE public.campaigns
  ADD COLUMN IF NOT EXISTS location_key text,
  ADD COLUMN IF NOT EXISTS known_places jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.campaigns.location_key IS 'Night City Atlas location code key (e.g. "b1") or district key (e.g. "kabuki").';
COMMENT ON COLUMN public.campaigns.known_places IS 'Array of atlas keys the character has visited or learned about.';