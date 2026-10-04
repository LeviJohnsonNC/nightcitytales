/**
 * The obituary reads the ledger back. These build the rows with the SAME
 * writers combat uses (`attackEvent`, `deathSaveEvent`), so a field renamed on
 * one side fails here rather than printing an empty receipt at the worst moment
 * a campaign has.
 */
import { describe, expect, it } from "vitest";
import type { CampaignEvent, CampaignNpc } from "@/lib/backend";
import { attackEvent, deathSaveEvent } from "../combatLog";
import { LAST_WORDS_MAX, MOURNERS_SHOWN, obituary, type ObituaryInput } from "../obituary";

const NAME = "Vincent Kang";

let seq = 0;
const row = (insert: Record<string, unknown>): CampaignEvent =>
  ({
    id: `e${(seq += 1)}`,
    seq,
    created_at: "2026-10-04T00:00:00Z",
    beat_id: null,
    roll: null,
    summary: null,
    data: {},
    ...insert,
  }) as unknown as CampaignEvent;

/** A hit as combat writes it: through `attackEvent`, never spelled by hand. */
const hitOn = (target: string, attacker: string, over: Record<string, unknown> = {}) =>
  row(
    attackEvent(
      "c1",
      {
        attack: {
          hit: true,
          margin: 3,
          formula: "d10(7) + REF 6 + Handgun 4 = 17 vs DV 13",
        } as never,
        damage: { total: 11 } as never,
        applied: {
          damageThroughArmor: 7,
          bonusDamage: 3,
          hpAfter: 2,
          totalHpLoss: 14,
          spBefore: 7,
          spAfter: 6,
          ablated: true,
          criticalInjury: true,
          ...over,
        } as never,
      },
      { attackerName: attacker, targetName: target, weapon: "Heavy Pistol", armorLocation: "head" },
    ),
  );

const missBy = (attacker: string, target: string) =>
  row(
    attackEvent(
      "c1",
      { attack: { hit: false, margin: -2, formula: "d10(2) + REF 6 = 8 vs DV 13" } as never },
      { attackerName: attacker, targetName: target, weapon: "Assault Rifle" },
    ),
  );

const failedSave = () =>
  row(
    deathSaveEvent(
      "c1",
      { roll: 7, penalty: 2, effective: 9, autoFail: false, survived: false, penaltyAfter: 3 },
      { combatantName: NAME, died: true },
    ),
  );

const npc = (name: string, disposition: number, role?: string, status = "alive"): CampaignNpc =>
  ({
    id: name,
    name,
    npc_id: name.toLowerCase(),
    disposition,
    status,
    data: role ? { role } : {},
  }) as unknown as CampaignNpc;

const base = (over: Partial<ObituaryInput> = {}): ObituaryInput => ({
  name: NAME,
  roleId: "solo",
  day: 41,
  minute: 130,
  locationKey: null,
  unfinishedJob: null,
  tally: { jobsTaken: 7, jobsFinished: 6, jobsDeclined: 2, bodies: 4 },
  reputation: { level: 4, whoKnows: "Everyone in the neighbourhood" },
  eurobucks: 1240,
  events: [],
  npcs: [],
  standings: [],
  ...over,
});

describe("the epitaph and the record", () => {
  it("says how far they got and what they finished", () => {
    const o = obituary(base());
    expect(o.epitaph).toBe("Vincent Kang made it to day 41 and finished 6 jobs.");
    expect(o.when).toBe("Day 41 · Saturday · 2:10 AM");
    expect(o.role).toBe("Solo");
  });

  it("is plain about a run that never finished a job, or never saw a second day", () => {
    expect(
      obituary(base({ tally: { jobsTaken: 1, jobsFinished: 0, jobsDeclined: 0, bodies: 0 } }))
        .epitaph,
    ).toBe("Vincent Kang made it to day 41, and never finished a job.");
    expect(obituary(base({ day: 1 })).epitaph).toBe(
      "Vincent Kang did not see a second day in Night City.",
    );
    expect(
      obituary(base({ tally: { jobsTaken: 1, jobsFinished: 1, jobsDeclined: 0, bodies: 0 } }))
        .epitaph,
    ).toContain("1 job.");
  });

  it("keeps losses beside gains, and invents no row for nothing", () => {
    const o = obituary(
      base({
        unfinishedJob: "A Night at the Opera",
        standings: [
          { factionId: "militech", standing: -4 },
          { factionId: "trauma_team", standing: 2 },
        ] as never,
      }),
    );
    const text = o.record.map((r) => r.text);
    expect(text).toContain("7 jobs taken, 6 finished, 1 left unfinished");
    expect(text).toContain("Died on the job: A Night at the Opera");
    expect(text).toContain("4 people died on their jobs");
    expect(text).toContain("Reputation 4: Everyone in the neighbourhood");
    expect(text).toContain("Died with 1240eb to their name");
    expect(o.record.find((r) => r.text.startsWith("Died on the job"))?.tone).toBe("bad");

    const bare = obituary(
      base({
        tally: { jobsTaken: 0, jobsFinished: 0, jobsDeclined: 0, bodies: 0 },
        reputation: { level: 0, whoKnows: null },
        eurobucks: 0,
      }),
    );
    expect(bare.record).toEqual([]);
  });
});

