import { describe, expect, it } from "vitest";
import {
  GAME_PHASES,
  PHASE_TRIGGERS,
  canTransition,
  isGamePhase,
  nextPhase,
  phaseOf,
} from "../phase";

describe("the phase machine", () => {
  it("moves each trigger only from where it belongs", () => {
    const legal: Record<string, [string, string][]> = {
      offer_hook: [["life", "hook"]],
      decline_hook: [["hook", "life"]],
      accept_hook: [["hook", "job"]],
      end_job: [["job", "aftermath"]],
      close_out: [["aftermath", "life"]],
    };
    for (const trigger of PHASE_TRIGGERS) {
      for (const from of GAME_PHASES) {
        const expected = legal[trigger]!.find(([f]) => f === from)?.[1] ?? null;
        expect(nextPhase(from, trigger), `${trigger} from ${from}`).toBe(expected);
        expect(canTransition(from, trigger)).toBe(expected !== null);
      }
    }
  });

  it("never closes a job out without its Aftermath, which is where it is paid", () => {
    expect(nextPhase("job", "close_out")).toBeNull();
  });

  it("only a hook leads into a job", () => {
    const intoJob = PHASE_TRIGGERS.filter((t) =>
      GAME_PHASES.some((from) => nextPhase(from, t) === "job"),
    );
    expect(intoJob).toEqual(["accept_hook"]);
  });

  it("reads anything unrecognised as Life", () => {
    expect(phaseOf("job")).toBe("job");
    expect(phaseOf("won")).toBe("life");
    expect(phaseOf(null)).toBe("life");
    expect(isGamePhase("aftermath")).toBe(true);
    expect(isGamePhase(3)).toBe(false);
  });
});
