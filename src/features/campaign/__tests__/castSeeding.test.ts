import { describe, expect, it } from "vitest";
import {
  GUARDED_AT,
  SUSPICION_COOLS_AFTER_DAYS,
  generateCast,
  isGuarded,
  publicView,
  REVEAL_LADDER,
  type CastMember,
} from "@/engine";
import type { CampaignNpc, FullCharacter } from "@/lib/backend";
import {
  castFrom,
  castMemberFrom,
  castMemberInRole,
  guardednessOf,
  knownFactsOf,
  lifepathTiesFrom,
  suspicionOf,
} from "../castSeeding";

/**
 * Exactly how lifeModel builds the people block: read the row back, read what
 * has been learned, and hand over only the public half.
 */
function viewsOf(rows: CampaignNpc[]) {
  return rows.flatMap((row) => {
    const member = castMemberFrom(row);
    return member ? [publicView(member, knownFactsOf(row))] : [];
  });
}

/** A row shaped the way ensureCast writes one. */
function rowFor(member: CastMember, known: string[] = []): CampaignNpc {
  return {
    id: `row-${member.key}`,
    campaign_id: "campaign-1",
    npc_id: member.key,
    name: member.name,
    disposition: member.disposition,
    status: "alive",
    notes: null,
    data: {
      role: member.role,
      standing: member.standing,
      tie: member.tie,
      dossier: member.dossier,
      known,
      lastSeenDay: 0,
    },
  } as unknown as CampaignNpc;
}

function characterWith(general: unknown): FullCharacter {
  return { lifepath: { general } } as unknown as FullCharacter;
}

const CAST = generateCast({ seed: 0x51ee7 });

describe("reading the character's Lifepath", () => {
  it("pulls the friend, the enemy and the one that ended badly", () => {
    const ties = lifepathTiesFrom(
      characterWith({
        friends: [{ tableId: "friends", value: "A teacher or mentor.", method: "rolled" }],
        enemies: [
          {
            who: { value: "Ex-lover" },
            cause: { value: "Caused a major public humiliation." },
            throwAtYou: { value: "Themselves and a few friends." },
          },
        ],
        tragicLove: [{ value: "Your lover mysteriously vanished." }],
      }),
    );
    expect(ties.friend).toBe("A teacher or mentor.");
    expect(ties.tragicLove).toBe("Your lover mysteriously vanished.");
    expect(ties.enemy?.who).toBe("Ex-lover");
    expect(ties.enemy?.cause).toBe("Caused a major public humiliation.");
  });

  it("prefers the printed table value over a player's rewording", () => {
    const ties = lifepathTiesFrom(
      characterWith({ friends: [{ value: "A teacher or mentor.", custom: "old Sifu" }] }),
    );
    expect(ties.friend).toBe("A teacher or mentor.");
  });

  it("survives a character who answered none of it", () => {
    expect(lifepathTiesFrom(characterWith({}))).toEqual({
      friend: null,
      enemy: null,
      tragicLove: null,
    });
    expect(lifepathTiesFrom({ lifepath: null } as unknown as FullCharacter).friend).toBeNull();
  });

  it("survives rows that are the wrong shape entirely", () => {
    const ties = lifepathTiesFrom(
      characterWith({ friends: "not an array", enemies: [42], tragicLove: [null] }),
    );
    expect(ties.friend).toBeNull();
    expect(ties.tragicLove).toBeNull();
    expect(ties.enemy).toBeNull();
  });
});

describe("rows in, people out", () => {
  it("round-trips a cast member through a row", () => {
    const member = CAST[0]!;
    expect(castMemberFrom(rowFor(member))).toEqual(member);
  });

  it("does not mistake an ordinary NPC for one of the six", () => {
    const stranger = {
      id: "row-x",
      npc_id: "some_guard",
      name: "A guard",
      disposition: 0,
      status: "alive",
      data: { opposition: { stats: { cool: 5 }, skills: {} } },
    } as unknown as CampaignNpc;
    expect(castMemberFrom(stranger)).toBeNull();
    expect(castFrom([stranger])).toEqual([]);
  });

  it("refuses a half-written dossier rather than serving blanks", () => {
    const broken = rowFor(CAST[0]!);
    (broken.data as Record<string, unknown>)["dossier"] = { wants: "something" };
    expect(castMemberFrom(broken)).toBeNull();
  });

  it("finds who holds a given job", () => {
    const rows = CAST.map((m) => rowFor(m));
    expect(castMemberInRole(rows, "fixer")?.role).toBe("fixer");
    expect(castMemberInRole([], "fixer")).toBeNull();
  });

  it("reads back only facts that are on the reveal ladder", () => {
    expect(knownFactsOf(rowFor(CAST[0]!, ["wants", "breakingPoint", "nonsense"]))).toEqual([
      "wants",
    ]);
    expect(knownFactsOf(null)).toEqual([]);
  });
});

