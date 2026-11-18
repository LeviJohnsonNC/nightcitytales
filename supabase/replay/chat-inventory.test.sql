BEGIN;
INSERT INTO auth.users (id) VALUES
  ('00000000-0000-0000-0000-000000000001'),
  ('00000000-0000-0000-0000-000000000099');
INSERT INTO public.characters (id,user_id,name,role,creation_method) VALUES
  ('00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000001','Inventory test','tech','streetrat');
INSERT INTO public.campaigns (id,user_id,character_id,name,phase,location_key,day,minute) VALUES
  ('00000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002','Inventory test','life','p4',2,1400);

SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub = '00000000-0000-0000-0000-000000000001';

DO $$
DECLARE
  cid uuid := '00000000-0000-0000-0000-000000000003';
  scene_id uuid;
  held_id uuid;
  reply jsonb;
  take jsonb := jsonb_build_object('campaign_id',cid,'location_key','p4',
    'request_key','turn-1:take:copper','mode','take','name','Heavy-gauge copper','quantity',3);
  drop_item jsonb;
  rifle_id uuid;
BEGIN
  IF has_function_privilege('anon','public.commit_chat_inventory(jsonb)','execute') THEN
    RAISE EXCEPTION 'anonymous execution granted';
  END IF;
  INSERT INTO public.campaign_scene_items (campaign_id,location_key,origin_key,source,item_id,item_kind,quantity,slot)
    VALUES (cid,'p4','offer:copper:workbench','Workbench','Heavy-gauge copper','gear',3,'gear')
    RETURNING id INTO scene_id;
  take := take || jsonb_build_object('scene_item_id',scene_id);

  PERFORM set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000099',true);
  IF EXISTS (SELECT FROM public.campaign_scene_items WHERE id=scene_id) THEN
    RAISE EXCEPTION 'another user could see the source';
  END IF;
  BEGIN
    PERFORM public.commit_chat_inventory(take);
    RAISE EXCEPTION 'foreign campaign wrote';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'Campaign not found' THEN RAISE; END IF; END;
  PERFORM set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',true);

  reply := public.commit_chat_inventory(take);
  IF reply->>'summary' <> '+3 × Heavy-gauge copper' THEN RAISE EXCEPTION 'unexpected pickup: %', reply; END IF;
  IF public.commit_chat_inventory(take) IS DISTINCT FROM reply THEN RAISE EXCEPTION 'retry changed pickup'; END IF;
  IF (public.commit_chat_inventory(take || '{"request_key":"another turn"}')->>'ok')::boolean THEN
    RAISE EXCEPTION 'picked up an empty source';
  END IF;
  INSERT INTO public.campaign_scene_items (campaign_id,location_key,origin_key,source,item_id,item_kind,quantity)
    VALUES (cid,'p4','offer:copper:workbench','Workbench','Heavy-gauge copper','gear',3)
    ON CONFLICT (campaign_id,location_key,origin_key) DO NOTHING;
  IF (SELECT quantity FROM public.campaign_scene_items WHERE id=scene_id) <> 0 THEN
    RAISE EXCEPTION 'narration replenished depleted supply';
  END IF;
  SELECT id INTO held_id FROM public.campaign_inventory WHERE campaign_id=cid AND item_id='Heavy-gauge copper' AND quantity=3;
  IF held_id IS NULL THEN RAISE EXCEPTION 'three loops were not saved'; END IF;

  UPDATE public.campaigns SET location_key='p5' WHERE id=cid;
  drop_item := jsonb_build_object('campaign_id',cid,'location_key','p4','request_key','turn-2:stash:copper',
    'mode','stash','name','Heavy-gauge copper','inventory_item_id',held_id,'quantity',2,'destination','Lockbox');
  IF (public.commit_chat_inventory(drop_item)->>'ok')::boolean THEN
    RAISE EXCEPTION 'stale location accepted';
  END IF;
  drop_item := drop_item || '{"location_key":"p5"}';
  IF (public.commit_chat_inventory(drop_item || '{"quantity":4}')->>'ok')::boolean THEN
    RAISE EXCEPTION 'could remove four from three';
  END IF;
  reply := public.commit_chat_inventory(drop_item);
  IF reply->>'summary' <> '−2 × Heavy-gauge copper' OR (reply->>'remaining')::int <> 1 THEN
    RAISE EXCEPTION 'unexpected stash: %', reply;
  END IF;
  IF public.commit_chat_inventory(drop_item) IS DISTINCT FROM reply THEN RAISE EXCEPTION 'retry changed stash'; END IF;
  SELECT id INTO scene_id FROM public.campaign_scene_items WHERE source='Lockbox' AND quantity=2;
  IF scene_id IS NULL THEN RAISE EXCEPTION 'stash not persisted'; END IF;
  UPDATE public.campaigns SET location_key='p4' WHERE id=cid;
  take := take || jsonb_build_object('scene_item_id',scene_id,'request_key','turn-3:take:copper','quantity',2);
  IF (public.commit_chat_inventory(take)->>'ok')::boolean THEN
    RAISE EXCEPTION 'could take stock from a different location';
  END IF;
  UPDATE public.campaigns SET location_key='p5' WHERE id=cid;
  reply := public.commit_chat_inventory(take || '{"location_key":"p5"}');
  IF (reply->>'remaining')::int <> 3 OR (SELECT quantity FROM public.campaign_inventory WHERE id=held_id) <> 3
     OR (SELECT count(*) FROM public.campaign_events WHERE campaign_id=cid AND type='inventory_changed') <> 3 THEN
    RAISE EXCEPTION 'pickup, stash and retrieval disagree with ledger: %', reply;
  END IF;

  INSERT INTO public.campaign_inventory (campaign_id, item_id, kind, slot, quantity, ammo_loaded, condition)
    VALUES (cid,'assault_rifle','weapon','weapon',1,4,'broken') RETURNING id INTO rifle_id;
  reply := public.commit_chat_inventory(drop_item || jsonb_build_object(
    'request_key','turn-4:drop:rifle','name','Assault Rifle','mode','drop',
    'inventory_item_id',rifle_id,'quantity',1,'destination','under the bench'));
  IF NOT (reply->>'ok')::boolean THEN RAISE EXCEPTION 'could not drop rifle: %', reply; END IF;
  SELECT id INTO scene_id FROM public.campaign_scene_items WHERE item_id='assault_rifle' AND quantity=1;
  IF scene_id IS NULL OR (SELECT quantity FROM public.campaign_inventory WHERE id=rifle_id) <> 0 THEN
    RAISE EXCEPTION 'dropping left the rifle in both places';
  END IF;
  reply := public.commit_chat_inventory(take || jsonb_build_object(
    'location_key','p5','request_key','turn-5:take:rifle','name','Assault Rifle','scene_item_id',scene_id,'quantity',1));
  IF NOT (reply->>'ok')::boolean OR NOT EXISTS (
    SELECT FROM public.campaign_inventory WHERE item_id='assault_rifle' AND quantity=1
      AND condition='broken' AND ammo_loaded=4 AND NOT equipped
  ) THEN RAISE EXCEPTION 'picking up the rifle lost its state: %', reply; END IF;
END;
$$;
ROLLBACK;
