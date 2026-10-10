/**
 * Which picture an item on a shelf is shown with.
 *
 * A find is shown as its base object (a sound puck looks like a sound puck,
 * whatever it is called this week); a catalog line as its category, because
 * twenty-nine weapons do not need twenty-nine paintings to be told apart and a
 * category picture is honest about what a row is. Pictures live in
 * `public/images/items/<slug>.webp` (and `-640.webp`), made by
 * `tools/art/webp.mjs`; their prompts are in `docs/art-style.md`.
 *
 * A slug is drawn only once it is listed in `ITEM_ART_READY`: art arrives
 * separately from code, and a picture that is not there yet must fall back to
 * the drawn icon rather than to a broken image. Presentation only.
 */
import { readGadget, type ItemKind } from "@/engine";

/** Slugs whose pictures exist in public/images/items. Add one when its file lands. */
export const ITEM_ART_READY: readonly string[] = [];

/** The category a catalog weapon is shown as. */
const WEAPON_ART: Record<string, string> = {
  light_melee: "melee",
  medium_melee: "melee",
  heavy_melee: "melee",
  very_heavy_melee: "melee",
  kendachi_mono_three: "melee",
  battleglove: "melee",
  stun_baton: "melee",
  medium_pistol: "pistol",
  heavy_pistol: "pistol",
  very_heavy_pistol: "pistol",
  air_pistol: "pistol",
  dartgun: "pistol",
  stun_gun: "pistol",
  malorian_3516: "pistol",
  smg: "smg",
  heavy_smg: "smg",
  tsunami_helix: "smg",
  assault_rifle: "rifle",
  hurricane_assault: "rifle",
  sniper_rifle: "rifle",
  bows_crossbows: "rifle",
  shotgun: "shotgun",
  cowboy_u56: "shotgun",
  grenade_launcher: "heavy",
  rocket_launcher: "heavy",
  flamethrower: "heavy",
  rhinemetall_railgun: "heavy",
  microwaver: "exotic",
  shrieker: "exotic",
};

const ARMOR_ART: Record<string, string> = {
  leathers: "armor-light",
  kevlar: "armor-light",
  light_armorjack: "armor-light",
  bodyweight_suit: "armor-light",
  medium_armorjack: "armor-heavy",
  heavy_armorjack: "armor-heavy",
  flak: "armor-heavy",
  metalgear: "armor-heavy",
  bulletproof_shield: "shield",
};

/** Every slug a picture can be asked for: the finds' bases and the categories. */
export const ITEM_ART_SLUGS: readonly string[] = [
  ...new Set([
    ...Object.values(WEAPON_ART),
    ...Object.values(ARMOR_ART),
    "ammo",
    "gear",
    "find-sound_puck",
    "find-hush_wrap",
    "find-foam_cutters",
    "find-gel_tube",
    "find-relay_clip",
    "find-timer_fuse",
    "find-crawler",
    "find-pneumatic_driver",
    "find-tool_roll",
    "find-lock_gun",
  ]),
];

/** The picture slug for one shelf item. */
export function itemArtSlug(kind: ItemKind | string, itemId: string): string {
  const gadget = readGadget(itemId);
  if (gadget) return `find-${gadget.base}`;
  if (kind === "weapon") return WEAPON_ART[itemId] ?? "pistol";
  if (kind === "armor") return ARMOR_ART[itemId] ?? "armor-light";
  if (kind === "ammunition") return "ammo";
  return "gear";
}

/** The picture's URL, or null while its file has not landed. `small` is the 640px cut. */
export function itemArtUrl(
  kind: ItemKind | string,
  itemId: string,
  small = true,
  ready: readonly string[] = ITEM_ART_READY,
): string | null {
  const slug = itemArtSlug(kind, itemId);
  if (!ready.includes(slug)) return null;
  return `/images/items/${slug}${small ? "-640" : ""}.webp`;
}
