import { backendClient } from "./client";
import type {
  Character,
  CharacterInsert,
  CharacterUpdate,
  CharacterFinanceInsert,
  CharacterGearInsert,
  CharacterCyberwareInsert,
  CharacterLifepathInsert,
  CharacterRoleAbilityInsert,
  CharacterSkillInsert,
  CharacterStatsInsert,
  FullCharacter,
  Json,
} from "./types";

function unwrap<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data as T;
}

export async function listCharacters(): Promise<Character[]> {
  const res = await backendClient
    .from("characters")
    .select("*")
    .order("created_at", { ascending: false });
  return unwrap(res) ?? [];
}

export type RosterStats = {
  hp_current: number | null;
  hp_max: number | null;
  humanity_current: number | null;
  humanity_max: number | null;
};

export type RosterEntry = Character & { stats: RosterStats | null };

/** The roster grid read: every saved character, most recently updated first. */
export async function listRoster(): Promise<RosterEntry[]> {
  const res = await backendClient
    .from("characters")
    .select("*, character_stats(hp_current,hp_max,humanity_current,humanity_max)")
    .order("updated_at", { ascending: false });
  const rows = unwrap(res) ?? [];
  return (
    rows as unknown as (Character & { character_stats: RosterStats | RosterStats[] | null })[]
  ).map(({ character_stats, ...character }) => ({
    ...character,
    stats: Array.isArray(character_stats) ? (character_stats[0] ?? null) : character_stats,
  }));
}

export async function getCharacter(id: string): Promise<FullCharacter | null> {
  const characterRes = await backendClient
    .from("characters")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  const character = unwrap(characterRes);
  if (!character) return null;

  const [stats, skills, roleAbility, gear, cyberware, lifepath, finance] = await Promise.all([
    backendClient.from("character_stats").select("*").eq("character_id", id).maybeSingle(),
    backendClient.from("character_skills").select("*").eq("character_id", id),
    backendClient.from("character_role_ability").select("*").eq("character_id", id).maybeSingle(),
    backendClient.from("character_gear").select("*").eq("character_id", id),
    backendClient.from("character_cyberware").select("*").eq("character_id", id),
    backendClient.from("character_lifepath").select("*").eq("character_id", id).maybeSingle(),
    backendClient.from("character_finance").select("*").eq("character_id", id).maybeSingle(),
  ]);

  return {
    character,
    stats: unwrap(stats),
    skills: unwrap(skills) ?? [],
    roleAbility: unwrap(roleAbility),
    gear: unwrap(gear) ?? [],
    cyberware: unwrap(cyberware) ?? [],
    lifepath: unwrap(lifepath),
    finance: unwrap(finance),
  };
}

export async function createCharacter(input: CharacterInsert): Promise<Character> {
  return unwrap(await backendClient.from("characters").insert(input).select("*").single());
}

export async function updateCharacter(id: string, patch: CharacterUpdate): Promise<Character> {
  return unwrap(
    await backendClient.from("characters").update(patch).eq("id", id).select("*").single(),
  );
}

export async function deleteCharacter(id: string): Promise<void> {
  const { error } = await backendClient.from("characters").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function saveStats(stats: CharacterStatsInsert) {
  return unwrap(
    await backendClient
      .from("character_stats")
      .upsert(stats, { onConflict: "character_id" })
      .select("*")
      .single(),
  );
}

export async function replaceSkills(characterId: string, skills: CharacterSkillInsert[]) {
  const del = await backendClient.from("character_skills").delete().eq("character_id", characterId);
  if (del.error) throw new Error(del.error.message);
  if (skills.length === 0) return [];
  return unwrap(await backendClient.from("character_skills").insert(skills).select("*"));
}

export async function saveRoleAbility(ability: CharacterRoleAbilityInsert) {
  return unwrap(
    await backendClient
      .from("character_role_ability")
      .upsert(ability, { onConflict: "character_id" })
      .select("*")
      .single(),
  );
}

export async function replaceGear(characterId: string, gear: CharacterGearInsert[]) {
  const del = await backendClient.from("character_gear").delete().eq("character_id", characterId);
  if (del.error) throw new Error(del.error.message);
  if (gear.length === 0) return [];
  return unwrap(await backendClient.from("character_gear").insert(gear).select("*"));
}

export async function replaceCyberware(characterId: string, items: CharacterCyberwareInsert[]) {
  const del = await backendClient
    .from("character_cyberware")
    .delete()
    .eq("character_id", characterId);
  if (del.error) throw new Error(del.error.message);
  if (items.length === 0) return [];
  return unwrap(await backendClient.from("character_cyberware").insert(items).select("*"));
}

export async function saveLifepath(lifepath: CharacterLifepathInsert) {
  return unwrap(
    await backendClient
      .from("character_lifepath")
      .upsert(lifepath, { onConflict: "character_id" })
      .select("*")
      .single(),
  );
}

export async function saveFinance(finance: CharacterFinanceInsert) {
  return unwrap(
    await backendClient
      .from("character_finance")
      .upsert(finance, { onConflict: "character_id" })
      .select("*")
      .single(),
  );
}

/**
 * Add end-of-session Improvement Points to a character's permanent total.
 * Returns the new total.
 */
export async function addImprovementPoints(characterId: string, amount: number): Promise<number> {
  const current = unwrap(
    await backendClient
      .from("character_finance")
      .select("improvement_points")
      .eq("character_id", characterId)
      .maybeSingle(),
  ) as { improvement_points: number } | null;
  const total = (current?.improvement_points ?? 0) + amount;
  if (!current) {
    await saveFinance({ character_id: characterId, improvement_points: total });
    return total;
  }
  const res = await backendClient
    .from("character_finance")
    .update({ improvement_points: total })
    .eq("character_id", characterId);
  if (res.error) throw new Error(res.error.message);
  return total;
}

/**
 * The one payload the save_character database function accepts. It writes the
 * character and every attached table in a single transaction and clears the
 * draft, so a half-saved character cannot exist.
 */
export type SaveCharacterPayload = {
  draft_id: string | null;
  character: {
    name: string;
    handle: string | null;
    role: string;
    creation_method: string;
    portrait_id: string | null;
    portrait_path: string | null;
  };
  stats: Record<string, number | null>;
  skills: { skill_id: string; level: number; specialization: string | null }[];
  role_ability: { ability_id: string; rank: number; metadata: Record<string, unknown> } | null;
  gear: {
    item_id: string;
    quantity: number;
    equipped: boolean;
    slot: string | null;
    current_sp: number | null;
    notes: string | null;
  }[];
  cyberware: {
    key: string;
    foundation_key: string | null;
    item_id: string;
    install_location: string | null;
    humanity_loss_rolled: number | null;
  }[];
  lifepath: { general: unknown; role_specific: unknown; narrative?: string | null };
  finance: { eurobucks: number; lifestyle: string; housing: string; rent: number };
};

/** Returns the new character id. */
export async function saveCompleteCharacter(payload: SaveCharacterPayload): Promise<string> {
  const { data, error } = await backendClient.rpc("save_character", {
    payload: payload as unknown as Json,
  });
  if (error) throw new Error(error.message);
  if (typeof data !== "string") throw new Error("Save did not return a character id.");
  return data;
}
