-- A campaign can leave a portable object somewhere and retrieve it later.
-- Store a copy of the kit attributes so dropping a weapon cannot refill it.
CREATE TABLE public.campaign_scene_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  location_key text NOT NULL,
  origin_key text NOT NULL,
  source text NOT NULL,
  item_id text NOT NULL,
  item_kind text NOT NULL CHECK (item_kind IN ('weapon','armor','ammunition','fashion','gear')),
  quantity integer NOT NULL CHECK (quantity BETWEEN 0 AND 10000),
  slot text,
  current_sp integer,
  ammo_loaded integer,
  condition text NOT NULL DEFAULT 'ok',
  notes text,
  UNIQUE (campaign_id, location_key, origin_key)
);

ALTER TABLE public.campaign_scene_items ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE ON public.campaign_scene_items TO authenticated;
GRANT ALL ON public.campaign_scene_items TO service_role;
CREATE POLICY "own campaign scene items" ON public.campaign_scene_items FOR ALL TO authenticated
  USING (public.owns_campaign(campaign_id)) WITH CHECK (public.owns_campaign(campaign_id));

CREATE UNIQUE INDEX campaign_inventory_transfer_once
  ON public.campaign_events(campaign_id, (data->>'request_key'))
  WHERE type = 'inventory_changed';

