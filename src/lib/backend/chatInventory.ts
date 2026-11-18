import { backendClient } from "./client";
import type { Json } from "./types";
import type { Database } from "@/integrations/supabase/types";

function unwrap<T>(result: { data: T | null; error: { message: string } | null }): T {
  if (result.error) throw new Error(result.error.message);
  return result.data as T;
}

type SceneItems = Database["public"]["Tables"]["campaign_scene_items"];
export type SceneItem = SceneItems["Row"];

export async function listSceneItems(
  campaignId: string,
  locationKey: string,
): Promise<SceneItem[]> {
  return (
    unwrap(
      await backendClient
        .from("campaign_scene_items")
        .select("*")
        .eq("campaign_id", campaignId)
        .eq("location_key", locationKey)
        .order("quantity", { ascending: false }),
    ) ?? []
  );
}

export async function putSceneItems(items: SceneItems["Insert"][]): Promise<void> {
  if (!items.length) return;
  unwrap(
    await backendClient.from("campaign_scene_items").upsert(items, {
      onConflict: "campaign_id,location_key,origin_key",
      ignoreDuplicates: true,
    }),
  );
}

export async function commitChatInventory(payload: Json): Promise<Json> {
  return unwrap(await backendClient.rpc("commit_chat_inventory", { payload }));
}
