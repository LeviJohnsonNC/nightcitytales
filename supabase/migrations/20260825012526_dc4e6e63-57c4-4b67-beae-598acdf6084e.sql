ALTER TABLE public.campaign_inventory
  ADD COLUMN IF NOT EXISTS ammo_loaded integer,
  ADD COLUMN IF NOT EXISTS condition text NOT NULL DEFAULT 'ok';