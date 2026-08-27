/**
 * Who is shooting at you, and how tough they are.
 *
 * The GM prompt used to hand the model a range to pick inside — "Mooks are
 * ordinary people: REF 5-7, BODY 5-6, HP 25-35, SP 7-11" — which made the
 * narrator the author of how hard every fight was. These pin the replacement:
 * a closed list the engine holds, and a fallback rather than an invention.
 */
import { describe, expect, it } from "vitest";
import {
  DEFAULT_FORCE_KEY,
  DEFAULT_THREAT_KEY,
  FORCES,
  FORCE_SIZES,
  THREAT_KEYS,
  THREAT_PROFILES,
  buildForce,
  combatNumber,
  describeForce,
  forceFor,
  isThreatKey,
  preferredRange,
  rollForceSize,
  seededRng,
  singleShotDV,
  threatFor,
  type ForceSize,
} from "@/engine";

describe("the threat table", () => {
  it("has a unique key for every profile", () => {
    expect(new Set(THREAT_KEYS).size).toBe(THREAT_PROFILES.length);
  });

  it("gives every profile numbers a fight can actually use", () => {
    for (const p of THREAT_PROFILES) {
      expect(p.ref).toBeGreaterThan(0);
      expect(p.body).toBeGreaterThan(0);
      expect(p.hp).toBeGreaterThan(0);
      expect(p.sp).toBeGreaterThanOrEqual(0);
      expect(p.attackSkill).toBeGreaterThanOrEqual(0);
      expect(p.damageDice).toBeGreaterThan(0);
      expect(p.move).toBeGreaterThan(0);
      expect(p.name.trim().length).toBeGreaterThan(2);
    }
  });

  it("gives every profile a range type the printed table knows", () => {
    // A range type the table has no column for would mean no DV, which means
    // the engine silently declines to resolve the attack at all.
    for (const p of THREAT_PROFILES) {
      expect(singleShotDV(p.rangeType, preferredRange(p.rangeType))).not.toBeNull();
    }
  });

  it("stays inside the published ladder it was calibrated against", () => {
    // The Lawman Backup table (roles.json) runs Combat 8 at the bottom to 16 at
    // the top. A profile outside that is not a Cyberpunk RED threat any more.
    for (const p of THREAT_PROFILES) {
      expect(combatNumber(p)).toBeGreaterThanOrEqual(8);
      expect(combatNumber(p)).toBeLessThanOrEqual(16);
    }
  });

  it("matches the published Backup rungs where it names one", () => {
    // Corporate Security is printed as Combat 8, SP 7, HP 20, MOVE 4.
    const corp = threatFor("corp_security");
    expect(combatNumber(corp)).toBe(8);
    expect(corp.sp).toBe(7);
    expect(corp.hp).toBe(20);
    expect(corp.move).toBe(4);

    // Beat Cops are printed as Combat 10, SP 7, HP 25, MOVE 5.
    const cop = threatFor("beat_cop");
    expect(combatNumber(cop)).toBe(10);
    expect(cop.hp).toBe(25);
    expect(cop.move).toBe(5);
  });

  it("makes a boss harder than a mook, which is the only reason tiers exist", () => {
    const mooks = THREAT_PROFILES.filter((p) => p.role === "mook");
    const bosses = THREAT_PROFILES.filter((p) => p.role === "boss");
    expect(mooks.length).toBeGreaterThan(0);
    expect(bosses.length).toBeGreaterThan(0);
    const worstBoss = Math.min(...bosses.map(combatNumber));
    const bestMook = Math.max(...mooks.map(combatNumber));
    expect(worstBoss).toBeGreaterThan(bestMook);
  });
});

describe("threatFor", () => {
  it("finds a profile the engine knows", () => {
    expect(threatFor("solo").name).toBe("Solo");
  });

  it("falls back rather than letting an invented threat become a real one", () => {
    expect(threatFor("cyber_dragon").key).toBe(DEFAULT_THREAT_KEY);
    expect(threatFor(null).key).toBe(DEFAULT_THREAT_KEY);
    expect(threatFor(undefined).key).toBe(DEFAULT_THREAT_KEY);
  });

  it("knows its own keys", () => {
    expect(isThreatKey("ganger")).toBe(true);
    expect(isThreatKey("cyber_dragon")).toBe(false);
    expect(isThreatKey(9)).toBe(false);
  });
});

