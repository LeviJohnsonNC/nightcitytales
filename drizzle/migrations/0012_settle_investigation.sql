CREATE FUNCTION public.settle_investigation(payload jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE
  v_result jsonb;
  v_ending text := payload #>> '{receipt,evidenceEnding}';
  v_beat text := payload #>> '{completion,beat_id}';
BEGIN
  IF v_ending IS NULL OR v_ending NOT IN ('delivered', 'leaked', 'buried')
    OR v_beat IS DISTINCT FROM (CASE WHEN v_ending = 'delivered' THEN 'resolution' ELSE v_ending END)
  THEN RAISE EXCEPTION 'unknown investigation ending'; END IF;

  v_result := public.settle_job(payload);
  IF (v_result->>'already_settled')::boolean THEN RETURN v_result; END IF;

  IF EXISTS (SELECT 1 FROM public.encounters WHERE campaign_id = (payload->>'campaign_id')::uuid
    AND status = 'active') THEN RAISE EXCEPTION 'finish the encounter before choosing an ending'; END IF;

  UPDATE public.mission_progress SET
    branch_choices = branch_choices || jsonb_build_object('evidence', v_beat),
    completed_beats = completed_beats || '["evidence"]'::jsonb,
    current_beat_id = v_beat, status = 'completed'
  WHERE campaign_id = (payload->>'campaign_id')::uuid AND mission_id = payload->>'mission_id'
    AND current_beat_id = 'evidence' AND status = 'active';
  IF NOT FOUND THEN RAISE EXCEPTION 'this investigation is not awaiting an evidence decision'; END IF;
  RETURN v_result;
END;
$$;
REVOKE ALL ON FUNCTION public.settle_investigation(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.settle_investigation(jsonb) TO authenticated, service_role;