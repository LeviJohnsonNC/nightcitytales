-- Spending Improvement Points on a Skill Level.
--
-- One transaction, because the two halves must never come apart: deducting the
-- points without raising the Skill would silently rob the player, and raising
-- the Skill without deducting would make advancement free. The cost is
-- recomputed here from the caller's claim and checked against the balance, so a
-- client cannot buy a Level cheaply by sending its own price.
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

  RETURN v_balance;
END;
$$;

GRANT EXECUTE ON FUNCTION public.spend_ip_on_skill(uuid, text, int, int, text) TO authenticated;
