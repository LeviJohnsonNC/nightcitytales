/**
 * Putting the standing cast on a campaign's books, and reading it back.
 *
 * The engine decides who the six are (engine/cast.ts); this module is the only
 * place they become rows and the only place rows become people again. The seed
 * is drawn once and stored, so seeding is idempotent: a campaign that already
 * has its cast gets it read back rather than rebuilt, and a campaign that
 * predates the cast gets one on next load without losing anyone it already met.
 *
 * The dossier rides in `campaign_npcs.data` alongside the opposition profile
 * that npcOpposition.ts already keeps there. Nothing in the schema changes,
 * because nothing needs to: the dossier is never queried, only carried.
 */
import {
  generateCast,
  isDossierFact,
  nextUnknownFact,
  revealText,
  rollJobSeed,
  type CastMember,
  type CastRole,
  type DossierFact,
  type Dossier,
  type LifepathTies,
} from "@/engine";
import {
  listCampaignNpcs,
  saveCampaignNpc,
  setCampaignFlag,
  setNpcDisposition,
  type CampaignFlag,
  type CampaignNpc,
  type FullCharacter,
  type Json,
} from "@/lib/backend";

/**
 * The campaign flag holding the seed the cast was built from. Its presence is
 * also the record that seeding has happened, so this never runs twice.
 */
export const CAST_SEED_FLAG = "cast_seed";

/** What a cast member's row carries beyond the columns. */
type CastData = {
  role?: unknown;
  standing?: unknown;
  tie?: unknown;
  dossier?: unknown;
  known?: unknown;
};

// ---------------------------------------------------------------------------
// Reading the character's own Lifepath.
// ---------------------------------------------------------------------------

function entryText(raw: unknown): string | null {
  if (!raw || typeof raw !== "object") return null;
  const entry = raw as { value?: unknown; custom?: unknown };
  // The canonical table value is what the cast quotes: a player's own rewording
  // is theirs to display, but the tie should read as the printed result.
  if (typeof entry.value === "string" && entry.value.trim()) return entry.value.trim();
  if (typeof entry.custom === "string" && entry.custom.trim()) return entry.custom.trim();
  return null;
}

/**
 * The people the character already rolled at creation, pulled out of the saved
 * Lifepath. Everything is optional: a character who skipped these still gets a
 * cast, just one with no personal history written onto it.
 */
export function lifepathTiesFrom(character: FullCharacter): LifepathTies {
  const general = (character.lifepath?.general ?? {}) as {
    friends?: unknown;
    enemies?: unknown;
    tragicLove?: unknown;
  };

  const firstFriend = Array.isArray(general.friends) ? general.friends[0] : null;
  const firstLove = Array.isArray(general.tragicLove) ? general.tragicLove[0] : null;
  const firstEnemy = Array.isArray(general.enemies) ? general.enemies[0] : null;

  const enemy =
    firstEnemy && typeof firstEnemy === "object"
      ? (() => {
          const record = firstEnemy as { who?: unknown; cause?: unknown; throwAtYou?: unknown };
          return {
            who: entryText(record.who),
            cause: entryText(record.cause),
            throwAtYou: entryText(record.throwAtYou),
          };
        })()
      : null;

  return {
    friend: entryText(firstFriend),
    enemy,
    tragicLove: entryText(firstLove),
  };
}

// ---------------------------------------------------------------------------
// Rows in, people out.
// ---------------------------------------------------------------------------

function dossierFrom(raw: unknown): Dossier | null {
  if (!raw || typeof raw !== "object") return null;
  const d = raw as Record<string, unknown>;
  const field = (key: string) => (typeof d[key] === "string" ? (d[key] as string) : null);
  const wants = field("wants");
  const fear = field("fear");
  const secret = field("secret");
  const breakingPoint = field("breakingPoint");
  if (!wants || !fear || !secret || !breakingPoint) return null;
  return { wants, fear, secret, breakingPoint };
}

/** The facts this person has actually given up. */
export function knownFactsOf(npc: CampaignNpc | null | undefined): DossierFact[] {
  const data = (npc?.data ?? {}) as CastData;
  if (!Array.isArray(data.known)) return [];
  return data.known.filter(isDossierFact);
}

/** Read a row back into a cast member, or null when it is not one of the six. */
export function castMemberFrom(npc: CampaignNpc): CastMember | null {
  const data = (npc.data ?? {}) as CastData;
  const dossier = dossierFrom(data.dossier);
  if (!dossier || typeof data.role !== "string") return null;
  return {
    key: npc.npc_id ?? npc.name,
    name: npc.name,
    role: data.role as CastRole,
    standing: typeof data.standing === "string" ? data.standing : "",
    tie: typeof data.tie === "string" ? data.tie : null,
    disposition: npc.disposition,
    dossier,
  };
}

