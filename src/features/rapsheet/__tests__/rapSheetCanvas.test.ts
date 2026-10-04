/**
 * The card is drawn onto a context, so a context that only writes down what it
 * is asked is enough to hold the promises that matter: every field is set, no
 * text ever leaves the card whatever it is made of, a missing picture is a
 * placeholder and not an error, and the same file draws the same card.
 *
 * What this cannot hold is how it LOOKS, which was checked by rendering the
 * fullest card there can be (and one made of absurd text) in a real browser.
 */
import { describe, expect, it } from "vitest";
import {
  RAP_FORMATS,
  rapSheet,
  sourceFromCampaign,
  sourceFromCharacter,
  type RapFormat,
} from "../rapSheetModel";
import { drawRapSheet, type RapAssets } from "../rapSheetCanvas";
import type { FullCharacter } from "@/lib/backend";

type Call = { name: string; args: unknown[] };
type Drawn = { text: string; x: number; y: number; width: number; align: string; size: number };

/** A context that remembers. `measureText` is a stand-in: wider than most real fonts. */
function recorder() {
  const calls: Call[] = [];
  const texts: Drawn[] = [];
  const state: Record<string, unknown> = { font: "400 10px x", textAlign: "left", tx: 0, ty: 0 };
  const stack: Record<string, unknown>[] = [];
  const widthOf = (text: string) => {
    const size = Number(/(\d+)px/.exec(String(state["font"]))?.[1] ?? 10);
    const spacing = Number(/(-?[\d.]+)px/.exec(String(state["letterSpacing"] ?? "0px"))?.[1] ?? 0);
    return text.length * (size * 0.62 + spacing);
  };
  const gradient = { addColorStop: () => {} };
  const methods: Record<string, (...args: unknown[]) => unknown> = {
    save: () => void stack.push({ ...state }),
    restore: () => void Object.assign(state, stack.pop() ?? {}),
    // Translation is followed, so a stamp drawn inside a moved origin is judged
    // where it lands on the card and not where it was asked for. Rotation is not:
    // the tilts are a few degrees and move a line by far less than the margin.
    translate: (x: unknown, y: unknown) => {
      state["tx"] = Number(state["tx"]) + Number(x);
      state["ty"] = Number(state["ty"]) + Number(y);
    },
    measureText: (text: unknown) => ({ width: widthOf(String(text)) }),
    createRadialGradient: () => gradient,
    createLinearGradient: () => gradient,
    fillText: (text: unknown, x: unknown, y: unknown) => {
      const t = String(text);
      texts.push({
        text: t,
        x: Number(x) + Number(state["tx"]),
        y: Number(y) + Number(state["ty"]),
        width: widthOf(t),
        align: String(state["textAlign"]),
        size: Number(/(\d+)px/.exec(String(state["font"]))?.[1] ?? 0),
      });
    },
  };
  const ctx = new Proxy(state, {
    get(target, prop: string) {
      if (prop in methods) {
        return (...args: unknown[]) => {
          calls.push({ name: prop, args });
          return methods[prop]!(...args);
        };
      }
      if (prop in target) return target[prop];
      // Anything else a context can do is a no-op that is still written down.
      return (...args: unknown[]) => void calls.push({ name: prop, args });
    },
    set(target, prop: string, value) {
      target[prop] = value;
      return true;
    },
    has: () => true,
  }) as unknown as CanvasRenderingContext2D;
  return { ctx, calls, texts, state };
}

const fakeImage = { naturalWidth: 640, naturalHeight: 960 } as unknown as CanvasImageSource;

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

