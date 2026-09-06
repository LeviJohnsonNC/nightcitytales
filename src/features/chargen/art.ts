/**
 * Art manifest access. Image paths live ONLY in /src/data/art/manifest.json.
 * A missing manifest, a missing entry, or `src: null` all resolve to a
 * placeholder descriptor carrying the asset id, never a broken image.
 */
import manifestJson from "@/data/art/manifest.json";

/**
 * Pointer registry. Artwork uploaded through Lovable lands in src/assets as a
 * <name>.asset.json pointer holding an immutable asset_id and a stable URL.
 * JSON cannot import a pointer, so the registry lives here and the manifest
 * refers to a pointer by its file name. Resolution order for every slot is:
 *   imported pointer  →  manifest.json src  →  placeholder
 * Adding artwork means: upload it, then add one manifest entry. Never a
 * component change — no component imports a pointer or holds an image path.
 */
type AssetPointer = { url?: string; original_filename?: string; asset_id?: string };

const POINTER_MODULES = import.meta.glob<AssetPointer>("../../assets/*.asset.json", {
  eager: true,
  import: "default",
});

const POINTERS = new Map<string, string>();
for (const [path, pointer] of Object.entries(POINTER_MODULES)) {
  const url = pointer?.url;
  if (!url) continue;
  const file = path
    .split("/")
    .pop()!
    .replace(/\.asset\.json$/, "");
  POINTERS.set(file, url);
  POINTERS.set(file.replace(/\.[^.]+$/, ""), url);
  if (pointer.original_filename) POINTERS.set(pointer.original_filename, url);
  if (pointer.asset_id) POINTERS.set(pointer.asset_id, url);
}

/** Every pointer name the registry knows, for the art audit in the style guide. */
export function registeredPointers(): string[] {
  return [...new Set(POINTERS.values())];
}

function pointerUrl(pointer: string | null | undefined): string | null {
  if (!pointer) return null;
  return POINTERS.get(pointer) ?? null;
}

export type FocalPoint = [number, number];
export type Presentation = "masc" | "femme" | "androgynous";

export type ArtEntry = {
  src: string | null;
  alt: string;
  focalPoint: FocalPoint;
  /** File name of an uploaded pointer in src/assets, e.g. "portrait-01.png". */
  pointer?: string | null;
};

export type PortraitEntry = {
  id: string;
  src: string | null;
  pointer?: string | null;
  roles: string[];
  presentation: Presentation;
  alt: string;
  focalPoint?: FocalPoint;
};

type Manifest = {
  roleArt?: Record<string, Partial<ArtEntry> | undefined>;
  itemArt?: Record<string, Partial<ArtEntry> | undefined>;
  portraits?: PortraitEntry[];
};

const manifest = (manifestJson ?? {}) as unknown as Manifest;

export const MANIFEST_PRESENT = Boolean(manifest.roleArt || manifest.portraits);

/**
 * The narrow width every local image is also encoded at, by tools/art/webp.mjs.
 *
 * Item and cast art is only ever drawn inside a max-w-lg dialog, so 1024 covers
 * it on a 2x display and 512 covers it on a 1x one. The full-size file keeps
 * the plain name; the narrow one is suffixed with its width.
 */
const NARROW_WIDTH = 512;

/**
 * The srcSet for a local image, or null for anything else.
 *
 * Derived from the path rather than stored, because the second file is written
 * by the conversion script and named by convention — a manifest listing both
 * would be a second place for the two to drift apart. Remote pointer URLs get
 * nothing: they are uploaded assets with no variants beside them.
 */
function srcSetFor(src: string | null): string | null {
  if (!src || !src.startsWith("/images/") || !src.endsWith(".webp")) return null;
  const base = src.slice(0, -".webp".length);
  return `${base}-${NARROW_WIDTH}.webp ${NARROW_WIDTH}w, ${src} 1024w`;
}

/** Resolved art for a slot. `src === null` means: render the placeholder. */
export type ResolvedArt = {
  assetId: string;
  src: string | null;
  /** Both widths, when this is a local image. Null for a remote pointer. */
  srcSet: string | null;
  alt: string;
  focalPoint: FocalPoint;
};

export function roleArt(roleId: string, roleName: string): ResolvedArt {
  const entry = manifest.roleArt?.[roleId];
  const src = pointerUrl(entry?.pointer) ?? entry?.src ?? null;
  return {
    assetId: `roleArt.${roleId}`,
    src,
    srcSet: srcSetFor(src),
    alt: entry?.alt ?? `${roleName} key art`,
    focalPoint: (entry?.focalPoint as FocalPoint | undefined) ?? [0.5, 0.35],
  };
}

/**
 * Art for a catalog item, resolved through the same pointer -> src -> placeholder
 * order as everything else. `key` is `${kind}.${id}`, e.g. "weapon.stun_baton".
 * Add images later by adding a manifest.itemArt entry; no component changes.
 */
export function itemArt(key: string, label: string): ResolvedArt {
  const entry = manifest.itemArt?.[key];
  const src = pointerUrl(entry?.pointer) ?? entry?.src ?? null;
  return {
    assetId: `itemArt.${key}`,
    src,
    srcSet: srcSetFor(src),
    alt: entry?.alt ?? `${label} art`,
    focalPoint: (entry?.focalPoint as FocalPoint | undefined) ?? [0.5, 0.5],
  };
}

export function portraits(): PortraitEntry[] {
  return manifest.portraits ?? [];
}

/** A portrait resolved through the same pointer → src → placeholder order. */
export function portraitArt(entry: PortraitEntry): ResolvedArt {
  const src = pointerUrl(entry.pointer) ?? entry.src ?? null;
  return {
    assetId: `portraits.${entry.id}`,
    src,
    srcSet: srcSetFor(src),
    alt: entry.alt,
    focalPoint: entry.focalPoint ?? [0.5, 0.35],
  };
}

export function portraitById(id: string): PortraitEntry | undefined {
  return portraits().find((p) => p.id === id);
}

export const PRESENTATIONS: Presentation[] = ["masc", "femme", "androgynous"];
