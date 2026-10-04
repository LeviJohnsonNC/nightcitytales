/**
 * Settlement reads a job whole. These hold the adapter that does it to the two
 * things that went wrong before: a job longer than the old 2000-row window lost
 * its own start (so it could never be closed), and a page that comes back
 * smaller than asked for is not the end of the ledger.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

type Row = { seq: number; type: string };
let ledger: Row[] = [];
let pageCap = 1000;
const ranges: Array<[number, number]> = [];

vi.mock("../client", () => ({
  backendClient: {
    from: () => {
      const q: Record<string, unknown> = {};
      let gte = 0;
      let desc = false;
      let type: string | null = null;
      let limit = Infinity;
      let span: [number, number] | null = null;
      const chain = {
        select: () => chain,
        eq: (col: string, value: string) => {
          if (col === "type") type = value;
          return chain;
        },
        gte: (_col: string, value: number) => {
          gte = value;
          return chain;
        },
        order: (_col: string, o: { ascending: boolean }) => {
          desc = !o.ascending;
          return chain;
        },
        limit: (n: number) => {
          limit = n;
          return chain;
        },
        range: (from: number, to: number) => {
          span = [from, to];
          ranges.push([from, to]);
          return chain;
        },
        maybeSingle: async () => ({ data: run()[0] ?? null, error: null }),
        then: (resolve: (v: unknown) => void) => resolve({ data: run(), error: null }),
      };
      function run(): Row[] {
        let rows = ledger.filter((r) => r.seq >= gte && (type === null || r.type === type));
        rows = [...rows].sort((a, b) => (desc ? b.seq - a.seq : a.seq - b.seq));
        if (span) rows = rows.slice(span[0], Math.min(span[1] + 1, span[0] + pageCap));
        return rows.slice(0, limit);
      }
      void q;
      return chain;
    },
  },
}));

const { listCurrentJobEvents } = await import("../campaigns");

beforeEach(() => {
  ledger = [];
  pageCap = 1000;
  ranges.length = 0;
});

const rows = (n: number, from: number): Row[] =>
  Array.from({ length: n }, (_, i) => ({ seq: from + i, type: "narration" }));

describe("the current job's events", () => {
  it("is everything from the newest mission_started, however long the job ran", async () => {
    ledger = [
      { seq: 1, type: "mission_started" },
      ...rows(50, 2),
      { seq: 100, type: "mission_started" },
      ...rows(4500, 101),
    ];
    const events = await listCurrentJobEvents("c");
    expect(events).toHaveLength(4501);
    expect(events[0]).toMatchObject({ seq: 100, type: "mission_started" });
    expect(events.at(-1)?.seq).toBe(4600);
    expect(events.map((e) => e.seq)).toEqual([...events.map((e) => e.seq)].sort((a, b) => a - b));
  });

  it("does not take a short page for the end of the ledger", async () => {
    pageCap = 300;
    ledger = [{ seq: 1, type: "mission_started" }, ...rows(1000, 2)];
    expect(await listCurrentJobEvents("c")).toHaveLength(1001);
  });

  it("is empty when no job has started", async () => {
    ledger = rows(10, 1);
    expect(await listCurrentJobEvents("c")).toEqual([]);
  });
});
