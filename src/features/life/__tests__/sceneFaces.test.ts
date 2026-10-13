/**
 * The "Here" row decides who is shown; the layout only draws it. So this holds
 * the decision: who is in it, in what order, once each, and never invented.
 */
import { describe, expect, it } from "vitest";
import { MAX_SCENE_FACES, sceneFaces } from "../sceneFaces";

const none = { walkOns: [], people: [] };

describe("sceneFaces", () => {
  it("puts the people a passage names first, in the order it names them", () => {
    const faces = sceneFaces({
      ...none,
      walkOns: [{ subject: "dive-bar-tender", gender: "male" }],
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

  it("does not show a role the place merely has: only who the passage brings in", () => {
    // A bar has a tender; a passage that never mentions one gets no tender.
    expect(sceneFaces({ ...none, text: "The bar hums." })).toEqual([]);
  });

  it("shows a walk-on the narrator tagged, once", () => {
    const faces = sceneFaces({
      ...none,
      walkOns: [
        { subject: "dive-bar-tender", gender: "male" },
        { subject: "dive-bar-tender", gender: "male" },
      ],
      text: "",
    });
    expect(
      faces.filter((f) => f.kind === "walkon" && f.subject === "dive-bar-tender"),
    ).toHaveLength(1);
  });

  it("shows a named person only when the engine has them at this place", () => {
    const text = "Nadia Sirko leans on a rail, and Kit Mwangi is only mentioned.";
    const names = (present?: string[]) =>
      sceneFaces({ ...none, text, ...(present ? { present } : {}) }).map(
        (f) => f.kind === "person" && f.npc.name,
      );
    expect(names(["Nadia Sirko"])).toEqual(["Nadia Sirko"]);
    expect(names([])).toEqual([]);
    // Where there is no answer to ask (a Job's beat decides), the passage's names stand.
    expect(names()).toEqual(["Nadia Sirko", "Kit Mwangi"]);
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
    expect(sceneFaces({ ...none, text })).toHaveLength(MAX_SCENE_FACES);
  });

  it("is empty for a scene with nobody in it", () => {
    expect(sceneFaces({ ...none, text: "Rain on the glass." })).toEqual([]);
  });
});
