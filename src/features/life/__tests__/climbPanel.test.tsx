import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { jobTierFor, reputationFrom, REPUTATION } from "@/engine";
import { ClimbPanel } from "../ClimbPanel";
import type { LifeBundle } from "../lifeOps";

const bundleWith = (input: { level: number; jobs: number; fixer: number }) =>
  ({
    tally: { jobsFinished: input.jobs },
    climb: {
      reputation: {
        level: input.level,
        whoKnows: REPUTATION.levels.find((l) => l.level === input.level)?.whoKnows ?? null,
        deeds: input.jobs,
      },
      tier: jobTierFor({
        reputation: input.level,
        jobsFinished: input.jobs,
        fixerDisposition: input.fixer,
      }),
    },
  }) as unknown as LifeBundle;

describe("the climb panel", () => {
  it("says nobody has heard of a new character, and what the next tier needs", () => {
    expect(reputationFrom([]).level).toBe(0);
    const html = renderToStaticMarkup(
      <ClimbPanel bundle={bundleWith({ level: 0, jobs: 0, fixer: 1 })} />,
    );
    expect(html).toContain("Reputation 0");
    expect(html).toContain("Nobody has heard of you yet.");
    expect(html).toContain("street work");
    expect(html).toMatch(/Steady work at Reputation 3 and 3 jobs done/);
  });

  it("says so when a cold fixer is holding the character back", () => {
    const html = renderToStaticMarkup(
      <ClimbPanel bundle={bundleWith({ level: 3, jobs: 4, fixer: -2 })} />,
    );
    expect(html).toContain("street work");
    expect(html).toContain("Your fixer has gone cold");
  });
});
