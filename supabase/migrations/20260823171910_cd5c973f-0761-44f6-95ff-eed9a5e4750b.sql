ALTER TABLE public.character_finance ADD COLUMN IF NOT EXISTS improvement_points integer NOT NULL DEFAULT 0;
ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS ip_awarded integer;