/**
 * One Life turn, end to end, over an in-memory campaign.
 *
 * `liveTurn` is the whole of a Life turn: the oracles, the packet, the model,
 * the engine applying what came back, and the writes in their order. The model
 * is scripted (`lifeTurnFn` runs the server's own normalizer over a wire reply)
 * and the backend adapter is a store in this file's hands; everything between
 * is the shipping code, including the Downtime operations, travel and the
 * place state. Only the world tick and the oracles' dice are pinned, so a turn
 * reads the same every run.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  LEDGER_EVENTS,
  MAX_ACTION_MINUTES,
  generateCast,
  getArc,
  arcFor,
  freshArcState,
  readArcState,
  readShopBrowsedEventData,
  shopsAt,
} from "@/engine";
import type { CampaignNpc, Json } from "@/lib/backend";
import { downtimeView } from "@/features/downtime/downtimeModel";
import { DV_BANDS } from "@/features/play/checkPrompt";
import { CAMPAIGN_ID, freshDb, reply, type Db } from "./lifeTurnHarness";

let db: Db = freshDb();

vi.mock("@/lib/backend", async () => {
  const { fakeBackend: make } = await import("./lifeTurnHarness");
  return make(() => db);
});

// travel.ts imports the adapter's modules directly rather than its index.
vi.mock("@/lib/backend/campaigns", async () => {
  const { fakeBackend: make } = await import("./lifeTurnHarness");
  return make(() => db);
});
vi.mock("@/lib/backend/life", async () => {
  const { fakeBackend: make } = await import("./lifeTurnHarness");
  return make(() => db);
});

vi.mock("../lifeTurn.server", async () => {
  const { normalizeLifeResponse } = await import("../lifeResponse");
  return {
    lifeTurnFn: async ({ data }: { data: { userPrompt: string } }) => {
      db.prompts.push(data.userPrompt);
      const wire = db.replies.shift();
      if (!wire) throw new Error("The model was asked for a turn the test did not script.");
      return {
        ...normalizeLifeResponse(wire, { onWarn: () => {} }),
        provenance: {
          narrator: "life",
          promptVersion: "test",
          model: "test-model",
          servedModel: "test-model",
        },
      };
    },
  };
});

// The night's own dice. Pinned so a turn cannot have a job ring in or a
// stranger walk up by chance.
vi.mock("@/features/campaign/oracles", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  askOracle: vi.fn(async () => {}),
  answerPendingQuestion: vi.fn(async () => null),
  consultWire: vi.fn(async () => ({ offered: false })),
  consultStreet: vi.fn(async () => null),
  spendWire: vi.fn(async () => {}),
}));
vi.mock("@/features/campaign/worldTick", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  runWorldTick: vi.fn(async () => {}),
}));

const { liveTurn, loadLife } = await import("../lifeOps");
const { CAST_SEED_FLAG, lifepathTiesFrom } = await import("@/features/campaign/castSeeding");

/** The campaign's six, seeded the way `ensureCast` would, from a fixed seed. */
function seedCast(target: Db, seed = 4242): void {
  const cast = generateCast({ seed, ties: lifepathTiesFrom(target.character) });
  for (const member of cast) {
    target.npcs.push({
      id: `npc-${member.key}`,
      campaign_id: CAMPAIGN_ID,
      npc_id: member.key,
      name: member.name,
      disposition: member.disposition,
      status: "alive",
      location: null,
      notes: null,
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
      data: {
        role: member.role,
        standing: member.standing,
        tie: member.tie,
        dossier: member.dossier,
        known: [],
        lastSeenDay: 0,
      } as unknown as Json,
    } as unknown as CampaignNpc);
  }
  target.flags.push({
    id: "flag-cast",
    campaign_id: CAMPAIGN_ID,
    flag: CAST_SEED_FLAG,
    value: seed as unknown as Json,
  });
}

function setup(over: Parameters<typeof freshDb>[0] = {}): void {
  db = freshDb(over);
  seedCast(db);
}

const ofType = (type: string) => db.events.filter((e) => e.type === type);
const types = () => db.events.map((e) => e.type);
const clockOf = () => ({ day: db.campaign.day, minute: db.campaign.minute });

beforeEach(() => setup());

