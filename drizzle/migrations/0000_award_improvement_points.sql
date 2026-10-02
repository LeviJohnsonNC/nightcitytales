-- Improvement Points are awarded in one transaction.
--
-- `settleIp` made three separate writes: the `ip_awarded` event, the campaign's
-- `ip_awarded` mark, and the character's I.P. total. A failure between the
-- second and third marked the job as paid and paid nothing; a failure before
-- the second left the event written and the job open to be judged again.
--
-- It also could not cover a life. An award is now either a job closing or a
-- stretch of life with no award (a house rule, `ip-awards.json` `_houseRules`),
-- and both mean "everything since the last award". So the guard against paying
-- the same stretch twice is the ledger itself: the caller sends the `seq` of the
-- last `ip_awarded` event it judged from — null when there has been none — and
-- the transaction refuses when that is no longer the last one.
--
-- The plan is computed in TypeScript (`awardImprovementPoints`, from the GM's
-- tier judgement). This checks ownership, phase, a printed tier value and the
-- window; it does not recompute the award.

CREATE OR REPLACE FUNCTION public.award_improvement_points(payload jsonb)
RETURNS integer LANGUAGE plpgsql SECURITY INVOKER SET search_path TO 'public' AS $$
DECLARE
  v_user uuid := auth.uid();
  v_campaign public.campaigns%ROWTYPE;
  v_kind text := payload->>'kind';
  v_ip integer := (payload->>'ip')::integer;
  v_expected bigint := nullif(payload->>'expected_last_award_seq', '')::bigint;
  v_last bigint;
  v_total integer;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;

  -- Locked, so two tabs tallying at once serialise here and the second one
  -- sees the first one's event.
  SELECT * INTO v_campaign FROM public.campaigns
   WHERE id = (payload->>'campaign_id')::uuid AND user_id = v_user
   FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'campaign not found'; END IF;

  IF v_kind IS NULL OR v_kind NOT IN ('job', 'life') THEN
    RAISE EXCEPTION 'unknown award kind %', v_kind;
  END IF;
  -- The printed table's values: 10 to 80 in tens.
  IF v_ip IS NULL OR v_ip < 10 OR v_ip > 80 OR v_ip % 10 <> 0 THEN
    RAISE EXCEPTION 'improvement points must be a printed tier value, got %', v_ip;
  END IF;

  SELECT max(seq) INTO v_last FROM public.campaign_events
   WHERE campaign_id = v_campaign.id AND type = 'ip_awarded';
  IF v_last IS DISTINCT FROM v_expected THEN
    RAISE EXCEPTION 'improvement points were awarded since this was judged';
  END IF;

  IF v_kind = 'job' AND v_campaign.ip_awarded IS NOT NULL THEN
    RAISE EXCEPTION 'This job''s Improvement Points have already been awarded.';
  END IF;
  IF v_kind = 'life' AND (v_campaign.phase <> 'life' OR v_campaign.status <> 'active') THEN
    RAISE EXCEPTION 'a life award needs a living campaign between jobs';
  END IF;

  INSERT INTO public.campaign_events (campaign_id, type, summary, data)
  VALUES (
    v_campaign.id,
    'ip_awarded',
    payload->>'summary',
    coalesce(payload->'data', '{}'::jsonb)
  );

  IF v_kind = 'job' THEN
    UPDATE public.campaigns SET ip_awarded = v_ip WHERE id = v_campaign.id;
  END IF;

  INSERT INTO public.character_finance (character_id, improvement_points)
  VALUES (v_campaign.character_id, v_ip)
  ON CONFLICT (character_id) DO UPDATE
    SET improvement_points = public.character_finance.improvement_points + EXCLUDED.improvement_points
  RETURNING improvement_points INTO v_total;

  RETURN v_total;
END;
$$;
GRANT EXECUTE ON FUNCTION public.award_improvement_points(jsonb) TO authenticated;