-- Run after migration replay. Two requests can quote the same room, only one can spend.
BEGIN;
INSERT INTO auth.users (id) VALUES ('00000000-0000-0000-0000-000000000001');
INSERT INTO public.characters (id,user_id,name,role,creation_method) VALUES
  ('00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000001','Block test','medtech','streetrat');
INSERT INTO public.campaigns(id,user_id,character_id,name,phase,location_key,day,minute) VALUES
  ('00000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002','Block test','life','h5',2,1400);
INSERT INTO public.campaign_vitals(campaign_id,hp_current,hp_max,seriously_wounded_threshold,humanity_current,humanity_max,eurobucks) VALUES
  ('00000000-0000-0000-0000-000000000003',16,40,20,40,40,75);
INSERT INTO public.campaign_flags(campaign_id,flag,value) VALUES
  ('00000000-0000-0000-0000-000000000003','old_japantown_neighborhood','{"keys":"keys","staff":"staff","equipment":"collect","counterLead":"medtech","counterResult":"kit","lanternLead":"listen","lanternResult":"benefit"}');
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub = '00000000-0000-0000-0000-000000000001';
DO $$
DECLARE
  cid uuid := '00000000-0000-0000-0000-000000000003';
  p jsonb;
  care jsonb;
  s jsonb := (SELECT value FROM public.campaign_flags WHERE campaign_id=cid);
BEGIN
  IF has_function_privilege('anon','public.commit_neighborhood_action(jsonb)','execute') THEN
    RAISE EXCEPTION 'anonymous execution granted';
  END IF;
  p := jsonb_build_object('request_id',gen_random_uuid(),'campaign_id',cid,'action','residents',
    'expected',jsonb_build_object('day',2,'minute',1400,'location','h5','hp',16,'cash',75,'state',s),
    'cost',75,'heal',0,'minutes',45,'clock','{"day":3,"minute":5}'::jsonb,'patch','{"lease":"residents"}'::jsonb,'summary','Residents sign.');
  BEGIN
    PERFORM public.commit_neighborhood_action(p || '{"cost":76}');
    RAISE EXCEPTION 'overspent';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'Incorrect price or care.' THEN RAISE; END IF; END;
  PERFORM set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000099',true);
  BEGIN
    PERFORM public.commit_neighborhood_action(p);
    RAISE EXCEPTION 'foreign campaign wrote';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'Campaign or request missing.' THEN RAISE; END IF; END;
  PERFORM set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',true);
  PERFORM public.commit_neighborhood_action(p);
  PERFORM public.commit_neighborhood_action(p);
  BEGIN
    PERFORM public.commit_neighborhood_action(p || jsonb_build_object('request_id',gen_random_uuid(),'action','kimen','cost',0));
    RAISE EXCEPTION 'stale decision wrote';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'The neighborhood changed. Check the latest scene.' THEN RAISE; END IF; END;
  care := jsonb_build_object('request_id',gen_random_uuid(),'campaign_id',cid,'action','care',
    'expected',jsonb_build_object('day',3,'minute',5,'location','h5','hp',16,'cash',0,'state',s || '{"lease":"residents"}'),
    'cost',0,'heal',4,'minutes',30,'clock','{"day":3,"minute":35}'::jsonb,'patch','{"careDay":3}'::jsonb,'summary','Nao treats you.','wound','light');
  PERFORM public.commit_neighborhood_action(care);
  PERFORM public.commit_neighborhood_action(care);
  BEGIN
    PERFORM public.commit_neighborhood_action(care || jsonb_build_object('request_id',gen_random_uuid(),'expected',
      (care->'expected') || jsonb_build_object('hp',20,'minute',35,'state',(care#>'{expected,state}') || '{"careDay":3}')));
    RAISE EXCEPTION 'treated twice';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'That opportunity has changed.' THEN RAISE; END IF; END;
  IF (SELECT count(*) FROM public.campaign_events WHERE campaign_id=cid AND type='neighborhood_action') <> 2
    OR NOT EXISTS (SELECT 1 FROM public.campaign_vitals WHERE campaign_id=cid AND eurobucks=0 AND hp_current=20 AND wound_state='light')
    OR NOT EXISTS (SELECT 1 FROM public.campaigns WHERE id=cid AND day=3 AND minute=35)
    OR NOT EXISTS (SELECT 1 FROM public.campaign_flags WHERE campaign_id=cid AND value @> '{"lease":"residents","careDay":3}')
  THEN RAISE EXCEPTION 'state, money, clock or receipt diverged'; END IF;
END;
$$;
ROLLBACK;