describe("a plain narration turn", () => {
  it("writes what the player said, then the narration, and charges the engine's clamp of the time", async () => {
    // The model claims a whole day went by on a look round the market.
    db.replies.push(reply({ timeSpent: 5000 }));
    const bundle = await loadLife(CAMPAIGN_ID);
    const before = clockOf();

    await liveTurn(bundle, "I look around the stalls.");

    expect(types().indexOf("player_input")).toBeGreaterThanOrEqual(0);
    expect(types().indexOf("player_input")).toBeLessThan(types().indexOf("life_narration"));
    expect(ofType("player_input")[0]!.summary).toBe("I look around the stalls.");
    const narration = ofType("life_narration")[0]!;
    expect(narration.summary).toBe("They look around.");
    // Where and when it was written: what makes the next turn the same scene.
    expect(narration.data).toMatchObject({ at: "o3", day: before.day });
    // Provenance rides on the narration row.
    expect(JSON.stringify(narration.data)).toContain("test-model");

    const spent = (clockOf().day - before.day) * 24 * 60 + clockOf().minute - before.minute;
    expect(spent).toBe(MAX_ACTION_MINUTES);
    expect(spent).toBeLessThan(5000);
  });

  it("charges what the engine already decided the turn costs over what the model says", async () => {
    db.replies.push(reply({ timeSpent: 200 }));
    const bundle = await loadLife(CAMPAIGN_ID);
    const before = clockOf();

    await liveTurn(bundle, "I grab a coffee.", { minutes: 15 });

    expect(clockOf()).toEqual({ day: before.day, minute: before.minute + 15 });
  });

  // Without `minutes: 0`: the turn itself refuses to spend time on an options
  // turn, rather than relying on the screen to pass zero.
  it("an options turn writes a life_options row and moves neither clock nor money", async () => {
    db.replies.push(
      reply({
        timeSpent: 120,
        proposedActions: [{ kind: "spend", amount: 50, reason: "noodles" }],
        actions: [{ label: "Eat", description: "Noodles", timeMinutes: 20, knownCost: 10 }],
      }),
    );
    const bundle = await loadLife(CAMPAIGN_ID);
    const before = clockOf();

    await liveTurn(bundle, "", { options: true });

    expect(ofType("life_options")).toHaveLength(1);
    expect(ofType("life_narration")).toHaveLength(0);
    expect(ofType("player_input")).toHaveLength(0);
    expect(ofType("life_action")).toHaveLength(0);
    expect(clockOf()).toEqual(before);
    expect(db.vitals.eurobucks).toBe(500);
  });

  it("ignores a disposition change for a person the campaign does not have", async () => {
    const real = db.npcs[0]!;
    db.replies.push(
      reply({
        deltas: [
          { kind: "npc_disposition", npcKey: "made_up_stranger", delta: 2 },
          { kind: "npc_disposition", npcKey: real.npc_id, delta: 9 },
        ],
      }),
    );
    const before = db.npcs.map((n) => n.disposition);
    const bundle = await loadLife(CAMPAIGN_ID);

    await liveTurn(bundle, "I nod at them.");

    expect(db.npcs).toHaveLength(6);
    expect(db.npcs.some((n) => n.npc_id === "made_up_stranger")).toBe(false);
    // The real one moved, and only as far as the column's -3..3 allows.
    expect(db.npcs[0]!.disposition).toBe(3);
    expect(db.npcs.slice(1).map((n) => n.disposition)).toEqual(before.slice(1));
  });
});

