-- What one campaign has discovered.
--
-- src/engine/truth.ts says what is TRUE about a place and not apparent from
-- standing in it; this says who has found it out. The two are deliberately
-- separate: a truth is a fact about the world and a discovery is a fact about
-- one campaign, so the same warehouse keeps its second entrance whether or not
-- anybody has ever looked for it, and a second campaign starts ignorant.
--
-- A row exists only once something has been found. A campaign that has searched
-- nothing has no rows, which is also its honest starting state.
--
-- `truth_key` is the engine's stable key ("place:x5::way_in"), not a foreign
-- key: the truths themselves are derived from the atlas and the campaign's own
-- place state rather than stored, exactly as places, beats and haunts are. What
-- must survive is which key was found, and when.
--
-- `via_skill` is the printed Skill id the discovery was made with. Kept because
-- the same fact reached by Perception and by Streetwise is the same fact
-- learned two different ways, and the narrator should be able to say which.

CREATE TABLE public.campaign_truths (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  truth_key text NOT NULL,
  -- The in-game day it was found, from the campaign clock.
  discovered_day integer,
  via_skill text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (campaign_id, truth_key)
);

CREATE INDEX campaign_truths_campaign_idx ON public.campaign_truths (campaign_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.campaign_truths TO authenticated;
GRANT ALL ON public.campaign_truths TO service_role;

ALTER TABLE public.campaign_truths ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own campaign_truths" ON public.campaign_truths
  FOR ALL TO authenticated
  USING (public.owns_campaign(campaign_id))
  WITH CHECK (public.owns_campaign(campaign_id));