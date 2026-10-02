-- Moving house: home and Lifestyle belong to the campaign.
--
-- Until now where a character lived was creation's answer, kept on the saved
-- character (`character_finance.home_place_key`) and never changed by play,
-- and the rent was read off the Role. Three nullable columns on the campaign
-- now say where this playthrough's character lives and what they eat. NULL in
-- any of them means "where creation put them", so every existing campaign
-- reads exactly as it did and nothing is backfilled.
--
-- `move_house` commits one move: the deposit, the new home, the clock, where
-- the character is standing, and the `moved_house` receipt, together. Its
-- payload is the contract in `src/engine/ledger.ts` (`readMovedHouseEventData`),
-- held to it by `movedHouse.test.ts`. The plan is priced in TypeScript
-- (`planMove` over the printed tables and `moving-house.json`); this checks
-- ownership, phase, the state the plan was priced against, and ranges, and
-- recomputes no rule. Idempotent on the caller's request id, which is also the
-- receipt event's id.

ALTER TABLE public.campaigns
  ADD COLUMN IF NOT EXISTS housing_id text,
  ADD COLUMN IF NOT EXISTS lifestyle_id text,
  ADD COLUMN IF NOT EXISTS home_place_key text;

CREATE OR REPLACE FUNCTION public.move_house(payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_campaign uuid := (payload->>'campaign_id')::uuid;
  v_request uuid := (payload->>'request_id')::uuid;
  v_phase text;
  v_day integer;
  v_minute integer;
  v_paid integer;
  v_known jsonb;
  v_eurobucks integer;
  v_existing jsonb;
  v_to_place text := nullif(payload->'move'->>'to_place', '');
  v_to_housing text := nullif(payload->'move'->>'to_housing', '');
  v_to_lifestyle text := nullif(payload->'move'->>'to_lifestyle', '');
  v_deposit integer := (payload->'move'->>'deposit')::integer;
  v_rent integer := (payload->'move'->>'rent')::integer;
  v_lifestyle_cost integer := (payload->'move'->>'lifestyle_cost')::integer;
  v_day_after integer := (payload->'move'->>'day_after')::integer;
  v_minute_after integer := (payload->'move'->>'minute_after')::integer;
  v_data jsonb;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF v_request IS NULL THEN RAISE EXCEPTION 'request_id is required'; END IF;

  SELECT data INTO v_existing
  FROM public.campaign_events
  WHERE id = v_request AND campaign_id = v_campaign AND type = 'moved_house';
  IF FOUND THEN RETURN v_existing; END IF;

  SELECT phase, day, minute, bills_paid_through_day, known_places
  INTO v_phase, v_day, v_minute, v_paid, v_known
  FROM public.campaigns
  WHERE id = v_campaign AND user_id = v_user
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'campaign not found'; END IF;

  -- A retry that raced the first past the fast path gets the first's receipt.
  SELECT data INTO v_existing
  FROM public.campaign_events
  WHERE id = v_request AND campaign_id = v_campaign AND type = 'moved_house';
  IF FOUND THEN RETURN v_existing; END IF;

  IF v_phase <> 'life' THEN
    RAISE EXCEPTION 'moving house is only possible between jobs';
  END IF;

  SELECT eurobucks INTO v_eurobucks
  FROM public.campaign_vitals
  WHERE campaign_id = v_campaign
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'campaign has no vitals'; END IF;

  IF v_day <> (payload->'expected'->>'day')::integer
    OR v_minute <> (payload->'expected'->>'minute')::integer
    OR v_eurobucks <> (payload->'expected'->>'eurobucks')::integer
    OR v_paid <> (payload->'expected'->>'bills_paid_through_day')::integer
  THEN
    RAISE EXCEPTION 'campaign changed';
  END IF;

  IF v_to_housing IS NULL OR v_to_lifestyle IS NULL THEN
    RAISE EXCEPTION 'a home needs a kind of housing and a Lifestyle';
  END IF;
  IF v_deposit IS NULL OR v_deposit < 0 OR v_deposit > v_eurobucks THEN
    RAISE EXCEPTION 'deposit % is not payable from %', v_deposit, v_eurobucks;
  END IF;
  IF v_rent IS NULL OR v_rent < 0 OR v_lifestyle_cost IS NULL OR v_lifestyle_cost < 0 THEN
    RAISE EXCEPTION 'rates cannot be negative';
  END IF;
  IF v_minute_after IS NULL OR v_minute_after NOT BETWEEN 0 AND 1439
    OR v_day_after IS NULL
    OR (v_day_after * 1440 + v_minute_after) < (v_day * 1440 + v_minute)
  THEN
    RAISE EXCEPTION 'a move cannot end before it starts';
  END IF;

  UPDATE public.campaign_vitals
  SET eurobucks = v_eurobucks - v_deposit
  WHERE campaign_id = v_campaign;

  UPDATE public.campaigns SET
    housing_id = v_to_housing,
    lifestyle_id = v_to_lifestyle,
    home_place_key = v_to_place,
    day = v_day_after,
    minute = v_minute_after,
    -- Moving in is arriving: the character is standing in the new place.
    location_key = coalesce(v_to_place, location_key),
    known_places = CASE
      WHEN v_to_place IS NULL OR coalesce(v_known, '[]'::jsonb) ? v_to_place
        THEN coalesce(v_known, '[]'::jsonb)
      ELSE coalesce(v_known, '[]'::jsonb) || to_jsonb(v_to_place)
    END
  WHERE id = v_campaign;

  v_data := jsonb_build_object(
    'from_place', nullif(payload->'move'->>'from_place', ''),
    'from_housing', payload->'move'->>'from_housing',
    'from_lifestyle', payload->'move'->>'from_lifestyle',
    'to_place', v_to_place,
    'to_housing', v_to_housing,
    'to_lifestyle', v_to_lifestyle,
    'deposit', v_deposit,
    'rent', v_rent,
    'lifestyle_cost', v_lifestyle_cost,
    'day', v_day
  );

  INSERT INTO public.campaign_events (id, campaign_id, type, summary, data)
  VALUES (v_request, v_campaign, 'moved_house', payload->>'summary', v_data);

  RETURN v_data;
END;
$$;

GRANT EXECUTE ON FUNCTION public.move_house(jsonb) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.move_house(jsonb) FROM anon;
