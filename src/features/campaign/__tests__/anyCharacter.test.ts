/**
 * The standing six are rolled per campaign, and the character they surround
 * can have answered their Lifepath any way at all and live anywhere in the
 * city. This walks every Lifepath answer the cast reads, a spread of seeds and
 * every district through everything that hangs off a cast member, so a person
 * who only turns up for somebody else's character is as finished as the ones
 * who turned up in playtesting.
 */
import { describe, expect, it } from "vitest";
import lifepath from "@/data/rules/lifepath-general.json";
import content from "@/data/cast/cast-content.json";
import fit from "@/data/cast/lifepath-fit.json";
import {
  CAST_ROLES,
  DISTRICTS,
  LIFEPATH_FIT_IS_HOUSE_RULE,
  arcFor,
  generateCast,
  getPlace,
  hauntsFor,
  loverIsLost,
  type LifepathTies,
} from "@/engine";
import { findNpc } from "@/features/cast/npcDirectory";

type Table = { entries: (string | { value: string })[] };
const TABLES = (lifepath as unknown as { tables: Record<string, Table> }).tables;
function values(table: string): string[] {
  const t = TABLES[table];
  if (!t) throw new Error(`No Lifepath table ${table}`);
  return t.entries.map((e) => (typeof e === "string" ? e : e.value));
}

const FRIENDS = values("friends");
const WHO = values("enemy_who");
const LOVE = values("tragic_love");
const POOLS = content as unknown as Record<string, { names: string[] }>;
const FIT = fit as unknown as {
  enemyWho: Record<string, string[]>;
  tragicLove: Record<string, "lost" | string[]>;
};
const SEEDS = Array.from({ length: 12 }, (_, i) => i * 7919 + 3);

function tiesFor(i: number): LifepathTies {
  return {
    friend: FRIENDS[i % FRIENDS.length]!,
    enemy: { who: WHO[i % WHO.length]!, cause: "You just don't like each other." },
    tragicLove: LOVE[i % LOVE.length]!,
  };
}

describe("the fit table", () => {
  it("is a house rule, and names only real rolls and real people", () => {
    expect(LIFEPATH_FIT_IS_HOUSE_RULE).toBe(true);
    for (const [who, names] of Object.entries(FIT.enemyWho)) {
      expect(WHO).toContain(who);
      for (const name of names) expect(POOLS["enemy"]!.names).toContain(name);
    }
    for (const [love, rule] of Object.entries(FIT.tragicLove)) {
      expect(LOVE).toContain(love);
      if (rule !== "lost")
        for (const name of rule) expect(POOLS["old_flame"]!.names).toContain(name);
    }
  });
});

describe("any character's cast", () => {
  it("gives the enemy the Lifepath rolled a bio that can hold it", () => {
    for (const who of WHO) {
      const allowed = FIT.enemyWho[who];
      for (const seed of SEEDS) {
        const enemy = generateCast({ seed, ties: { enemy: { who } } }).find(
          (m) => m.role === "enemy",
        )!;
        if (allowed) expect(allowed).toContain(enemy.name);
        expect(enemy.tie).toContain(who);
      }
    }
  });

  it("never hands a living old flame a dead lover's history", () => {
    for (const love of LOVE) {
      for (const seed of SEEDS) {
        const flame = generateCast({ seed, ties: { tragicLove: love } }).find(
          (m) => m.role === "old_flame",
        )!;
        if (loverIsLost(love)) {
          expect(flame.tie).toMatch(/^Not the one you lost\./);
          expect(flame.tie).toContain(love);
        } else {
          expect(flame.tie).toBe(love);
        }
        const only = FIT.tragicLove[love];
        if (Array.isArray(only)) expect(only).toContain(flame.name);
      }
    }
  });

  it("leaves text a player typed alone", () => {
    const cast = generateCast({
      seed: 5,
      ties: { enemy: { who: "My old sergeant" }, tragicLove: "We married young." },
    });
    expect(cast.find((m) => m.role === "enemy")!.tie).toContain("My old sergeant");
    expect(cast.find((m) => m.role === "old_flame")!.tie).toBe("We married young.");
  });

  it("is a whole cast, with a bio, a story and somewhere to be, from anywhere", () => {
    for (let i = 0; i < 40; i += 1) {
      const seed = i * 104729 + 11;
      const cast = generateCast({ seed, ties: tiesFor(i) });
      expect(cast.map((m) => m.role)).toEqual([...CAST_ROLES]);
      expect(new Set(cast.map((m) => m.key)).size).toBe(6);
      for (const member of cast) {
        const entry = findNpc(member.name);
        expect(entry, member.name).not.toBeNull();
        expect(entry!.bio, member.name).toBeTruthy();
        expect(arcFor(member.role, `campaign-${i}:${member.key}`), member.name).toBeDefined();
      }
    }
    for (const district of DISTRICTS) {
      for (const role of CAST_ROLES) {
        const haunts = hauntsFor(role, district.key, "any-campaign");
        expect(haunts.length, `${role} in ${district.key}`).toBeGreaterThan(0);
        for (const key of haunts) expect(getPlace(key), key).toBeDefined();
      }
    }
  });
});