describe("what leaves this module", () => {
  it("never carries an unlearned secret", () => {
    const rows = CAST.map((m) => rowFor(m));
    const rendered = JSON.stringify(viewsOf(rows));
    for (const member of CAST) {
      expect(rendered).not.toContain(member.dossier.wants);
      expect(rendered).not.toContain(member.dossier.fear);
      expect(rendered).not.toContain(member.dossier.secret);
      expect(rendered).not.toContain(member.dossier.breakingPoint);
    }
  });

  it("carries exactly what was learned, once it is learned", () => {
    const member = CAST[0]!;
    const view = viewsOf([rowFor(member, ["wants", "fear"])])[0]!;
    expect(view.known).toHaveLength(2);
    expect(JSON.stringify(view)).toContain(member.dossier.wants);
    expect(JSON.stringify(view)).toContain(member.dossier.fear);
    expect(JSON.stringify(view)).not.toContain(member.dossier.secret);
  });

  it("never carries a breaking point, even from a fully read person", () => {
    const member = CAST[0]!;
    const view = viewsOf([rowFor(member, [...REVEAL_LADDER])])[0]!;
    expect(JSON.stringify(view)).not.toContain(member.dossier.breakingPoint);
  });

  it("still carries the public half", () => {
    const view = viewsOf([rowFor(CAST[0]!)])[0]!;
    expect(view.name).toBe(CAST[0]!.name);
    expect(view.standing).toBe(CAST[0]!.standing);
    expect(view.role).toBe(CAST[0]!.role);
  });
});

/**
 * Suspicion rides in the row's `data`, beside the rungs they have given up and
 * the day they were last dealt with — so the one new axis in the social system
 * needed no column and no migration.
 */
describe("how guarded somebody is, off the row", () => {
  const member = CAST[0]!;

  /** A row as `raiseNpcSuspicion` leaves one. */
  const worked = (points: number, onDay: number): CampaignNpc => {
    const row = rowFor(member);
    const data = (row.data ?? {}) as Record<string, unknown>;
    return { ...row, data: { ...data, suspicion: { points, onDay } } } as CampaignNpc;
  };

  it("reads nothing off a person nobody has worked", () => {
    expect(suspicionOf(rowFor(member))).toBeNull();
    expect(guardednessOf(rowFor(member), 12)).toBe(0);
    expect(guardednessOf(null, 12)).toBe(0);
  });

  it("reads back what was written, and cools it with the days", () => {
    const row = worked(GUARDED_AT, 10);
    expect(suspicionOf(row)).toEqual({ points: GUARDED_AT, onDay: 10 });
    expect(isGuarded(guardednessOf(row, 10))).toBe(true);
    expect(isGuarded(guardednessOf(row, 10 + SUSPICION_COOLS_AFTER_DAYS * GUARDED_AT))).toBe(false);
  });

  it("ignores a suspicion field that is not one", () => {
    // Rows written before this existed, and anything hand-edited into the JSON
    // blob, must read as "nobody has worked them" rather than throwing.
    for (const junk of [7, "high", null, {}, { points: "3", onDay: 1 }]) {
      const row = rowFor(member);
      const data = (row.data ?? {}) as Record<string, unknown>;
      const mangled = { ...row, data: { ...data, suspicion: junk } } as CampaignNpc;
      expect(suspicionOf(mangled)).toBeNull();
      expect(guardednessOf(mangled, 3)).toBe(0);
    }
  });

  it("keeps the number out of the public half and the boolean in it", () => {
    const row = worked(GUARDED_AT + 4, 2);
    const view = publicView(member, [], isGuarded(guardednessOf(row, 2)));
    expect(view.guarded).toBe(true);
    expect(JSON.stringify(view)).not.toContain(String(GUARDED_AT + 4));
  });
});
