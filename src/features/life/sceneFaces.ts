/**
 * Who is in the scene, as faces.
 *
 * The pictures of people used to hang off each paragraph: a collapsed strip under
 * whatever the narrator had just tagged, and a thumbnail in front of every mention
 * of a name. Faces belong to the scene, not to the sentence. This reads one row
 * from three things the engine already knows, in the order a player would look:
 *
 *  1. the people the current passage NAMES, since they are who it is about;
 *  2. the walk-ons the narrator tagged this turn;
 *  3. the people the engine put in the room before the narrator wrote
 *     (`alsoHereAt`), whether or not this passage mentions them.
 *
 * Each person once, capped, and nothing is invented: every face traces to a
 * directory entry, a tag the interface already validated, or a role the place
 * has. Presentation only; no rule reads it.
 */
import { seenAsLine } from "@/engine";
import { flavorArt, flavorSubjectLabel, type FlavorGender } from "@/features/cast/flavorArt";
import type { AmbientPerson } from "@/features/cast/ambientPeople";
import { isPerson, type NpcEntry } from "@/features/cast/npcDirectory";
import { npcsNamedIn } from "@/features/cast/npcMentions";
import { dispositionBand, type PersonTone } from "./hud/hudModel";

/** A room, not a roll call. */
export const MAX_SCENE_FACES = 6;

export type SceneFace =
  | {
      kind: "person";
      key: string;
      npc: NpcEntry;
      /** How they feel about the character, when the character knows them. */
      tone: PersonTone | null;
    }
  | {
      kind: "walkon";
      key: string;
      subject: string;
      gender: FlavorGender;
      label: string;
      /** "woman, older", or null when the picture has none. */
      look: string | null;
    };

export function sceneFaces(input: {
  /** The passage the player is reading, or "" when there is none. */
  text: string;
  /** Walk-ons the narrator tagged this turn, already resolved to a face. */
  walkOns: readonly { subject: string; gender: FlavorGender }[];
  /** The people the engine says are in the room. */
  ambient: readonly AmbientPerson[];
  /** The people the character knows, for the ring. */
  people: readonly { name: string; disposition: number }[];
  max?: number;
}): SceneFace[] {
  const out: SceneFace[] = [];
  const rings = new Map(input.people.map((p) => [p.name, dispositionBand(p.disposition).tone]));
  const people = new Set<string>();
  for (const npc of npcsNamedIn(input.text)) {
    if (!isPerson(npc) || people.has(npc.id)) continue;
    people.add(npc.id);
    out.push({ kind: "person", key: `person:${npc.id}`, npc, tone: rings.get(npc.name) ?? null });
  }
  const subjects = new Set<string>();
  for (const w of [...input.walkOns, ...input.ambient]) {
    if (subjects.has(w.subject)) continue;
    const art = flavorArt(w.subject, w.gender);
    // A subject with no picture on file is left out, the same rule the strip follows.
    if (!art) continue;
    subjects.add(w.subject);
    out.push({
      kind: "walkon",
      key: `walkon:${w.subject}`,
      subject: w.subject,
      gender: w.gender,
      label: flavorSubjectLabel(w.subject),
      look: seenAsLine(art.look),
    });
  }
  return out.slice(0, input.max ?? MAX_SCENE_FACES);
}
