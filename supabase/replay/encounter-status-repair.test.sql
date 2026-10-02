-- Simulate the older deployed constraint that the normal clean baseline masks.
BEGIN;
ALTER TABLE public.encounters DROP CONSTRAINT encounters_status_check;
ALTER TABLE public.encounters ADD CONSTRAINT encounters_status_check
  CHECK(status IN ('active','resolved','fled','abandoned'));
INSERT INTO auth.users(id) VALUES ('00000000-0000-0000-0000-000000000001');
INSERT INTO public.characters(id,user_id,name,role,creation_method)
VALUES('00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000001','Test','solo','streetrat');
INSERT INTO public.campaigns(id,user_id,character_id,name)
VALUES('00000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002','Test');
INSERT INTO public.encounters(campaign_id,status)
VALUES('00000000-0000-0000-0000-000000000003','fled'),
('00000000-0000-0000-0000-000000000003','abandoned');
DO $$ BEGIN
  BEGIN
    INSERT INTO public.encounters(campaign_id,status)
    VALUES('00000000-0000-0000-0000-000000000003','friendlies_won');
    RAISE EXCEPTION 'legacy constraint did not reproduce the failure';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
END $$;
\ir ../migrations/20261002100000_repair_encounter_status_constraint.sql
-- The repair is safe on a database where it has already been applied.
\ir ../migrations/20261002100000_repair_encounter_status_constraint.sql
DO $$ DECLARE v_status text; BEGIN
  IF (SELECT count(*) FROM public.encounters WHERE status='resolved') <> 2 THEN
    RAISE EXCEPTION 'legacy terminal rows were not normalized';
  END IF;
  FOREACH v_status IN ARRAY ARRAY['active','friendlies_won','friendlies_lost','resolved'] LOOP
    INSERT INTO public.encounters(campaign_id,status)
    VALUES('00000000-0000-0000-0000-000000000003',v_status);
  END LOOP;
  BEGIN
    INSERT INTO public.encounters(campaign_id,status)
    VALUES('00000000-0000-0000-0000-000000000003','invented');
    RAISE EXCEPTION 'invalid encounter status was accepted';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
END $$;
ROLLBACK;
