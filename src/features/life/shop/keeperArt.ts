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
export const KEEPER_ART_READY: readonly string[] = [];

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
