/**
 * The face behind a counter.
 *
 * A seller at a place has a keeper with a name (`place-shops.json`); their
 * portrait lives in `public/images/keepers/<vendor>-<place>.webp` (and
 * `-512.webp`), made by `tools/art/webp.mjs`, with prompts in
 * `docs/art-style.md`. Like the item art, a face is drawn only once it is
 * listed here, and the Counter shows the keeper's initials until then.
 * Presentation only.
 */

/** Keeper portraits that exist in public/images/keepers. Add one when its file lands. */
export const KEEPER_ART_READY: readonly string[] = [
  "armorer-a13",
  "armorer-g15",
  "armorer-m6",
  "armorer-q5",
  "armorer-t2",
  "gun_shop-d3",
  "gun_shop-e7",
  "gun_shop-i10",
  "gun_shop-l5",
  "gun_shop-n14",
  "gun_shop-s4",
  "gun_shop-t2",
  "gun_shop-w1",
  "street-b14",
  "street-c2",
  "street-f11",
  "street-h4",
  "street-j1",
  "street-k3",
  "street-o3",
  "street-p1",
  "street-r2",
  "street-u8",
  "street-v7",
  "street-w1",
  "street-x5",
];

/** The file a seller's keeper portrait is saved as: `gun_shop@d3` → `gun_shop-d3`. */
export function keeperSlug(vendorId: string): string {
  return vendorId.replace("@", "-");
}

export function keeperImage(
  vendorId: string,
  ready: readonly string[] = KEEPER_ART_READY,
): string | null {
  const slug = keeperSlug(vendorId);
  return ready.includes(slug) ? `/images/keepers/${slug}-512.webp` : null;
}

/** Two letters for the stand-in: "Mama Ishii" → MI, "Dot" → DO. */
export function initials(name: string): string {
  const words = name.split(/[\s&]+/).filter((w) => /[a-z]/i.test(w));
  if (words.length === 1) return words[0]!.slice(0, 2).toUpperCase();
  return words
    .slice(0, 2)
    .map((w) => w.replace(/[^a-z]/gi, "")[0]!.toUpperCase())
    .join("");
}