describe("forces", () => {
  it("has a unique key for every force", () => {
    expect(new Set(FORCES.map((f) => f.key)).size).toBe(FORCES.length);
  });

  it("gives every force every size, and every size somebody in it", () => {
    for (const force of FORCES) {
      for (const size of FORCE_SIZES) {
        const members = buildForce(force, size);
        expect(members.length).toBeGreaterThan(0);
      }
    }
  });

  it("only names profiles the engine actually has", () => {
    for (const force of FORCES) {
      for (const size of FORCE_SIZES) {
        for (const entry of force.sizes[size]) {
          expect(isThreatKey(entry.profile)).toBe(true);
        }
      }
    }
  });

  it("gets bigger as the size goes up", () => {
    for (const force of FORCES) {
      const small = buildForce(force, "small").length;
      const standard = buildForce(force, "standard").length;
      const heavy = buildForce(force, "heavy").length;
      expect(standard).toBeGreaterThanOrEqual(small);
      expect(heavy).toBeGreaterThan(small);
    }
  });

  it("gets harder as the size goes up, not just longer", () => {
    // Four more thugs is a slog. The point of "heavy" is that somebody in it
    // outclasses anybody in "small".
    for (const force of FORCES) {
      const worst = (size: ForceSize) =>
        Math.max(...buildForce(force, size).map((m) => combatNumber(m.profile)));
      expect(worst("heavy")).toBeGreaterThanOrEqual(worst("small"));
    }
  });

  it("falls back to a street crew for a force nobody has heard of", () => {
    expect(forceFor("the moon patrol").key).toBe(DEFAULT_FORCE_KEY);
    expect(forceFor(null).key).toBe(DEFAULT_FORCE_KEY);
  });

  it("gives everyone in a force a distinct key", () => {
    for (const force of FORCES) {
      for (const size of FORCE_SIZES) {
        const keys = buildForce(force, size).map((m) => m.key);
        expect(new Set(keys).size).toBe(keys.length);
      }
    }
  });

  it("does not number somebody who is the only one of themselves", () => {
    const members = buildForce(forceFor("boostergang"), "heavy");
    const enforcer = members.find((m) => m.profile.key === "enforcer")!;
    expect(enforcer.name).toBe("Enforcer");
    const boosters = members.filter((m) => m.profile.key === "booster");
    expect(boosters[0]!.name).toBe("Boostergang Chromer 1");
  });

  it("is deterministic", () => {
    const a = buildForce(forceFor("corporate"), "standard");
    const b = buildForce(forceFor("corporate"), "standard");
    expect(a.map((m) => m.key)).toEqual(b.map((m) => m.key));
  });
});

describe("rollForceSize", () => {
  it("is deterministic for a seed", () => {
    expect(rollForceSize(seededRng(7))).toBe(rollForceSize(seededRng(7)));
  });

  it("produces every size across many seeds, and mostly standard", () => {
    // A run of jobs that are all trivial or all a bloodbath reads as noise.
    const counts: Record<string, number> = { small: 0, standard: 0, heavy: 0 };
    for (let seed = 0; seed < 400; seed += 1) counts[rollForceSize(seededRng(seed))]! += 1;
    for (const size of FORCE_SIZES) expect(counts[size]!).toBeGreaterThan(0);
    expect(counts["standard"]!).toBeGreaterThan(counts["small"]!);
    expect(counts["standard"]!).toBeGreaterThan(counts["heavy"]!);
  });
});

describe("describeForce", () => {
  it("counts repeats rather than listing them", () => {
    const line = describeForce(buildForce(forceFor("corporate"), "standard"));
    expect(line).toContain("4× Corporate Security");
    expect(line).toContain("Enforcer");
  });

  it("says so when nobody is waiting", () => {
    expect(describeForce([])).toBe("nobody");
  });
});