describe("spending", () => {
  it("debits what the character pays for", async () => {
    db.replies.push(
      reply({ proposedActions: [{ kind: "spend", amount: 30, reason: "a bowl of noodles" }] }),
    );
    await liveTurn(await loadLife(CAMPAIGN_ID), "I buy noodles.");

    expect(db.vitals.eurobucks).toBe(470);
    expect(ofType("life_action")[0]).toMatchObject({ data: { amount: 30 } });
    expect(ofType("action_refused")).toHaveLength(0);
  });

  it("refuses a spend the character cannot afford and never goes negative", async () => {
    setup({ eurobucks: 20 });
    db.replies.push(reply({ proposedActions: [{ kind: "spend", amount: 400, reason: "a gun" }] }));
    await liveTurn(await loadLife(CAMPAIGN_ID), "I buy the pistol.");

    expect(db.vitals.eurobucks).toBe(20);
    expect(ofType("action_refused")).toHaveLength(1);
    expect(ofType("action_refused")[0]!.data).toMatchObject({ code: "resource_unavailable" });
    expect(ofType("life_action")).toHaveLength(0);
  });

  it("refuses an option card's printed price the character cannot meet", async () => {
    setup({ eurobucks: 5 });
    db.replies.push(reply());
    await liveTurn(await loadLife(CAMPAIGN_ID), "Eat", {
      spend: { amount: 10, reason: "noodles" },
    });

    expect(db.vitals.eurobucks).toBe(5);
    expect(ofType("action_refused")).toHaveLength(1);
  });

  // The capability snapshot is built once, from the balance the turn started
  // with. Each spend is now judged against what is left, so a second one the
  // first made unaffordable is refused rather than quietly cut down to the
  // balance ("Paid 20eb" for a 50eb hat).
  it("refuses a second spend that the first one left unaffordable", async () => {
    setup({ eurobucks: 100 });
    db.replies.push(
      reply({
        proposedActions: [
          { kind: "spend", amount: 80, reason: "a jacket" },
          { kind: "spend", amount: 50, reason: "a hat" },
        ],
      }),
    );
    await liveTurn(await loadLife(CAMPAIGN_ID), "I buy a jacket and a hat.");

    expect(db.vitals.eurobucks).toBe(20);
    expect(ofType("action_refused")).toHaveLength(1);
    expect(ofType("life_action").map((e) => (e.data as { amount: number }).amount)).toEqual([80]);
  });
});

describe("spend, then pay the bills, in one turn", () => {
  /** Day 61 with nothing paid: one month owed past the free first one. */
  function billsTotal(): number {
    const view = downtimeView({
      campaign: db.campaign,
      vitals: db.vitals,
      character: db.character,
      inventory: [],
      restDays: 0,
    });
    return view.bills.total;
  }

  it("prices the bills against what is left after the spend", async () => {
    setup({ day: 61, eurobucks: 5000 });
    const total = billsTotal();
    expect(total).toBeGreaterThan(0);
    db.replies.push(
      reply({
        proposedActions: [{ kind: "spend", amount: 100, reason: "a round" }, { kind: "pay_bills" }],
      }),
    );
    await liveTurn(await loadLife(CAMPAIGN_ID), "I buy a round, then pay the rent.");

    expect(db.vitals.eurobucks).toBe(5000 - 100 - total);
    expect(ofType("downtime_bills")).toHaveLength(1);
    expect(db.campaign.bills_paid_through_day).toBe(60);
    expect(ofType("action_refused")).toHaveLength(0);
  });

  it("refuses a bill the spend has left them unable to pay, and keeps the spend", async () => {
    setup({ day: 61 });
    const total = billsTotal();
    // Enough for the bills alone, not for the bills after the spend.
    const start = total + 50;
    db.vitals.eurobucks = start;
    db.replies.push(
      reply({
        proposedActions: [{ kind: "spend", amount: 100, reason: "a round" }, { kind: "pay_bills" }],
      }),
    );
    await liveTurn(await loadLife(CAMPAIGN_ID), "I buy a round, then pay the rent.");

    expect(db.vitals.eurobucks).toBe(start - 100);
    expect(ofType("downtime_bills")).toHaveLength(0);
    const refused = ofType("action_refused");
    expect(refused).toHaveLength(1);
    expect(refused[0]!.summary).toContain(`${total}eb`);
    expect(refused[0]!.summary).toContain(`${start - 100}eb`);
    expect(db.campaign.bills_paid_through_day).toBe(0);
  });
});

