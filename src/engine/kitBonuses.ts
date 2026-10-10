/**
 * What the kit adds to a Check, as the gear list prints it.
 *
 * A Medscanner has said "+2 to First Aid and Paramedic" since the catalog was
 * transcribed, and nothing ever added it: the sentence was description. An item
 * whose description promises a number the roll does not carry is the smallest
 * version of the thing this project refuses everywhere else, so the printed
 * bonuses are data (`src/data/rules/kit-bonuses.json`) and the roll reads them.
 *
 * Pure: carried item ids and a Skill in, labelled modifiers out.
 */
import data from "@/data/rules/kit-bonuses.json";
import { GEAR } from "./catalog";

type KitBonus = { item: string; skills: string[]; value: number };

export const KIT_BONUSES = data.bonuses as KitBonus[];

const NAMES = new Map(GEAR.map((g) => [g.id, g.name]));

/**
 * The bonuses the carried kit gives a Check with `skillId`, one per Skill: the
 * largest printed bonus wins and two of the same thing add nothing more.
 * `carried` is the ids of every item with something left of it.
 */
export function kitBonuses(
  carried: readonly string[],
  skillId: string,
): { label: string; value: number }[] {
  const have = new Set(carried);
  let best: KitBonus | null = null;
  for (const bonus of KIT_BONUSES) {
    if (!have.has(bonus.item) || !bonus.skills.includes(skillId)) continue;
    if (!best || bonus.value > best.value) best = bonus;
  }
  return best ? [{ label: NAMES.get(best.item) ?? best.item, value: best.value }] : [];
}
