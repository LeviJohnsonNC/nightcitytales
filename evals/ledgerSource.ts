/**
 * Where ledger rows come from: a file, or the project's own database.
 *
 * Plain `fetch` against PostgREST, not the Supabase client. This runs on a
 * developer's machine against their own project, and `src/lib/backend/` is the
 * application's adapter; a script that borrowed it would be application code
 * that reads other people's campaigns. Nothing here is imported by anything that
 * ships.
 *
 * Two ways in, and the difference matters:
 *
 *   SUPABASE_SERVICE_ROLE_KEY   every campaign in the project. It bypasses RLS
 *                               entirely, so keep it on your machine, never in a
 *                               commit, a log or a browser (AGENTS.md).
 *   SUPABASE_ACCESS_TOKEN       a signed-in user's token, with the publishable
 *                               key: only that user's own campaigns, through RLS.
 *
 * Neither key is ever printed. An error reports the status and a short piece of
 * the body, which PostgREST does not fill with credentials.
 */
import { readFileSync } from "node:fs";
import { NARRATION_TYPES, type LedgerRow } from "../src/features/narration/ledgerReplay";

const PAGE = 1000;
const COLUMNS = "id,campaign_id,type,summary,data,created_at";

export type LedgerQuery = {
  /** Only turns at or after this ISO date. */
  since?: string;
};

/** Rows saved from the dashboard or a query: a JSON array, or `{ rows: [...] }`. */
export function readLedgerFile(path: string): LedgerRow[] {
  const parsed: unknown = JSON.parse(readFileSync(path, "utf8"));
  const list = Array.isArray(parsed)
    ? parsed
    : parsed && typeof parsed === "object" && Array.isArray((parsed as { rows?: unknown }).rows)
      ? (parsed as { rows: unknown[] }).rows
      : null;
  if (!list) throw new Error(`${path}: expected a JSON array of campaign_events rows.`);
  return list as LedgerRow[];
}

type Env = Record<string, string | undefined>;

function credentials(env: Env): { url: string; headers: Record<string, string>; scope: string } {
  const url = env["SUPABASE_URL"] ?? env["VITE_SUPABASE_URL"];
  if (!url) throw new Error("Set SUPABASE_URL (it is in .env.example), or pass --file.");
  const service = env["SUPABASE_SERVICE_ROLE_KEY"];
  if (service) {
    return {
      url,
      headers: { apikey: service, Authorization: `Bearer ${service}` },
      scope: "every campaign in the project",
    };
  }
  const anon = env["SUPABASE_PUBLISHABLE_KEY"] ?? env["VITE_SUPABASE_PUBLISHABLE_KEY"];
  const token = env["SUPABASE_ACCESS_TOKEN"];
  if (anon && token) {
    return {
      url,
      headers: { apikey: anon, Authorization: `Bearer ${token}` },
      scope: "the campaigns the token's user owns",
    };
  }
  throw new Error(
    "No way in. Set SUPABASE_SERVICE_ROLE_KEY (every campaign; keep it local), or " +
      "SUPABASE_ACCESS_TOKEN with SUPABASE_PUBLISHABLE_KEY (one user's campaigns), or pass --file.",
  );
}

/**
 * Every narration row, oldest first, a page at a time.
 * `fetchFn` is injectable so the paging can be exercised without a database.
 */
export async function fetchLedger(
  query: LedgerQuery = {},
  env: Env = process.env,
  fetchFn: typeof fetch = fetch,
): Promise<{ rows: LedgerRow[]; scope: string }> {
  const { url, headers, scope } = credentials(env);
  const rows: LedgerRow[] = [];
  const types = NARRATION_TYPES.join(",");
  for (let from = 0; ; from += PAGE) {
    const params = new URLSearchParams({
      select: COLUMNS,
      type: `in.(${types})`,
      order: "created_at.asc,id.asc",
    });
    if (query.since) params.append("created_at", `gte.${query.since}`);
    const res = await fetchFn(`${url.replace(/\/$/, "")}/rest/v1/campaign_events?${params}`, {
      headers: { ...headers, Range: `${from}-${from + PAGE - 1}`, "Range-Unit": "items" },
    });
    // A page that starts past the end: when the total is an exact multiple of the
    // page size, the last full page is followed by one that asks for rows that
    // are not there.
    if (res.status === 416) return { rows, scope };
    if (!res.ok && res.status !== 206) {
      const body = (await res.text()).slice(0, 200);
      throw new Error(`campaign_events returned ${res.status}: ${body}`);
    }
    const page = (await res.json()) as LedgerRow[];
    rows.push(...page);
    if (page.length < PAGE) return { rows, scope };
  }
}