CREATE FUNCTION public.commit_chat_inventory(payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE
  v_campaign_id uuid := (payload->>'campaign_id')::uuid;
  v_location text := payload->>'location_key';
  v_request text := payload->>'request_key';
  v_mode text := payload->>'mode';
  v_quantity int := (payload->>'quantity')::int;
  v_name text := payload->>'name';
  v_source text := nullif(payload->>'destination', '');
  v_event public.campaign_events%ROWTYPE;
  v_scene public.campaign_scene_items%ROWTYPE;
  v_held public.campaign_inventory%ROWTYPE;
  v_available bigint;
  v_receipt jsonb;
  v_summary text;
BEGIN
  -- Serialize scene withdrawals, kit edits and retries from campaign chat.
  PERFORM 1 FROM public.campaigns WHERE id = v_campaign_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Campaign not found';
  END IF;

  IF v_request IS NULL OR length(v_request) NOT BETWEEN 1 AND 260
     OR v_quantity IS NULL OR v_quantity NOT BETWEEN 1 AND 10000
     OR v_name IS NULL OR length(v_name) NOT BETWEEN 1 AND 80
     OR v_mode IS NULL OR v_mode NOT IN ('take','drop','stash','give','discard') THEN
    RAISE EXCEPTION 'Invalid inventory transfer';
  END IF;

  SELECT * INTO v_event FROM public.campaign_events
    WHERE campaign_id = v_campaign_id AND type = 'inventory_changed'
      AND data->>'request_key' = v_request;
  IF FOUND THEN
    RETURN v_event.data || jsonb_build_object('ok', true, 'summary', v_event.summary);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.campaigns
    WHERE id = v_campaign_id AND coalesce(location_key, 'little_europe') = v_location) THEN
    RETURN jsonb_build_object('ok', false, 'summary', 'You are somewhere else now.');
  END IF;

  IF v_mode = 'take' THEN
    SELECT * INTO v_scene FROM public.campaign_scene_items
      WHERE campaign_id = v_campaign_id AND location_key = v_location
        AND id = (payload->>'scene_item_id')::uuid FOR UPDATE;
    IF NOT FOUND OR v_scene.quantity < v_quantity THEN
      RETURN jsonb_build_object('ok', false, 'summary', 'That quantity of ' || v_name || ' is no longer available here.');
    END IF;

    UPDATE public.campaign_scene_items SET quantity = quantity - v_quantity WHERE id = v_scene.id;
    IF v_scene.item_kind IN ('gear','ammunition') THEN
      SELECT * INTO v_held FROM public.campaign_inventory
        WHERE campaign_id = v_campaign_id AND kind = v_scene.item_kind AND item_id = v_scene.item_id
          AND NOT equipped AND notes IS NOT DISTINCT FROM v_scene.notes
          AND slot IS NOT DISTINCT FROM v_scene.slot AND condition = v_scene.condition
        ORDER BY id LIMIT 1 FOR UPDATE;
    END IF;
    IF v_held.id IS NOT NULL THEN
      UPDATE public.campaign_inventory SET quantity = quantity + v_quantity WHERE id = v_held.id;
    ELSE
      INSERT INTO public.campaign_inventory
        (campaign_id, kind, item_id, quantity, equipped, slot, current_sp, ammo_loaded, condition, notes)
      VALUES (v_campaign_id, v_scene.item_kind, v_scene.item_id, v_quantity, false,
        v_scene.slot, v_scene.current_sp, v_scene.ammo_loaded, v_scene.condition, v_scene.notes);
    END IF;
    v_summary := format('+%s × %s', v_quantity, v_name);
  ELSE
    SELECT * INTO v_held FROM public.campaign_inventory
      WHERE id = (payload->>'inventory_item_id')::uuid AND campaign_id = v_campaign_id FOR UPDATE;
    IF NOT FOUND OR v_held.quantity < v_quantity OR v_held.kind = 'cyberware' THEN
      RETURN jsonb_build_object('ok', false, 'summary', 'That quantity of ' || v_name || ' is not in your kit.');
    END IF;
    -- An active encounter holds its own live weapon and worn armor state.
    IF (v_held.kind IN ('armor','weapon') OR v_held.slot IN ('body','head','shield','weapon'))
       AND EXISTS (SELECT 1 FROM public.encounters WHERE campaign_id = v_campaign_id AND status = 'active') THEN
      RETURN jsonb_build_object('ok', false, 'summary', 'Settle the fight before removing that weapon or armor.');
    END IF;

    UPDATE public.campaign_inventory SET quantity = quantity - v_quantity,
      equipped = equipped AND quantity > v_quantity
      WHERE id = v_held.id;
    IF v_mode IN ('drop','stash') THEN
      INSERT INTO public.campaign_scene_items
        (campaign_id, location_key, origin_key, source, item_id, item_kind, quantity,
          slot, current_sp, ammo_loaded, condition, notes)
      VALUES (v_campaign_id, v_location, 'transfer:' || v_request,
        coalesce(v_source, CASE WHEN v_mode = 'stash' THEN 'your stash' ELSE 'where you dropped it' END),
        v_held.item_id, coalesce(payload->>'item_kind', v_held.kind), v_quantity,
        coalesce(payload->>'slot', v_held.slot), v_held.current_sp, v_held.ammo_loaded, v_held.condition, v_held.notes);
    END IF;
    v_summary := format('−%s × %s', v_quantity, v_name);
  END IF;

  SELECT coalesce(sum(quantity), 0) INTO v_available FROM public.campaign_inventory
    WHERE campaign_id = v_campaign_id AND item_id = coalesce(v_scene.item_id, v_held.item_id);
  v_receipt := jsonb_build_object('request_key', v_request, 'mode', v_mode,
    'request_id', payload->>'request_id', 'intent_item', payload->>'intent_item',
    'selection', payload->>'selection',
    'item_id', coalesce(v_scene.item_id, v_held.item_id), 'name', v_name,
    'quantity', v_quantity, 'remaining', v_available);
  IF v_source IS NOT NULL THEN
    v_receipt := v_receipt || jsonb_build_object('destination', v_source);
  END IF;
  INSERT INTO public.campaign_events (campaign_id, beat_id, type, summary, data)
    VALUES (v_campaign_id, payload->>'beat_id', 'inventory_changed', v_summary, v_receipt);
  RETURN v_receipt || jsonb_build_object('ok', true, 'summary', v_summary);
END;
$$;

REVOKE ALL ON FUNCTION public.commit_chat_inventory(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.commit_chat_inventory(jsonb) TO authenticated, service_role;
