/**
 * Backend types. The generated Cloud client types are re-exported here so
 * nothing outside /src/lib/backend imports the generated files directly.
 */
import type { Database, Json as CloudJson } from "@/integrations/supabase/types";

export type { Database };
export type Json = CloudJson;

type Tables = Database["public"]["Tables"];
export type Row<T extends keyof Tables> = Tables[T]["Row"];
export type Insert<T extends keyof Tables> = Tables[T]["Insert"];
export type Update<T extends keyof Tables> = Tables[T]["Update"];

export type Character = Row<"characters">;
export type CharacterInsert = Insert<"characters">;
export type CharacterUpdate = Update<"characters">;

export type CharacterStats = Row<"character_stats">;
export type CharacterStatsInsert = Insert<"character_stats">;

export type CharacterSkill = Row<"character_skills">;
export type CharacterSkillInsert = Insert<"character_skills">;

export type CharacterRoleAbility = Row<"character_role_ability">;
export type CharacterRoleAbilityInsert = Insert<"character_role_ability">;

export type CharacterGear = Row<"character_gear">;
export type CharacterGearInsert = Insert<"character_gear">;

export type CharacterCyberware = Row<"character_cyberware">;
export type CharacterCyberwareInsert = Insert<"character_cyberware">;

export type CharacterLifepath = Row<"character_lifepath">;
export type CharacterLifepathInsert = Insert<"character_lifepath">;

export type CharacterFinance = Row<"character_finance">;
export type CharacterFinanceInsert = Insert<"character_finance">;

export type ChargenDraft = Row<"chargen_drafts">;
export type ChargenDraftInsert = Insert<"chargen_drafts">;

export type CreationMethod = "streetrat" | "edgerunner" | "complete_package";

/** A character plus every attached record. */
export type FullCharacter = {
  character: Character;
  stats: CharacterStats | null;
  skills: CharacterSkill[];
  roleAbility: CharacterRoleAbility | null;
  gear: CharacterGear[];
  cyberware: CharacterCyberware[];
  lifepath: CharacterLifepath | null;
  finance: CharacterFinance | null;
};

// --- Play engine (campaigns) ------------------------------------------------

export type Campaign = Row<"campaigns">;
export type CampaignInsert = Insert<"campaigns">;
export type CampaignUpdate = Update<"campaigns">;

export type CampaignVitals = Row<"campaign_vitals">;
export type CampaignVitalsInsert = Insert<"campaign_vitals">;
export type CampaignVitalsUpdate = Update<"campaign_vitals">;


export type CampaignInventoryItem = Row<"campaign_inventory">;
export type CampaignInventoryInsert = Insert<"campaign_inventory">;

export type CampaignNpc = Row<"campaign_npcs">;
export type CampaignNpcInsert = Insert<"campaign_npcs">;

export type CampaignFaction = Row<"campaign_factions">;
export type CampaignFactionInsert = Insert<"campaign_factions">;

export type CampaignFlag = Row<"campaign_flags">;
export type CampaignFlagInsert = Insert<"campaign_flags">;

export type MissionProgress = Row<"mission_progress">;
export type MissionProgressInsert = Insert<"mission_progress">;

export type CampaignEvent = Row<"campaign_events">;
export type CampaignEventInsert = Insert<"campaign_events">;

/** A campaign plus its live child state. */
export type FullCampaign = {
  campaign: Campaign;
  vitals: CampaignVitals | null;
  inventory: CampaignInventoryItem[];
  npcs: CampaignNpc[];
  factions: CampaignFaction[];
  flags: CampaignFlag[];
  missions: MissionProgress[];
};

// --- Play engine (encounters) -----------------------------------------------

export type Encounter = Row<"encounters">;
export type EncounterInsert = Insert<"encounters">;
export type EncounterUpdate = Update<"encounters">;

export type EncounterCombatant = Row<"encounter_combatants">;
export type EncounterCombatantInsert = Insert<"encounter_combatants">;
export type EncounterCombatantUpdate = Update<"encounter_combatants">;

/** An encounter plus its combatants. */
export type FullEncounter = {
  encounter: Encounter;
  combatants: EncounterCombatant[];
};

export type MissionProgressUpdate = Update<"mission_progress">;
