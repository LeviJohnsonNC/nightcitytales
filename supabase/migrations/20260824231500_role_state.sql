-- Live Role Ability state for a campaign.
--
-- A Solo's Combat Awareness division persists between fights ("If they don't
-- change their assignments, the previous ones persist"), so it has to live
-- somewhere. Role Abilities differ enough from each other that a column per
-- Role would be a bad trade; one jsonb blob keyed by ability id leaves room for
-- the seven Roles not yet modelled without another migration each time.
--
-- Shape: { "combat_awareness": { "allocation": { "precision_attack": 3 } } }
ALTER TABLE public.campaigns
  ADD COLUMN IF NOT EXISTS role_state jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.campaigns.role_state IS
  'Live Role Ability state, keyed by ability id. Empty until the Role Ability is used.';
