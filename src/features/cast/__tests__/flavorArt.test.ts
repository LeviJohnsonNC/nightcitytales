/**
 * Guards the one thing flavor-art.json cannot check for itself: that a
 * catalog id actually names a file on disk. A typo'd or renamed id here does
 * not fail loudly like a broken import would — it fails as a missing image in
 * a shipped build — so this walks the whole catalog against the filesystem
 * the way encounterSchema.test.ts and placeSchema.test.ts guard their own
 * data/asset drift.
 */
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import FLAVOR_ART from "@/data/cast/flavor-art.json";
import { flavorArt, FLAVOR_SUBJECTS } from "../flavorArt";

const PUBLIC_DIR = resolve(import.meta.dirname, "../../../../public/images/flavor");

describe("flavor art catalog", () => {
  it.each(FLAVOR_ART.entries)("$id has both encoded widths on disk", ({ id }) => {
    expect(existsSync(resolve(PUBLIC_DIR, `${id}.webp`))).toBe(true);
    expect(existsSync(resolve(PUBLIC_DIR, `${id}-512.webp`))).toBe(true);
  });

  it("has no duplicate ids", () => {
    const ids = FLAVOR_ART.entries.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("flavorArt()", () => {
  it("returns undefined for a subject with no art", () => {
    expect(flavorArt("nonexistent-subject")).toBeUndefined();
  });

  it("returns the matching gender when it exists", () => {
    const art = flavorArt("dive-bar-tender", "male");
    expect(art?.src).toBe("/images/flavor/dive-bar-tender-male.webp");
    expect(art?.srcSet).toContain("512w");
  });

  it("falls back to whatever variants exist when the requested gender is missing", () => {
    // Every current subject has both genders, so exercise the fallback path
    // directly against a gender the catalog does not define for anyone yet.
    const art = flavorArt("dive-bar-tender", "unspecified" as never);
    expect(["/images/flavor/dive-bar-tender-male.webp", "/images/flavor/dive-bar-tender-female.webp"]).toContain(
      art?.src,
    );
  });

  it("picks a variant when no gender is given at all", () => {
    const art = flavorArt("street-vendor");
    expect(art?.src).toMatch(/^\/images\/flavor\/street-vendor-(male|female)\.webp$/);
  });

  it("lists every subject exactly once", () => {
    expect(FLAVOR_SUBJECTS).toEqual([...FLAVOR_SUBJECTS].sort());
    expect(new Set(FLAVOR_SUBJECTS).size).toBe(FLAVOR_SUBJECTS.length);
  });
});
