/**
 * Generated portrait storage. Images live in the private "portraits" bucket
 * under ${user_id}/${draft_id}/${take_id}.png, owner-scoped by RLS, and are
 * read back through signed URLs. Drafts store the path, never the image bytes.
 */
import { backendClient } from "./client";

const BUCKET = "portraits";
const SIGNED_URL_TTL_SECONDS = 60 * 60 * 12;

const signedUrlCache = new Map<string, { url: string; expires: number }>();

export async function uploadPortrait(
  userId: string,
  draftId: string | null,
  blob: Blob,
): Promise<string> {
  const takeId = crypto.randomUUID();
  const path = `${userId}/${draftId ?? "unsaved"}/${takeId}.png`;
  const { error } = await backendClient.storage
    .from(BUCKET)
    .upload(path, blob, { contentType: "image/png", upsert: false });
  if (error) throw new Error(error.message);
  return path;
}

/** A signed, cached URL for a stored portrait path. */
export async function portraitUrl(path: string): Promise<string> {
  const cached = signedUrlCache.get(path);
  if (cached && cached.expires > Date.now() + 60_000) return cached.url;

  const { data, error } = await backendClient.storage
    .from(BUCKET)
    .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
  if (error || !data?.signedUrl) throw new Error(error?.message ?? "Could not load that portrait.");
  signedUrlCache.set(path, {
    url: data.signedUrl,
    expires: Date.now() + SIGNED_URL_TTL_SECONDS * 1000,
  });
  return data.signedUrl;
}
