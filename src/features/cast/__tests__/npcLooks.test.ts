/**
 * The portraits are fixed and the dossiers were written without saying who they
 * show, so `cast-looks.json` is where the two are made to agree. This holds the
 * file to the directory (no portrait without a look, no look without a person)
 * and holds each look to the dossier's own pronouns, so a bio that says "she"
 * can never sit under a row that says "man".
 */
import { describe, expect, it } from "vitest";
import LOOKS from "@/data/cast/cast-looks.json";
import { PLACE_SHOPS } from "@/engine";
import { CAST_BIOS } from "../castBios";
import { NPC_DIRECTORY } from "../npcDirectory";
import { LOOK_IDS, keeperNamed, lookOfNpcId, seenAsFor } from "../npcLooks";
import { WORLD_BIOS } from "../worldBios";

/** Kinds that are one person with one face; factions and hostile archetypes are crowds. */
const PEOPLE = NPC_DIRECTORY.filter((n) => ["cast", "broker", "patron", "target"].includes(n.kind));

function pronounCounts(text: string) {
  return {
    male: (text.match(/\b(he|him|his|himself)\b/gi) ?? []).length,
    female: (text.match(/\b(she|her|hers|herself)\b/gi) ?? []).length,
  };
}

describe("cast-looks.json", () => {
  it("has a look for every person with a portrait, and nobody else", () => {
    expect(LOOK_IDS.sort()).toEqual(PEOPLE.map((n) => n.id).sort());
  });

  it("holds each look to the pronouns the dossier already uses", () => {
    for (const npc of PEOPLE) {
      const look = lookOfNpcId(npc.id)!;
      const { male, female } = pronounCounts(CAST_BIOS[npc.id] ?? WORLD_BIOS[npc.id] ?? "");
      if (male + female === 0) {
        // Silent dossier: any look is fine except that it must not be open and gendered.
        continue;
      }
      if (look.sex === "male")
        expect(male, `${npc.name}: dossier says she`).toBeGreaterThan(female);
      else if (look.sex === "female")
        expect(female, `${npc.name}: dossier says he`).toBeGreaterThan(male);
      // Open on purpose: the dossier must not have picked a side the file leaves open.
      else expect(male + female, `${npc.name}: dossier has pronouns, so the file may say`).toBe(0);
    }
  });

  it("gives every person an age unless nobody has ever seen them", () => {
    for (const [id, row] of Object.entries(LOOKS.people)) {
      if (id === "the-quartermaster") expect(row.age).toBeNull();
      else expect(row.age, id).toBeGreaterThanOrEqual(16);
    }
  });

  it("says it as a band, never as a number", () => {
    expect(seenAsFor("Ilsa Bräun")).toBe("woman, middle-aged");
    expect(seenAsFor("Ma Tsatsu")).toBe("woman, elderly");
    expect(seenAsFor("Ilsa Bräun")).not.toMatch(/\d/);
  });

  it("reads the four set from their portraits as women", () => {
    for (const name of ["Kit Mwangi", "Lark Ferreira", "Wren Kovalenko", "Sunny Okafor"])
      expect(seenAsFor(name), name).toMatch(/^woman, /);
  });

  it("says nothing for somebody never seen, or not on file", () => {
    expect(seenAsFor("The Quartermaster")).toBeNull();
    expect(seenAsFor("Nobody At All")).toBeNull();
  });
});

describe("keepers' looks", () => {
  it("records a look for every keeper, with the sex stated even when it is open", () => {
    for (const shop of PLACE_SHOPS) {
      const k = shop.keeper!;
      expect(k, shop.label).toBeTruthy();
      expect("sex" in k, `${k.name} sex`).toBe(true);
      expect(typeof k.age, `${k.name} age`).toBe("number");
    }
  });

  it("agrees with the pronouns in the line that describes them", () => {
    for (const shop of PLACE_SHOPS) {
      const k = shop.keeper!;
      const { male, female } = pronounCounts(`${k.who} ${shop.line}`);
      if (k.sex === "male") expect(female, `${k.name}`).toBeLessThanOrEqual(male);
      if (k.sex === "female") expect(male, `${k.name}`).toBeLessThanOrEqual(female);
    }
  });

  it("says Adair is nonbinary, with their pronouns, so the narrator does not have to guess", () => {
    const adair = PLACE_SHOPS.find((s) => s.keeper?.name === "Adair")!.keeper!;
    expect(adair.sex).toBe("nonbinary");
    expect(keeperNamed(adair)).toBe("Adair (nonbinary person, they/them, in their prime)");
  });

  it("still tells the narrator when somebody is left open, instead of saying nothing", () => {
    expect(keeperNamed({ name: "Marrow", sex: null, age: 50 })).toMatch(/^Marrow \(.*no he or she/);
  });

  it("sets Marrow and Cutter", () => {
    const sexOf = (name: string) => PLACE_SHOPS.find((s) => s.keeper?.name === name)!.keeper!.sex;
    expect(sexOf("Marrow")).toBe("male");
    expect(sexOf("Cutter")).toBe("female");
  });

  it("names a keeper with how they read", () => {
    expect(keeperNamed({ name: "Dot", sex: "female", age: 55 })).toBe("Dot (woman, older)");
    expect(keeperNamed({ name: "Dot" })).toBe("Dot");
    const pair = PLACE_SHOPS.find((s) => s.keeper?.name === "Torrell and Chiang")!.keeper!;
    expect(keeperNamed(pair)).toBe("Torrell and Chiang (a man and a woman, both older)");
  });
});
