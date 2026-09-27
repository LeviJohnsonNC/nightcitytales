import { describe, expect, it } from "vitest";
import content from "@/data/cast/cast-content.json";
import rolesData from "@/data/rules/roles.json";
import { fixerCandidates, generateCast, readCastPlan, FIXERS_AT_THE_MEET } from "@/engine";
import { findNpc } from "@/features/cast/npcDirectory";
import {
  INTERVIEW_FIXERS,
  INTERVIEW_STEPS,
  fixerShortName,
  fixerSays,
  fixerVoice,
} from "../interview";

const POOL = (content as unknown as Record<string, { names: string[] }>)["fixer"]!.names;
const ROLE_IDS = Object.keys(rolesData.roles);

describe("the fixer interview", () => {
  it("has a voice, a face and a bio for every fixer who can be dealt", () => {
    expect([...INTERVIEW_FIXERS].sort()).toEqual([...POOL].sort());
    for (const name of POOL) {
      const npc = findNpc(name);
      expect(npc, name).not.toBeNull();
      expect(npc!.bio, name).toBeTruthy();
    }
  });

  it("gives every fixer a line for every step and every Role", () => {
    for (const name of INTERVIEW_FIXERS) {
      const voice = fixerVoice(name)!;
      for (const text of [voice.where, voice.pitch, voice.greeting, voice.verdict]) {
        expect(text.trim(), name).not.toBe("");
      }
      for (const step of INTERVIEW_STEPS) expect(voice.ask[step], `${name} ${step}`).toBeTruthy();
      for (const role of ROLE_IDS) expect(voice.roles[role], `${name} ${role}`).toBeTruthy();
      for (const chapter of ["origin", "self", "people", "drive", "work"] as const) {
        expect(voice.chapters[chapter], `${name} ${chapter}`).toBeTruthy();
      }
    }
  });

  it("keeps the house voice: no em-dashes, and no numbers the engine should own", () => {
    for (const name of INTERVIEW_FIXERS) {
      const voice = fixerVoice(name)!;
      const lines = [
        voice.where,
        voice.pitch,
        voice.greeting,
        voice.verdict,
        ...Object.values(voice.ask),
        ...Object.values(voice.roles),
        ...Object.values(voice.chapters),
      ];
      for (const line of lines) {
        expect(line, line).not.toMatch(/—/);
        expect(line, line).not.toMatch(/\d/);
      }
    }
  });

  it("answers the Role question with a reaction once there is a Role", () => {
    const name = INTERVIEW_FIXERS[0]!;
    expect(fixerSays(name, "role", null)).toBe(fixerVoice(name)!.ask.role);
    expect(fixerSays(name, "role", "solo")).toBe(fixerVoice(name)!.roles["solo"]);
    expect(fixerSays(name, "fixer", null)).toBe(fixerVoice(name)!.greeting);
    expect(fixerSays(null, "role", "solo")).toBeNull();
  });

  it("shortens a name the way people say it", () => {
    expect(fixerShortName('Marcus "Tally" Oyelaran')).toBe("Tally");
    expect(fixerShortName("Kit Mwangi")).toBe("Kit");
  });
});

describe("the meet", () => {
  it("deals the same room for the same draft, every fixer real and none twice", () => {
    for (let seed = 1; seed < 200; seed += 7) {
      const room = fixerCandidates(seed);
      expect(room).toEqual(fixerCandidates(seed));
      expect(room).toHaveLength(FIXERS_AT_THE_MEET);
      expect(new Set(room).size).toBe(room.length);
      for (const name of room) expect(POOL).toContain(name);
    }
  });

  it("deals different rooms to different drafts", () => {
    const rooms = new Set(Array.from({ length: 40 }, (_, i) => fixerCandidates(i * 977).join()));
    expect(rooms.size).toBeGreaterThan(5);
  });

  it("makes the fixer the player picked the campaign's fixer, and moves nobody else", () => {
    for (let seed = 3; seed < 400; seed += 37) {
      const drawn = generateCast({ seed });
      for (const pick of fixerCandidates(seed)) {
        const cast = generateCast({ seed, picks: { fixer: pick } });
        expect(cast.find((m) => m.role === "fixer")!.name).toBe(pick);
        expect(cast.map((m) => m.dossier)).toEqual(drawn.map((m) => m.dossier));
        expect(cast.filter((m) => m.role !== "fixer")).toEqual(
          drawn.filter((m) => m.role !== "fixer"),
        );
      }
    }
  });

  it("reads a stored plan back, and drops a pick that is nobody", () => {
    expect(readCastPlan({ seed: 42, picks: { fixer: "Kit Mwangi" } })).toEqual({
      seed: 42,
      picks: { fixer: "Kit Mwangi" },
    });
    expect(readCastPlan({ seed: 42, picks: { fixer: "Somebody Invented" } })).toEqual({
      seed: 42,
      picks: {},
    });
    expect(readCastPlan({ picks: {} })).toBeNull();
    expect(readCastPlan(null)).toBeNull();
  });
});
