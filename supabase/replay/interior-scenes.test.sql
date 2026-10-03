-- Template: bun tools/scenes/interior-sql.ts | psql "$PGURL" -v ON_ERROR_STOP=1
-- Each production-composed fixture runs independently, with every write rolled back.
BEGIN;
INSERT INTO auth.users(id) VALUES ('00000000-0000-0000-0000-000000000001');
INSERT INTO public.characters(id,user_id,name,role,creation_method)
VALUES ('00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000001','Interior test','solo','streetrat');
INSERT INTO public.campaigns(id,user_id,character_id,name)
VALUES ('00000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002','Interior test');
INSERT INTO public.campaign_vitals(campaign_id,hp_current,hp_max,seriously_wounded_threshold,humanity_current,humanity_max)
VALUES ('00000000-0000-0000-0000-000000000003',40,40,20,40,40);
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub='00000000-0000-0000-0000-000000000001';
DO $$
DECLARE
  start_payload jsonb := __START__;
  manifest jsonb := __MANIFEST__;
  moved jsonb := __MOVE__;
  damage jsonb := __DAMAGE__;
  stage_payload jsonb;
  staged jsonb;
  revisited jsonb;
  origin jsonb;
  enc uuid;
  save_payload jsonb;
BEGIN
  stage_payload:=jsonb_build_object('campaign_id',start_payload->>'campaign_id','manifest',manifest);
  staged:=public.stage_authored_scene(stage_payload);
  SELECT jsonb_build_object('phase',phase,'location',location_key,'missionId',current_mission_id)
    INTO origin FROM public.campaigns WHERE id=(start_payload->>'campaign_id')::uuid;
  start_payload:=start_payload || jsonb_build_object('lifecycle_version',1,
    'command_id','00000000-0000-0000-0000-000000000006','expected_origin',origin,
    'scene_ref',jsonb_build_object('id',staged->>'id','revision',0));
  enc:=public.start_persisted_scene_encounter(start_payload);
  IF (SELECT layout FROM public.encounters WHERE id=enc) IS DISTINCT FROM manifest->'scene'->'layout' THEN
    RAISE EXCEPTION 'interior geometry changed at entry';
  END IF;
  save_payload:=jsonb_build_object('encounter_id',enc,'version',0,'layout_version',2,'lifecycle_version',1,
    'round',1,'active_index',0,'status','active','order_ids',start_payload->'order_ids',
    'combatants',jsonb_set(start_payload->'combatants','{0,data,position}',moved),'cover',damage,
    'player','{"hp_current":40,"wound_state":"none","mortal_save_failures":0}'::jsonb);
  PERFORM public.save_encounter_state(save_payload);
  IF NOT EXISTS(SELECT 1 FROM public.encounters WHERE id=enc AND version=1 AND cover=damage AND layout=manifest->'scene'->'layout') THEN
    RAISE EXCEPTION 'interior layout or cover damage did not persist';
  END IF;
  IF (SELECT data->'position' FROM public.encounter_combatants WHERE id=(start_payload->'combatants'->0->>'id')::uuid) IS DISTINCT FROM moved THEN
    RAISE EXCEPTION 'interior movement did not persist';
  END IF;
  save_payload:=save_payload || jsonb_build_object('version',1,'status','friendlies_won','completion',
    jsonb_build_object('summary','Interior encounter completed.','data',jsonb_build_object('encounterId',enc,'status','friendlies_won',
      'sceneResult',jsonb_build_object('version',1,'battlefield',manifest->'scene'->'layout'->'arena'->>'label','objects','[]'::jsonb))));
  PERFORM public.save_encounter_state(save_payload);
  SET CONSTRAINTS ALL IMMEDIATE;
  revisited:=public.stage_authored_scene(stage_payload);
  IF revisited->>'status'<>'resolved' OR revisited->'manifest' IS DISTINCT FROM manifest THEN
    RAISE EXCEPTION 'interior revisit lost frozen geometry or completion';
  END IF;
END;
$$;
ROLLBACK;
