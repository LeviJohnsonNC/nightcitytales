BEGIN;
INSERT INTO auth.users (id) VALUES ('00000000-0000-0000-0000-000000000001');
INSERT INTO public.characters (id,user_id,name,role,creation_method) VALUES
  ('00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000001','Nighteye','media','streetrat');
INSERT INTO public.campaigns (id,user_id,character_id,name,phase,current_mission_id,location_key,day,minute) VALUES
  ('00000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000002','Opera retry','job','night-at-the-opera','p4',1,1435);
INSERT INTO public.mission_progress (campaign_id,mission_id,current_beat_id,completed_beats,branch_choices,objectives) VALUES
  ('00000000-0000-0000-0000-000000000003','night-at-the-opera','hook','["background"]','{"background":"hook"}','[]');
INSERT INTO public.campaign_events (id,campaign_id,type,summary) VALUES
  ('00000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-000000000003','mission_started','Accepted Opera');

ALTER TABLE public.campaign_events ADD CONSTRAINT opera_replay_force_receipt_failure
  CHECK (type <> 'beat_advanced' OR summary <> 'fail receipt');

SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub = '00000000-0000-0000-0000-000000000001';
DO $$
DECLARE
  cid uuid := '00000000-0000-0000-0000-000000000003';
  action jsonb := '{
    "campaign_id":"00000000-0000-0000-0000-000000000003",
    "mission_started_id":"00000000-0000-0000-0000-000000000004",
    "request_id":"00000000-0000-0000-0000-000000000005",
    "from_beat":"hook","to_beat":"opera_clerk","expected_location":"p4",
    "expected_day":1,"expected_minute":1435,"day":2,"minute":10,
    "completed_beats":["background","hook"],"branch_choices":{"background":"hook","hook":"opera_clerk"},
    "objectives":[],"input":"Question the clerk","choice":"Question the clerk","summary":"A Night at the Opera: Len Vale, promoter"
  }';
  follow_up jsonb;
BEGIN
  IF has_function_privilege('anon','public.commit_opera_action(jsonb)','execute') THEN
    RAISE EXCEPTION 'anonymous execution granted';
  END IF;
  PERFORM set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000099',true);
  BEGIN
    PERFORM public.commit_opera_action(action);
    RAISE EXCEPTION 'foreign campaign wrote';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'Campaign not found' THEN RAISE; END IF; END;
  PERFORM set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',true);

  BEGIN
    PERFORM public.commit_opera_action(action || '{"summary":"fail receipt"}');
    RAISE EXCEPTION 'failure was not injected';
  EXCEPTION WHEN check_violation THEN NULL; END;
  IF (SELECT current_beat_id FROM public.mission_progress WHERE campaign_id=cid) <> 'hook'
    OR (SELECT minute FROM public.campaigns WHERE id=cid) <> 1435
    OR (SELECT count(*) FROM public.campaign_events WHERE campaign_id=cid) <> 1
  THEN RAISE EXCEPTION 'failed save left partial state'; END IF;

  PERFORM public.commit_opera_action(action);
  PERFORM public.commit_opera_action(action || '{"expected_day":2,"expected_minute":10,"day":2,"minute":25}');
  IF (SELECT current_beat_id FROM public.mission_progress WHERE campaign_id=cid) <> 'opera_clerk'
    OR (SELECT day FROM public.campaigns WHERE id=cid) <> 2
    OR (SELECT minute FROM public.campaigns WHERE id=cid) <> 10
    OR (SELECT count(*) FROM public.campaign_events WHERE campaign_id=cid AND type='beat_advanced') <> 1
    OR (SELECT count(*) FROM public.campaign_events WHERE campaign_id=cid AND type='player_input') <> 1
  THEN RAISE EXCEPTION 'retry changed a committed result'; END IF;

  BEGIN
    PERFORM public.commit_opera_action(action ||
      '{"request_id":"00000000-0000-0000-0000-000000000006","to_beat":"opera_campus"}');
    RAISE EXCEPTION 'stale choice overwrote the lead';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'The scene changed. Choose an action from the current scene.' THEN RAISE; END IF;
  END;

  follow_up := action || '{
    "request_id":"00000000-0000-0000-0000-000000000007",
    "from_beat":"opera_clerk","to_beat":"opera_guest_list",
    "expected_day":2,"expected_minute":10,"day":2,"minute":25,
    "completed_beats":["background","hook","opera_clerk"],
    "branch_choices":{"background":"hook","hook":"opera_clerk","opera_clerk":"opera_guest_list"},
    "input":"I call Len Vale.","choice":"Call the promoter","summary":"A Night at the Opera: A place on the guest list"
  }';
  PERFORM public.commit_opera_action(follow_up);
  IF (SELECT branch_choices->>'opera_clerk' FROM public.mission_progress WHERE campaign_id=cid) <> 'opera_guest_list'
    OR (SELECT minute FROM public.campaigns WHERE id=cid) <> 25
    OR (SELECT count(*) FROM public.campaign_events WHERE campaign_id=cid AND type='beat_advanced') <> 2
  THEN RAISE EXCEPTION 'typed follow-up did not commit'; END IF;
END;
$$;
ROLLBACK;