function character(over: { handle?: string; name?: string; wants?: string } = {}): FullCharacter {
  return {
    character: {
      id: "c-1",
      name: over.name ?? "Vincent Kang",
      handle: over.handle ?? "Velvet",
      role: "solo",
      portrait_path: "u/d/t.png",
    },
    stats: STATS,
    skills: [
      { skill_id: "handgun", level: 6, specialization: null },
      { skill_id: "athletics", level: 6, specialization: null },
      { skill_id: "brawling", level: 4, specialization: null },
    ],
    roleAbility: { rank: 4 },
    gear: [],
    cyberware: [],
    lifepath: {
      general: {
        entries: {
          personality: entry("personality", "Shy and secretive"),
          value_most: entry("value_most", "Honor"),
          life_goals: entry("life_goals", over.wants ?? "To live down the shame of a past mistake"),
        },
        identity: { sex: "female", age: 34 },
        castPlan: { seed: 7, picks: {} },
      },
    },
    finance: { home_district_key: "little_europe" },
  } as unknown as FullCharacter;
}

const campaignSheet = (dead = false, c = character()) =>
  rapSheet(
    sourceFromCampaign({
      character: c,
      campaign: { day: 41, location_key: "a1" },
      chrome: [{ item_id: "cyberarm" }, { item_id: "cybereye" }],
      npcs: [
        {
          name: "Nnamdi Cole",
          disposition: 3,
          status: dead ? "dead" : "alive",
          data: { role: "friend" },
        },
        { name: "Ilsa Bräun", disposition: 2, status: "alive", data: { role: "fixer" } },
        {
          name: 'Corrado "Razor" Villanueva',
          disposition: -3,
          status: "alive",
          data: { role: "enemy" },
        },
      ] as never,
      standings: [{ factionId: "militech", standing: -5 }] as never,
      tally: { jobsFinished: 6, bodies: 4 },
      reputation: { level: 4, whoKnows: "Stories are all over the local area." },
      dead,
    }),
  );

const FORMATS: RapFormat[] = ["post", "story"];
const none: RapAssets = { portrait: null, faces: {} };

function draw(sheet = campaignSheet(), format: RapFormat = "post", assets: RapAssets = none) {
  const r = recorder();
  drawRapSheet(r.ctx, sheet, assets, format);
  return r;
}

describe("everything on the sheet is drawn", () => {
  for (const format of FORMATS) {
    it(`sets every field on the ${format}`, () => {
      const sheet = campaignSheet();
      const said = draw(sheet, format).texts.map((t) => t.text);
      for (const expected of [
        "RAP SHEET",
        "Velvet",
        "Vincent Kang",
        "SOLO",
        sheet.stamp,
        `FILE NO. ${sheet.fileNo}`,
        "STATS",
        "KNOWN ASSOCIATES",
        "Nnamdi Cole",
        "FRIEND",
        "ENEMY",
        "MEET YOUR FIXER",
      ]) {
        expect(said, expected).toContain(expected);
      }
      for (const stat of sheet.stats) {
        expect(said).toContain(stat.label);
        expect(said).toContain(String(stat.value));
      }
      expect(said.join(" ")).toContain("Combat Awareness");
      expect(said.join(" ")).toContain("MILITECH");
      expect(said.join(" ")).toContain("NIGHTCITYTALES.LOVABLE.APP");
    });
  }

  it("sets the Lifepath on the story, under its own heading", () => {
    const said = draw(campaignSheet(), "story").texts.map((t) => t.text);
    expect(said).toContain("ON THE RECORD");
    expect(said).toContain("TEMPERAMENT");
    expect(said).toContain("Shy and secretive");
  });

  it("puts the days, jobs and bodies on the card of somebody who has lived them", () => {
    const post = draw(campaignSheet(), "post").texts.map((t) => t.text);
    expect(post.join(" ")).toMatch(/41 DAYS · 6 JOBS · 4 BODIES/);
    const story = draw(campaignSheet(), "story").texts.map((t) => t.text);
    expect(story).toContain("41");
    expect(story).toContain("DAYS");
  });

  it("says nothing about a campaign for a file that is open", () => {
    const open = rapSheet(sourceFromCharacter(character()));
    const said = draw(open, "post")
      .texts.map((t) => t.text)
      .join(" ");
    expect(said).toContain("FILE OPEN");
    expect(said).not.toMatch(/DAYS|JOBS|BODIES|WANTED BY|REPUTATION/);
  });
});

