ALTER TABLE public.campaigns
  ADD COLUMN IF NOT EXISTS phase text NOT NULL DEFAULT 'job';

ALTER TABLE public.campaigns
  ADD CONSTRAINT campaigns_phase_check CHECK (phase IN ('life','hook','job','aftermath'));

ALTER TABLE public.campaigns ALTER COLUMN phase SET DEFAULT 'life';

CREATE TABLE public.campaign_situations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  situation_key text NOT NULL,
  category text NOT NULL DEFAULT 'need' CHECK (category IN ('need','people','opportunity','pressure','hook')),
  title text NOT NULL,
  summary text,
  npc_key text,
  status text NOT NULL DEFAULT 'live' CHECK (status IN ('live','resolved','expired','escalated')),
  severity integer NOT NULL DEFAULT 1,
  due_day integer,
  last_shown_day integer,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (campaign_id, situation_key)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.campaign_situations TO authenticated;
GRANT ALL ON public.campaign_situations TO service_role;

ALTER TABLE public.campaign_situations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own campaign_situations" ON public.campaign_situations
  FOR ALL TO authenticated
  USING (public.owns_campaign(campaign_id))
  WITH CHECK (public.owns_campaign(campaign_id));

CREATE TRIGGER campaign_situations_set_updated_at
  BEFORE UPDATE ON public.campaign_situations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.campaign_clocks (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  clock_key text NOT NULL,
  label text NOT NULL,
  filled integer NOT NULL DEFAULT 0,
  segments integer NOT NULL DEFAULT 6,
  hidden boolean NOT NULL DEFAULT false,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (campaign_id, clock_key)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.campaign_clocks TO authenticated;
GRANT ALL ON public.campaign_clocks TO service_role;

ALTER TABLE public.campaign_clocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own campaign_clocks" ON public.campaign_clocks
  FOR ALL TO authenticated
  USING (public.owns_campaign(campaign_id))
  WITH CHECK (public.owns_campaign(campaign_id));

CREATE TRIGGER campaign_clocks_set_updated_at
  BEFORE UPDATE ON public.campaign_clocks
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();