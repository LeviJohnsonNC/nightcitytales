/**
 * Who a walk-on has turned out to be, once the character has learned it.
 *
 * A walk-on has no row and no key (see walkOnMention.ts). What identifies one is a
 * role at a place: the cook at that plaza, the receptionist in that lobby. So a name
 * the passage gave is stored where it was learned, on the narration's `walkOns`
 * (`name`), beside the place the narration was written (`at`), and read back from the
 * ledger here, never kept anywhere else. The first name learned for a role at a place
 * is the one they have from then on.
 *
 * `resolveWalkOns` carries it onto each later turn that tags the same role there, so a
 * name that was learned once is shown every time the character is with that person
 * and a scrollback row stays what it was when it was written.
 */
import { readNarrationPlace, readWalkOnsEventData } from "@/engine/ledger";

/** Role id to the name the character knows them by, for one place. */
export type KnownWalkOnNames = ReadonlyMap<string, string>;

const NARRATION_TYPES = new Set(["life_narration", "gm_narration"]);

/**
 * `events` in ledger order, oldest first. Only a narration written AT this place
 * counts, and the earliest name for a role is kept.
 */
export function knownWalkOnNames(
  events: readonly { type: string; data: unknown }[],
  placeKey: string,
): KnownWalkOnNames {
  const known = new Map<string, string>();
  for (const event of events) {
    if (!NARRATION_TYPES.has(event.type)) continue;
    if (readNarrationPlace(event.data) !== placeKey) continue;
    for (const walkOn of readWalkOnsEventData(event.data)) {
      if (walkOn.name && !known.has(walkOn.subject)) known.set(walkOn.subject, walkOn.name);
    }
  }
  return known;
}
