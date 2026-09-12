-- The Supabase surface the migrations stand on, and nothing else.
--
-- A replay needs a database that looks enough like Supabase for the migrations
-- to apply: the roles they grant to, the auth helpers their policies call, and
-- the storage objects their portrait policies reference. This is that, kept
-- deliberately small — it is derived from what the migrations actually use
-- (auth.uid, auth.users, storage.objects, storage.foldername), so it grows only
-- when a migration starts depending on something new.
--
-- It is NOT a Supabase emulator. It proves the migration SEQUENCE is valid SQL
-- against a clean database: no object created twice, no function referencing a
-- column that does not exist, no policy on a missing table. That is the bug
-- class that took the encounter saves down — `save_encounter_state` filtered on
-- an `encounter_combatants.campaign_id` that the surviving CREATE TABLE never
-- made, and nothing noticed because CI has no database.
--
-- It does not verify that RLS policies are CORRECT, only that they apply.

-- Roles the migrations grant to. NOLOGIN: nothing connects as them here.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon NOLOGIN NOINHERIT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOLOGIN NOINHERIT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    CREATE ROLE service_role NOLOGIN NOINHERIT BYPASSRLS;
  END IF;
END
$$;

CREATE SCHEMA IF NOT EXISTS auth;
CREATE SCHEMA IF NOT EXISTS storage;

-- Supabase's own users table, reduced to the columns the migrations reference
-- (they only ever foreign-key to id).
CREATE TABLE IF NOT EXISTS auth.users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text
);

-- auth.uid() reads the request's JWT claims in Supabase. Here it reads a GUC,
-- so a test can say who it is with `set local request.jwt.claim.sub`.
CREATE OR REPLACE FUNCTION auth.uid()
RETURNS uuid
LANGUAGE sql STABLE
AS $$
  SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;

CREATE OR REPLACE FUNCTION auth.role()
RETURNS text
LANGUAGE sql STABLE
AS $$
  SELECT coalesce(nullif(current_setting('request.jwt.claim.role', true), ''), 'anon');
$$;

-- The storage objects the portrait policies are written against.
CREATE TABLE IF NOT EXISTS storage.buckets (
  id text PRIMARY KEY,
  name text NOT NULL,
  public boolean NOT NULL DEFAULT false
);

CREATE TABLE IF NOT EXISTS storage.objects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bucket_id text REFERENCES storage.buckets (id),
  name text,
  owner uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Splits an object name on "/" the way Supabase's helper does, so a policy
-- comparing foldername(name)[1] to a user id applies cleanly.
CREATE OR REPLACE FUNCTION storage.foldername(name text)
RETURNS text[]
LANGUAGE sql IMMUTABLE
AS $$
  SELECT string_to_array(regexp_replace(name, '/[^/]*$', ''), '/');
$$;

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role;
GRANT USAGE ON SCHEMA storage TO anon, authenticated, service_role;
