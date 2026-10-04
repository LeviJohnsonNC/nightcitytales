/**
 * The Screamsheet is a newspaper over a ledger. These hold the three promises
 * that make it one: it says only what the engine recorded, it names the
 * character only when the engine says they were named, and it can never be
 * left behind by a flag the engine learns to set.
 */
import { describe, expect, it } from "vitest";
import placeState from "@/data/atlas/place-state.json";
import screamsheetData from "@/data/atlas/screamsheet.json";
import { PLACE_FLAGS } from "../placeState";
import { getPlace } from "../geography";
import { placeChangedEventData } from "../ledger";
import { REPUTATION } from "../rulesData";
import {
  JOB_HEADLINE_ORDER,
  PRINTED_FLAGS,
  SCREAMSHEET_IS_HOUSE_RULE,
  UNPRINTED_FLAGS,
  groupByDay,
  newestSeq,
  screamsheet,
  unseenCount,
  type SheetEvent,
} from "../screamsheet";

const PLACE = "a1";
const PLACE_NAME = getPlace(PLACE)!.name;
const HANDLE = "Velvet";

let seq = 0;
const row = (type: string, data: unknown, id?: string): SheetEvent => {
  seq += 1;
  return { id: id ?? `e${seq}`, seq, type, data };
};

const placeChanged = (
  flag: string,
  over: { set?: boolean; day?: number; placeKey?: string } = {},
) =>
  row(
    "place_changed",
    placeChangedEventData({
      placeKey: over.placeKey ?? PLACE,
      flag,
      set: over.set ?? true,
      ...(over.day !== undefined ? { day: over.day } : {}),
    }),
  );

/** A settled job as `settle_job` stores it: the receipt, whole. */
const settled = (
  noticed: Partial<Record<string, number>>,
  over: { agreed?: number; day?: number; placeKey?: string | null; missionId?: string } = {},
) =>
  row("job_settled", {
    findings: Object.entries(noticed).map(([observation, count]) => ({
      observation,
      count,
      because: "x",
    })),
    payment: { agreed: over.agreed ?? 500, paid: over.agreed ?? 500 },
    ...(over.day !== undefined ? { day: over.day } : {}),
    ...(over.placeKey !== undefined ? { placeKey: over.placeKey } : { placeKey: PLACE }),
    ...(over.missionId ? { missionId: over.missionId } : {}),
  });

const sheet = (events: SheetEvent[]) => screamsheet({ events, handle: HANDLE });

