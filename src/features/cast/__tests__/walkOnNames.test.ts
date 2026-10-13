import { describe, expect, it } from "vitest";
import { knownWalkOnNames } from "../walkOnNames";
import { alsoHereLines } from "../ambientPeople";
import { resolveWalkOns } from "../walkOnMention";

const narration = (type: string, at: string | undefined, walkOns: unknown[]) => ({
  type,
  data: { ...(at ? { at } : {}), walkOns },
});

describe("who the character has learned at a place", () => {
  const events = [
    narration("life_narration", "plaza", [{ subject: "street-vendor", gender: "male" }]),
    narration("life_narration", "plaza", [
      { subject: "street-vendor", gender: "male", name: "Dae-ho" },
    ]),
    narration("gm_narration", "plaza", [
      { subject: "street-vendor", gender: "male", name: "Somebody Else" },
      { subject: "ncpd-beat-cop", gender: "female", name: "Okafor" },
    ]),
    narration("life_narration", "lobby", [
      { subject: "corpo-lobby-receptionist", gender: "female", name: "Inge" },
    ]),
    narration("life_narration", undefined, [
      { subject: "dive-bar-tender", gender: "female", name: "Placeless" },
    ]),
    narration("shop_browsed", "plaza", [{ subject: "x", gender: "male", name: "Wrong Type" }]),
  ];

  it("is read off the narrations written at that place, the first name for a role winning", () => {
    expect([...knownWalkOnNames(events, "plaza")]).toEqual([
      ["street-vendor", "Dae-ho"],
      ["ncpd-beat-cop", "Okafor"],
    ]);
  });

  it("does not carry a name to another place, or from a narration with no place", () => {
    expect([...knownWalkOnNames(events, "lobby")]).toEqual([["corpo-lobby-receptionist", "Inge"]]);
    expect(knownWalkOnNames(events, "elsewhere").size).toBe(0);
  });

  it("is told to the narrator beside the role it belongs to", () => {
    const people = [
      { subject: "street-vendor", gender: "male" as const, seenAs: "man, older" },
      { subject: "ncpd-beat-cop", gender: "female" as const, seenAs: "woman, in their prime" },
    ];
    const lines = alsoHereLines(people, new Map([["street-vendor", "Dae-ho"]]));
    expect(lines[0]).toContain("the character knows them as Dae-ho");
    expect(lines[1]).not.toContain("knows them as");
    expect(alsoHereLines(people)).toEqual(alsoHereLines(people, new Map()));
  });

  it("stays theirs on a later turn that tags them, whatever that turn calls them", () => {
    const known = new Map([["street-vendor", "Dae-ho"]]);
    // The turn does not say the name and does not tag one: it still wears it.
    expect(
      resolveWalkOns([{ subject: "street-vendor" }], "c1:plaza", [], {
        text: "He shrugs.",
        known,
      })[0]?.name,
    ).toBe("Dae-ho");
    // A turn that offers another name does not rename them.
    expect(
      resolveWalkOns([{ subject: "street-vendor", name: "Kenji" }], "c1:plaza", [], {
        text: "Kenji grins.",
        known,
      })[0]?.name,
    ).toBe("Dae-ho");
    // Somebody else there is not given their name.
    expect(
      resolveWalkOns([{ subject: "ncpd-beat-cop" }], "c1:plaza", [], { text: "", known })[0],
    ).not.toHaveProperty("name");
  });
});
