ALTER TABLE public.campaign_npcs
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS update_campaign_npcs_updated_at ON public.campaign_npcs;
CREATE TRIGGER update_campaign_npcs_updated_at
BEFORE UPDATE ON public.campaign_npcs
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS campaign_npcs_campaign_created_idx
  ON public.campaign_npcs (campaign_id, created_at);