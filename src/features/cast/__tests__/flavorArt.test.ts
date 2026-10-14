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
import {
  flavorArt,
  flavorGenders,
  flavorSubjectLabel,
  pickFlavorFace,
  resolveFlavorGender,
  FLAVOR_SUBJECTS,
} from "../flavorArt";
import { ageBand } from "@/engine";

const PUBLIC_DIR = resolve(import.meta.dirname, "../../../../public/images/flavor");

describe("flavor art catalog", () => {
  it.each(FLAVOR_ART.entries)("$id has both encoded widths on disk", ({ id }) => {
    expect(existsSync(resolve(PUBLIC_DIR, `${id}.webp`))).toBe(true);
    expect(existsSync(resolve(PUBLIC_DIR, `${id}-512.webp`))).toBe(true);
  });

  it.each(FLAVOR_ART.entries)("$id has its face cut from the scene", ({ id, face, age }) => {
    expect(existsSync(resolve(PUBLIC_DIR, `${id}-face.webp`))).toBe(true);
    // The square must sit inside the 1024x683 scene the cut is made from.
    expect(face.x).toBeGreaterThanOrEqual(0);
    expect(face.y).toBeGreaterThanOrEqual(0);
    expect(face.x + face.size).toBeLessThanOrEqual(1024);
    expect(face.y + face.size).toBeLessThanOrEqual(683);
    expect(age).toBeGreaterThanOrEqual(16);
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
    expect([
      "/images/flavor/dive-bar-tender-male.webp",
      "/images/flavor/dive-bar-tender-female.webp",
    ]).toContain(art?.src);
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

describe("flavorSubjectLabel()", () => {
  it("title-cases a kebab slug", () => {
    expect(flavorSubjectLabel("dive-bar-tender")).toBe("Dive Bar Tender");
    expect(flavorSubjectLabel("ncpd-beat-cop")).toBe("Ncpd Beat Cop");
  });
});

describe("resolveFlavorGender()", () => {
  it("returns undefined for a subject with no art at all", () => {
    expect(resolveFlavorGender("nonexistent-subject", undefined, "seed")).toBeUndefined();
  });

  it("keeps the requested gender when this subject has it", () => {
    expect(resolveFlavorGender("dive-bar-tender", "male", "any-seed")).toBe("male");
    expect(resolveFlavorGender("dive-bar-tender", "female", "any-seed")).toBe("female");
  });

  it("is deterministic: the same seed always resolves to the same gender", () => {
    const seed = "campaign-1:skivs-counter:dive-bar-tender";
    const first = resolveFlavorGender("dive-bar-tender", undefined, seed);
    for (let i = 0; i < 20; i += 1) {
      expect(resolveFlavorGender("dive-bar-tender", undefined, seed)).toBe(first);
    }
  });

  it("different seeds can resolve to different genders", () => {
    // Not guaranteed for any single pair, but across enough distinct seeds at
    // least one should land on each gender, or this stopped being a pick.
    const genders = new Set(
      Array.from({ length: 50 }, (_, i) =>
        resolveFlavorGender("dive-bar-tender", undefined, `seed-${i}`),
      ),
    );
    expect(genders.size).toBeGreaterThan(1);
  });

  it("falls back deterministically when the requested gender does not exist for this subject", () => {
    // Every current subject has both genders, so exercise the fallback path
    // directly against one the catalog does not define for anyone.
    const seed = "campaign-1:some-place:dive-bar-tender";
    const first = resolveFlavorGender("dive-bar-tender", "unspecified" as never, seed);
    expect(["male", "female"]).toContain(first);
    expect(resolveFlavorGender("dive-bar-tender", "unspecified" as never, seed)).toBe(first);
  });
});

describe("a role with several faces", () => {
  const ids = (subject: string, gender: string) =>
    FLAVOR_ART.entries.filter((e) => e.subject === subject && e.gender === gender).map((e) => e.id);

  it("keeps the original first, so a walk-on stored without a face is the face it always was", () => {
    expect(flavorArt("dive-bar-tender", "female")?.id).toBe("dive-bar-tender-female");
    expect(flavorArt("dive-bar-tender")?.id).toBe(
      FLAVOR_ART.entries.find((e) => e.subject === "dive-bar-tender")!.id,
    );
  });

  it("gives the face asked for, and ignores one that is another role's or another gender's", () => {
    expect(flavorArt("dive-bar-tender", "female", "dive-bar-tender-female-young")?.id).toBe(
      "dive-bar-tender-female-young",
    );
    expect(flavorArt("dive-bar-tender", "male", "dive-bar-tender-female-young")?.id).toBe(
      "dive-bar-tender-male",
    );
    expect(flavorArt("dive-bar-tender", "female", "street-vendor-female-young")?.id).toBe(
      "dive-bar-tender-female",
    );
    expect(flavorArt("dive-bar-tender", "female", "no-such-face")?.id).toBe(
      "dive-bar-tender-female",
    );
  });

  it("is chosen from a seed, and always one of that gender's faces", () => {
    for (const subject of FLAVOR_SUBJECTS) {
      for (const gender of flavorGenders(subject)) {
        const own = ids(subject, gender);
        const first = pickFlavorFace(subject, gender, "c1:place");
        expect(own, `${subject} ${gender}`).toContain(first);
        for (let i = 0; i < 5; i += 1)
          expect(pickFlavorFace(subject, gender, "c1:place")).toBe(first);
      }
    }
    expect(pickFlavorFace("nonexistent-subject", "male", "seed")).toBeUndefined();
  });

  it("uses every face over enough places, so nobody has the same bartender everywhere", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 60; i += 1)
      seen.add(pickFlavorFace("dive-bar-tender", "female", `c:${i}`)!);
    expect([...seen].sort()).toEqual(ids("dive-bar-tender", "female").sort());
  });

  it("lists each gender once however many faces it has", () => {
    expect(flavorGenders("dive-bar-tender").sort()).toEqual(["female", "male"]);
  });

  it("has a young and an older face for most roles, read by the same bands the narrator is told", () => {
    const band = (id: string) => ageBand(FLAVOR_ART.entries.find((e) => e.id === id)!.age).id;
    expect(band("dive-bar-tender-female-young")).toBe("young");
    expect(band("dive-bar-tender-female")).toBe("older");
    expect(band("noodle-bar-cook-male-older")).toBe("older");
  });
});
