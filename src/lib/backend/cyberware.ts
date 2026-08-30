import { backendClient } from "./client";
import type { Json } from "./types";

export type InstallCyberwarePayload = {
  campaign_id: string;
  request_id: string;
  ripperdoc_id: string;
  hook_situation_key: string | null;
  expected: { day: number; minute: number; eurobucks: number; humanity: number };
  implants: Array<{
    id: string;
    item_id: string;
    install_location: string | null;
    humanity_loss: number;
    foundational_for: string | null;
  }>;
  summary: string;
  roll: Json;
  receipt: Json;
};

/** Commit one engine-planned installation as an idempotent database boundary. */
export async function installCyberware(payload: InstallCyberwarePayload): Promise<Json> {
  const { data, error } = await backendClient.rpc("install_cyberware", {
    payload: payload as unknown as Json,
  });
  if (error) throw new Error(error.message);
  if (!data || typeof data !== "object") throw new Error("Installation returned no receipt.");
  return data;
}
