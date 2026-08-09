CREATE TABLE public.characters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  handle text,
  role text NOT NULL,
  creation_method text NOT NULL CHECK (creation_method IN ('streetrat','edgerunner','complete_package')),
  portrait_id text,
  is_complete boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX characters_user_id_idx ON public.characters(user_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.characters TO authenticated;
GRANT ALL ON public.characters TO service_role;
ALTER TABLE public.characters ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own characters" ON public.characters FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.owns_character(_character_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.characters c WHERE c.id = _character_id AND c.user_id = auth.uid());
$$;

CREATE TABLE public.character_stats (
  character_id uuid PRIMARY KEY REFERENCES public.characters(id) ON DELETE CASCADE,
  int int, ref int, dex int, tech int, cool int,
  will int, luck int, move int, body int, emp int,
  emp_max int,
  hp_max int, hp_current int,
  seriously_wounded_threshold int,
  death_save int,
  humanity_max int, humanity_current int
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.character_stats TO authenticated;
GRANT ALL ON public.character_stats TO service_role;
ALTER TABLE public.character_stats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own character_stats" ON public.character_stats FOR ALL TO authenticated USING (public.owns_character(character_id)) WITH CHECK (public.owns_character(character_id));

CREATE TABLE public.character_skills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  character_id uuid NOT NULL REFERENCES public.characters(id) ON DELETE CASCADE,
  skill_id text NOT NULL,
  level int NOT NULL,
  specialization text,
  UNIQUE (character_id, skill_id, specialization)
);
CREATE INDEX character_skills_character_id_idx ON public.character_skills(character_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.character_skills TO authenticated;
GRANT ALL ON public.character_skills TO service_role;
ALTER TABLE public.character_skills ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own character_skills" ON public.character_skills FOR ALL TO authenticated USING (public.owns_character(character_id)) WITH CHECK (public.owns_character(character_id));

CREATE TABLE public.character_role_ability (
  character_id uuid PRIMARY KEY REFERENCES public.characters(id) ON DELETE CASCADE,
  ability_id text NOT NULL,
  rank int NOT NULL DEFAULT 4,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.character_role_ability TO authenticated;
GRANT ALL ON public.character_role_ability TO service_role;
ALTER TABLE public.character_role_ability ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own character_role_ability" ON public.character_role_ability FOR ALL TO authenticated USING (public.owns_character(character_id)) WITH CHECK (public.owns_character(character_id));

CREATE TABLE public.character_gear (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  character_id uuid NOT NULL REFERENCES public.characters(id) ON DELETE CASCADE,
  item_id text NOT NULL,
  quantity int NOT NULL DEFAULT 1,
  equipped boolean NOT NULL DEFAULT false,
  slot text,
  current_sp int,
  notes text
);
CREATE INDEX character_gear_character_id_idx ON public.character_gear(character_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.character_gear TO authenticated;
GRANT ALL ON public.character_gear TO service_role;
ALTER TABLE public.character_gear ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own character_gear" ON public.character_gear FOR ALL TO authenticated USING (public.owns_character(character_id)) WITH CHECK (public.owns_character(character_id));

CREATE TABLE public.character_cyberware (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  character_id uuid NOT NULL REFERENCES public.characters(id) ON DELETE CASCADE,
  item_id text NOT NULL,
  install_location text,
  humanity_loss_rolled int,
  foundational_for uuid REFERENCES public.character_cyberware(id) ON DELETE SET NULL
);
CREATE INDEX character_cyberware_character_id_idx ON public.character_cyberware(character_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.character_cyberware TO authenticated;
GRANT ALL ON public.character_cyberware TO service_role;
ALTER TABLE public.character_cyberware ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own character_cyberware" ON public.character_cyberware FOR ALL TO authenticated USING (public.owns_character(character_id)) WITH CHECK (public.owns_character(character_id));

CREATE TABLE public.character_lifepath (
  character_id uuid PRIMARY KEY REFERENCES public.characters(id) ON DELETE CASCADE,
  general jsonb NOT NULL DEFAULT '{}'::jsonb,
  role_specific jsonb NOT NULL DEFAULT '{}'::jsonb
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.character_lifepath TO authenticated;
GRANT ALL ON public.character_lifepath TO service_role;
ALTER TABLE public.character_lifepath ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own character_lifepath" ON public.character_lifepath FOR ALL TO authenticated USING (public.owns_character(character_id)) WITH CHECK (public.owns_character(character_id));

CREATE TABLE public.character_finance (
  character_id uuid PRIMARY KEY REFERENCES public.characters(id) ON DELETE CASCADE,
  eurobucks int NOT NULL DEFAULT 0,
  lifestyle text,
  housing text,
  rent int
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.character_finance TO authenticated;
GRANT ALL ON public.character_finance TO service_role;
ALTER TABLE public.character_finance ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own character_finance" ON public.character_finance FOR ALL TO authenticated USING (public.owns_character(character_id)) WITH CHECK (public.owns_character(character_id));

CREATE TABLE public.chargen_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  state jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX chargen_drafts_user_id_idx ON public.chargen_drafts(user_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chargen_drafts TO authenticated;
GRANT ALL ON public.chargen_drafts TO service_role;
ALTER TABLE public.chargen_drafts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own chargen_drafts" ON public.chargen_drafts FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER characters_set_updated_at BEFORE UPDATE ON public.characters FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER chargen_drafts_set_updated_at BEFORE UPDATE ON public.chargen_drafts FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();