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

export async function getCharacter(id: string): Promise<FullCharacter | null> {
  const characterRes = await backendClient.from("characters").select("*").eq("id", id).maybeSingle();
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