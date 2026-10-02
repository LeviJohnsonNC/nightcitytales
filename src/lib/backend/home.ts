import { backendClient } from "./client";
import type { Json } from "./types";

/** The payload `move_house` accepts. Field names are the SQL's. */
export type MoveHousePayload = {
  campaign_id: string;
  request_id: string;
  summary: string;
  expected: { day: number; minute: number; eurobucks: number; bills_paid_through_day: number };
  move: {
    from_place: string | null;
    from_housing: string;
    from_lifestyle: string;
    to_place: string | null;
    to_housing: string;
    to_lifestyle: string;
    deposit: number;
    rent: number;
    lifestyle_cost: number;
    day_after: number;
    minute_after: number;
  };
};

/**
 * Commit one engine-planned move: deposit, new home, clock and receipt in one
 * transaction. Idempotent on `request_id`. Returns the receipt's data.
 */
export async function moveHouse(payload: MoveHousePayload): Promise<Json> {
  const { data, error } = await backendClient.rpc("move_house", {
    payload: payload as unknown as Json,
  });
  if (error) throw new Error(error.message);
  if (!data || typeof data !== "object") throw new Error("The move returned no receipt.");
  return data;
}
