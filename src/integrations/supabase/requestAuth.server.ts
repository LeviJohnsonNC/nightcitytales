/**
 * Server-side authentication for an HTTP route.
 *
 * `requireSupabaseAuth` in auth-middleware.ts is a `createMiddleware({ type:
 * "function" })`, so it only reaches server FUNCTIONS. A file route's handler
 * (src/routes/api/*) gets a bare Request and never runs it — which is how
 * /api/generate-portrait came to bill image generation for anyone who could
 * reach the URL. This is the same check, shaped for a Request.
 *
 * It duplicates about fifteen lines of that middleware on purpose:
 * auth-middleware.ts is generated and carries "Do not edit it directly", so the
 * shared helper cannot live there. Keep the two in step by hand — both do
 * nothing more than verify a Bearer JWT with `auth.getClaims` and read `sub`.
 *
 * `.server.ts` so it never reaches the client bundle.
 */
import { createClient } from "@supabase/supabase-js";

/** Thrown when a request carries no usable session. Callers answer 401. */
export class UnauthorizedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnauthorizedError";
  }
}

/**
 * The authenticated user's id, or a thrown UnauthorizedError.
 *
 * Authorization is the point: this says WHO is calling, so a paid endpoint can
 * refuse a stranger and meter a user. It is not a substitute for RLS on any
 * data the handler goes on to touch.
 */
export async function requireUserId(request: Request): Promise<string> {
  const SUPABASE_URL = process.env["SUPABASE_URL"];
  const SUPABASE_PUBLISHABLE_KEY = process.env["SUPABASE_PUBLISHABLE_KEY"];
  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
    // A misconfigured server must not read as "everybody is welcome".
    throw new UnauthorizedError("Authentication is not configured for this app.");
  }

  const authHeader = request.headers.get("authorization");
  if (!authHeader) throw new UnauthorizedError("No authorization header provided");
  if (!authHeader.startsWith("Bearer "))
    throw new UnauthorizedError("Only Bearer tokens are supported");

  const token = authHeader.slice("Bearer ".length);
  if (!token) throw new UnauthorizedError("No token provided");
  if (token.split(".").length !== 3) throw new UnauthorizedError("Invalid token");

  const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await supabase.auth.getClaims(token);
  if (error || !data?.claims?.sub) throw new UnauthorizedError("Invalid token");
  return data.claims.sub;
}
