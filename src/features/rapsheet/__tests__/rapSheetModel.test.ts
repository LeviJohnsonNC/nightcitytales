/**
 * A Rap Sheet is made to be posted. These hold what it may say: only what the
 * game holds, nothing that identifies the account, and nothing about a campaign
 * that is not behind the card.
 */
import { describe, expect, it } from "vitest";
import { STAT_ORDER } from "@/engine";
import type { FullCharacter } from "@/lib/backend";
import {
  MAX_CHROME,
  MAX_SKILLS,
  RAP_FORMATS,
  fileNumber,
  rapSheet,
  sourceFromCampaign,
  sourceFromCharacter,
  themeFor,
} from "../rapSheetModel";

const CHARACTER_ID = "11111111-2222-3333-4444-555555555555";
const USER_ID = "99999999-aaaa-bbbb-cccc-dddddddddddd";

const STATS = {
  int: 6,
  ref: 8,
  dex: 7,
  tech: 5,
  cool: 6,
  will: 6,
  luck: 4,
  move: 6,
  body: 7,
  emp: 3,
};

const entry = (tableId: string, value: string) => ({ tableId, value, rollIndex: 1 });

function character(over: Record<string, unknown> = {}): FullCharacter {
  return {
    character: {
      id: CHARACTER_ID,
      user_id: USER_ID,
      name: "Vincent Kang",
      handle: "Velvet",
      role: "solo",
      portrait_path: `${USER_ID}/draft/take.png`,
    },
    stats: STATS,
    skills: [
      { skill_id: "handgun", level: 6, specialization: null },
      { skill_id: "athletics", level: 6, specialization: null },
      { skill_id: "brawling", level: 4, specialization: null },
      { skill_id: "stealth", level: 4, specialization: null },
      { skill_id: "perception", level: 0, specialization: null },
      { skill_id: "not_a_printed_skill", level: 5, specialization: null },
    ],
    roleAbility: { rank: 4 },
    gear: [],
    cyberware: [],
    lifepath: {
      general: {
        entries: {
          personality: entry("personality", "Shy and secretive"),
          value_most: entry("value_most", "Honor"),
          life_goals: entry("life_goals", "To live down the shame of a past mistake"),
        },
        identity: { sex: "male", age: 71 },
        castPlan: { seed: 7, picks: {} },
      },
    },
    finance: { home_district_key: "little_europe" },
    ...over,
  } as unknown as FullCharacter;
}

const sheet = (c = character()) => rapSheet(sourceFromCharacter(c));

