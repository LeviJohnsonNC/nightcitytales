/**
 * Art manifest access. Image paths live ONLY in /src/data/art/manifest.json.
 * A missing manifest, a missing entry, or `src: null` all resolve to a
 * placeholder descriptor carrying the asset id, never a broken image.
 */
import manifestJson from "@/data/art/manifest.json";

export type FocalPoint = [number, number];
export type Presentation = "masc" | "femme" | "androgynous";

export type ArtEntry = {
  src: string | null;
  alt: string;
  focalPoint: FocalPoint;
};

export type PortraitEntry = {
  id: string;
  src: string | null;
  roles: string[];
  presentation: Presentation;
  alt: string;
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
    src: entry?.src ?? null,
    alt: entry?.alt ?? `${roleName} key art`,
    focalPoint: (entry?.focalPoint as FocalPoint | undefined) ?? [0.5, 0.35],
  };
}

export function portraits(): PortraitEntry[] {
  return manifest.portraits ?? [];
}

export const PRESENTATIONS: Presentation[] = ["masc", "femme", "androgynous"];
