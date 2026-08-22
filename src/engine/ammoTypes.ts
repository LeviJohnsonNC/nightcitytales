/**
 * Ammunition comes in several delivery types, and the price line in
 * src/data/rules/catalog.json is quantity-dependent: bullets, slugs, shells and
 * arrows are sold "per 10", while grenades and rockets are sold each.
 *
 * The catalog stores the legality of each ammo as printed prose
 * ("Arrows, Bullets, and Slugs"). Nothing here invents a value: every option is
 * expanded from those printed phrases, and an unrecognised phrase throws rather
 * than being guessed at.
 */
import { AMMUNITION, getAmmunition, type CatalogAmmunition } from "./catalog";

export type AmmoType =
  | "Bullet (Pistol)"
  | "Bullet (Rifle)"
  | "Bullet (Slug)"
  | "Shotgun Shell"
  | "Arrow"
  | "Grenade"
  | "Rocket";

/** Every delivery type the catalog's ammunition prose refers to. */
export const AMMO_TYPES: AmmoType[] = [
  "Bullet (Pistol)",
  "Bullet (Rifle)",
  "Bullet (Slug)",
  "Shotgun Shell",
  "Arrow",
  "Grenade",
  "Rocket",
];

/** Grenades and rockets are priced each; everything else is priced per 10. */
const SOLD_EACH: AmmoType[] = ["Grenade", "Rocket"];

export function ammoTypeIsSoldEach(type: AmmoType): boolean {
  return SOLD_EACH.includes(type);
}

/** Printed unit line for one delivery type, e.g. "per 10 units" or "each". */
export function ammoUnitFor(type: AmmoType): string {
  return ammoTypeIsSoldEach(type) ? "each" : "per 10 units";
}

/** Plural nouns as the catalog prose writes them. */
const PHRASE_WORDS: Record<string, AmmoType[]> = {
  arrow: ["Arrow"],
  arrows: ["Arrow"],
  bullet: ["Bullet (Pistol)", "Bullet (Rifle)"],
  bullets: ["Bullet (Pistol)", "Bullet (Rifle)"],
  slug: ["Bullet (Slug)"],
  slugs: ["Bullet (Slug)"],
  grenade: ["Grenade"],
  grenades: ["Grenade"],
  rocket: ["Rocket"],
  rockets: ["Rocket"],
  "shotgun shell": ["Shotgun Shell"],
  "shotgun shells": ["Shotgun Shell"],
  "bullet (pistol)": ["Bullet (Pistol)"],
  "bullet (rifle)": ["Bullet (Rifle)"],
  "bullet (slug)": ["Bullet (Slug)"],
};

function wordsOf(phrase: string): AmmoType[] {
  return phrase
    .replace(/\bonly\b/gi, "")
    .split(/,|\band\b/i)
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean)
    .flatMap((part) => {
      const hit = PHRASE_WORDS[part];
      if (!hit) {
        throw new Error(
          `Unrecognised ammunition type phrase "${part}" (src/data/rules/catalog.json → ammunition.types)`,
        );
      }
      return hit;
    });
}

function expandPhrase(phrase: string): AmmoType[] {
  const except = /^all except (.+)$/i.exec(phrase.trim());
  if (except) {
    const excluded = wordsOf(except[1]!);
    return AMMO_TYPES.filter((t) => !excluded.includes(t));
  }
  return wordsOf(phrase);
}

/** The delivery types a given ammunition row may be bought as, in catalog order. */
export function ammoTypeOptions(ammo: CatalogAmmunition | string): AmmoType[] {
  const row = typeof ammo === "string" ? getAmmunition(ammo) : ammo;
  const found = row.types.flatMap(expandPhrase);
  const unique = AMMO_TYPES.filter((t) => found.includes(t));
  if (unique.length === 0) {
    throw new Error(
      `No ammunition types resolved for "${row.id}" (src/data/rules/catalog.json → ammunition.types)`,
    );
  }
  return unique;
}

/** True when the row offers a real choice the player has to make. */
export function ammoNeedsTypeChoice(ammo: CatalogAmmunition | string): boolean {
  return ammoTypeOptions(ammo).length > 1;
}

/** Label used on a cart line, e.g. "Armor-Piercing Ammunition — Grenade (each)". */
export function ammoVariantLabel(ammo: CatalogAmmunition | string, type: AmmoType): string {
  const row = typeof ammo === "string" ? getAmmunition(ammo) : ammo;
  return `${row.name} — ${type} (${ammoUnitFor(type)})`;
}

/** Every ammunition row with its resolved type options. */
export const AMMO_TYPE_OPTIONS: Record<string, AmmoType[]> = Object.fromEntries(
  AMMUNITION.map((a) => [a.id, ammoTypeOptions(a)]),
);
