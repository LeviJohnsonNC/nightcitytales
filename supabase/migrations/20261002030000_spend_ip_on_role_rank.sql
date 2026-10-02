-- Role Ability Ranks can be bought with Improvement Points.
--
-- Rank 4 was a character's Rank for the whole campaign: `character_role_ability`
-- has always had a `rank` column, and everything that reads it — the Combat
-- Awareness pool, the Backup tier, the Motorpool, Maker and Medicine specialty
-- pools — already scales with it. Only the purchase was missing.
--
-- The twin of `spend_ip_on_skill`: one Rank at a time, off the Rank actually on
-- file, paid from the same locked balance, and a `role_rank_raised` event
-- appended to the character's active campaign in the same transaction. The
-- payload is the contract in `src/engine/ledger.ts`
-- (`readRoleRankRaisedEventData`), held to it by `roleRankRaised.test.ts`.
--
-- The price is computed in TypeScript (`roleRankRaiseCost`, 60 I.P. times the
-- new Rank) and sent, as the Skill price is; this checks the step and the range.

CREATE OR REPLACE FUNCTION public.spend_ip_on_role_rank(
  p_character_id uuid,
  p_ability_id text,
  p_new_rank int,
  p_cost int
)
RETURNS int LANGUAGE plpgsql SET search_path TO 'public' AS $$
DECLARE
  v_user uuid := auth.uid();
  v_balance int;
  v_current int;
  v_ability text;
  v_campaign uuid;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF NOT public.owns_character(p_character_id) THEN
    RAISE EXCEPTION 'character not found';
  END IF;
  IF p_cost < 0 THEN RAISE EXCEPTION 'cost cannot be negative'; END IF;
  IF p_new_rank < 1 OR p_new_rank > 10 THEN
    RAISE EXCEPTION 'rank % is outside the printed range 1-10', p_new_rank;
  END IF;

  SELECT improvement_points INTO v_balance
  FROM public.character_finance
  WHERE character_id = p_character_id
  FOR UPDATE;

  IF v_balance IS NULL THEN RAISE EXCEPTION 'character has no improvement points'; END IF;
  IF v_balance < p_cost THEN
    RAISE EXCEPTION 'not enough improvement points: have %, need %', v_balance, p_cost;
  END IF;

  SELECT rank, ability_id INTO v_current, v_ability
  FROM public.character_role_ability
  WHERE character_id = p_character_id
  FOR UPDATE;

  IF FOUND AND v_ability <> p_ability_id THEN
    RAISE EXCEPTION 'character''s role ability is %, not %', v_ability, p_ability_id;
  END IF;

  -- A character saved without a row holds the column's own default, the Rank
  -- every Role starts at.
  v_current := coalesce(v_current, 4);

  IF v_current + 1 <> p_new_rank THEN
    RAISE EXCEPTION 'role ability is at rank %, cannot move to rank %', v_current, p_new_rank;
  END IF;

  INSERT INTO public.character_role_ability (character_id, ability_id, rank)
  VALUES (p_character_id, p_ability_id, p_new_rank)
  ON CONFLICT (character_id) DO UPDATE SET rank = EXCLUDED.rank;

  UPDATE public.character_finance
  SET improvement_points = improvement_points - p_cost
  WHERE character_id = p_character_id
  RETURNING improvement_points INTO v_balance;

  SELECT id INTO v_campaign
  FROM public.campaigns
  WHERE character_id = p_character_id AND status = 'active'
  LIMIT 1;

  IF v_campaign IS NOT NULL THEN
    INSERT INTO public.campaign_events (campaign_id, type, summary, data)
    VALUES (
      v_campaign,
      'role_rank_raised',
      -- A fallback for anything that prints summaries; the screen names the
      -- ability from the payload.
      initcap(replace(p_ability_id, '_', ' ')) || ' Rank ' || v_current || ' → ' || p_new_rank,
      jsonb_build_object(
        'ability_id', p_ability_id,
        'from_rank', v_current,
        'to_rank', p_new_rank,
        'cost', p_cost
      )
    );
  END IF;

  RETURN v_balance;
END;
$$;
GRANT EXECUTE ON FUNCTION public.spend_ip_on_role_rank(uuid, text, int, int) TO authenticated;
