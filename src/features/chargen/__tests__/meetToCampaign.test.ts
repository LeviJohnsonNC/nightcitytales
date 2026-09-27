/**
 * Creation promises the player people, and the campaign has to keep the promise.
 *
 * The Meet picks a fixer and the reveal shows the three people waiting in the
 * city. Both read the cast plan the draft holds; the campaign reads the same
 * plan back out of the saved Lifepath and seeds its six from it. If those two
 * paths ever disagree, the player is introduced to Song Ha-eun and then meets
 * Deacon Ferris, and nothing would fail — so this pins them together.
 */
import { afterEach, describe, expect, it } from "vitest";
import { CAST_PLAN_KEY, fixerCandidates, generateCast } from "@/engine";
import { castPlanFrom, lifepathTiesFrom } from "@/features/campaign/castSeeding";
import type { FullCharacter } from "@/lib/backend";
import { castForState } from "../revealModel";
import { useChargenStore } from "../store";

const GENERAL = {
  entries: {},
  friends: [{ tableId: "friends", roll: 3, value: "A teacher or mentor.", source: "rolled" }],
  enemies: [
    {
      id: "e1",
      who: { tableId: "enemy_who", roll: 8, value: "Corporate exec", source: "rolled" },
      cause: null,
      throwAtYou: null,
      injuredParty: "you",
    },
  ],
  tragicLove: [
    {
      tableId: "tragic_love",
      roll: 1,
      value: "Your lover died in an accident.",
      source: "rolled",
    },
  ],
  language: null,
};

afterEach(() => useChargenStore.getState().reset());

describe("from the meet to the campaign", () => {
  it("shows on the reveal exactly the six the campaign will seed", () => {
    for (let seed = 11; seed < 600; seed += 53) {
      const fixer = fixerCandidates(seed)[1]!;
      const plan = { seed, picks: { fixer } };
      useChargenStore.getState().patch({
        castPlan: plan,
        lifepath: { general: GENERAL as unknown as Record<string, unknown>, roleSpecific: {} },
      });
      const shown = castForState(useChargenStore.getState());

      // What the save writes, and what the campaign reads back from it.
      const saved = {
        lifepath: { general: { ...GENERAL, [CAST_PLAN_KEY]: plan } },
      } as unknown as FullCharacter;
      const stored = castPlanFrom(saved)!;
      const seeded = generateCast({
        seed: stored.seed,
        ties: lifepathTiesFrom(saved),
        picks: stored.picks,
      });

      expect(shown).toEqual(seeded);
      expect(seeded.find((m) => m.role === "fixer")!.name).toBe(fixer);
      expect(seeded.find((m) => m.role === "enemy")!.name).toBe("Song Ha-eun");
    }
  });

  it("shows nobody before the meet has dealt a room", () => {
    expect(castForState(useChargenStore.getState())).toEqual([]);
  });
});

describe("changing how you build", () => {
  it("clears what the method makes and keeps who the character is", () => {
    const store = useChargenStore.getState();
    store.selectMethod("edgerunner");
    store.selectRole("solo");
    store.patch({
      name: "Vic Salas",
      handle: "Static",
      castPlan: { seed: 7, picks: { fixer: "Kit Mwangi" } },
      lifepath: { general: GENERAL as unknown as Record<string, unknown>, roleSpecific: {} },
      stats: { int: 6 },
      skills: [{ skillId: "handgun", level: 4, specialization: null }],
    });

    useChargenStore.getState().selectMethod("complete_package");
    const after = useChargenStore.getState();

    expect(after.method).toBe("complete_package");
    expect(after.roleId).toBe("solo");
    expect(after.name).toBe("Vic Salas");
    expect(after.handle).toBe("Static");
    expect(after.castPlan).toEqual({ seed: 7, picks: { fixer: "Kit Mwangi" } });
    expect(after.lifepath.general).toEqual(GENERAL);
    expect(after.stats).toEqual({});
    expect(after.skills).toEqual([]);
  });

  it("starts a new character at the meet", () => {
    expect(useChargenStore.getState().step).toBe("fixer");
  });
});
