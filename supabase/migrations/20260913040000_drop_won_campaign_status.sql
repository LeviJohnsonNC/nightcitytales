-- Drop "won" from the campaign status vocabulary.
--
-- Nothing in the application has ever written it. A value the game cannot
-- produce is decoration, and this one was also the wrong shape for what the
-- game is: a campaign is a life rather than a job, so surviving a night's work
-- is not winning anything. A run ends when the character dies, or when the
-- player walks away.
--
-- Safe as a forward-only change because no row can hold it: the only writers of
-- campaigns.status are the application ('active', 'lost') and close_aftermath
-- ('active'). The UPDATE below is belt and braces rather than a real migration
-- of data, and it runs before the constraint so a hand-edited row cannot make
-- this fail at 3am.

UPDATE public.campaigns SET status = 'active' WHERE status = 'won';

ALTER TABLE public.campaigns DROP CONSTRAINT IF EXISTS campaigns_status_check;

ALTER TABLE public.campaigns
  ADD CONSTRAINT campaigns_status_check
  CHECK (status = ANY (ARRAY['active'::text, 'lost'::text, 'abandoned'::text]));