describe("the receipts", () => {
  it("reads the last hit the character took, off the row combat wrote", () => {
    const o = obituary(
      base({
        events: [hitOn(NAME, "Tyger Claw Gunman"), missBy("Tyger Claw Gunman", NAME), failedSave()],
      }),
    );
    expect(o.lastBlow).toMatchObject({ title: "The last hit you took" });
    expect(o.lastBlow?.trace).toContain("vs DV 13");
    const rows = Object.fromEntries(o.lastBlow!.rows.map((r) => [r.label, r.value]));
    expect(rows["Hit by"]).toBe("Tyger Claw Gunman · Heavy Pistol");
    expect(rows["Damage rolled"]).toBe("11");
    expect(rows["Armor (head)"]).toBe("7 SP, worn to 6");
    expect(rows["Through the armor"]).toBe("7 + 3 bonus");
    expect(rows["Hit Points"]).toBe("16 → 2");
    expect(rows["Critical Injury"]).toBe("yes");
  });

  it("does not mistake a miss, or somebody else's wound, for the blow that did it", () => {
    const o = obituary(
      base({ events: [hitOn("Somebody Else", "Vincent Kang"), missBy("Gunman", NAME)] }),
    );
    expect(o.lastBlow).toBeNull();
  });

  it("takes the NEWEST hit, however the rows were handed over", () => {
    const early = hitOn(NAME, "First Shooter");
    const late = hitOn(NAME, "Last Shooter");
    const o = obituary(base({ events: [late, early] }));
    expect(o.lastBlow?.rows[0]?.value).toContain("Last Shooter");
  });

  it("carries the failed Death Save with the engine's own line", () => {
    const o = obituary(base({ events: [failedSave()] }));
    expect(o.finalSave?.trace).toContain("DEAD");
    expect(o.finalSave?.rows).toContainEqual({ label: "Rolled", value: "d10 7 + 2 penalty = 9" });
  });

  it("ignores a Death Save that was survived", () => {
    const survived = row(
      deathSaveEvent(
        "c1",
        { roll: 2, penalty: 0, effective: 2, autoFail: false, survived: true, penaltyAfter: 1 },
        { combatantName: NAME, died: false },
      ),
    );
    expect(obituary(base({ events: [survived] })).finalSave).toBeNull();
  });

  it("names the character's own last shot, hit or miss", () => {
    const o = obituary(base({ events: [missBy(NAME, "Gunman")] }));
    expect(o.lastShot?.rows).toContainEqual({ label: "Result", value: "missed" });
    expect(o.lastShot?.rows[0]).toEqual({ label: "At", value: "Gunman · Assault Rifle" });
  });

  it("has no receipts for a death with no combat on the ledger", () => {
    const o = obituary(base({ events: [] }));
    expect(o.lastBlow).toBeNull();
    expect(o.finalSave).toBeNull();
    expect(o.lastShot).toBeNull();
  });
});

describe("last words", () => {
  it("is the last thing the player had the character do, verbatim", () => {
    const o = obituary(
      base({
        events: [
          row({ type: "player_input", summary: "I check the exits." }),
          row({ type: "player_input", summary: "I kick the door in." }),
          row({ type: "narration", summary: "The door gives." }),
        ],
      }),
    );
    expect(o.lastWords).toBe("I kick the door in.");
  });

  it("is cut to a line, and absent when nobody typed anything", () => {
    const long = "x".repeat(LAST_WORDS_MAX * 3);
    const o = obituary(base({ events: [row({ type: "player_input", summary: long })] }));
    expect(o.lastWords!.length).toBe(LAST_WORDS_MAX);
    expect(o.lastWords!.endsWith("…")).toBe(true);
    expect(obituary(base()).lastWords).toBeNull();
  });
});

describe("who is left", () => {
  it("names the standing six in the order their loss is felt, in words and never numbers", () => {
    const o = obituary(
      base({
        npcs: [
          npc("Kiro", 1, "fixer"),
          npc("Maelcum", 3, "friend"),
          npc("Trace", -3, "enemy"),
          npc("Alt", 2, "old_flame"),
        ],
      }),
    );
    expect(o.mourners.map((m) => m.name)).toEqual(["Maelcum", "Alt", "Kiro", "Trace"]);
    expect(o.mourners[0]).toMatchObject({
      relation: "your friend",
      feeling: "devoted",
      tone: "good",
    });
    expect(o.mourners[3]).toMatchObject({ feeling: "hostile", tone: "bad" });
    expect(JSON.stringify(o.mourners)).not.toMatch(/-3|"disposition"/);
  });

  it("says when somebody is already dead, and lets a stranger in only on strong feeling", () => {
    const o = obituary(
      base({
        npcs: [npc("Maelcum", 3, "friend", "dead"), npc("Barkeep", 1), npc("Debt Collector", -3)],
      }),
    );
    expect(o.mourners.map((m) => m.name)).toEqual(["Maelcum", "Debt Collector"]);
    expect(o.mourners[0]?.feeling).toBe("already dead");
  });

  it("is a eulogy, not a directory", () => {
    const crowd = Array.from({ length: 12 }, (_, i) => npc(`Person ${i}`, 3));
    expect(obituary(base({ npcs: crowd })).mourners).toHaveLength(MOURNERS_SHOWN);
  });
});

describe("where", () => {
  it("names the place from the atlas, or nothing", () => {
    expect(obituary(base({ locationKey: null })).where).toBeNull();
    expect(obituary(base({ locationKey: "no_such_place_anywhere" })).where).toBeNull();
  });
});
