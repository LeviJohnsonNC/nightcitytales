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
  const file = path.split("/").pop()!.replace(/\.asset\.json$/, "");
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
  portraits?: PortraitEntry[];
};

const manifest = (manifestJson ?? {}) as unknown as Manifest;

export const MANIFEST_PRESENT = Boolean(manifest.roleArt || manifest.portraits);

/** Resolved art for a slot. `src === null` means: render the placeholder. */
export type ResolvedArt = {
  assetId: string;
  src: string | null;
  alt: string;
  focalPoint: FocalPoint;
};

export function roleArt(roleId: string, roleName: string): ResolvedArt {
  const entry = manifest.roleArt?.[roleId];
  return {
    assetId: `roleArt.${roleId}`,
    src: pointerUrl(entry?.pointer) ?? entry?.src ?? null,
    alt: entry?.alt ?? `${roleName} key art`,
    focalPoint: (entry?.focalPoint as FocalPoint | undefined) ?? [0.5, 0.35],
  };
}

export function portraits(): PortraitEntry[] {
  return manifest.portraits ?? [];
}

/** A portrait resolved through the same pointer → src → placeholder order. */
export function portraitArt(entry: PortraitEntry): ResolvedArt {
  return {
    assetId: `portraits.${entry.id}`,
    src: pointerUrl(entry.pointer) ?? entry.src ?? null,
    alt: entry.alt,
    focalPoint: entry.focalPoint ?? [0.5, 0.35],
  };
}

export function portraitById(id: string): PortraitEntry | undefined {
  return portraits().find((p) => p.id === id);
}

export const PRESENTATIONS: Presentation[] = ["masc", "femme", "androgynous"];
