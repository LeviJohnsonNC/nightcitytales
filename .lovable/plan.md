# Why "Start Adventure" doesn't work

The front end for play is built, but the backend it calls does not exist yet.

Confirmed by inspecting the live database:

- The only tables are the nine character-creation tables. There are no `campaigns`, `campaign_vitals`, `campaign_inventory`, `campaign_npcs`, `campaign_factions`, `campaign_flags`, `campaign_events`, or `mission_progress` tables.
- There is no `start_campaign` database function.

So when you click Start Adventure, the app calls `start_campaign`, the backend replies that the function does not exist, and the button just reports an error instead of navigating to the play screen. Everything downstream (the play screen, mission progress, the event ledger) is waiting on the same missing pieces.

## What to change

### 1. One migration that creates the play schema

Tables, each with owner-scoped RLS (via the character's owner), plus the required grants:

- `campaigns` — id, user_id, character_id, name, status (active/won/lost/abandoned), current_mission_id, game day + minute clock, created_at/updated_at.
- `campaign_vitals` — hp_current/hp_max, seriously_wounded_threshold, humanity_current/max, wound_state, mortal_save_failures, eurobucks.
- `campaign_inventory` — copied from the character's gear/cyberware at start.
- `campaign_npcs`, `campaign_factions`, `campaign_flags` — live world state (npc status + disposition range matching the engine's -3..3).
- `campaign_events` — append-only ledger with a per-campaign `seq`, type, summary, jsonb data, optional beat_id.
- `mission_progress` — mission id, status, current beat, objectives jsonb.

### 2. `start_campaign(payload jsonb)` function

Security definer, verifies the caller owns the character, then in one transaction:

- creates the campaign (name from payload, optional `mission_id`, clock seeded to Day 1 / 18:00 to match `CAMPAIGN_START_CLOCK`);
- writes starting vitals exactly as `startingVitals()` in `src/engine/campaign.ts` defines them (full HP, creation-time humanity and eurobucks, unwounded, zero death-save failures) — no new numbers invented;
- copies character gear and cyberware into `campaign_inventory`;
- opens `mission_progress` at the mission's first beat when a mission id is given;
- writes the first ledger entry;
- returns the new campaign id.

Also add a guard so a character can only have one `active` campaign, which is what `getActiveCampaignForCharacter` assumes.

### 3. Regenerate backend types

`src/lib/backend/types.ts` already declares `Row<"campaigns">` and friends, but the generated schema types have no such tables — those types currently resolve to nothing. Regenerating after the migration makes the whole campaign adapter type-check honestly.

### 4. Small front-end follow-ups

- `src/features/roster/CharacterDetail.tsx` still shows a disabled "Start Adventure — coming soon" button; wire it to the same `startOrResumeAdventure` call as the roster card.
- Surface the failure message on the card (already rendered) — no change needed beyond confirming it reads clearly.

## Verification

- Run the engine/feature test suite (campaign + mission state tests already exist).
- Start an adventure from the roster with a saved character, confirm it lands on `/play/:id` with vitals, the opening beat of "A Night at the Opera", and one ledger entry.
- Click Start Adventure again on the same character and confirm it resumes the same campaign instead of creating a second one.
