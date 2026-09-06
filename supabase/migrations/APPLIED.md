# Applied migrations

Which migrations have actually been run against the database.

## Why this file exists

A migration in `supabase/migrations/` is a file somebody wrote. It is not a
change to the database until somebody applies it, and nothing in the repository
recorded the difference — the convention was a commit message ("Applied
campaign_places SQL") that no test could read.

That gap shipped a real bug. `20260906090000_character_home_place.sql` was
committed and never applied, so `character_finance` had no `home_place_key`
column. Saving a character silently dropped their address, reading it back
failed, the failure was swallowed, and every new character woke up at the atlas
default no matter which district they chose. Every test passed the whole time,
because every test ran against code rather than against the database.

`schema.test.ts` now holds this list against the directory. A migration added
without a line here fails the suite, which turns "somebody has to remember" into
"somebody has to decide".

## How to use it

1. Apply the migration to the database.
2. Add its filename below, in the same order the directory sorts.
3. Commit both together.

If a migration is deliberately NOT applied — superseded, abandoned — say so on
its line rather than deleting it. A migration nobody can account for is the
thing this file exists to prevent.

## Applied

- `20260809190156_5da5d1e4-a37d-48b9-8f17-4621971a5334.sql`
- `20260809190217_9a45b199-9115-4f47-bdb0-b37cd581d273.sql`
- `20260810032700_73337e12-e95e-4945-bef4-0451fcd8a137.sql`
- `20260822203710_b57c9ec3-3373-4b40-928f-6c0ac550b53e.sql`
- `20260822220909_9709911d-acc6-4b64-a1b7-054514da13ef.sql`
- `20260822220945_ed861b17-db13-47a2-bed6-8b46aa3cbdb2.sql`
- `20260823002741_bffe1689-f643-42e1-a688-950563db811f.sql`
- `20260823024230_66c90de6-2d7d-41ad-81be-f378b00ec9ad.sql`
- `20260823033846_e9916cc6-8353-4cf9-b1ee-b6729b8b21d4.sql`
- `20260823033905_8d4e33ec-4252-42ec-abda-1ee8ef2dd49d.sql`
- `20260823033944_f575d4ed-3a63-4ad4-aba9-9505c61750f0.sql`
- `20260823171910_cd5c973f-0761-44f6-95ff-eed9a5e4750b.sql`
- `20260823235600_spend_ip_on_skill.sql`
- `20260824193000_luck_pool.sql`
- `20260824202631_4d8136a5-60ef-4fdf-87dd-e24e66c1fb11.sql`
- `20260824204500_downtime_bills.sql`
- `20260824204758_2c19bfe7-c840-481e-b5ab-ee9697091d8b.sql`
- `20260824231500_role_state.sql`
- `20260824233053_0927a097-1761-4456-ac27-05b347eb68b1.sql`
- `20260825012526_dc4e6e63-57c4-4b67-beae-598acdf6084e.sql`
- `20260825024021_9283b40d-a2c9-4db5-9562-97f69348184b.sql`
- `20260825044532_600d2822-4e53-4f36-8843-2e8f0fa020b4.sql`
- `20260825233000_faction_standing_unique.sql`
- `20260826010427_40ec1a29-5ac0-402d-9756-b16e475911ab.sql`
- `20260826190000_inventory_kinds_and_slots.sql`
- `20260826193435_03a6349b-9c8f-42ab-b7ba-603cf18d5b66.sql`
- `20260827040000_encounter_arena.sql`
- `20260827132532_684596f1-03dd-4dde-9e50-3cfb127e2939.sql`
- `20260830020000_atomic_combat_and_closeout.sql`
- `20260830160000_ripperdoc_installation.sql`
- `20260830211754_f9c7fa06-d9eb-4dd9-9ae0-2872d85d7fc5.sql`
- `20260831020000_cover_state.sql`
- `20260831023602_7e006fbc-1bcf-49fb-9054-14dfc0ab0ec6.sql`
- `20260831055629_18dfd940-d86f-4635-86c6-daff69942bf4.sql`
- `20260831075212_b117837c-7ccd-47c7-bfcf-4a9e1b6ac9fb.sql`
- `20260831171708_69a39a30-ff97-4df7-84bb-0da185e15d27.sql`
- `20260901000000_encounter_version.sql`
- `20260901030700_87f6caeb-5252-482d-ab26-57847e61ced4.sql`
- `20260901120000_encounter_combatant_scope.sql`
- `20260904030000_campaign_places.sql`
- `20260904132122_67120570-47f1-40e1-a1a3-d9abd3f9f644.sql`
- `20260905140000_encounter_status_constraint.sql`
- `20260906090000_character_home_place.sql` — never run directly. Its DDL was
  applied by the duplicate below, written when the column was added through the
  Lovable console. Both are `ADD COLUMN IF NOT EXISTS`, so running this one now
  is a no-op; it is kept because it is the file the code comments point at.
- `20260906193715_1f0962dd-5121-4e11-9d65-49386fc69e0f.sql` — the copy that was
  actually applied. Identical DDL to the entry above.
