import { describe, expect, it } from "vitest";
import { DISTRICTS } from "@/engine";
import { buildDescentFacts, waitingLines } from "../descentFacts";

const district = DISTRICTS.find((d) => d.key === "pacifica_playground")!;
const place = district.locations[0]!;

function bundle(over: { sex?: string; age?: number; role?: string; handle?: string | null } = {}) {
  return {
    campaign: { location_key: place.key, minute: 21 * 60 + 30 },
    vitals: {},
    cast: [],
    character: {
      character: {
        name: "Mara Vance",
        handle: over.handle === undefined ? "Sundown" : over.handle,
        role: over.role ?? "Lawman",
        portrait_path: "u/c/p.png",
      },
      finance: { home_place_key: place.key },
      lifepath: {
        general: { identity: { sex: over.sex ?? "female", age: over.age ?? 34 } },
      },
    },
  } as never;
}

describe("what the descent narrows the city by", () => {
  const facts = buildDescentFacts(bundle());

  it("says where they sleep, what they do and who they are on sight", () => {
    expect(facts.filters.map((f) => f.label)).toEqual(["Area", "District", "Does", "Reads as"]);
    expect(facts.filters[1]!.value).toBe(district.name);
    expect(facts.filters[2]!.value).toBe("Lawman");
    expect(facts.districtKey).toBe(district.key);
    expect(facts.placeKey).toBe(place.key);
    expect(facts.handle).toBe("Sundown");
    expect(facts.portraitPath).toBe("u/c/p.png");
  });

  it("gives the band, never the age: a stranger sees a face, not a birth certificate", () => {
    const line = facts.filters[3]!.value;
    expect(line).toMatch(/woman/i);
    expect(line).not.toMatch(/\d/);
  });

  it("reads a Role id as its printed name", () => {
    expect(buildDescentFacts(bundle({ role: "netrunner" })).filters[2]!.value).toBe("Netrunner");
  });

  it("copes with a character the atlas cannot place, and with no handle", () => {
    const lost = buildDescentFacts({
      ...(bundle({ handle: null }) as object),
      campaign: { location_key: null, minute: 0 },
      character: {
        ...(bundle({ handle: null }) as { character: object }).character,
        finance: null,
      },
    } as never);
    expect(lost.districtKey).toBeNull();
    expect(lost.handle).toBeNull();
    expect(lost.filters[1]!.value).toBeTruthy();
  });

  it("says what time of night it is in words", () => {
    expect(facts.hour).toBe("late evening");
  });
});

describe("what the window says while it waits", () => {
  it("mixes the Role's own habits with the room's, and never states a number", () => {
    const lines = waitingLines("Solo", "The Ivory Needle");
    expect(lines).toContain("Counting the exits.");
    expect(lines.some((l) => l.includes("The Ivory Needle"))).toBe(true);
    expect(lines.length).toBeGreaterThan(4);
    for (const line of lines) expect(line).not.toMatch(/\d/);
  });

  it("still has something to say for a Role it has no lines for", () => {
    expect(waitingLines("Cook", null).length).toBeGreaterThan(3);
  });
});
