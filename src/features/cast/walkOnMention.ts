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

export const WalkOnMentionSchema = z.object({
  subject: z.string(),
  gender: z.enum(["male", "female"]).optional(),
});

export type WalkOnMention = { subject: string; gender?: FlavorGender };

export type ResolvedWalkOn = { subject: string; gender: FlavorGender };

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
    out.push({ subject, ...(gender ? { gender } : {}) });
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
export function resolveWalkOns(mentions: WalkOnMention[] | undefined, seed: string): ResolvedWalkOn[] {
  if (!Array.isArray(mentions)) return [];
  const out: ResolvedWalkOn[] = [];
  for (const mention of mentions) {
    const gender = resolveFlavorGender(mention.subject, mention.gender, `${seed}:${mention.subject}`);
    if (gender) out.push({ subject: mention.subject, gender });
  }
  return out;
}