describe("a file that is open", () => {
  it("is a saved character with no campaign, and claims no campaign facts", () => {
    const s = sheet();
    expect(s).toMatchObject({
      status: "open",
      stamp: "FILE OPEN",
      handle: "Velvet",
      name: "Vincent Kang",
      role: "Solo",
      roleId: "solo",
    });
    expect(s.record).toEqual([]);
    expect(s.knownFor).toBeNull();
    expect(s.wantedBy).toEqual([]);
  });

  it("lists the ten STATs in the printed order, on the sheet's own colours", () => {
    const s = sheet();
    expect(s.stats.map((x) => x.key)).toEqual(STAT_ORDER);
    expect(s.stats.find((x) => x.key === "ref")).toMatchObject({
      label: "REF",
      value: 8,
      fraction: 1,
    });
    expect(s.stats.find((x) => x.key === "emp")?.fraction).toBeCloseTo(1 / 6);
    expect(s.stats.every((x) => /^hsl\(/.test(x.color))).toBe(true);
  });

  it("names the edge and the weak spot the character sheet names", () => {
    const s = sheet();
    expect(s.edge).toContain("REF 8");
    expect(s.weak).toBe("EMP 3");
  });

  it("says neither when no STAT stands out", () => {
    const even = { ...STATS, ref: 5, dex: 5, body: 5, emp: 5 };
    const s = sheet(character({ stats: even }));
    expect(s.edge).toBeNull();
    expect(s.weak).toBeNull();
  });

  it("takes the three best Skills, by Level then by the Role's own list, and skips the unlearned", () => {
    const s = sheet();
    expect(s.skills).toHaveLength(MAX_SKILLS);
    expect(s.skills.map((k) => k.level)).toEqual([6, 6, 5]);
    expect(s.skills.map((k) => k.name)).not.toContain("Perception");
  });

  it("does not fall over a Skill the printed list does not have", () => {
    expect(() => sheet()).not.toThrow();
    expect(sheet().skills.some((k) => k.name === "not_a_printed_skill")).toBe(true);
  });

  it("names the Role Ability with its Rank", () => {
    expect(sheet().ability).toEqual({ name: "Combat Awareness", rank: 4 });
  });

  it("reads the Lifepath under the file's own headings", () => {
    expect(sheet().notes).toEqual([
      { label: "TEMPERAMENT", value: "Shy and secretive" },
      { label: "VALUES", value: "Honor" },
      { label: "WANTS", value: "To live down the shame of a past mistake" },
    ]);
  });

  it("says how they read, in a band, never the age", () => {
    const s = sheet();
    expect(s.readsAs).toBeTruthy();
    expect(s.readsAs).not.toMatch(/71/);
  });

  it("puts the six people on the file, in order, with a face where the atlas has one", () => {
    const s = sheet();
    expect(s.associates).toHaveLength(6);
    expect(s.associates.map((a) => a.relation)).toEqual([
      "FIXER",
      "RIPPERDOC",
      "LANDLORD",
      "FRIEND",
      "ENEMY",
      "OLD FLAME",
    ]);
    const enemy = s.associates.find((a) => a.relation === "ENEMY")!;
    expect(enemy.tone).toBe("bad");
    expect(s.associates.find((a) => a.relation === "FRIEND")?.tone).toBe("good");
    for (const a of s.associates) {
      if (a.image) expect(a.image).toMatch(/^\/images\/cast\/[\w-]+\.webp$/);
    }
  });

  it("shows where they come from when nothing says where they are", () => {
    expect(sheet().lastSeen).toEqual({ label: "HOME TURF", value: expect.any(String) });
  });

  it("carries no associates for a character created before the cast was planned", () => {
    const old = character();
    (old.lifepath as unknown as { general: Record<string, unknown> }).general = { entries: {} };
    expect(sheet(old).associates).toEqual([]);
  });
});

describe("chrome", () => {
  it("names what is installed and counts the rest", () => {
    const rows = ["cyberarm", "cybereye", "neural_link", "sandevistan"].map((item_id) => ({
      item_id,
    }));
    const s = sheet(character({ cyberware: rows }));
    expect(s.chrome.length).toBeLessThanOrEqual(MAX_CHROME + 1);
  });

  it("skips a row that names chrome the catalogue does not know", () => {
    const s = sheet(character({ cyberware: [{ item_id: "a label from a legacy row" }] }));
    expect(s.chrome).toEqual([]);
  });
});

describe("what a card must never carry", () => {
  it("has no id of the character or the account anywhere in it", () => {
    const text = JSON.stringify(sheet());
    expect(text).not.toContain(CHARACTER_ID);
    expect(text).not.toContain(USER_ID);
  });

  it("knows there is a picture without carrying the path it is stored under", () => {
    // The path holds the account's id. It stays on the SOURCE, for the one place
    // that fetches the picture, and the sheet that gets passed around only knows
    // that there is one.
    expect(sheet().hasPortrait).toBe(true);
    expect(sourceFromCharacter(character()).portraitPath).toBe(`${USER_ID}/draft/take.png`);
    expect(JSON.stringify(sheet())).not.toMatch(/token=|https?:\/\//);
    const none = character();
    (none.character as unknown as { portrait_path: string | null }).portrait_path = null;
    expect(sheet(none).hasPortrait).toBe(false);
  });

  it("is the same file number every time, formatted like a case number, and means nothing", () => {
    expect(fileNumber(CHARACTER_ID)).toBe(fileNumber(CHARACTER_ID));
    expect(fileNumber(CHARACTER_ID)).toMatch(/^NCT-\d{4}-\d{4}$/);
    expect(fileNumber("another")).not.toBe(fileNumber(CHARACTER_ID));
    expect(fileNumber(CHARACTER_ID)).not.toContain(CHARACTER_ID.slice(0, 8));
  });

  it("falls back to the name when there is no handle, and never to nothing", () => {
    const noHandle = character();
    (noHandle.character as unknown as { handle: string | null }).handle = null;
    expect(sheet(noHandle).handle).toBe("Vincent Kang");
    const nameless = character();
    (nameless.character as unknown as { handle: string | null; name: string }).handle = " ";
    (nameless.character as unknown as { name: string }).name = " ";
    expect(sheet(nameless).handle).toBe("Nobody");
  });

  it("names the picture file after the handle, safely", () => {
    const odd = character();
    (odd.character as unknown as { handle: string }).handle = "Ghost/../Girl!";
    expect(sheet(odd).filename).toBe("ghost-girl-rap-sheet.png");
  });
});

describe("a file with a campaign behind it", () => {
  const live = (over: Record<string, unknown> = {}) =>
    rapSheet(
      sourceFromCampaign({
        character: character(),
        campaign: { day: 41, location_key: null },
        chrome: [],
        npcs: [
          { name: "Maelcum", disposition: 3, status: "alive", data: { role: "friend" } },
          { name: "Trace", disposition: -3, status: "alive", data: { role: "enemy" } },
          { name: "A Stranger", disposition: 3, status: "alive", data: {} },
        ] as never,
        standings: [
          { factionId: "militech", standing: -5 },
          { factionId: "trauma_team", standing: 3 },
        ] as never,
        tally: { jobsFinished: 6, bodies: 4 },
        reputation: { level: 4, whoKnows: "Stories are all over the local area." },
        dead: false,
        ...over,
      }),
    );

  it("is ACTIVE, with the record only a campaign can give", () => {
    const s = live();
    expect(s).toMatchObject({ status: "active", stamp: "ACTIVE" });
    expect(s.record).toEqual([
      { label: "DAYS", value: "41" },
      { label: "JOBS", value: "6" },
      { label: "BODIES", value: "4" },
    ]);
    expect(s.knownFor).toEqual({ level: 4, line: "Stories are all over the local area." });
  });

  it("skips bodies when there are none, and fame when there is none", () => {
    const s = live({
      tally: { jobsFinished: 0, bodies: 0 },
      reputation: { level: 0, whoKnows: null },
    });
    expect(s.record.map((r) => r.label)).toEqual(["DAYS", "JOBS"]);
    expect(s.knownFor).toBeNull();
  });

  it("is wanted only by those who would start trouble on sight", () => {
    expect(live().wantedBy).toEqual(["Militech"]);
  });

  it("carries the people as they stand NOW, and only the standing six", () => {
    const s = live();
    expect(s.associates.map((a) => a.name)).toEqual(["Maelcum", "Trace"]);
    expect(s.associates[1]?.tone).toBe("bad");
  });

  it("is FLATLINED when the character is dead, and a dead friend reads as dead", () => {
    const s = live({
      dead: true,
      npcs: [
        { name: "Maelcum", disposition: 3, status: "dead", data: { role: "friend" } },
      ] as never,
    });
    expect(s).toMatchObject({ status: "flatlined", stamp: "FLATLINED" });
    expect(s.associates[0]?.tone).toBe("dead");
  });

  it("carries the chrome the character has NOW, not the saved sheet's", () => {
    const s = rapSheet(
      sourceFromCampaign({
        character: character({ cyberware: [{ item_id: "cyberarm" }] }),
        campaign: { day: 2, location_key: null },
        chrome: [],
        npcs: [],
        standings: [],
        tally: { jobsFinished: 0, bodies: 0 },
        reputation: { level: 0, whoKnows: null },
        dead: false,
      }),
    );
    expect(s.chrome).toEqual([]);
  });
});

describe("looks", () => {
  it("gives every Role its own colour, and a fallback for one it does not know", () => {
    const accents = new Set(
      [
        "solo",
        "netrunner",
        "tech",
        "fixer",
        "rockerboy",
        "nomad",
        "media",
        "medtech",
        "exec",
        "lawman",
      ].map((r) => themeFor(r).accent),
    );
    expect(accents.size).toBe(10);
    expect(themeFor(null)).toEqual(themeFor("nonsense"));
  });

  it("has the two shapes people post", () => {
    expect(RAP_FORMATS.post).toMatchObject({ width: 1080, height: 1350 });
    expect(RAP_FORMATS.story).toMatchObject({ width: 1080, height: 1920 });
  });
});