describe("browsing", () => {
  it("opens the seller where the character stands, and charges no time for looking", async () => {
    const vendor = shopsAt("o3")[0]!;
    db.replies.push(reply({ timeSpent: 60, proposedActions: [{ kind: "browse" }] }));
    const before = clockOf();
    await liveTurn(await loadLife(CAMPAIGN_ID), "What have you got?");

    const browsed = ofType(LEDGER_EVENTS.shopBrowsed);
    expect(browsed).toHaveLength(1);
    expect(readShopBrowsedEventData(browsed[0]!.data)).toMatchObject({
      vendorId: vendor.id,
      day: before.day,
    });
    expect(ofType("travelled")).toHaveLength(0);
    expect(clockOf()).toEqual(before);
  });

  it("goes to a seller named elsewhere first, then opens it once, on arrival", async () => {
    setup({ location: "d3" });
    db.replies.push(
      reply({ proposedActions: [{ kind: "browse", seller: "Ganymede" }] }),
      // The arrival, narrated as a continuation of the same words. It proposes
      // the browse again; the Counter must not be opened twice.
      reply({ resolution: "They arrive.", proposedActions: [{ kind: "browse" }] }),
    );
    await liveTurn(await loadLife(CAMPAIGN_ID), "Show me what Ganymede has.");

    expect(db.campaign.location_key).toBe("o3");
    const travelled = ofType("travelled");
    expect(travelled).toHaveLength(1);
    const browsed = ofType(LEDGER_EVENTS.shopBrowsed);
    expect(browsed).toHaveLength(1);
    expect(types().indexOf("travelled")).toBeLessThan(types().indexOf(LEDGER_EVENTS.shopBrowsed));
    expect(readShopBrowsedEventData(browsed[0]!.data)?.vendorId).toMatch(/@o3$/);
    // Two model calls: the turn, and the arrival.
    expect(db.prompts).toHaveLength(2);
    // Being there is the beginning of knowing it.
    expect(db.places.find((p) => p.place_key === "o3")?.visits).toBe(1);
  });
});

describe("a turn about somebody's own story", () => {
  it("keeps lastSeenDay and the arc's progress on the person's row", async () => {
    const npc = db.npcs.find((n) => (n.data as { role: string }).role === "friend") ?? db.npcs[0]!;
    const key = npc.npc_id!;
    const arc = arcFor((npc.data as { role: never }).role, `${CAMPAIGN_ID}:${key}`)!;
    expect(arc).toBeTruthy();
    const state = { ...freshArcState(arc), stage: 1, lastDay: 2 };
    npc.data = { ...(npc.data as object), arc: state } as unknown as Json;
    db.situations.push({
      id: "sit-arc",
      campaign_id: CAMPAIGN_ID,
      situation_key: `arc_${key}`,
      category: "person",
      title: `${npc.name} needs a word`,
      summary: "They have been calling.",
      npc_key: key,
      status: "live",
      severity: 5,
      due_day: null,
      last_shown_day: null,
      data: { arcId: arc.id, stage: 1 } as unknown as Json,
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
    } as never);

    const bundle = await loadLife(CAMPAIGN_ID);
    const current = bundle.situations.find((s) => s.key === `arc_${key}`)!;
    expect(current).toBeTruthy();
    db.replies.push(reply());
    await liveTurn({ ...bundle, current }, `I call ${npc.name} back.`);

    const row = db.npcs.find((n) => n.npc_id === key)!;
    const data = row.data as { lastSeenDay?: number; arc?: unknown };
    expect(data.lastSeenDay).toBe(bundle.clock.day);
    const saved = readArcState(data.arc)!;
    expect(saved.id).toBe(getArc(arc.id)!.id);
    expect(saved.stage).toBe(1);
    expect(saved.involved).toBe(true);
    // The dossier survived both writes.
    expect((row.data as { dossier?: unknown }).dossier).toBeTruthy();
    expect(db.situations.find((s) => s.situation_key === `arc_${key}`)?.status).toBe("resolved");
  });

  it("does not count opening the moment as dealing with them", async () => {
    const npc = db.npcs[0]!;
    db.situations.push({
      id: "sit-p",
      campaign_id: CAMPAIGN_ID,
      situation_key: `arc_${npc.npc_id}`,
      category: "person",
      title: "A call",
      summary: null,
      npc_key: npc.npc_id,
      status: "live",
      severity: 5,
      due_day: null,
      last_shown_day: null,
      data: {},
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
    } as never);
    const bundle = await loadLife(CAMPAIGN_ID);
    const current = bundle.situations.find((s) => s.key === `arc_${npc.npc_id}`)!;
    db.replies.push(reply());
    await liveTurn({ ...bundle, current }, "");

    expect((db.npcs[0]!.data as { lastSeenDay: number }).lastSeenDay).toBe(0);
    expect(db.npcWrites).toHaveLength(0);
  });
});

