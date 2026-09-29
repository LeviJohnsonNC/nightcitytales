import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { fetchLedger, readLedgerFile } from "../../../../evals/ledgerSource";

/**
 * The loader for `bun run eval:replay`. It lives in `evals/`, which CI does not
 * run, but it has no network at import and its paging is exactly the kind of
 * code that is wrong quietly: a page too many, or one too few, reads as a smaller
 * ledger and nothing else.
 */

const env = {
  SUPABASE_URL: "https://example.supabase.co/",
  SUPABASE_SERVICE_ROLE_KEY: "service-secret",
};

const rowsOf = (count: number, from = 0) =>
  Array.from({ length: count }, (_, i) => ({
    id: `r${from + i}`,
    campaign_id: "c",
    type: "life_narration",
    summary: "x",
    data: {},
    created_at: "2026-09-29T00:00:00Z",
  }));

/** A fake PostgREST holding `total` rows, answering Range requests. */
function fakeServer(total: number) {
  const calls: { url: string; headers: Record<string, string> }[] = [];
  const fetchFn = (async (url: string, init?: { headers?: Record<string, string> }) => {
    const headers = init?.headers ?? {};
    calls.push({ url, headers });
    const [start, end] = (headers["Range"] ?? "0-999").split("-").map(Number) as [number, number];
    if (start >= total && total > 0) return new Response("", { status: 416 });
    const page = rowsOf(Math.max(0, Math.min(end + 1, total) - start), start);
    return new Response(JSON.stringify(page), { status: page.length < total ? 206 : 200 });
  }) as unknown as typeof fetch;
  return { fetchFn, calls };
}

describe("fetching the ledger", () => {
  it("reads every page, and stops on a short one", async () => {
    const { fetchFn, calls } = fakeServer(2234);
    const { rows } = await fetchLedger({}, env, fetchFn);
    expect(rows).toHaveLength(2234);
    expect(calls.map((c) => c.headers["Range"])).toEqual(["0-999", "1000-1999", "2000-2999"]);
  });

  it("stops cleanly when the total is an exact multiple of the page", async () => {
    const { fetchFn } = fakeServer(2000);
    expect((await fetchLedger({}, env, fetchFn)).rows).toHaveLength(2000);
  });

  it("copes with an empty ledger", async () => {
    const { fetchFn } = fakeServer(0);
    expect((await fetchLedger({}, env, fetchFn)).rows).toEqual([]);
  });

  it("asks only for narration events, oldest first, and from a date when given one", async () => {
    const { fetchFn, calls } = fakeServer(3);
    await fetchLedger({ since: "2026-09-20" }, env, fetchFn);
    const q = new URL(calls[0]!.url).searchParams;
    expect(q.get("type")).toBe("in.(gm_narration,life_narration,life_options)");
    expect(q.get("order")).toBe("created_at.asc,id.asc");
    expect(q.get("created_at")).toBe("gte.2026-09-20");
    expect(calls[0]!.url.startsWith("https://example.supabase.co/rest/v1/campaign_events")).toBe(
      true,
    );
  });

  it("uses the service key when there is one, and a user's token otherwise", async () => {
    const a = fakeServer(1);
    const service = await fetchLedger({}, env, a.fetchFn);
    expect(a.calls[0]!.headers["Authorization"]).toBe("Bearer service-secret");
    expect(service.scope).toContain("every campaign");

    const b = fakeServer(1);
    const user = await fetchLedger(
      {},
      {
        SUPABASE_URL: "https://x.co",
        SUPABASE_PUBLISHABLE_KEY: "pub",
        SUPABASE_ACCESS_TOKEN: "tok",
      },
      b.fetchFn,
    );
    expect(b.calls[0]!.headers["apikey"]).toBe("pub");
    expect(b.calls[0]!.headers["Authorization"]).toBe("Bearer tok");
    expect(user.scope).toContain("owns");
  });

  it("says what is missing, and never echoes a key in an error", async () => {
    await expect(fetchLedger({}, {}, fakeServer(1).fetchFn)).rejects.toThrow(/SUPABASE_URL/);
    await expect(
      fetchLedger({}, { SUPABASE_URL: "https://x.co" }, fakeServer(1).fetchFn),
    ).rejects.toThrow(/No way in/);
    const failing = (async () =>
      new Response("permission denied", { status: 401 })) as unknown as typeof fetch;
    const error = await fetchLedger({}, env, failing).catch((e: Error) => e.message);
    expect(error).toContain("401");
    expect(error).not.toContain("service-secret");
  });
});

describe("reading a saved ledger", () => {
  const save = (contents: unknown) => {
    const path = join(mkdtempSync(join(tmpdir(), "ledger-")), "rows.json");
    writeFileSync(path, JSON.stringify(contents));
    return path;
  };

  it("takes an array, or an object with rows", () => {
    expect(readLedgerFile(save(rowsOf(2)))).toHaveLength(2);
    expect(readLedgerFile(save({ rows: rowsOf(3) }))).toHaveLength(3);
  });

  it("refuses anything else", () => {
    expect(() => readLedgerFile(save({ hello: 1 }))).toThrow(/array/);
  });
});
