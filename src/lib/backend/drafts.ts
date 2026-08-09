import { backendClient } from "./client";
import type { ChargenDraft, Json } from "./types";

export async function getLatestDraft(): Promise<ChargenDraft | null> {
  const { data, error } = await backendClient
    .from("chargen_drafts")
    .select("*")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function saveDraft(userId: string, state: Json, id?: string): Promise<ChargenDraft> {
  const payload = id ? { id, user_id: userId, state } : { user_id: userId, state };
  const { data, error } = await backendClient
    .from("chargen_drafts")
    .upsert(payload, { onConflict: "id" })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function deleteDraft(id: string): Promise<void> {
  const { error } = await backendClient.from("chargen_drafts").delete().eq("id", id);
  if (error) throw new Error(error.message);
}