describe("a check the model proposes", () => {
  it("becomes a check card at a published DV, whatever number the model chose", async () => {
    // Snapped twice on purpose: once by the normalizer, once again where the
    // card is written. Both must land on the ladder.
    db.replies.push(
      reply({
        proposedActions: [
          { kind: "skill_check", skillId: "perception", dv: 14, intent: "Spot the tail" },
        ],
      }),
    );
    await liveTurn(await loadLife(CAMPAIGN_ID), "Is anyone following me?");

    const prompts = ofType("check_prompt");
    expect(prompts).toHaveLength(1);
    const data = prompts[0]!.data as { skillId: string; dv: number; intent: string };
    expect(data.skillId).toBe("perception");
    expect(DV_BANDS.map((b) => b.dv)).toContain(data.dv);
    expect(data.dv).not.toBe(14);
    expect(prompts[0]!.summary).toContain(`DV ${data.dv}`);
    expect(data.intent).toBe("Spot the tail");
    // Nothing was rolled: the card waits for the player.
    expect(ofType(LEDGER_EVENTS.skillCheck)).toHaveLength(0);
  });

  it("drops a check on a Skill that does not exist", async () => {
    db.replies.push(
      reply({ proposedActions: [{ kind: "skill_check", skillId: "telekinesis", dv: 15 }] }),
    );
    await liveTurn(await loadLife(CAMPAIGN_ID), "I move the cup with my mind.");

    expect(ofType("check_prompt")).toHaveLength(0);
  });
});

describe("the body's own clock", () => {
  it("a night's sleep moves the clock by the hours slept, not the model's minutes, and opens a day", async () => {
    db.replies.push(reply({ timeSpent: 30, proposedActions: [{ kind: "rest", hours: 8 }] }));
    const before = clockOf();
    await liveTurn(await loadLife(CAMPAIGN_ID), "I go home and sleep.");

    const after = clockOf();
    expect((after.day - before.day) * 24 * 60 + after.minute - before.minute).toBe(8 * 60);
    expect(ofType("day_began")).toHaveLength(1);
    expect(ofType("day_began")[0]!.summary).toBe(`Day ${before.day + 1}`);
  });

  it("a trip to nowhere is refused, stays put, and is narrated as a fixed result", async () => {
    db.replies.push(
      reply({ proposedActions: [{ kind: "travel", destination: "the lost city of Atlantis" }] }),
      reply({
        resolution: "They do not go.",
        proposedActions: [{ kind: "spend", amount: 100, reason: "should never apply" }],
      }),
    );
    await liveTurn(await loadLife(CAMPAIGN_ID), "Take me to Atlantis.");

    expect(db.campaign.location_key).toBe("o3");
    expect(ofType("travelled")).toHaveLength(0);
    expect(ofType("action_refused")).toHaveLength(1);
    // The follow-up was asked for and wrote prose only.
    expect(db.prompts).toHaveLength(2);
    expect(ofType("life_narration")).toHaveLength(2);
    expect(db.vitals.eurobucks).toBe(500);
  });
});

describe("what the model cannot do", () => {
  it("cannot put a job on the table on a night the wire said was quiet", async () => {
    db.replies.push(reply({ proposedActions: [{ kind: "hook_offer" }] }));
    await liveTurn(await loadLife(CAMPAIGN_ID), "Any work going?");

    expect(ofType("hook_offered")).toHaveLength(0);
    expect(ofType("action_refused")[0]?.data).toMatchObject({ code: "no_work" });
    expect(db.campaign.phase).toBe("life");
  });

  it("a fixed-result follow-up applies nothing the model attached to it", async () => {
    db.replies.push(
      reply({
        timeSpent: 300,
        proposedActions: [{ kind: "spend", amount: 100, reason: "x" }],
        deltas: [{ kind: "set_flag", flag: "model_flag" }],
      }),
    );
    const before = clockOf();
    await liveTurn(await loadLife(CAMPAIGN_ID), "", {
      fixedResult: true,
      minutes: 0,
      resolved: "It is done.",
    });

    expect(ofType("life_narration")).toHaveLength(1);
    expect(db.vitals.eurobucks).toBe(500);
    expect(db.flags.some((f) => f.flag === "model_flag")).toBe(false);
    expect(clockOf()).toEqual(before);
  });
});
