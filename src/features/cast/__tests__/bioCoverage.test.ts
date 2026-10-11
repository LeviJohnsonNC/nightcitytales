/**
 * Every person the game can put in front of the player has a dossier, and
 * every dossier belongs to somebody the game can put there.
 *
 * The standing six are drawn from the pools in cast-content.json (and, for an
 * enemy or a lost love, filtered by lifepath-fit.json); the dossier modal finds
 * them by name through the NPC directory and reads CAST_BIOS by its id. A pool
 * name with no directory entry, or an entry with no bio, opens a portrait with
 * nothing under it. A bio keyed to an id nothing has is dead copy.
 */
import { describe, expect, it } from "vitest";
import content from "@/data/cast/cast-content.json";
import fit from "@/data/cast/lifepath-fit.json";
import { CAST_BIOS } from "../castBios";
import { WORLD_BIOS } from "../worldBios";
import { NPC_DIRECTORY, findNpc } from "../npcDirectory";

const POOLS = Object.entries(content).filter(([key]) => key !== "_about") as [
  string,
  { names: string[] },
][];
const ids = new Set(NPC_DIRECTORY.map((n) => n.id));

describe("cast pools and their dossiers", () => {
  it("has pools to check", () => {
    expect(POOLS.length).toBeGreaterThanOrEqual(6);
    for (const [, pool] of POOLS) expect(pool.names.length).toBeGreaterThan(0);
  });

  it("finds every pool member in the directory as standing cast", () => {
    for (const [role, pool] of POOLS)
      for (const name of pool.names) {
        const npc = findNpc(name);
        expect(npc, `${role}: ${name}`).not.toBeNull();
        expect(npc!.kind, name).toBe("cast");
      }
  });

  it("gives every pool member their own hand-written bio", () => {
    for (const [, pool] of POOLS)
      for (const name of pool.names) {
        const npc = findNpc(name)!;
        expect(CAST_BIOS[npc.id], name).toBeTruthy();
        expect(npc.bio).toBe(CAST_BIOS[npc.id]);
      }
  });

  it("has a bio for exactly the pool members, and no one else", () => {
    const poolIds = new Set(POOLS.flatMap(([, p]) => p.names.map((n) => findNpc(n)!.id)));
    expect(new Set(Object.keys(CAST_BIOS))).toEqual(poolIds);
  });

  it("finds every person lifepath-fit can choose", () => {
    const named = [
      ...Object.values(fit.enemyWho as Record<string, unknown>),
      ...Object.values(fit.tragicLove as Record<string, unknown>),
    ].flatMap((v) => (Array.isArray(v) ? (v as string[]) : []));
    expect(named.length).toBeGreaterThan(0);
    for (const name of named) {
      const npc = findNpc(name);
      expect(npc, name).not.toBeNull();
      expect(CAST_BIOS[npc!.id], name).toBeTruthy();
    }
  });
});

describe("no orphan dossiers", () => {
  it("keys every cast bio to a directory entry", () => {
    for (const id of Object.keys(CAST_BIOS)) expect(ids.has(id), id).toBe(true);
  });

  it("keys every world bio to a directory entry", () => {
    for (const id of Object.keys(WORLD_BIOS)) expect(ids.has(id), id).toBe(true);
  });

  it("never files one person in both books", () => {
    for (const id of Object.keys(WORLD_BIOS)) expect(CAST_BIOS[id], id).toBeUndefined();
  });

  it("has no empty bios", () => {
    for (const [id, bio] of [...Object.entries(CAST_BIOS), ...Object.entries(WORLD_BIOS)])
      expect(bio.trim().length, id).toBeGreaterThan(200);
  });

  it("resolves a bio for every directory entry", () => {
    expect(NPC_DIRECTORY.filter((n) => n.bio === null).map((n) => n.id)).toEqual([]);
  });

  it("gives a numbered variant its archetype's dossier", () => {
    for (const npc of NPC_DIRECTORY.filter((n) => /-\d+$/.test(n.id))) {
      const archetype = npc.id.replace(/-\d+$/, "");
      const own = CAST_BIOS[npc.id] ?? WORLD_BIOS[npc.id];
      if (!own) expect(npc.bio, npc.id).toBe(CAST_BIOS[archetype] ?? WORLD_BIOS[archetype] ?? null);
    }
  });
});