describe("nothing leaves the card", () => {
  const within = (texts: Drawn[], format: RapFormat) => {
    const { width, height } = RAP_FORMATS[format];
    for (const t of texts) {
      const left =
        t.align === "right" ? t.x - t.width : t.align === "center" ? t.x - t.width / 2 : t.x;
      const right = left + t.width;
      expect(left, `${t.text} left`).toBeGreaterThanOrEqual(0);
      expect(right, `${t.text} right`).toBeLessThanOrEqual(width);
      expect(t.y, `${t.text} y`).toBeGreaterThan(0);
      expect(t.y, `${t.text} y`).toBeLessThan(height);
    }
  };

  for (const format of FORMATS) {
    it(`keeps an ordinary ${format} on the card`, () => {
      within(draw(campaignSheet(), format).texts, format);
    });

    it(`keeps an absurd ${format} on the card`, () => {
      const long =
        "The Ghost Of A Girl Who Never Existed At All And Never Will, Not Ever, Not Once";
      const sheet = campaignSheet(
        false,
        character({
          handle: long,
          name: `${long} ${long}`,
          wants: `${long} ${long} ${long}`,
        }),
      );
      within(draw(sheet, format).texts, format);
    });
  }

  it("never cuts a word down to nothing", () => {
    const sheet = campaignSheet(false, character({ handle: "X".repeat(200) }));
    for (const t of draw(sheet, "post").texts) expect(t.text.length).toBeGreaterThan(0);
  });
});

describe("pictures", () => {
  it("draws the portrait and every face it was handed", () => {
    const sheet = campaignSheet();
    const faces = Object.fromEntries(
      sheet.associates.flatMap((a) => (a.image ? [[a.image, fakeImage]] : [])),
    );
    const { calls } = draw(sheet, "post", { portrait: fakeImage, faces });
    const drawn = calls.filter((c) => c.name === "drawImage").length;
    expect(drawn).toBe(1 + Object.keys(faces).length);
    expect(Object.keys(faces).length).toBeGreaterThan(0);
  });

  it("is a placeholder, not an error, when a picture did not load", () => {
    const r = draw(campaignSheet(), "post", none);
    expect(r.calls.filter((c) => c.name === "drawImage")).toHaveLength(0);
    // The initial stands in for the face.
    expect(r.texts.map((t) => t.text)).toContain("V");
  });
});

describe("the look follows the file", () => {
  it("drains the picture of somebody who is gone, and not of somebody who is not", () => {
    const drained = (dead: boolean) => {
      const r = recorder();
      const modes: unknown[] = [];
      const handler = new Proxy(r.ctx, {
        set(target, prop, value) {
          if (prop === "globalCompositeOperation") modes.push(value);
          (target as unknown as Record<string, unknown>)[prop as string] = value;
          return true;
        },
      });
      drawRapSheet(handler, campaignSheet(dead), none, "post");
      return modes.includes("saturation");
    };
    expect(drained(true)).toBe(true);
    expect(drained(false)).toBe(false);
  });

  it("stamps the file by its status", () => {
    expect(draw(campaignSheet(true)).texts.map((t) => t.text)).toContain("FLATLINED");
    expect(draw(campaignSheet(false)).texts.map((t) => t.text)).toContain("ACTIVE");
    expect(draw(rapSheet(sourceFromCharacter(character()))).texts.map((t) => t.text)).toContain(
      "FILE OPEN",
    );
  });

  it("draws the same card for the same file, every time", () => {
    const a = draw(campaignSheet(), "story").calls.map((c) => c.name);
    const b = draw(campaignSheet(), "story").calls.map((c) => c.name);
    expect(a).toEqual(b);
  });

  it("is the shape that was asked for", () => {
    expect(RAP_FORMATS.post.width / RAP_FORMATS.post.height).toBeCloseTo(4 / 5);
    expect(RAP_FORMATS.story.width / RAP_FORMATS.story.height).toBeCloseTo(9 / 16);
  });
});
