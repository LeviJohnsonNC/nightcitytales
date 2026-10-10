import { describe, expect, it } from "vitest";
import atlas from "@/data/atlas/night-city.json";
import { HOUSE_RULE_PLACES, areaOf, getPlace } from "../geography";
import { districtAtPoint } from "../cityGrid";
import { hauntsFor } from "../haunts";
import { tagsOf } from "../places";
import { PLACE_SHOPS } from "../vendors";

/**
 * The map has to have somewhere to buy and somewhere to be cut in every
 * district, or "go there" is a long trip for whoever happened to live in the
 * wrong one. These hold the shape of that coverage rather than any one place.
 */
const DISTRICTS = atlas.districts;
/**
 * Hospitals that will put a stranger on the table: Old Japantown's no-questions
 * Crisis Medical Center, and the research hospital on Rocklin Augmentics' campus,
 * which is a cyberware company's own.
 */
const WALK_IN_HOSPITALS = new Set(["h1", "p9"]);
const placesIn = (districtKey: string) =>
  DISTRICTS.find((d) => d.key === districtKey)!.locations.map((l) => l.key);

describe("somewhere to buy", () => {
  it("has a seller in every district", () => {
    for (const district of DISTRICTS) {
      const here = new Set(
        [...placesIn(district.key), ...houseRuleKeys(district.key)].filter((k) =>
          PLACE_SHOPS.some((s) => s.place === k),
        ),
      );
      expect(here.size, `${district.name} has no seller`).toBeGreaterThan(0);
    }
  });

  it("has a gun counter in every area of the city", () => {
    const areas = new Set(
      PLACE_SHOPS.filter((s) => s.vendor === "gun_shop").map(
        (s) => areaOf(districtKeyOf(s.place))?.key,
      ),
    );
    for (const area of ["island", "northside", "mainland", "southside"]) {
      expect(areas.has(area as never), `no gun counter in the ${area}`).toBe(true);
    }
  });
});

describe("somewhere to be cut", () => {
  it("has ripperdoc ground in every district, so every home keeps its ripperdoc close", () => {
    for (const district of DISTRICTS) {
      const keys = [...placesIn(district.key), ...houseRuleKeys(district.key)];
      const local = keys.filter((k) =>
        tagsOf(k).some((t) => t === "ripperdoc" || t === "clinic" || t === "hospital"),
      );
      expect(local.length, `${district.name} has no ripperdoc ground`).toBeGreaterThan(0);
    }
  });

  it("never leaves a district's only ripperdoc ground to an executive hospital", () => {
    for (const district of DISTRICTS) {
      const keys = [...placesIn(district.key), ...houseRuleKeys(district.key)];
      const real = keys.filter((k) => tagsOf(k).some((t) => t === "ripperdoc" || t === "clinic"));
      const hospitals = keys.filter((k) => tagsOf(k).includes("hospital"));
      if (real.length === 0) {
        // Only hospitals: each must be one that will take a walk-in. Name them here, so a new one is a decision.
        expect(
          hospitals.every((k) => WALK_IN_HOSPITALS.has(k)),
          district.name,
        ).toBe(true);
      }
    }
  });

  it("draws every character's ripperdoc from their own district first", () => {
    for (const district of DISTRICTS) {
      for (const seed of ["a", "b", "c", "d"]) {
        const [first] = hauntsFor("ripperdoc", district.key, seed);
        expect(districtKeyOf(first!), `${district.name} sent its ripperdoc across town`).toBe(
          district.key,
        );
      }
    }
  });
});

describe("the places we added", () => {
  const ours = [...HOUSE_RULE_PLACES];

  it("stand inside their own district, on land", () => {
    for (const key of ours) {
      const place = getPlace(key)!;
      expect(districtAtPoint(place.map!), `${place.name} (${key}) is off its district`).toBe(
        districtKeyOf(key),
      );
    }
  });

  it("have a name, a blurb and a code that matches the key", () => {
    for (const key of ours) {
      const place = getPlace(key)!;
      expect(place.name.trim().length).toBeGreaterThan(2);
      expect(place.blurb.trim().length).toBeGreaterThan(30);
      expect(place.code).toBe(key.toUpperCase());
    }
  });

  it("do not share a name with anywhere else in the city", () => {
    const names = DISTRICTS.flatMap((d) => d.locations.map((l) => l.name));
    for (const key of ours) names.push(getPlace(key)!.name);
    expect(new Set(names.map((n) => n.toLowerCase())).size).toBe(names.length - dupesAllowed());
  });
});

function houseRuleKeys(districtKey: string): string[] {
  return [...HOUSE_RULE_PLACES].filter((k) => districtKeyOf(k) === districtKey);
}

function districtKeyOf(placeKey: string): string {
  const letter = placeKey[0]!.toUpperCase();
  return DISTRICTS.find((d) => d.code === letter)!.key;
}

/** The atlas prints the Forlorn Hope twice (Little China and North Heywood). */
function dupesAllowed(): number {
  const names = DISTRICTS.flatMap((d) => d.locations.map((l) => l.name.toLowerCase()));
  return names.length - new Set(names).size;
}
