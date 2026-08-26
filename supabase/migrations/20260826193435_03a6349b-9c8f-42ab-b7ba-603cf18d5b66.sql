-- ---------------------------------------------------------------------------
-- Let the campaign own every kind of thing a character can carry.
-- ---------------------------------------------------------------------------
--
-- Two defects, both of which made buying anything pointless:
--
--   1. campaign_inventory.kind was CHECK (kind IN ('gear','cyberware')) — the
--      two kinds character creation happened to write. The engine's ItemKind
--      (src/engine/catalog.ts) has six members, and an item_id is only
--      resolvable in the namespace kind names. Buying a weapon, a piece of
--      armor or a box of ammunition was therefore rejected by the database
--      outright: three of the four categories the shop offered could not be
--      inserted at all.
--
--   2. start_campaign copies character_gear across with kind hardcoded to
--      'gear', so a campaign's pistols and armor have been filed under the
--      wrong namespace since the first day. Play works — the runtime keys off
--      slot — but nothing can look the row up in the catalog, which is what a
--      shop and a live sheet both have to do.
--
-- Widening the constraint and deriving kind from slot fixes both. The column
-- now means what ItemKind means, which is what every reader already assumed.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'campaign_inventory_kind_check'
      AND conrelid = 'public.campaign_inventory'::regclass
  ) THEN
    ALTER TABLE public.campaign_inventory
      DROP CONSTRAINT campaign_inventory_kind_check;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Repair what is already stored, before the wider constraint goes on.
-- ---------------------------------------------------------------------------
--
-- slot is the reliable column: character creation has always written it
-- (saveCharacter.ts: `slot: line.location ?? line.kind`) and start_campaign
-- copies it verbatim. So slot is where kind is recovered from.
--
-- Both statements are idempotent: re-running them changes nothing, because the
-- second pass finds the values already correct.

UPDATE public.campaign_inventory
SET kind = CASE
  WHEN slot IN ('body','head','shield') THEN 'armor'
  WHEN slot IN ('weapon','ammunition','gear','cyberware','fashion') THEN slot
  ELSE kind
END
WHERE kind = 'gear'
  AND slot IS NOT NULL
  AND slot NOT IN ('gear');

-- Rows written by the old buy path carry no slot at all, which made them
-- invisible to weaponCapabilities and to every ammunition count. Their kind
-- was never wrong (the constraint saw to that), so kind is what recovers slot.
UPDATE public.campaign_inventory
SET slot = kind
WHERE slot IS NULL
  AND kind IN ('weapon','ammunition','gear','cyberware');

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'campaign_inventory_kind_range'
      AND conrelid = 'public.campaign_inventory'::regclass
  ) THEN
    -- Anything still outside the engine's vocabulary would block the
    -- constraint. Nothing should be, but a stray row is filed as gear rather
    -- than costing everyone the constraint.
    UPDATE public.campaign_inventory
    SET kind = 'gear'
    WHERE kind NOT IN ('weapon','armor','ammunition','cyberware','fashion','gear');

    ALTER TABLE public.campaign_inventory
      ADD CONSTRAINT campaign_inventory_kind_range
      CHECK (kind IN ('weapon','armor','ammunition','cyberware','fashion','gear'));
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- And stop new campaigns from repeating it.
-- ---------------------------------------------------------------------------
--
-- Identical to the current definition except that the gear copy derives kind
-- from the slot it is already copying, instead of calling everything 'gear'.

CREATE OR REPLACE FUNCTION public.start_campaign(payload jsonb)
RETURNS uuid LANGUAGE plpgsql SET search_path TO 'public' AS $$
DECLARE
  v_user uuid := auth.uid();
  v_char public.characters%ROWTYPE;
  v_stats public.character_stats%ROWTYPE;
  v_eb integer := 0;
  v_campaign uuid;
  v_mission text := payload->>'mission_id';
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;

  SELECT * INTO v_char FROM public.characters
   WHERE id = (payload->>'character_id')::uuid AND user_id = v_user;
  IF NOT FOUND THEN RAISE EXCEPTION 'character not found'; END IF;

  SELECT id INTO v_campaign FROM public.campaigns
   WHERE character_id = v_char.id AND status = 'active';
  IF FOUND THEN RETURN v_campaign; END IF;

  SELECT * INTO v_stats FROM public.character_stats WHERE character_id = v_char.id;
  IF NOT FOUND THEN RAISE EXCEPTION 'character has no stats'; END IF;

  SELECT coalesce(eurobucks, 0) INTO v_eb FROM public.character_finance WHERE character_id = v_char.id;

  INSERT INTO public.campaigns (user_id, character_id, name, current_mission_id)
  VALUES (
    v_user,
    v_char.id,
    coalesce(nullif(trim(payload->>'name'), ''), coalesce(nullif(trim(v_char.handle), ''), v_char.name) || ' in Night City'),
    v_mission
  )
  RETURNING id INTO v_campaign;

  INSERT INTO public.campaign_vitals (
    campaign_id, hp_current, hp_max, seriously_wounded_threshold,
    humanity_current, humanity_max, wound_state, mortal_save_failures, eurobucks
  ) VALUES (
    v_campaign,
    coalesce(v_stats.hp_max, 0),
    coalesce(v_stats.hp_max, 0),
    coalesce(v_stats.seriously_wounded_threshold, 0),
    coalesce(v_stats.humanity_current, coalesce(v_stats.humanity_max, 0)),
    coalesce(v_stats.humanity_max, 0),
    'none',
    0,
    coalesce(v_eb, 0)
  );

  -- kind derived from the slot being copied, so an item_id stays resolvable in
  -- the catalog. Hardcoding 'gear' filed every pistol and vest under the wrong
  -- namespace, which is why nothing could look them up.
  INSERT INTO public.campaign_inventory (campaign_id, kind, item_id, quantity, equipped, slot, current_sp, notes)
  SELECT
    v_campaign,
    CASE
      WHEN g.slot IN ('body','head','shield') THEN 'armor'
      WHEN g.slot IN ('weapon','ammunition','gear','cyberware','fashion') THEN g.slot
      ELSE 'gear'
    END,
    g.item_id, g.quantity, g.equipped, g.slot, g.current_sp, g.notes
    FROM public.character_gear g WHERE g.character_id = v_char.id;

  INSERT INTO public.campaign_inventory (campaign_id, kind, item_id, quantity, equipped, slot, notes)
  SELECT v_campaign, 'cyberware', c.item_id, 1, true, c.install_location, NULL
    FROM public.character_cyberware c WHERE c.character_id = v_char.id;

  INSERT INTO public.campaign_events (campaign_id, type, summary, data)
  VALUES (
    v_campaign,
    'campaign_started',
    coalesce(nullif(trim(v_char.handle), ''), v_char.name) || ' hits the streets of Night City.',
    jsonb_build_object('character_id', v_char.id, 'mission_id', v_mission)
  );

  RETURN v_campaign;
END;
$$;