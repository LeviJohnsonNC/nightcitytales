CREATE OR REPLACE FUNCTION public.save_character(payload jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
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

  INSERT INTO public.characters (user_id, name, handle, role, creation_method, portrait_id, portrait_path, is_complete)
  VALUES (
    v_user,
    payload->'character'->>'name',
    payload->'character'->>'handle',
    payload->'character'->>'role',
    payload->'character'->>'creation_method',
    payload->'character'->>'portrait_id',
    payload->'character'->>'portrait_path',
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

  IF payload->'role_ability' IS NOT NULL AND jsonb_typeof(payload->'role_ability') = 'object' THEN
    INSERT INTO public.character_role_ability
    SELECT * FROM jsonb_populate_record(
      NULL::public.character_role_ability,
      (payload->'role_ability') || jsonb_build_object('character_id', v_char)
    );
  END IF;

  FOR v_entry IN SELECT * FROM jsonb_array_elements(coalesce(payload->'skills', '[]'::jsonb)) LOOP
    INSERT INTO public.character_skills
    SELECT * FROM jsonb_populate_record(
      NULL::public.character_skills,
      v_entry || jsonb_build_object('character_id', v_char, 'id', gen_random_uuid())
    );
  END LOOP;

  FOR v_entry IN SELECT * FROM jsonb_array_elements(coalesce(payload->'gear', '[]'::jsonb)) LOOP
    INSERT INTO public.character_gear
    SELECT * FROM jsonb_populate_record(
      NULL::public.character_gear,
      (v_entry - 'key') || jsonb_build_object('character_id', v_char, 'id', gen_random_uuid())
    )
    RETURNING id INTO v_new;
    IF v_entry ? 'key' THEN
      v_ids := v_ids || jsonb_build_object(v_entry->>'key', v_new);
    END IF;
  END LOOP;

  FOR v_entry IN SELECT * FROM jsonb_array_elements(coalesce(payload->'cyberware', '[]'::jsonb)) LOOP
    INSERT INTO public.character_cyberware
    SELECT * FROM jsonb_populate_record(
      NULL::public.character_cyberware,
      (v_entry - 'key' - 'foundation_key') || jsonb_build_object('character_id', v_char, 'id', gen_random_uuid())
    )
    RETURNING id INTO v_new;
    IF v_entry ? 'key' THEN
      v_ids := v_ids || jsonb_build_object(v_entry->>'key', v_new);
    END IF;
  END LOOP;

  UPDATE public.character_cyberware c
  SET foundation_id = (v_ids->>(e->>'foundation_key'))::uuid
  FROM jsonb_array_elements(coalesce(payload->'cyberware', '[]'::jsonb)) e
  WHERE e->>'foundation_key' IS NOT NULL
    AND c.id = (v_ids->>(e->>'key'))::uuid;

  v_draft := payload->>'draft_id';
  IF v_draft IS NOT NULL THEN
    DELETE FROM public.chargen_drafts WHERE id = v_draft::uuid AND user_id = v_user;
  END IF;

  RETURN v_char;
END;
$function$;