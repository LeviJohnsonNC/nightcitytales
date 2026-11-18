-- A failed decision leaves the whole job open. A competing decision gets the first receipt.
BEGIN;
INSERT INTO auth.users (id) VALUES ('00000000-0000-0000-0000-000000000001');
INSERT INTO public.characters (id, user_id, name, role, creation_method)
VALUES ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'Inquiry test', 'media', 'streetrat');
INSERT INTO public.campaigns (id, user_id, character_id, name, phase, current_mission_id)
VALUES ('00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', 'Inquiry test', 'job', 'job-test');
INSERT INTO public.campaign_vitals (campaign_id, hp_current, hp_max, seriously_wounded_threshold, humanity_current, humanity_max, eurobucks)
VALUES ('00000000-0000-0000-0000-000000000003', 40, 40, 20, 40, 40, 100);
INSERT INTO public.mission_progress (campaign_id, mission_id, current_beat_id, branch_choices)
VALUES ('00000000-0000-0000-0000-000000000003', 'job-test', 'climax', '{"legwork":"money"}');
INSERT INTO public.campaign_events (id, campaign_id, type)
VALUES ('00000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000003', 'mission_started');

SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub = '00000000-0000-0000-0000-000000000001';
DO $$
DECLARE
  p jsonb := '{
    "campaign_id":"00000000-0000-0000-0000-000000000003","job_event_id":"00000000-0000-0000-0000-000000000004",
    "mission_id":"job-test","receipt":{"evidenceEnding":"delivered"},"completion":{"beat_id":"resolution"},
    "payment":{"agreed":1500,"paid":1500}
  }';
  replay jsonb;
BEGIN
  BEGIN
    PERFORM public.settle_investigation(p);
    RAISE EXCEPTION 'settled before securing the evidence';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'this investigation is not awaiting an evidence decision' THEN RAISE; END IF;
  END;
  IF NOT EXISTS (SELECT 1 FROM public.campaigns WHERE phase = 'job')
    OR EXISTS (SELECT 1 FROM public.campaign_events WHERE type = 'job_settled')
    OR NOT EXISTS (SELECT 1 FROM public.campaign_vitals WHERE eurobucks = 100)
  THEN RAISE EXCEPTION 'partial settlement survived rollback'; END IF;

  UPDATE public.mission_progress SET current_beat_id = 'evidence';
  PERFORM public.settle_investigation(p);
  replay := public.settle_investigation(p || '{
    "receipt":{"evidenceEnding":"buried"},"completion":{"beat_id":"buried"},"payment":{"agreed":1500,"paid":0}
  }');
  IF replay #>> '{receipt,evidenceEnding}' IS DISTINCT FROM 'delivered'
    OR replay->>'already_settled' IS DISTINCT FROM 'true'
    OR NOT EXISTS (SELECT 1 FROM public.mission_progress WHERE current_beat_id = 'resolution'
      AND status = 'completed' AND branch_choices = '{"legwork":"money","evidence":"resolution"}'
      AND completed_beats = '["evidence"]')
    OR NOT EXISTS (SELECT 1 FROM public.campaign_vitals WHERE eurobucks = 1600)
    OR (SELECT count(*) FROM public.campaign_events WHERE type = 'job_settled') <> 1
  THEN RAISE EXCEPTION 'the first decision did not survive the retry'; END IF;
END;
$$;
ROLLBACK;