/** Everyone on this campaign's books who is one of the standing six. */
export function castFrom(npcs: CampaignNpc[]): CastMember[] {
  return npcs.map(castMemberFrom).filter((member): member is CastMember => member !== null);
}

/** The member holding a given job, read off the rows. */
export function castMemberInRole(npcs: CampaignNpc[], role: CastRole): CastMember | null {
  return castFrom(npcs).find((member) => member.role === role) ?? null;
}

// ---------------------------------------------------------------------------
// Seeding.
// ---------------------------------------------------------------------------

function castSeedFrom(flags: CampaignFlag[]): number | null {
  const value = flags.find((f) => f.flag === CAST_SEED_FLAG)?.value;
  return typeof value === "number" && Number.isFinite(value) ? value >>> 0 : null;
}

function rowFor(member: CastMember): { name: string; data: Json } {
  return {
    name: member.name,
    data: {
      role: member.role,
      standing: member.standing,
      tie: member.tie,
      dossier: member.dossier,
      known: [],
      // Day zero means "not dealt with yet". The Life engine reads the gap from
      // here, so a fresh cast starts quiet rather than all knocking at once.
      lastSeenDay: 0,
    } as unknown as Json,
  };
}

export type EnsureCastResult = {
  /** The campaign's people after this call. */
  npcs: CampaignNpc[];
  /** True when the cast was written on this call rather than read back. */
  seeded: boolean;
};

/**
 * Make sure this campaign has its six.
 *
 * Idempotent by the stored seed, not by row count: a campaign whose enemy has
 * since died still has a cast and is not re-seeded around the corpse. Existing
 * rows are updated rather than duplicated, so an NPC the campaign already met
 * under one of these keys keeps their disposition and their remembered numbers.
 */
export async function ensureCast(input: {
  campaignId: string;
  flags: CampaignFlag[];
  character: FullCharacter;
  npcs: CampaignNpc[];
}): Promise<EnsureCastResult> {
  if (castSeedFrom(input.flags) !== null) return { npcs: input.npcs, seeded: false };

  const seed = rollJobSeed();
  const cast = generateCast({ seed, ties: lifepathTiesFrom(input.character) });
  const existing = new Map(input.npcs.map((npc) => [npc.npc_id ?? npc.name, npc]));

  for (const member of cast) {
    const row = rowFor(member);
    const prior = existing.get(member.key);
    const priorData = (prior?.data ?? {}) as Record<string, unknown>;
    const saved = await saveCampaignNpc(input.campaignId, member.key, {
      name: row.name,
      // Anything the campaign already knew about this key survives: the cast
      // adds a dossier, it does not overwrite a history.
      data: { ...priorData, ...(row.data as Record<string, unknown>) } as unknown as Json,
    });
    // A friend is not neutral and an enemy is not a stranger. Only someone the
    // campaign had formed no view about gets an opening disposition written:
    // a person it already knows keeps whatever it thinks of them.
    if (!prior) await setNpcDisposition(saved.id, member.disposition);
  }

  await setCampaignFlag(input.campaignId, CAST_SEED_FLAG, seed as unknown as Json);
  return { npcs: await listCampaignNpcs(input.campaignId), seeded: true };
}

// ---------------------------------------------------------------------------
// Learning something.
// ---------------------------------------------------------------------------

export type CastReveal = { fact: DossierFact; text: string };

/**
 * Give up the next rung of someone's dossier, if they have one left to give.
 * Returns what was learned so the caller can put it on the ledger and let the
 * model narrate the tell; null when this person has nothing further to reveal.
 */
export async function revealNextFact(
  campaignId: string,
  npc: CampaignNpc,
): Promise<CastReveal | null> {
  const member = castMemberFrom(npc);
  if (!member) return null;
  const known = knownFactsOf(npc);
  const fact = nextUnknownFact(known);
  if (!fact) return null;

  const data = (npc.data ?? {}) as Record<string, unknown>;
  await saveCampaignNpc(campaignId, npc.npc_id ?? npc.name, {
    data: { ...data, known: [...known, fact] } as unknown as Json,
  });
  return { fact, text: revealText(member, fact) };
}

/** Record that the character has actually dealt with someone today. */
export async function markDealtWith(
  campaignId: string,
  npc: CampaignNpc,
  day: number,
): Promise<void> {
  const data = (npc.data ?? {}) as Record<string, unknown>;
  if (data["lastSeenDay"] === day) return;
  await saveCampaignNpc(campaignId, npc.npc_id ?? npc.name, {
    data: { ...data, lastSeenDay: day } as unknown as Json,
  });
}