describe("the data file", () => {
  it("is a house rule, and says it is", () => {
    expect(SCREAMSHEET_IS_HOUSE_RULE).toBe(true);
    expect(screamsheetData.houseRule).toBe(true);
  });

  it("has a headline for every flag the engine can SET, so a new one cannot be forgotten", () => {
    const setByEngine = new Set(
      (placeState as unknown as { thresholds: { sets: string[] }[] }).thresholds.flatMap(
        (t) => t.sets,
      ),
    );
    for (const flag of setByEngine) expect(PRINTED_FLAGS).toContain(flag);
  });

  it("accounts for every flag a place may carry: printed, or unprinted with a reason", () => {
    for (const flag of PLACE_FLAGS) {
      const accounted = PRINTED_FLAGS.includes(flag) || flag in UNPRINTED_FLAGS;
      expect(accounted, `${flag} is neither printed nor explained`).toBe(true);
      if (flag in UNPRINTED_FLAGS) expect(UNPRINTED_FLAGS[flag]!.length).toBeGreaterThan(20);
    }
    // And nothing is printed that is not a flag.
    for (const flag of PRINTED_FLAGS) expect(PLACE_FLAGS).toContain(flag);
  });

  it("has a headline for every loud thing a job can leave behind", () => {
    for (const observation of JOB_HEADLINE_ORDER) {
      const group = (screamsheetData.jobs as Record<string, { items: unknown[] }>)[observation];
      expect(group?.items.length, observation).toBeGreaterThan(0);
    }
  });

  it("covers every Reputation Level the press covers, with a printed line to quote", () => {
    // Levels 1 and 2 are the people who were there and their friends: not news.
    for (const level of REPUTATION.levels.filter((l) => l.level >= 3)) {
      const band = screamsheetData.fame.find((b) => level.level >= b.from && level.level <= b.to);
      expect(band, `Level ${level.level}`).toBeDefined();
    }
  });

  it("adds no fact: no digit, no quotation, no money in any template", () => {
    const templates: string[] = [];
    const walk = (value: unknown) => {
      if (typeof value === "string") templates.push(value);
      else if (Array.isArray(value)) value.forEach(walk);
      else if (value && typeof value === "object") Object.values(value).forEach(walk);
    };
    const { houseRule: _h, note: _n, unprinted: _u, ...printed } = screamsheetData;
    walk(printed);
    expect(templates.length).toBeGreaterThan(40);
    for (const text of templates) {
      expect(text, text).not.toMatch(/\d/);
      expect(text, text).not.toMatch(/["“”]/);
      expect(text, text).not.toMatch(/\beb\b|\$|€/i);
    }
  });

  it("uses only tokens the engine fills", () => {
    const allowed = new Set(["place", "handle", "count", "who", "ladder"]);
    const seen = JSON.stringify(screamsheetData).match(/\{(\w+)\}/g) ?? [];
    for (const token of seen) expect(allowed.has(token.slice(1, -1)), token).toBe(true);
  });
});

describe("what a place printing looks like", () => {
  it("prints a flag the place gained, under the day it happened", () => {
    const [item] = sheet([placeChanged("raided", { day: 12 })]);
    expect(item).toMatchObject({ kind: "place", tone: "bad", day: 12, placeKey: PLACE });
    expect(item!.headline).toContain(PLACE_NAME);
    expect(item!.placeName).toBe(PLACE_NAME);
  });

  it("does not print a flag the place lost, nor one it has no headline for", () => {
    expect(sheet([placeChanged("market_open", { set: false })])).toEqual([]);
    expect(sheet([placeChanged("rebuilt")])).toEqual([]);
    expect(sheet([placeChanged("made_up_flag")])).toEqual([]);
  });

  it("will not print a place the atlas does not know", () => {
    expect(sheet([placeChanged("raided", { placeKey: "zz99" })])).toEqual([]);
  });

  it("labels every item with a kicker, the way a tabloid does", () => {
    const items = sheet([placeChanged("raided"), settled({ killed: 1, seen: 1, loud: 1 })]);
    for (const item of items) expect(item.kicker).toMatch(/^[A-Z][A-Z ]+$/);
    expect(items.find((i) => i.kind === "place")?.kicker).toBe("RAID");
    expect(items.find((i) => i.kind === "job")?.kicker).toBe("BODIES");
  });

  it("reports a flag gained on a good day as good", () => {
    expect(sheet([placeChanged("welcome")])[0]?.tone).toBe("good");
  });

  it("carries a row written before days were kept, undated", () => {
    expect(sheet([placeChanged("shut")])[0]?.day).toBeNull();
  });

  it("is told the same way every time it is opened", () => {
    const events = [placeChanged("raided"), placeChanged("shut"), placeChanged("under_audit")];
    expect(sheet(events)).toEqual(sheet([...events].reverse()));
    expect(sheet(events)).toEqual(sheet(events));
  });

  it("can choose between wordings of the same fact, by its own row", () => {
    const wordings = new Set<string>();
    for (let i = 0; i < 40; i += 1) {
      wordings.add(sheet([placeChanged("raided")])[0]!.headline.replace(PLACE_NAME, "X"));
    }
    expect(wordings.size).toBeGreaterThan(1);
  });
});

describe("what a job prints", () => {
  it("leads with the loudest thing it left behind, counted honestly", () => {
    const [job] = sheet([settled({ killed: 2, loud: 1, seen: 1 })]);
    expect(job).toMatchObject({ kind: "job", tone: "bad", placeKey: PLACE });
    expect(job!.headline).toMatch(/Two|dead|Bodies/);
    expect(job!.headline + (job!.deck ?? "")).toContain("Two");
  });

  it("says 'at least four' when the count has hit the cap, never a number it cannot back", () => {
    const text = sheet([settled({ killed: 4 })])
      .map((i) => `${i.headline} ${i.deck ?? ""}`)
      .join(" ");
    expect(text).toContain("At least four");
    expect(text).not.toMatch(/\d/);
  });

  it("names the character only when the engine says somebody said the name", () => {
    const named = sheet([settled({ loud: 1, named: 1 })])[0]!;
    expect(named.deck).toContain(`Heard on the street: ${HANDLE}.`);
    const unnamed = sheet([settled({ loud: 1, seen: 1 })])[0]!;
    expect(unnamed.deck).not.toContain(HANDLE);
    expect(unnamed.deck).toContain("clear look");
    const nobody = sheet([settled({ loud: 1 })])[0]!;
    expect(nobody.deck).not.toContain(HANDLE);
    expect(nobody.deck).toContain("name");
  });

  it("prints nothing for a job nobody can place the character at", () => {
    expect(sheet([settled({ clean: 1 })])).toEqual([]);
    expect(sheet([settled({ clean: 1, loud: 1 })])).toEqual([]);
    expect(sheet([settled({})])).toEqual([]);
  });

  it("prints a favour as good news and never says nobody knew the name when it was a favour", () => {
    const [job] = sheet([settled({ favour: 1 })]);
    expect(job?.tone).toBe("good");
    expect(job?.deck ?? "").not.toMatch(/Nobody has put a name/);
  });

  it("falls back to the job's own mission when the receipt predates the venue", () => {
    // An authored mission names its venue; a receipt from before it was kept does not.
    const events = [
      row("mission_started", { missionId: "no_such_mission" }),
      settled({ loud: 1 }, { placeKey: null }),
    ];
    const [job] = sheet(events);
    expect(job?.placeKey).toBeNull();
    expect(job?.headline).toContain("an address in Night City");
  });

  it("never leaves a token unfilled", () => {
    const events = [
      settled({ killed: 1, named: 1 }),
      settled({ burned: 1 }),
      settled({ property: 1 }),
      settled({ loud: 1 }),
      settled({ wounded: 1 }),
      settled({ witness: 1 }),
      settled({ seen: 1 }),
      settled({ favour: 1 }),
      placeChanged("raided"),
    ];
    for (const item of sheet(events)) {
      expect(`${item.headline} ${item.deck ?? ""}`).not.toMatch(/[{}]/);
    }
  });
});

describe("fame", () => {
  it("announces a Reputation Level once, on the job that earned it, quoting the printed ladder", () => {
    const events = [settled({ loud: 1, seen: 1 }), settled({ loud: 1, seen: 1 })];
    const fame = sheet(events).filter((i) => i.kind === "fame");
    expect(fame).toHaveLength(1);
    expect(fame[0]!.seq).toBe(events[0]!.seq);
    const ladder = REPUTATION.levels.find((l) => l.level === 3)!.whoKnows;
    expect(fame[0]!.deck).toBe(ladder);
    expect(fame[0]!.tone).toBe("good");
  });

  it("announces a higher Level only when the deed is higher", () => {
    const events = [
      settled({ loud: 1, seen: 1 }),
      settled({ loud: 1, seen: 1, named: 1, killed: 3 }, { agreed: 3000 }),
      settled({ loud: 1, seen: 1 }),
    ];
    const levels = sheet(events)
      .filter((i) => i.kind === "fame")
      .map((i) => i.deck);
    expect(levels).toHaveLength(2);
    expect(new Set(levels).size).toBe(2);
  });

  it("keeps the name out of print below Level 5, where the ladder first says it, unless it was said", () => {
    const quiet = sheet([settled({ loud: 1, seen: 1 })]).find((i) => i.kind === "fame")!;
    expect(quiet.headline).toContain("a runner");
    expect(quiet.headline).not.toContain(HANDLE);
    const said = sheet([settled({ loud: 1, named: 1 })]).find((i) => i.kind === "fame")!;
    expect(said.headline).toContain(HANDLE);
  });

  it("never has to put a name into a headline that is about a runner nobody has named", () => {
    // A band that can print "a runner" must read as a sentence with it: no band
    // that starts before the name is out (Level 5) may use a "The name {who}" line.
    const bands = screamsheetData.fame as { from: number; to: number; items: { h: string }[] }[];
    for (const band of bands.filter((b) => b.from < 5)) {
      expect(band.to).toBeLessThan(5);
      for (const item of band.items) expect(item.h).not.toMatch(/^The name \{who\}/);
    }
  });

  it("is not printed for the first small jobs, which only the people who were there know", () => {
    // Reputation 1 and 2 are a deed to the engine and not news to anybody.
    expect(sheet([settled({})]).some((i) => i.kind === "fame")).toBe(false);
    expect(sheet([settled({ loud: 1 })]).some((i) => i.kind === "fame")).toBe(false);
  });

  it("prints a clean job's fame never, since it earns none", () => {
    expect(sheet([settled({ clean: 1 })]).some((i) => i.kind === "fame")).toBe(false);
  });
});

describe("the sheet as a whole", () => {
  it("is empty when nothing has happened, which is the honest answer", () => {
    expect(sheet([])).toEqual([]);
    expect(sheet([row("narration", {}), row("player_input", {})])).toEqual([]);
  });

  it("is newest first, a job before the fame it earned, and capped", () => {
    const events = [placeChanged("raided"), settled({ loud: 1, seen: 1 }), placeChanged("shut")];
    const items = sheet(events);
    expect(items.map((i) => i.seq)).toEqual([...items.map((i) => i.seq)].sort((a, b) => b - a));
    const sameRow = sheet([settled({ loud: 1, seen: 1 })]);
    expect(sameRow.map((i) => i.kind)).toEqual(["job", "fame"]);
    expect(screamsheet({ events, handle: HANDLE, limit: 2 })).toHaveLength(2);
  });

  it("groups by the morning, newest first, undated rows last", () => {
    const items = sheet([
      placeChanged("raided", { day: 3 }),
      placeChanged("shut", { day: 9 }),
      placeChanged("under_audit"),
      placeChanged("locked_down", { day: 9 }),
    ]);
    const groups = groupByDay(items);
    expect(groups.map((g) => g.day)).toEqual([9, 3, null]);
    expect(groups[0]!.items).toHaveLength(2);
  });

  it("counts what a reader has not seen yet", () => {
    const items = sheet([placeChanged("raided"), placeChanged("shut"), placeChanged("welcome")]);
    expect(unseenCount(items, null)).toBe(3);
    expect(unseenCount(items, newestSeq(items))).toBe(0);
    expect(unseenCount(items, items[2]!.seq)).toBe(2);
    expect(newestSeq([])).toBeNull();
  });

  it("falls back to a handle that is not blank", () => {
    const items = screamsheet({ events: [settled({ loud: 1, named: 1 })], handle: "   " });
    expect(items[0]!.deck).toContain("a runner");
  });
});
