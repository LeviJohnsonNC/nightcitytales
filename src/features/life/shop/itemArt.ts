/**
 * Which picture an item on a shelf is shown with.
 *
 * A catalog line is shown with its own picture, the one its detail dialog
 * shows (`itemArt` in `chargen/art.ts`, from the art manifest), so the shelf
 * and the "?" never disagree about what a thing looks like. A find is shown as
 * its base object (a sound puck looks like a sound puck, whatever it is called
 * this week), and anything the manifest has no picture for falls back to its
 * category. Category and find pictures live in
 * `public/images/items/<slug>.webp` (and `-640.webp`), made by
 * `tools/art/webp.mjs`; their prompts are in `docs/art-style.md`.
 *
 * A slug is drawn only once it is listed in `ITEM_ART_READY`: art arrives
 * separately from code, and a picture that is not there yet must fall back to
 * the drawn icon rather than to a broken image. Presentation only.
 */
import { readGadget, type ItemKind } from "@/engine";
import { itemArt } from "@/features/chargen/art";

/** Slugs whose pictures exist in public/images/items. Add one when its file lands. */
export const ITEM_ART_READY: readonly string[] = [
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
  "pistol",
  "smg",
  "rifle",
  "shotgun",
  "heavy",
  "exotic",
  "melee",
  "armor-light",
  "armor-heavy",
  "shield",
  "ammo",
  "gear",
];

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

/**
 * A picture to draw for a row: where it is, which part of it to keep, and how
 * it fills the frame. The Counter's own art is painted square to be cropped;
 * the catalog's art comes in every shape from a tall 2:3 to a wide 2.4:1, so
 * it is shown whole (`contain`) over a blurred copy of itself.
 */
export type ItemPicture = { url: string; focus: string; fit: "cover" | "contain" };

/**
 * The pictures to try for one shelf item, best first: the item's own picture,
 * then its category's. A thumbnail that fails to load moves on to the next.
 */
export function itemPictures(kind: ItemKind | string, itemId: string, small = true): ItemPicture[] {
  const pictures: ItemPicture[] = [];
  if (!readGadget(itemId)) {
    const own = itemArt(`${kind}.${itemId}`, itemId);
    if (own.src) {
      const local = own.src.startsWith("/images/") && own.src.endsWith(".webp");
      const [x, y] = own.focalPoint;
      pictures.push({
        url: small && local ? `${own.src.slice(0, -".webp".length)}-512.webp` : own.src,
        focus: `${x * 100}% ${y * 100}%`,
        fit: "contain",
      });
    }
  }
  const category = itemArtUrl(kind, itemId, small);
  if (category) pictures.push({ url: category, focus: "50% 50%", fit: "cover" });
  return pictures;
}
