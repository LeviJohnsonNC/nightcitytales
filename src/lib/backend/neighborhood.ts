import { backendClient } from "./client";
import type { Json } from "./types";

export async function commitNeighborhood(payload: Json) {
  const { error } = await backendClient.rpc("commit_neighborhood_action", { payload });
  if (error) throw new Error(error.message);
}
