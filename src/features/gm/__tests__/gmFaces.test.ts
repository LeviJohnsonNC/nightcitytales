/**
 * The Job packet's half of the faces: who a place has standing in it, told to the
 * narrator before it writes, with the one difference from Life that matters. On a
 * Job the BEAT decides who is in a scene, so the list is faces on file, not a
 * promise that somebody is there.
 */
import { describe, expect, it } from "vitest";
import { NIGHT_AT_THE_OPERA, getBeat } from "@/engine";
import { alsoHereNote } from "@/features/narration/narratorRules";
import { buildGmContext, renderGmUserPrompt, type GmCharacterSummary } from "../gmContext";
import { GM_SYSTEM_PROMPT } from "../gmSystemPrompt";

const character: GmCharacterSummary = {
  name: "Vincent Kang",
  role: "solo",
  hp: 40,
  hpMax: 40,
  woundState: "none",
  humanity: 44,
  humanityMax: 60,
  eurobucks: 1030,
  stats: { ref: 8, body: 6 },
  keySkills: [{ skill: "Handgun", id: "handgun", base: 14 }],
};

const beat = getBeat(NIGHT_AT_THE_OPERA, "getting_tickets");
const packetWith = (alsoHere?: string[]) =>
  renderGmUserPrompt(
    buildGmContext({
      mission: NIGHT_AT_THE_OPERA,
      beat,
      availableExits: beat.exits,
      character,
      objectives: [],
      npcsPresent: [],
      recentEvents: [],
      place: {
        where: "Night City Symphony Hall",
        district: "Westbrook",
        area: "Westbrook",
        security: "NCPD",
        gangs: [],
        combatZone: false,
        nearby: [],
        ...(alsoHere ? { alsoHere } : {}),
      },
    }),
    "I walk up to the box office.",
  );

describe("the Job packet's 'Also here'", () => {
  const lines = ['"corpo-lobby-receptionist" (Corpo Lobby Receptionist): woman, in their prime'];

  it("names who the place has, with the face the player will be shown", () => {
    const packet = packetWith(lines);
    expect(packet).toContain(
      'Also here: "corpo-lobby-receptionist" (Corpo Lobby Receptionist): woman, in their prime',
    );
    expect(packet).toContain("the same sex for every pronoun");
  });

  it("leaves it to the beat whether any of them is in the scene", () => {
    const packet = packetWith(lines);
    expect(packet).toContain("the beat's to say, not this list's");
    expect(packet).toContain("never add one to a scene that has no room for them");
  });

  it("says nothing for a place with none of the roles", () => {
    expect(packetWith([])).not.toContain("Also here");
    expect(packetWith()).not.toContain("Also here");
  });

  it("keeps the same core rule as Life, and only the framing differs", () => {
    const core = "the same sex for every pronoun and the same stage of life, never the other";
    expect(alsoHereNote("life")).toContain(core);
    expect(alsoHereNote("job")).toContain(core);
    expect(alsoHereNote("life")).not.toContain("beat's to say");
    expect(alsoHereNote("job")).toContain("beat's to say");
  });

  it("is in the Job prompt as the one exception to choosing a gender", () => {
    expect(GM_SYSTEM_PROMPT).toContain('A role the context lists as "Also here" is the exception');
  });
});
