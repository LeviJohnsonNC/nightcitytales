-- What a place has become, in one campaign.
--
-- src/data/atlas/places.gameplay.json says what a location IS; this says what
-- has happened to it. A row exists only once something has: a campaign that has
-- never touched a place has no row for it, and the place reads at its authored
-- starting condition. That keeps 156 locations from becoming 156 rows per
-- campaign saying nothing.
--
-- `dials` holds the local pressures — police attention on a market, who has the
-- run of a rooftop — as {key: filled} against segment counts the engine owns.
-- Deliberately NOT campaign_clocks: that table is the pressure rail, which
-- means "something is coming for you", and a market's police attention is a
-- fact about a place rather than a thing hunting the character.
--
-- `flags` is a closed vocabulary held in src/engine/placeState.ts. The model
-- never writes here: it reports observations from the vocabulary it already
-- has, and the engine prices them.

CREATE TABLE public.campaign_places (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  -- An atlas key: a location code ("x5") or a district key.
  place_key text NOT NULL,
  dials jsonb NOT NULL DEFAULT '{}'::jsonb,
  flags text[] NOT NULL DEFAULT ARRAY[]::text[],
  visits integer NOT NULL DEFAULT 0,
  first_visit_day integer,
  last_visit_day integer,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (campaign_id, place_key)
);

CREATE INDEX campaign_places_campaign_idx ON public.campaign_places (campaign_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.campaign_places TO authenticated;
GRANT ALL ON public.campaign_places TO service_role;

ALTER TABLE public.campaign_places ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own campaign_places" ON public.campaign_places
  FOR ALL TO authenticated
  USING (public.owns_campaign(campaign_id))
  WITH CHECK (public.owns_campaign(campaign_id));

CREATE TRIGGER campaign_places_set_updated_at
  BEFORE UPDATE ON public.campaign_places
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();