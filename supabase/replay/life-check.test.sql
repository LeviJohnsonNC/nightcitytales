BEGIN;
INSERT INTO auth.users (id) VALUES ('00000000-0000-0000-0000-000000000001');
INSERT INTO public.characters (id,user_id,name,role,creation_method) VALUES
  ('00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000001','Roll test','tech','streetrat');
INSERT INTO public.character_stats(character_id,luck) VALUES
  ('00000000-0000-0000-0000-000000000002',5);
INSERT INTO public.campaigns(id,user_id,character_id,name,phase,location_key,day,minute) VALUES
  ('00000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002','Roll test','life','p4',2,1400);
INSERT INTO public.campaign_vitals(campaign_id,hp_current,hp_max,seriously_wounded_threshold,humanity_current,humanity_max,eurobucks) VALUES
  ('00000000-0000-0000-0000-000000000003',40,40,20,40,40,75);
INSERT INTO public.campaign_events(id,campaign_id,type,summary) VALUES
  ('00000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-000000000003','check_prompt','Test the alternator'),
  ('00000000-0000-0000-0000-000000000005','00000000-0000-0000-0000-000000000003','check_prompt','Test it again');
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub = '00000000-0000-0000-0000-000000000001';
DO $$
DECLARE
  cid uuid := '00000000-0000-0000-0000-000000000003';
  payload jsonb := jsonb_build_object('campaign_id',cid,'expected_luck',null,'summary','14 vs DV 13',
    'roll','{"total":14,"dv":13}'::jsonb,
    'data','{"prompt_event_id":"00000000-0000-0000-0000-000000000004","luck_spent":1}'::jsonb);
  next_roll jsonb := jsonb_set(payload,'{data,prompt_event_id}','"00000000-0000-0000-0000-000000000005"');
BEGIN
  IF has_function_privilege('anon','public.record_life_check(jsonb)','execute') THEN
    RAISE EXCEPTION 'anonymous execution granted';
  END IF;
  PERFORM set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000099',true);
  BEGIN
    PERFORM public.record_life_check(payload);
    RAISE EXCEPTION 'foreign campaign wrote';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'active Life campaign not found' THEN RAISE; END IF; END;
  PERFORM set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',true);
  IF NOT public.record_life_check(payload) THEN RAISE EXCEPTION 'first roll was not saved'; END IF;
  IF public.record_life_check(payload) THEN RAISE EXCEPTION 'roll was saved twice'; END IF;
  BEGIN
    PERFORM public.record_life_check(next_roll);
    RAISE EXCEPTION 'stale Luck was used';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'the Luck pool changed before the roll was saved' THEN RAISE; END IF; END;
  IF (SELECT count(*) FROM public.campaign_events WHERE campaign_id=cid AND type='skill_check') <> 1
    OR (SELECT luck_current FROM public.campaign_vitals WHERE campaign_id=cid) <> 4
  THEN RAISE EXCEPTION 'roll and Luck diverged'; END IF;
END;
$$;
ROLLBACK;
