import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import manifest from "@/data/art/manifest.json";
import { NPC_DIRECTORY, npcArtwork, npcImage } from "@/features/cast/npcDirectory";
import { itemArt, roleArt } from "../art";

/**
 * Every picture the app names, against the files that are actually there.
 *
 * There was no test like this, which is how a directory of 376 images and three
 * separate resolution paths — the art manifest, the cast directory, and the
 * Phaser loader — could all have their extension changed with nothing to catch
 * a missed one. Every path here is built by string convention, so the only
 * thing standing between a typo and an invisible broken image is this file.
 */

const PUBLIC = join(process.cwd(), "public");
const IMAGES = join(PUBLIC, "images");

/** Every `/images/...` path the art manifest points at. */
function manifestSources(): string[] {
  const found: string[] = [];
  const walk = (node: unknown) => {
    if (!node || typeof node !== "object") return;
    for (const value of Object.values(node as Record<string, unknown>)) {
      if (value && typeof value === "object") {
        const src = (value as { src?: unknown }).src;
        if (typeof src === "string" && src.startsWith("/images/")) found.push(src);
        walk(value);
      }
    }
  };
  walk(manifest);
  return found;
}

/** Both widths a local image is encoded at, from the full-size path. */
function widthsOf(src: string): string[] {
  const base = src.slice(0, -".webp".length);
  return [src, `${base}-512.webp`];
}

describe("the pictures the app names", () => {
  it("points the art manifest at files that exist, at both widths", () => {
    const sources = manifestSources();
    expect(sources.length, "the manifest names no images at all").toBeGreaterThan(100);
    for (const src of sources) {
      for (const url of widthsOf(src)) {
        expect(existsSync(join(PUBLIC, url)), `manifest names ${url}, which is missing`).toBe(true);
      }
    }
  });

  it("resolves every catalog item through to a file on disk", () => {
    // Through itemArt rather than off the manifest, so the resolver's own
    // pointer -> src -> placeholder order is what gets checked.
    for (const key of Object.keys(
      (manifest as { itemArt?: Record<string, unknown> }).itemArt ?? {},
    )) {
      const art = itemArt(key, key);
      if (!art.src?.startsWith("/images/")) continue;
      expect(existsSync(join(PUBLIC, art.src)), `${key} points at ${art.src}`).toBe(true);
      expect(art.srcSet, `${key} has no srcSet`).toBeTruthy();
      for (const url of art.srcSet!.split(",").map((p) => p.trim().split(/\s+/)[0]!)) {
        expect(existsSync(join(PUBLIC, url)), `${key} srcSet names ${url}`).toBe(true);
      }
    }
  });

  it("gives every named NPC a portrait at both widths", () => {
    for (const npc of NPC_DIRECTORY) {
      const art = npcArtwork(npc);
      expect(art.src, npc.id).toBe(npcImage(npc));
      for (const url of widthsOf(art.src)) {
        expect(existsSync(join(PUBLIC, url)), `${npc.id} has no ${url}`).toBe(true);
      }
    }
  });

  it("leaves the courtyard textures where Phaser looks for them", () => {
    // Lossless and unresized, because these are atlases sliced into frames. A
    // missing one drops the whole scene to its failure path.
    const dir = join(IMAGES, "combat", "night-shift");
    const files = readdirSync(dir);
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      expect(file.endsWith(".webp"), `${file} is not WebP`).toBe(true);
    }
  });

  it("ships no PNGs anywhere under public/images", () => {
    // 978MB of them, for pictures nothing draws above 896 CSS pixels. One
    // reappearing is a file added by hand that the conversion never saw.
    const strays: string[] = [];
    const walk = (dir: string, prefix: string) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        if (entry.isDirectory()) walk(join(dir, entry.name), `${prefix}${entry.name}/`);
        else if (entry.name.endsWith(".png")) strays.push(`${prefix}${entry.name}`);
      }
    };
    walk(IMAGES, "");
    expect(strays).toEqual([]);
  });

  it("gives no srcSet to anything that is not a local WebP", () => {
    // Role art is uploaded through Lovable and served from a remote URL, and
    // portraits can be too. Inventing a "-512" twin for one of those would name
    // a file that has never existed, and the browser would fetch it and fail.
    const roles = Object.keys((manifest as { roleArt?: Record<string, unknown> }).roleArt ?? {});
    expect(roles.length, "no role art to check").toBeGreaterThan(0);
    for (const roleId of roles) {
      const art = roleArt(roleId, roleId);
      if (art.src?.startsWith("/images/") && art.src.endsWith(".webp")) {
        expect(art.srcSet, `${roleId} is local and should have both widths`).toBeTruthy();
      } else {
        expect(art.srcSet, `${roleId} is remote and must not claim a narrow twin`).toBeNull();
      }
    }
  });
});
