/**
 * What a link to the site looks like when somebody pastes it into a chat, a
 * feed or a group server.
 *
 * Until this existed the root route still carried the scaffold's placeholders —
 * "Lovable App", "Lovable Generated Project", `@Lovable` — and nothing named an
 * image, so every unfurl was a grey box with another product's name on it. The
 * landing page had its own title and description and no picture. A game that
 * lives on word of mouth had a blank card to hand out.
 *
 * Link previews are fetched by a crawler that does not run the app, so every
 * URL here has to be absolute: a root-relative asset path resolves to nothing.
 * `SITE_URL` is the published address, kept in one place for that reason.
 *
 * Pure: strings in, `<meta>` descriptors out. No React, no router.
 */
import shareArt from "@/assets/hero-one.jpg.asset.json";

/** The published origin. A crawler cannot resolve a relative `og:image`. */
export const SITE_URL = "https://nightcitytales.lovable.app";
export const SITE_NAME = "Night City Tales";

export const DEFAULT_TITLE = "Night City Tales · Live Your Life in Night City";
export const DEFAULT_DESCRIPTION =
  "A solo Cyberpunk RED campaign run by an AI Game Master. Take dangerous jobs, build relationships, make enemies, and live with everything that follows.";

/** The painting the landing page opens on: the skyline and the runner. */
export const SHARE_IMAGE_URL = absoluteUrl(shareArt.url);
export const SHARE_IMAGE_ALT =
  "A runner stands over a rain-soaked, neon-lit Night City skyline at night.";

/** `path` on the published origin, unless it already names one. */
export function absoluteUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  return `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

export type MetaTag =
  { title: string } | { name: string; content: string } | { property: string; content: string };

/**
 * The tags for one page. The title and description are the page's own; the
 * picture and the site name are the game's, unless the page brings its own.
 * Open Graph and Twitter are both written because the two crawlers read their
 * own tags first and fall back unevenly.
 */
export function pageMeta(input: {
  title: string;
  description: string;
  /** Where the page lives on the published site, for `og:url`. */
  path?: string;
  /** An absolute URL or a root-relative asset path. */
  image?: string;
  imageAlt?: string;
}): MetaTag[] {
  const image = input.image ? absoluteUrl(input.image) : SHARE_IMAGE_URL;
  const alt = input.imageAlt ?? SHARE_IMAGE_ALT;
  const tags: MetaTag[] = [
    { title: input.title },
    { name: "description", content: input.description },
    { property: "og:site_name", content: SITE_NAME },
    { property: "og:type", content: "website" },
    { property: "og:title", content: input.title },
    { property: "og:description", content: input.description },
    { property: "og:image", content: image },
    { property: "og:image:alt", content: alt },
    { name: "twitter:card", content: "summary_large_image" },
    { name: "twitter:title", content: input.title },
    { name: "twitter:description", content: input.description },
    { name: "twitter:image", content: image },
    { name: "twitter:image:alt", content: alt },
  ];
  if (input.path !== undefined) tags.push({ property: "og:url", content: absoluteUrl(input.path) });
  return tags;
}
