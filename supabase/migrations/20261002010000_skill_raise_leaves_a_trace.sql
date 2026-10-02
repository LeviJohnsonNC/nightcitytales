-- A Skill raise leaves a trace in the campaign.
--
-- `spend_ip_on_skill` moved a Level and took the points, and told the campaign
-- nothing: the ledger of a character who went from Handgun 4 to Handgun 7 read
-- exactly like the ledger of one who never spent a point. So there was no
-- receipt to show, and no history for "how far have I come" to read.
--
-- Now, when the character has an active campaign, the same transaction appends
-- a `skill_raised` event to it. The payload is the contract in
-- `src/engine/ledger.ts` (`readSkillRaisedEventData`); `skillRaised.test.ts`
-- holds the keys below to it, because the type checker never reads inside a
-- SQL string.
--
-- Same signature, so CREATE OR REPLACE replaces rather than overloads, and the
-- generated types do not move. A character with no active campaign — spending
-- from the roster between lives — writes no event, because there is no
-- campaign to tell. Everything else is the function as it was.

CREATE OR REPLACE FUNCTION public.spend_ip_on_skill(
  p_character_id uuid,
  p_skill_id text,
  p_new_level int,
  p_cost int,
  p_specialization text DEFAULT NULL
)
RETURNS int LANGUAGE plpgsql SET search_path TO 'public' AS $$
DECLARE
  v_user uuid := auth.uid();
  v_balance int;
  v_current int;
  v_campaign uuid;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF NOT public.owns_character(p_character_id) THEN
    RAISE EXCEPTION 'character not found';
  END IF;
  IF p_cost < 0 THEN RAISE EXCEPTION 'cost cannot be negative'; END IF;

  -- Lock the balance row so two concurrent buys cannot both see the same points.
  SELECT improvement_points INTO v_balance
  FROM public.character_finance
  WHERE character_id = p_character_id
  FOR UPDATE;

  IF v_balance IS NULL THEN RAISE EXCEPTION 'character has no improvement points'; END IF;
  IF v_balance < p_cost THEN
    RAISE EXCEPTION 'not enough improvement points: have %, need %', v_balance, p_cost;
  END IF;

  -- Repeatable Skills (Language, Science, ...) have one row per specialization,
  -- so the line is identified by both. IS NOT DISTINCT FROM matches NULL to NULL.
  SELECT level INTO v_current
  FROM public.character_skills
  WHERE character_id = p_character_id
    AND skill_id = p_skill_id
    AND specialization IS NOT DISTINCT FROM p_specialization;

  -- Exactly one Level at a time, off the level actually on the sheet. This is
  -- what stops a replayed or stale request from buying a Level twice.
  IF coalesce(v_current, 0) + 1 <> p_new_level THEN
    RAISE EXCEPTION 'skill % is at level %, cannot move to level %',
      p_skill_id, coalesce(v_current, 0), p_new_level;
  END IF;

  IF v_current IS NULL THEN
    INSERT INTO public.character_skills (character_id, skill_id, level, specialization)
    VALUES (p_character_id, p_skill_id, p_new_level, p_specialization);
  ELSE
    UPDATE public.character_skills
    SET level = p_new_level
    WHERE character_id = p_character_id
      AND skill_id = p_skill_id
      AND specialization IS NOT DISTINCT FROM p_specialization;
  END IF;

  UPDATE public.character_finance
  SET improvement_points = improvement_points - p_cost
  WHERE character_id = p_character_id
  RETURNING improvement_points INTO v_balance;

  -- start_campaign keeps at most one active campaign per character.
  SELECT id INTO v_campaign
  FROM public.campaigns
  WHERE character_id = p_character_id AND status = 'active'
  LIMIT 1;

  IF v_campaign IS NOT NULL THEN
    INSERT INTO public.campaign_events (campaign_id, type, summary, data)
    VALUES (
      v_campaign,
      'skill_raised',
      -- A fallback for anything that prints summaries; the screen names the
      -- Skill from the payload, through skillEntryName.
      initcap(replace(p_skill_id, '_', ' ')) || ' ' || coalesce(v_current, 0) || ' → ' || p_new_level,
      jsonb_build_object(
        'skill_id', p_skill_id,
        'specialization', p_specialization,
        'from_level', coalesce(v_current, 0),
        'to_level', p_new_level,
        'cost', p_cost
      )
    );
  END IF;

  RETURN v_balance;
END;
$$;
GRANT EXECUTE ON FUNCTION public.spend_ip_on_skill(uuid, text, int, int, text) TO authenticated;
