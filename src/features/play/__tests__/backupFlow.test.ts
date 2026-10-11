/**
 * A Lawman's Backup, from a landed call to the group standing in the fight.
 *
 * The printed Combat Number is the whole of a Backup member's attack base, so
 * what matters is that REF + attack Skill (what combatFlow rolls with) comes to
 * exactly that number, that they arrive beside the player and inside the arena,
 * and that every member is written so the fight survives a reload.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const added: { encounterId: string; row: Record<string, unknown> }[] = [];
const events: Record<string, unknown>[] = [];
const saved: unknown[] = [];

vi.mock("@/lib/backend", () => ({
  addCombatant: vi.fn(async (encounterId: string, row: Record<string, unknown>) => {
    added.push({ encounterId, row });
    return row;
  }),
  appendCampaignEvent: vi.fn(async (row: Record<string, unknown>) => {
    events.push(row);
    return row;
  }),
}));
vi.mock("@/features/campaign/encounterState", () => ({
  saveLiveEncounter: vi.fn(async (live: unknown) => {
    saved.push(live);
    return { ...(live as object), version: 1 };
  }),
}));

const { arriveBackup, pendingBackupFrom } = await import("../backupFlow");
const { BACKUP_TIERS, arenaFor, clampToArena, composeScene, readBattlefieldPositions } =
  await import("@/engine");
import type { BackupCall, BackupTier } from "@/engine";
import type { LiveEncounter } from "@/features/campaign/encounterState";

const tier = (name: string): BackupTier => {
  const found = BACKUP_TIERS.find((t) => t.name.includes(name));
  if (!found) throw new Error(`no tier ${name}`);
  return found;
};

const call = (over: Partial<BackupCall> = {}): BackupCall => ({
  responseRoll: 2,
  responded: true,
  arrivalRoll: 3,
  roundsUntilArrival: 3,
  tier: BACKUP_TIERS[0]!,
  tierUp: false,
  groups: 1,
  ...over,
});

function fight(playerAt: { x: number; y: number } | null): LiveEncounter {
  const body = (id: string, isPlayer: boolean) => ({
    id,
    name: isPlayer ? "Vela" : "Scav",
    side: isPlayer ? "friendly" : "hostile",
    isPlayer,
    ref: 6,
    body: 6,
    hpMax: 35,
    hp: 35,
    seriouslyWoundedThreshold: 18,
    woundState: "none",
    deathSavePenalty: 0,
    spHead: 7,
    spBody: 7,
    defeated: false,
    initiative: isPlayer ? 9 : 14,
  });
  const data = (key: string, position: { x: number; y: number }) => ({
    key,
    weaponName: "pistol",
    damageDice: 2,
    rangeType: "pistol",
    position,
    move: 6,
    attackSkill: 4,
  });
  return {
    id: "enc-1",
    arena: arenaFor("street").key,
    cover: {},
    version: 0,
    state: {
      round: 2,
      order: ["h", "p"],
      activeIndex: 1,
      status: "active",
      combatants: { p: body("p", true), h: body("h", false) },
    },
    data: {
      ...(playerAt ? { p: data("player", playerAt) } : {}),
      h: data("scav_1", { x: 21, y: 21 }),
    },
  } as unknown as LiveEncounter;
}

beforeEach(() => {
  added.length = 0;
  events.length = 0;
  saved.length = 0;
});

describe("pendingBackupFrom", () => {
  it("is due on the current Round plus the rolled delay", () => {
    expect(pendingBackupFrom(call({ roundsUntilArrival: 4 }), 3)).toEqual({
      tierName: BACKUP_TIERS[0]!.name,
      arrivesOnRound: 7,
      groups: 1,
    });
  });

  it("carries two groups when the call says two", () => {
    expect(pendingBackupFrom(call({ groups: 2 }), 1)?.groups).toBe(2);
  });

  it("leaves nothing behind when nobody answered", () => {
    expect(
      pendingBackupFrom(
        call({ responded: false, tier: null, roundsUntilArrival: null, groups: 0 }),
        2,
      ),
    ).toBeNull();
  });

  it("leaves nothing behind for an incomplete answer", () => {
    expect(pendingBackupFrom(call({ tier: null }), 2)).toBeNull();
    expect(pendingBackupFrom(call({ roundsUntilArrival: null }), 2)).toBeNull();
  });
});

describe("arriveBackup", () => {
  it("brings in count × groups friendly members and writes each one", async () => {
    const t = tier("Corporate");
    const { live } = await arriveBackup({
      campaignId: "c",
      beatId: null,
      live: fight({ x: 9, y: 9 }),
      tier: t,
      groups: 2,
    });
    const members = Object.values(live.state.combatants).filter(
      (c) => !c.isPlayer && c.side === "friendly",
    );
    expect(members).toHaveLength(t.count * 2);
    expect(added).toHaveLength(t.count * 2);
    expect(added.every((a) => a.encounterId === "enc-1")).toBe(true);
    // Everyone took a place in the Initiative order.
    for (const m of members) {
      expect(live.state.order).toContain(m.id);
      expect(m.initiative).not.toBeNull();
    }
    // The fight was saved once with every member's data, and the save's version carried forward.
    expect(saved).toHaveLength(1);
    expect(live.version).toBe(1);
    for (const m of members) expect(live.data[m.id]).toBeDefined();
  });

  it("treats groups below one as one group", async () => {
    const t = tier("Corporate");
    await arriveBackup({
      campaignId: "c",
      beatId: null,
      live: fight({ x: 9, y: 9 }),
      tier: t,
      groups: 0,
    });
    expect(added).toHaveLength(t.count);
  });

  it("gives every member the printed Combat Number as their whole attack base", async () => {
    for (const t of BACKUP_TIERS) {
      added.length = 0;
      const { live } = await arriveBackup({
        campaignId: "c",
        beatId: null,
        live: fight({ x: 9, y: 9 }),
        tier: t,
        groups: 1,
      });
      for (const { row } of added) {
        const id = row["id"] as string;
        const combatant = live.state.combatants[id]!;
        const data = live.data[id]!;
        // combatFlow rolls REF + attackSkill; that must be the printed number, not more.
        expect(combatant.ref + data.attackSkill, t.name).toBe(t.combat);
        expect(combatant.body).toBe(t.body);
        expect(combatant.hp).toBe(t.hp);
        expect(combatant.hpMax).toBe(t.hp);
        expect(combatant.seriouslyWoundedThreshold).toBe(Math.ceil(t.hp / 2));
        expect(combatant.spHead).toBe(t.sp);
        expect(combatant.spBody).toBe(t.sp);
        expect(data.move).toBe(t.move);
        expect(row["is_player"]).toBe(false);
        expect(row["side"]).toBe("friendly");
      }
    }
  });

  it("numbers members of a multi-person tier and gives each a distinct key", async () => {
    const t = BACKUP_TIERS.find((x) => x.count > 1)!;
    const { live } = await arriveBackup({
      campaignId: "c",
      beatId: null,
      live: fight({ x: 9, y: 9 }),
      tier: t,
      groups: 1,
    });
    const names = added.map((a) => a.row["name"]);
    expect(names).toEqual(Array.from({ length: t.count }, (_, i) => `${t.name} ${i + 1}`));
    const keys = added.map((a) => live.data[a.row["id"] as string]!.key);
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys.every((k) => /^backup-[a-z0-9-]+-\d+$/.test(k))).toBe(true);
  });

  it("names a lone member by the tier alone", async () => {
    const t = BACKUP_TIERS.find((x) => x.count === 1);
    if (!t) return;
    await arriveBackup({
      campaignId: "c",
      beatId: null,
      live: fight({ x: 9, y: 9 }),
      tier: t,
      groups: 1,
    });
    expect(added[0]!.row["name"]).toBe(t.name);
  });

  it("spreads members either side of the player, two metres apart, on the player's line", async () => {
    const t = tier("Corporate");
    const { live } = await arriveBackup({
      campaignId: "c",
      beatId: null,
      live: fight({ x: 9, y: 9 }),
      tier: t,
      groups: 1,
    });
    const spots = added.map((a) => live.data[a.row["id"] as string]!.position);
    expect(spots).toEqual([
      { x: 11, y: 9 },
      { x: 7, y: 9 },
      { x: 13, y: 9 },
      { x: 5, y: 9 },
    ]);
  });

  it("rallies on the arena's player start when the player has no position", async () => {
    const t = tier("Corporate");
    const arena = arenaFor("street");
    const { live } = await arriveBackup({
      campaignId: "c",
      beatId: null,
      live: fight(null),
      tier: t,
      groups: 1,
    });
    const first = live.data[added[0]!.row["id"] as string]!.position;
    expect(first).toEqual(
      clampToArena(arena, { x: arena.playerStart.x + 2, y: arena.playerStart.y }),
    );
  });

  it("never places anybody outside the arena", async () => {
    const arena = arenaFor("street");
    const t = tier("Corporate");
    const { live } = await arriveBackup({
      campaignId: "c",
      beatId: null,
      live: fight({ x: 1, y: 1 }),
      tier: t,
      groups: 2,
    });
    for (const { row } of added) {
      const p = live.data[row["id"] as string]!.position;
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.x).toBeLessThanOrEqual(arena.extent.width);
      expect(p.y).toBeGreaterThanOrEqual(0);
      expect(p.y).toBeLessThanOrEqual(arena.extent.height);
    }
  });

  // Clamping was once the only placement rule: at an arena edge several members
  // were clamped onto one point, off the odd-centred grid a scene-backed fight
  // requires. Each now takes the nearest free square (`freeTileNear`).
  it("never stacks two members on one spot at an arena edge", async () => {
    const t = tier("Corporate");
    const { live } = await arriveBackup({
      campaignId: "c",
      beatId: null,
      live: fight({ x: 1, y: 1 }),
      tier: t,
      groups: 2,
    });
    const spots = added.map((a) => JSON.stringify(live.data[a.row["id"] as string]!.position));
    expect(new Set(spots).size).toBe(spots.length);
  });

  // On a scene-backed fight the saved layout is the authority, and liveFrom
  // re-reads every position through readBattlefieldPositions on load. Backup
  // once landed on blocked or shared squares, and the fight could not reload.
  it("leaves a scene-backed fight that its own loader can read back", async () => {
    const layout = composeScene("office", 1).layout;
    const live = {
      ...fight(layout.arena.playerStart),
      layout,
      data: { p: { ...fight(layout.arena.playerStart).data["p"]! } },
    } as LiveEncounter;
    delete (live.state.combatants as Record<string, unknown>)["h"];
    live.state.order = ["p"];
    live.state.activeIndex = 0;
    const result = await arriveBackup({
      campaignId: "c",
      beatId: null,
      live,
      tier: tier("Corporate"),
      groups: 1,
    });
    expect(() =>
      readBattlefieldPositions(
        layout,
        Object.values(result.live.data).map((d) => d.position),
        {},
      ),
    ).not.toThrow();
  });

  it("records who turned up, against the beat when there is one", async () => {
    const t = tier("Corporate");
    const { line } = await arriveBackup({
      campaignId: "c",
      beatId: "b1",
      live: fight({ x: 9, y: 9 }),
      tier: t,
      groups: 1,
    });
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      campaign_id: "c",
      type: "backup_arrived",
      beat_id: "b1",
      data: { tier: t.name, members: t.count },
      summary: line,
    });
    expect(line).toContain(t.name);
    expect(line).toContain(`Combat ${t.combat}`);
    expect(line).toContain(`SP ${t.sp}`);
    expect(line).toContain(`HP ${t.hp}`);
  });

  it("omits the beat id when there is none", async () => {
    await arriveBackup({
      campaignId: "c",
      beatId: null,
      live: fight({ x: 9, y: 9 }),
      tier: tier("Corporate"),
      groups: 1,
    });
    expect(events[0]).not.toHaveProperty("beat_id");
  });

  it("writes the ledger only after the fight is saved", async () => {
    const order: string[] = [];
    const backend = await import("@/lib/backend");
    const state = await import("@/features/campaign/encounterState");
    vi.mocked(state.saveLiveEncounter).mockImplementationOnce(async (live) => {
      order.push("save");
      return live;
    });
    vi.mocked(backend.appendCampaignEvent).mockImplementationOnce(async (row) => {
      order.push("event");
      return row as never;
    });
    await arriveBackup({
      campaignId: "c",
      beatId: null,
      live: fight({ x: 9, y: 9 }),
      tier: tier("Corporate"),
      groups: 1,
    });
    expect(order).toEqual(["save", "event"]);
  });
});
