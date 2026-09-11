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

export type RosterEntry = Character & {
  stats: RosterStats | null;
  /** True when this character already has a live playthrough to continue. */
  hasActiveCampaign: boolean;
};

/** The roster grid read: every saved character, most recently updated first. */
export async function listRoster(): Promise<RosterEntry[]> {
  const res = await backendClient
    .from("characters")
    .select("*, character_stats(hp_current,hp_max,humanity_current,humanity_max)")
    .order("updated_at", { ascending: false });
  const rows = unwrap(res) ?? [];
  const active = unwrap(
    await backendClient.from("campaigns").select("character_id").eq("status", "active"),
  );
  const live = new Set((active ?? []).map((row) => row.character_id));
  return (
    rows as unknown as (Character & { character_stats: RosterStats | RosterStats[] | null })[]
  ).map(({ character_stats, ...character }) => ({
    ...character,
    stats: Array.isArray(character_stats) ? (character_stats[0] ?? null) : character_stats,
    hasActiveCampaign: live.has(character.id),
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

/**
 * Where a character lives, and whether we were able to find out.
 *
 * `placeKey: null, readable: true` is a real answer: a character saved before
 * the housing step asked for an address has none. `readable: false` is not an
 * answer at all — it means the columns were not there to read, which is a
 * different problem with the same shape, and the two must not be confused.
 */
export type CharacterHome = {
  placeKey: string | null;
  districtKey: string | null;
  /** False when the finance row exists but carries no home columns. */
  readable: boolean;
};

/**
 * Just the atlas keys for where a character lives.
 *
 * A targeted read rather than a full character fetch, because the one caller
 * that needs it — starting a campaign — has a character id and nothing else.
 *
 * SELECTS `*` DELIBERATELY, rather than naming the two columns. Naming them
 * makes the whole read fail on a database that has not had the migration
 * applied yet, and that failure was indistinguishable from "this character has
 * no home": a player who chose Pacifica woke up at the atlas default with
 * nothing logged anywhere. Selecting everything means a missing column is a
 * missing FIELD, which this can see and say so about — and it means the feature
 * starts working the moment the migration lands, with no redeploy.
 */
export async function getCharacterHome(characterId: string): Promise<CharacterHome> {
  const res = await backendClient
    .from("character_finance")
    .select("*")
    .eq("character_id", characterId)
    .maybeSingle();
  if (res.error) throw new Error(res.error.message);
  const row = res.data as Record<string, unknown> | null;
  // No finance row at all is not a schema problem — there is simply nothing
  // saved for this character, and null is the honest answer.
  if (!row) return { placeKey: null, districtKey: null, readable: true };
  const readable = "home_place_key" in row;
  return {
    placeKey: (row["home_place_key"] as string | null) ?? null,
    districtKey: (row["home_district_key"] as string | null) ?? null,
    readable,
  };
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
 * Buy one Skill Level with Improvement Points. Returns the I.P. left.
 *
 * The deduction and the raise happen in one transaction (spend_ip_on_skill), so
 * they cannot come apart, and the function re-checks the balance and the Skill's
 * current Level itself — a stale or replayed call is rejected rather than
 * charged twice.
 */
export async function spendIpOnSkill(
  characterId: string,
  skillId: string,
  newLevel: number,
  cost: number,
  specialization: string | null = null,
): Promise<number> {
  const { data, error } = await backendClient.rpc("spend_ip_on_skill", {
    p_character_id: characterId,
    p_skill_id: skillId,
    p_new_level: newLevel,
    p_cost: cost,
    // The generated signature types this optional, so an unspecialized line
    // omits it and hits the function's own DEFAULT NULL — the same thing.
    ...(specialization === null ? {} : { p_specialization: specialization }),
  });
  if (error) throw new Error(error.message);
  return data as number;
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
  finance: {
    eurobucks: number;
    lifestyle: string;
    housing: string;
    rent: number;
    /** Atlas location key for the character's home. Null for older saves. */
    home_place_key?: string | null;
    /** Atlas district key for the character's home. Null for older saves. */
    home_district_key?: string | null;
  };
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
