/**
 * The "Here" row decides who is shown; the layout only draws it. So this holds
 * the decision: who is in it, in what order, once each, and never invented.
 */
import { describe, expect, it } from "vitest";
import GAMEPLAY from "@/data/atlas/places.gameplay.json";
import { shopsAt, tagsOf } from "@/engine";
import { ambientPeople } from "@/features/cast/ambientPeople";
import { MAX_SCENE_FACES, sceneFaces } from "../sceneFaces";

const barKey = Object.keys(GAMEPLAY.places).find(
  (k) => tagsOf(k).includes("bar") && shopsAt(k).length === 0,
)!;
const ambient = ambientPeople(barKey, `c1:${barKey}`, false);
const none = { walkOns: [], ambient: [], people: [] };

describe("sceneFaces", () => {
  it("puts the people a passage names first, in the order it names them", () => {
    const faces = sceneFaces({
      ...none,
      ambient,
      text: "Kit Mwangi has not answered, and Ilsa Bräun's message is still open.",
    });
    expect(faces.slice(0, 2).map((f) => f.kind === "person" && f.npc.name)).toEqual([
      "Kit Mwangi",
      "Ilsa Bräun",
    ]);
    expect(faces.at(-1)?.kind).toBe("walkon");
  });

  it("names a person once, however often the passage does", () => {
    const faces = sceneFaces({ ...none, text: "Ilsa says no. Ilsa Bräun says it again. Ilsa." });
    expect(faces.filter((f) => f.kind === "person")).toHaveLength(1);
  });

  it("leaves out crowds: a faction or a hostile archetype is not one person with a face", () => {
    const faces = sceneFaces({ ...none, text: "The Tyger Claws and a pair of gangers watch." });
    expect(faces).toEqual([]);
  });

  it("shows the room's people even when the passage never mentions them", () => {
    const faces = sceneFaces({ ...none, ambient, text: "" });
    expect(faces.map((f) => f.kind === "walkon" && f.subject)).toContain("dive-bar-tender");
  });

  it("shows a role once when the narrator tagged somebody the engine had already put there", () => {
    const told = ambient.find((p) => p.subject === "dive-bar-tender")!;
    const faces = sceneFaces({
      ...none,
      ambient,
      walkOns: [{ subject: "dive-bar-tender", gender: told.gender }],
      text: "",
    });
    expect(
      faces.filter((f) => f.kind === "walkon" && f.subject === "dive-bar-tender"),
    ).toHaveLength(1);
  });

  it("reads each walk-on as a band, never a number", () => {
    const faces = sceneFaces({ ...none, ambient, text: "" });
    for (const f of faces)
      if (f.kind === "walkon") expect(f.look).toMatch(/^(man|woman), [a-z -]+$/);
  });

  it("drops a role with no picture on file rather than drawing a blank", () => {
    const faces = sceneFaces({
      ...none,
      walkOns: [{ subject: "not-a-role", gender: "male" }],
      text: "",
    });
    expect(faces).toEqual([]);
  });

  it("carries how they feel about the character, for the ring, only for people the character knows", () => {
    const faces = sceneFaces({
      ...none,
      text: "Ilsa Bräun and Kit Mwangi.",
      people: [{ name: "Ilsa Bräun", disposition: 3 }],
    });
    const tone = (name: string) => {
      const f = faces.find((x) => x.kind === "person" && x.npc.name === name);
      return f?.kind === "person" ? f.tone : "missing";
    };
    expect(tone("Ilsa Bräun")).toBe("warm");
    expect(tone("Kit Mwangi")).toBeNull();
  });

  it("is a room, not a roll call", () => {
    const text =
      "Ilsa Bräun, Kit Mwangi, Rosalind Achebe, Yuri Pastrana, Reg Amankwah, Meiling Zhou, Wren Kovalenko.";
    expect(sceneFaces({ ...none, ambient, text })).toHaveLength(MAX_SCENE_FACES);
  });

  it("is empty for a scene with nobody in it", () => {
    expect(sceneFaces({ ...none, text: "Rain on the glass." })).toEqual([]);
  });
});
