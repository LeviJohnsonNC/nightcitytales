/**
 * Walk-on characters the GM tags in passing — a bartender, a beat cop — who
 * are not part of the standing cast and get no persistent identity: there is
 * no key to look them up by and nothing here ever writes one to campaign_npcs.
 * This is presentation only, closed to the subjects flavor-art.json actually
 * has art for.
 *
 * Two steps, deliberately apart:
 *  - normalizeWalkOnMentions: shape/vocabulary validation, no campaign
 *    context needed. An unknown subject or a malformed item is dropped,
 *    exactly like every other list in lifeResponse.ts/gmResponse.ts.
 *  - resolveWalkOns: turns a validated mention into a concrete gender, using
 *    the campaign+place seed the ops layer has and the response schema does
 *    not. Resolved ONCE here, at the turn that narrated it, and persisted —
 *    never re-rolled by a later render.
 */
import { z } from "zod";
import { FLAVOR_SUBJECTS, resolveFlavorGender, type FlavorGender } from "./flavorArt";
import { npcsNamedIn } from "./npcMentions";

export const WalkOnMentionSchema = z.object({
  subject: z.string(),
  gender: z.enum(["male", "female"]).optional(),
  /** What the character has learned to call them, in the words the passage uses. */
  name: z.string().optional(),
});

export type WalkOnMention = z.infer<typeof WalkOnMentionSchema>;

export type ResolvedWalkOn = { subject: string; gender: FlavorGender; name?: string };

const MAX_NAME = 40;
/** Letters, spaces and the punctuation names carry; no digits, no quotation, no stray symbols. */
const NAME_SHAPE = /^\p{L}[\p{L}'’.\- ]*$/u;

/**
 * A walk-on's name as the wire may carry it: a short run of letters, and never
 * the name of somebody in the directory. A walk-on is not a cast member, so a
 * name that belongs to one is refused rather than lending the walk-on their face.
 */
export function cleanWalkOnName(raw: unknown): string | undefined {
  if (typeof raw !== "string") return undefined;
  const name = raw.trim().replace(/\s+/g, " ");
  if (name.length < 2 || name.length > MAX_NAME || !NAME_SHAPE.test(name)) return undefined;
  if (npcsNamedIn(name).length > 0) return undefined;
  return name;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function passageSays(text: string, name: string): boolean {
  return new RegExp(`(?<![\\p{L}])${escapeRegExp(name)}(?![\\p{L}])`, "iu").test(text);
}

/**
 * The name the PLAYER was actually given: the whole of it if the passage says it,
 * else its first word if the passage only says that ("Mara" after "Mara Ketter"),
 * else nothing. The model supplies a name; the passage is what makes it known, so a
 * name the player never read is never shown beside a face.
 */
export function nameTheyLearned(name: string | undefined, text: string): string | undefined {
  if (!name || !text) return undefined;
  if (passageSays(text, name)) return name;
  const first = name.split(" ")[0]!;
  return first.length >= 2 && first !== name && passageSays(text, first) ? first : undefined;
}

/** A turn narrates at most this many walk-ons. Plenty for a scene, and bounded. */
const MAX_WALK_ONS = 3;

const SUBJECTS = new Set(FLAVOR_SUBJECTS);

/** Loose wire parsing, mirroring the tolerant style of lifeResponse.ts/gmResponse.ts. */
export function normalizeWalkOnMentions(raw: unknown): WalkOnMention[] {
  if (!Array.isArray(raw)) return [];
  const out: WalkOnMention[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const w = item as Record<string, unknown>;
    const subject = typeof w["subject"] === "string" ? w["subject"].trim() : "";
    // Not a real subject we have art for: dropped rather than shown as a
    // blank space, the same rule an unknown threat profile or arena follows.
    if (!subject || !SUBJECTS.has(subject)) continue;
    const genderRaw = typeof w["gender"] === "string" ? w["gender"].trim().toLowerCase() : "";
    const gender = genderRaw === "male" || genderRaw === "female" ? genderRaw : undefined;
    const name = cleanWalkOnName(w["name"]);
    out.push({ subject, ...(gender ? { gender } : {}), ...(name ? { name } : {}) });
    if (out.length === MAX_WALK_ONS) break;
  }
  return out;
}

/**
 * Validated mentions -> concrete, persistable walk-ons.
 *
 * `seed` is the campaign+place context (e.g. `${campaignId}:${locationKey}`);
 * each subject gets its own slot appended, so two different subjects
 * mentioned in the same scene resolve independently.
 */
export function resolveWalkOns(
  mentions: WalkOnMention[] | undefined,
  seed: string,
  /**
   * Roles the narrator was TOLD are here (`ambientSubjectsAt`). Their face was
   * settled before it wrote, so a gender it asks for on one of them is ignored:
   * the picture is the one it was given, not the one it prefers.
   */
  told: ReadonlySet<string> | readonly string[] = [],
  /** The passage the player reads: a name is kept only if it says it (`nameTheyLearned`). */
  text = "",
): ResolvedWalkOn[] {
  if (!Array.isArray(mentions)) return [];
  const settled = new Set(told);
  const out: ResolvedWalkOn[] = [];
  for (const mention of mentions) {
    const gender = resolveFlavorGender(
      mention.subject,
      settled.has(mention.subject) ? undefined : mention.gender,
      `${seed}:${mention.subject}`,
    );
    if (!gender) continue;
    const name = nameTheyLearned(mention.name, text);
    out.push({ subject: mention.subject, gender, ...(name ? { name } : {}) });
  }
  return out;
}
