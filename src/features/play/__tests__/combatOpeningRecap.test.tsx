import { expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { attackEventData } from "@/engine";
import type { CampaignEvent } from "@/lib/backend";
import type { LiveEncounter } from "@/features/campaign/encounterState";
import { CombatOpeningRecap } from "../CombatOpeningRecap";

const live = {
  id: "fight",
  origin: { version: 1 },
  state: {
    round: 1,
    activeIndex: 2,
    order: ["h", "n", "p"],
    status: "active",
    combatants: {
      h: { id: "h", name: "Rifleman", side: "hostile", initiative: 18 },
      n: { id: "n", name: "Worker", side: "neutral", initiative: 14 },
      p: {
        id: "p",
        name: "Sarah",
        isPlayer: true,
        side: "friendly",
        initiative: 10,
        hp: 37,
        hpMax: 45,
      },
    },
  },
} as unknown as LiveEncounter;
const event = (type: string, data: unknown) => ({ type, data }) as CampaignEvent;
const start = event("encounter_started", { encounterId: "fight" });
const hit = event(
  "attack",
  attackEventData({
    attacker: "Rifleman",
    target: "Sarah",
    hit: true,
    margin: 2,
    applied: {
      hpAfter: 37,
      totalHpLoss: 8,
      damageThroughArmor: 8,
      bonusDamage: 0,
      spBefore: 11,
      spAfter: 10,
      ablated: true,
      armorLocation: "body",
      criticalInjury: false,
    },
  }),
);
it("explains saved opening damage after a fresh render without playback", () => {
  const html = renderToStaticMarkup(<CombatOpeningRecap live={live} events={[start, hit]} />);
  expect(html).toContain("1 opponent acted before you");
  expect(html).toContain("45 → 37 HP");
  expect(html).toContain("body armor 11 → 10");
  expect(html).toContain("Initiative rolls");
  expect(html).not.toContain("Worker acted");
});
it("never attributes pre-existing wounds or another encounter's attacks to this opening", () => {
  const html = renderToStaticMarkup(<CombatOpeningRecap live={live} events={[hit, start]} />);
  expect(html).not.toContain("45 → 37");
  const missing = renderToStaticMarkup(<CombatOpeningRecap live={live} events={[hit]} />);
  expect(missing).not.toContain("45 → 37");
  const next = renderToStaticMarkup(
    <CombatOpeningRecap
      live={live}
      events={[start, event("encounter_started", { encounterId: "later" }), hit]}
    />,
  );
  expect(next).not.toContain("45 → 37");
});
it("reports misses as misses and stops showing the opening on subsequent rounds", () => {
  const miss = event(
    "attack",
    attackEventData({ attacker: "Rifleman", target: "Sarah", hit: false, margin: -3 }),
  );
  const html = renderToStaticMarkup(<CombatOpeningRecap live={live} events={[start, miss]} />);
  expect(html).toContain("missed");
  expect(html).not.toContain("→ 37");
  const later = { ...live, state: { ...live.state, round: 2 } };
  expect(renderToStaticMarkup(<CombatOpeningRecap live={later} events={[start, hit]} />)).toBe("");
});
it("does not announce an opening while enemy playback is still showing their turn", () => {
  const acting = { ...live, state: { ...live.state, activeIndex: 0 } };
  expect(renderToStaticMarkup(<CombatOpeningRecap live={acting} events={[start, hit]} />)).toBe("");
});
