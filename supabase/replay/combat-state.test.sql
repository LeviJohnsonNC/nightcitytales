-- Run after replay.sh against its disposable database. All fixtures roll back.
BEGIN;
INSERT INTO auth.users (id) VALUES ('00000000-0000-0000-0000-000000000001');
INSERT INTO public.characters (id, user_id, name, role, creation_method)
VALUES ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'Combat test', 'solo', 'streetrat');
INSERT INTO public.campaigns (id, user_id, character_id, name)
VALUES ('00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', 'Combat test');
INSERT INTO public.campaign_vitals (campaign_id, hp_current, hp_max, seriously_wounded_threshold, humanity_current, humanity_max)
VALUES ('00000000-0000-0000-0000-000000000003', 5, 40, 20, 40, 40);
INSERT INTO public.encounters (id, campaign_id)
VALUES ('00000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000003');
INSERT INTO public.encounter_combatants (id, encounter_id, is_player, name, side, ref, body, hp_max, hp_current, seriously_wounded_threshold)
VALUES
('00000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000004', true, 'Player', 'friendly', 6, 6, 40, 5, 20),
('00000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000004', false, 'Hostile', 'hostile', 6, 6, 40, 5, 20);
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub = '00000000-0000-0000-0000-000000000001';
DO $$
DECLARE
  payload jsonb := '{
    "encounter_id":"00000000-0000-0000-0000-000000000004",
    "version":0,"round":2,"active_index":0,"status":"active",
    "order_ids":["00000000-0000-0000-0000-000000000005","00000000-0000-0000-0000-000000000006"],
    "player":{"hp_current":-3,"wound_state":"mortal","mortal_save_failures":1},
    "combatants":[
      {"id":"00000000-0000-0000-0000-000000000005","hp_current":-3,"wound_state":"mortal","death_save_penalty":1,"sp_head":7,"sp_body":7,"defeated":false,"initiative":15,"data":{"deathSaveRound":2}},
      {"id":"00000000-0000-0000-0000-000000000006","hp_current":-8,"wound_state":"mortal","death_save_penalty":0,"sp_head":7,"sp_body":7,"defeated":false,"initiative":10,"data":{"combatGoal":"capture","threatRole":"lieutenant","moraleSpent":["wounded"]}}
    ]
  }';
BEGIN
  PERFORM public.save_encounter_state(payload);
  IF NOT EXISTS (SELECT 1 FROM public.campaign_vitals WHERE hp_current = -3 AND wound_state = 'mortal')
    OR NOT EXISTS (SELECT 1 FROM public.encounter_combatants WHERE hp_current = -8 AND NOT defeated)
    OR NOT EXISTS (SELECT 1 FROM public.encounter_combatants WHERE data->>'deathSaveRound' = '2')
    OR NOT EXISTS (SELECT 1 FROM public.encounters WHERE version = 1)
  THEN RAISE EXCEPTION 'mortal state did not persist'; END IF;

  BEGIN
    PERFORM public.save_encounter_state(payload);
    RAISE EXCEPTION 'accepted stale version';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'encounter changed' THEN RAISE; END IF;
  END;

  payload := jsonb_set(payload, '{version}', '1');
  BEGIN
    PERFORM public.save_encounter_state(jsonb_set(payload, '{combatants,1,wound_state}', '"none"'));
    RAISE EXCEPTION 'accepted negative healthy HP';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'invalid combatant state' THEN RAISE; END IF;
  END;
  IF NOT EXISTS (SELECT 1 FROM public.encounters WHERE version = 1) THEN
    RAISE EXCEPTION 'invalid exchange did not roll back';
  END IF;

  PERFORM set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000099', true);
  BEGIN
    PERFORM public.save_encounter_state(payload);
    RAISE EXCEPTION 'accepted another user';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'encounter not found' THEN RAISE; END IF;
  END;
END;
$$;
ROLLBACK;
