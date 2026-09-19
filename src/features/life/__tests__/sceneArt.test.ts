import { describe, expect, it } from "vitest";
import { getDistrict } from "@/engine";
import { sceneArt } from "../sceneArt";

/** Eagle Rock Stadium, in Rancho Coronado. Both have pictures. */
const STADIUM = "x3";

describe("the picture for where the character is standing", () => {
  it("uses the venue's own picture when it has one", () => {
    const scene = sceneArt(STADIUM);
    expect(scene.precision).toBe("place");
    expect(scene.artwork?.src).toBe("/images/places/eagle-rock-stadium.webp");
    expect(scene.artwork?.srcSet).toContain("640w");
    expect(scene.title).toBe("Eagle Rock Stadium");
    expect(scene.subtitle).toContain("Rancho Coronado");
    expect(scene.alt).not.toBe("");
  });

  it("keeps the venue's picture when the location carries a point", () => {
    expect(sceneArt(`${STADIUM}@12,34`).artwork).toEqual(sceneArt(STADIUM).artwork);
  });

  it("walks up to the district rather than showing somewhere else's venue", () => {
    // A landmark has no dossier of its own: the district's picture stands in,
    // and the caption still says which landmark the character is standing at.
    const scene = sceneArt("coronado_bay_bridge");
    expect(scene.precision).toBe("district");
    expect(scene.artwork?.src).toMatch(/^\/images\/places\/.+\.webp$/);
    expect(scene.title).toMatch(/Coronado/i);
  });

  it("uses the district's own picture when that is where they are", () => {
    const scene = sceneArt("rancho_coronado");
    expect(scene.artwork?.src).toBe("/images/places/rancho-coronado.webp");
  });

  it("still names the place when nothing in the chain has a picture", () => {
    const scene = sceneArt("this-is-not-a-place");
    expect(scene.artwork).toBeUndefined();
    expect(scene.precision).toBe("none");
    expect(scene.title).toBe("Night City");
  });

  it("does not print the district twice when standing in the district itself", () => {
    const district = getDistrict("rancho_coronado")!;
    expect(sceneArt(district.key).subtitle).not.toContain(district.name);
  });

  it("resolves something for every district on the map", () => {
    for (const key of ["little_europe", "watson", "pacifica", "santo_domingo"]) {
      const scene = sceneArt(key);
      expect(scene.title).not.toBe("");
    }
  });
});
