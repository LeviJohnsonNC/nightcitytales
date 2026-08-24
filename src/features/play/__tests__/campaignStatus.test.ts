import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CAMPAIGN_STATUSES } from "@/engine";

/**
 * campaigns.status carries a CHECK constraint (active/won/lost/abandoned).
 * TypeScript cannot see it — the generated column type is plain string — so
 * `updateCampaign(id, { status: "completed" })` compiled cleanly, threw at
 * runtime, and was swallowed by a catch. Both "completed" and "dead" shipped
 * that way.
 *
 * This scans the play layer for literal status writes and checks them against
 * the vocabulary the database will actually accept.
 */
const FILES = ["usePlay.ts", "PlayScreen.tsx", "combatFlow.ts", "encounterModel.ts"];

function sourceOf(file: string): string {
  return readFileSync(join(__dirname, "..", file), "utf8");
}

describe("campaign status writes stay inside the CHECK constraint", () => {
  it("only ever writes a status the campaigns table permits", () => {
    const legal = new Set<string>(CAMPAIGN_STATUSES);
    const offenders: string[] = [];

    for (const file of FILES) {
      const source = sourceOf(file);
      // updateCampaign(..., { ... status: "x" ... })
      for (const match of source.matchAll(/updateCampaign\([^)]*status:\s*"([^"]+)"/g)) {
        const status = match[1] as string;
        if (!legal.has(status)) offenders.push(`${file}: updateCampaign status "${status}"`);
      }
    }

    expect(offenders, offenders.join("; ")).toEqual([]);
  });

  it("does not compare a campaign status against a value that can never be set", () => {
    const legal = new Set<string>(CAMPAIGN_STATUSES);
    const offenders: string[] = [];

    for (const file of FILES) {
      for (const match of sourceOf(file).matchAll(/campaign\.status\s*[=!]==\s*"([^"]+)"/g)) {
        const status = match[1] as string;
        if (!legal.has(status)) offenders.push(`${file}: compares campaign.status to "${status}"`);
      }
    }

    expect(offenders, offenders.join("; ")).toEqual([]);
  });

  it("knows the vocabulary it is checking against", () => {
    // Guards the guard: if CAMPAIGN_STATUSES drifts from the migration's CHECK,
    // the tests above would start passing bad values.
    expect([...CAMPAIGN_STATUSES].sort()).toEqual(["abandoned", "active", "lost", "won"]);
  });
});
