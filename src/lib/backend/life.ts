/**
 * Backend adapter for the LIFE phase: persistent situations, clocks, and the
 * campaign clock. Like every module in /src/lib/backend, this is the only layer
 * allowed to touch the Cloud client.
 */
import { backendClient } from "./client";
import type { Campaign, CampaignClock, CampaignSituation, Json } from "./types";

function unwrap<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data as T;
}

/** Every situation on a campaign's books, live or otherwise. */
export async function listSituations(campaignId: string): Promise<CampaignSituation[]> {
  const res = await backendClient
    .from("campaign_situations")
    .select("*")
    .eq("campaign_id", campaignId)
    .order("created_at", { ascending: true });
  return unwrap(res) ?? [];
}

export type SituationUpsert = {
  situationKey: string;
  category: string;
  title: string;
  summary?: string | null;
  npcKey?: string | null;
  status?: string;
  severity?: number;
  dueDay?: number | null;
  lastShownDay?: number | null;
  data?: Json;
};

/** Create or update a situation by its stable key (unique per campaign). */
export async function upsertSituation(
  campaignId: string,
  input: SituationUpsert,
): Promise<CampaignSituation> {
  return unwrap(
    await backendClient
      .from("campaign_situations")
      .upsert(
        {
          campaign_id: campaignId,
          situation_key: input.situationKey,
          category: input.category,
          title: input.title,
          summary: input.summary ?? null,
          npc_key: input.npcKey ?? null,
          status: input.status ?? "live",
          severity: input.severity ?? 1,
          due_day: input.dueDay ?? null,
          last_shown_day: input.lastShownDay ?? null,
          ...(input.data ? { data: input.data } : {}),
        },
        { onConflict: "campaign_id,situation_key" },
      )
      .select("*")
      .single(),
  );
}

/** Write a batch of situations back in one round trip. */
export async function upsertSituations(
  campaignId: string,
  inputs: SituationUpsert[],
): Promise<CampaignSituation[]> {
  if (!inputs.length) return [];
  const rows = inputs.map((input) => ({
    campaign_id: campaignId,
    situation_key: input.situationKey,
    category: input.category,
    title: input.title,
    summary: input.summary ?? null,
    npc_key: input.npcKey ?? null,
    status: input.status ?? "live",
    severity: input.severity ?? 1,
    due_day: input.dueDay ?? null,
    last_shown_day: input.lastShownDay ?? null,
    ...(input.data ? { data: input.data } : {}),
  }));
  return (
    unwrap(
      await backendClient
        .from("campaign_situations")
        .upsert(rows, { onConflict: "campaign_id,situation_key" })
        .select("*"),
    ) ?? []
  );
}

export async function setSituationStatus(
  campaignId: string,
  situationKey: string,
  status: string,
): Promise<void> {
  const { error } = await backendClient
    .from("campaign_situations")
    .update({ status })
    .eq("campaign_id", campaignId)
    .eq("situation_key", situationKey);
  if (error) throw new Error(error.message);
}

/** Every clock on a campaign, hidden ones included (the UI filters). */
export async function listClocks(campaignId: string): Promise<CampaignClock[]> {
  const res = await backendClient
    .from("campaign_clocks")
    .select("*")
    .eq("campaign_id", campaignId)
    .order("created_at", { ascending: true });
  return unwrap(res) ?? [];
}

export type ClockUpsert = {
  clockKey: string;
  label: string;
  filled: number;
  segments: number;
  hidden?: boolean;
  data?: Json;
};

export async function upsertClock(campaignId: string, input: ClockUpsert): Promise<CampaignClock> {
  return unwrap(
    await backendClient
      .from("campaign_clocks")
      .upsert(
        {
          campaign_id: campaignId,
          clock_key: input.clockKey,
          label: input.label,
          filled: Math.max(0, Math.min(input.segments, Math.round(input.filled))),
          segments: Math.max(1, Math.round(input.segments)),
          hidden: input.hidden ?? false,
          ...(input.data ? { data: input.data } : {}),
        },
        { onConflict: "campaign_id,clock_key" },
      )
      .select("*")
      .single(),
  );
}

/** Move the in-world clock. The only place day + minute are written together. */
export async function setCampaignClock(
  campaignId: string,
  clock: { day: number; minute: number },
): Promise<Campaign> {
  return unwrap(
    await backendClient
      .from("campaigns")
      .update({ day: clock.day, minute: clock.minute })
      .eq("id", campaignId)
      .select("*")
      .single(),
  );
}

/** Move the campaign between phases. The app is authoritative, never the AI. */
export async function setCampaignPhase(campaignId: string, phase: string): Promise<Campaign> {
  return unwrap(
    await backendClient
      .from("campaigns")
      .update({ phase })
      .eq("id", campaignId)
      .select("*")
      .single(),
  );
}
