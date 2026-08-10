CREATE OR REPLACE FUNCTION public.save_character(payload jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_char uuid;
  v_entry jsonb;
  v_ids jsonb := '{}'::jsonb;
  v_new uuid;
  v_draft text;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  INSERT INTO public.characters (user_id, name, handle, role, creation_method, portrait_id, is_complete)
  VALUES (
    v_user,
    payload->'character'->>'name',
    payload->'character'->>'handle',
    payload->'character'->>'role',
    payload->'character'->>'creation_method',
    payload->'character'->>'portrait_id',
    true
  )
  RETURNING id INTO v_char;

  INSERT INTO public.character_stats
  SELECT * FROM jsonb_populate_record(
    NULL::public.character_stats,
    coalesce(payload->'stats', '{}'::jsonb) || jsonb_build_object('character_id', v_char)
  );

  INSERT INTO public.character_lifepath
  SELECT * FROM jsonb_populate_record(
    NULL::public.character_lifepath,
    coalesce(payload->'lifepath', '{}'::jsonb) || jsonb_build_object('character_id', v_char)
  );

  INSERT INTO public.character_finance
  SELECT * FROM jsonb_populate_record(
    NULL::public.character_finance,
    coalesce(payload->'finance', '{}'::jsonb) || jsonb_build_object('character_id', v_char)
  );

  IF payload ? 'role_ability' THEN
    INSERT INTO public.character_role_ability
    SELECT * FROM jsonb_populate_record(
      NULL::public.character_role_ability,
      (payload->'role_ability') || jsonb_build_object('character_id', v_char)
    );
  END IF;

  INSERT INTO public.character_skills
  SELECT * FROM jsonb_populate_recordset(
    NULL::public.character_skills,
    (
      SELECT coalesce(jsonb_agg(e || jsonb_build_object('character_id', v_char, 'id', gen_random_uuid())), '[]'::jsonb)
      FROM jsonb_array_elements(coalesce(payload->'skills', '[]'::jsonb)) e
    )
  );

  INSERT INTO public.character_gear
  SELECT * FROM jsonb_populate_recordset(
    NULL::public.character_gear,
    (
      SELECT coalesce(jsonb_agg(e || jsonb_build_object('character_id', v_char, 'id', gen_random_uuid())), '[]'::jsonb)
      FROM jsonb_array_elements(coalesce(payload->'gear', '[]'::jsonb)) e
    )
  );

  -- Foundations first, so slotted options can point at the row they sit in.
  FOR v_entry IN
    SELECT e FROM jsonb_array_elements(coalesce(payload->'cyberware', '[]'::jsonb)) e
    WHERE coalesce(e->>'foundation_key', '') = ''
  LOOP
    INSERT INTO public.character_cyberware (character_id, item_id, install_location, humanity_loss_rolled)
    VALUES (
      v_char,
      v_entry->>'item_id',
      v_entry->>'install_location',
      (v_entry->>'humanity_loss_rolled')::int
    )
    RETURNING id INTO v_new;
    v_ids := v_ids || jsonb_build_object(coalesce(v_entry->>'key', v_new::text), v_new::text);
  END LOOP;

  FOR v_entry IN
    SELECT e FROM jsonb_array_elements(coalesce(payload->'cyberware', '[]'::jsonb)) e
    WHERE coalesce(e->>'foundation_key', '') <> ''
  LOOP
    INSERT INTO public.character_cyberware (character_id, item_id, install_location, humanity_loss_rolled, foundational_for)
    VALUES (
      v_char,
      v_entry->>'item_id',
      v_entry->>'install_location',
      (v_entry->>'humanity_loss_rolled')::int,
      (v_ids->>(v_entry->>'foundation_key'))::uuid
    );
  END LOOP;

  v_draft := payload->>'draft_id';
  IF v_draft IS NOT NULL AND v_draft <> '' THEN
    DELETE FROM public.chargen_drafts WHERE id = v_draft::uuid AND user_id = v_user;
  END IF;

  RETURN v_char;
END;
$$;

REVOKE ALL ON FUNCTION public.save_character(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_character(jsonb) TO authenticated;